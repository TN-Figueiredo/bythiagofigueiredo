import { describe, it, expect, vi, beforeEach } from 'vitest'

const { SITE } = vi.hoisted(() => ({ SITE: 'site-sessao' }))
const settle = vi.fn()
const denyUnlessSiteAdmin = vi.fn()
const varianteOriginalId = vi.fn()
const requireSiteScope = vi.fn()
const linha = vi.fn()
const atualiza = vi.fn()
const tentar = vi.fn()

vi.mock('@/lib/youtube/ab-restore-acoes', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/ab-restore-acoes')>()),
  tentarAgora: (...a: unknown[]) => tentar(...a),
}))
vi.mock('@/lib/youtube/ab-settle', () => ({ settleOnAir: (...a: unknown[]) => settle(...a), ORIGINAL: { tipo: 'original' } }))
vi.mock('@/lib/youtube/ab-acao-saida', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/ab-acao-saida')>()),
  varianteOriginalId: (...a: unknown[]) => varianteOriginalId(...a),
}))
vi.mock('@/lib/cms/auth-guards', () => ({ denyUnlessSiteAdmin: (...a: unknown[]) => denyUnlessSiteAdmin(...a) }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: SITE }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => linha() }) }) }),
      update: (...u: unknown[]) => {
        const cad = { eq: (...e: unknown[]) => { eqs.push(e); return cad }, select: () => atualiza(u, eqs) }
        const eqs: unknown[][] = []
        return cad
      },
    }),
  }),
}))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ getChannelTier: vi.fn() }))
vi.mock('@/lib/youtube/prompt-scoring', () => ({ scoreForPrompt: vi.fn() }))

import { aplicarSugerido } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { ehVitoriaHumana } from '@/lib/youtube/ab-types'
import { MSG_JA_ENCERRADO, MSG_SEM_PERMISSAO_VARIANTE } from '@/lib/youtube/ab-acao-saida'

const OK = { data: { completed_reason: 'regra_v2', status: 'completed', result_metadata: { v2: { vencedor_sugerido: 'B' } } }, error: null }
const FEITO = { resultado: 'feito', campos: {} }

beforeEach(() => {
  vi.clearAllMocks()
  settle.mockResolvedValue(FEITO)
  denyUnlessSiteAdmin.mockResolvedValue(null)
  varianteOriginalId.mockResolvedValue('A')
  requireSiteScope.mockResolvedValue({ ok: true })
  linha.mockResolvedValue(OK)
})

describe('aplicarSugerido (T11b)', () => {
  it('sugerido bate e é regra_v2: chama settleOnAir(aplicar_sugerido) com o seq visto', async () => {
    const r = await aplicarSugerido('t1', 'B', 9)
    expect(settle).toHaveBeenCalledWith('t1', { siteId: SITE, destino: { tipo: 'variante', id: 'B' }, motivo: 'aplicar_sugerido', humano: true, seqEsperado: 9 })
    expect(r).toMatchObject({ ok: true, resultado: 'feito' })
  })
  it('exige admin do site (variante no canal): sem permissão não toca no banco nem no settle', async () => {
    denyUnlessSiteAdmin.mockResolvedValueOnce({ error: 'negado' })
    expect(await aplicarSugerido('t1', 'B', 9)).toEqual({ ok: false, resultado: 'sem_permissao', error: 'negado' })
    expect(linha).not.toHaveBeenCalled(); expect(settle).not.toHaveBeenCalled()
  })
  it('sessão expirada vira sem_permissao', async () => {
    requireSiteScope.mockResolvedValueOnce({ ok: false, reason: 'unauthenticated' })
    expect(await aplicarSugerido('t1', 'B', 9)).toEqual({ ok: false, resultado: 'sem_permissao', error: 'unauthenticated' })
    expect(settle).not.toHaveBeenCalled()
  })
  it.each([
    ['variante diferente do sugerido', 'C', OK],
    ['teste não é regra_v2', 'B', { data: { completed_reason: 'manual_winner', status: 'completed', result_metadata: { v2: { vencedor_sugerido: 'B' } } }, error: null }],
    ['sem sugerido', 'B', { data: { completed_reason: 'regra_v2', status: 'completed', result_metadata: { v2: { vencedor_sugerido: null } } }, error: null }],
    ['sem result_metadata', 'B', { data: { completed_reason: 'regra_v2', status: 'completed', result_metadata: null }, error: null }],
    ['teste de outro site (sem linha)', 'B', { data: null, error: null }],
  ])('ja_encerrado quando %s, sem settleOnAir', async (_n, varianteId, resp) => {
    linha.mockResolvedValueOnce(resp)
    expect(await aplicarSugerido('t1', varianteId, 9)).toEqual({ ok: false, resultado: 'ja_encerrado', error: MSG_JA_ENCERRADO })
    expect(settle).not.toHaveBeenCalled()
  })
  describe('B2: a original vence', () => {
    const ORIG = (v2: object = {}) => ({ data: { completed_reason: 'regra_v2', status: 'completed', restore_seq: 9, result_metadata: { v2: { vencedor_sugerido: 'A', ...v2 } } }, error: null })
    beforeEach(() => { atualiza.mockResolvedValue({ data: [{ id: 't1' }], error: null }); linha.mockResolvedValue(ORIG()) })
    it('original já no ar: manual_winner com a original, sem settleOnAir nem YouTube', async () => {
      const r = await aplicarSugerido('t1', 'A', 9)
      expect(r).toMatchObject({ ok: true, resultado: 'feito' })
      expect(atualiza).toHaveBeenCalledTimes(1)
      const [[upd], eqs] = atualiza.mock.calls[0]! as [[Record<string, unknown>], unknown[][]]
      expect(upd).toEqual({ completed_reason: 'manual_winner', winner_variant_id: 'A' })
      expect(eqs).toEqual(expect.arrayContaining([['id', 't1'], ['site_id', SITE], ['completed_reason', 'regra_v2'], ['restore_seq', 9]]))
      expect(settle).not.toHaveBeenCalled(); expect(tentar).not.toHaveBeenCalled()
    })
    it('a vitória da original não conta como vitória de variante no winRate', () => {
      expect(ehVitoriaHumana({ completed_reason: 'manual_winner', winner_variant_id: 'A', winner_is_original: true })).toBe(false)
      expect(ehVitoriaHumana({ completed_reason: 'manual_winner', winner_variant_id: 'B', winner_is_original: false })).toBe(true)
    })
    it('volta_falhou: delega a novaTentativa (tentarAgora) e não grava nada', async () => {
      linha.mockResolvedValue(ORIG({ volta_falhou: { em: '2026-10-20' } }))
      tentar.mockResolvedValue(FEITO)
      const r = await aplicarSugerido('t1', 'A', 9)
      expect(tentar).toHaveBeenCalledTimes(1)
      expect(tentar.mock.calls[0]!.slice(1, 4)).toEqual(['t1', SITE, 9])
      expect(r).toMatchObject({ ok: true, resultado: 'feito' })
      expect(atualiza).not.toHaveBeenCalled(); expect(settle).not.toHaveBeenCalled()
    })
    it('seq mudou (CAS não casou): mudou, sem sucesso falso', async () => {
      atualiza.mockResolvedValue({ data: [], error: null })
      expect(await aplicarSugerido('t1', 'A', 9)).toMatchObject({ ok: false, resultado: 'mudou' })
    })
    it('erro do banco ao gravar: erro', async () => {
      atualiza.mockResolvedValue({ data: null, error: { message: 'x' } })
      expect(await aplicarSugerido('t1', 'A', 9)).toMatchObject({ ok: false, resultado: 'erro' })
    })
  })
  it('seqVisto inválido recusa', async () => {
    const r = await aplicarSugerido('t1', 'B', -1)
    expect(r.ok).toBe(false); expect(settle).not.toHaveBeenCalled()
  })
  it('depois de aplicar (manual_winner + winner) a vitória conta como humana no winRate', () => {
    expect(ehVitoriaHumana({ completed_reason: 'manual_winner', winner_variant_id: 'B' })).toBe(true)
    expect(ehVitoriaHumana({ completed_reason: 'regra_v2', winner_variant_id: null })).toBe(false)
  })
  it('mensagem de permissão existe', () => { expect(MSG_SEM_PERMISSAO_VARIANTE).toBeTruthy() })
})
