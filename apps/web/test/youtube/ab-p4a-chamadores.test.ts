import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'

const { SITE_DA_SESSAO } = vi.hoisted(() => ({ SITE_DA_SESSAO: 'site-sessao' }))

const settle = vi.fn()
const denyUnlessSiteAdmin = vi.fn()
const varianteOriginalId = vi.fn()
const requireSiteScope = vi.fn()

vi.mock('@/lib/youtube/ab-settle', () => ({ settleOnAir: (...a: unknown[]) => settle(...a), ORIGINAL: { tipo: 'original' } }))
vi.mock('@/lib/youtube/ab-acao-saida', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/ab-acao-saida')>()),
  varianteOriginalId: (...a: unknown[]) => varianteOriginalId(...a),
}))
vi.mock('@/lib/cms/auth-guards', () => ({ denyUnlessSiteAdmin: (...a: unknown[]) => denyUnlessSiteAdmin(...a) }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: SITE_DA_SESSAO }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ getChannelTier: vi.fn() }))
vi.mock('@/lib/youtube/prompt-scoring', () => ({ scoreForPrompt: vi.fn() }))

import { pauseAbTest, endAbTest, revertWinner } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { MSG_EM_ANDAMENTO } from '@/lib/youtube/ab-acao-saida'
import { revalidatePath, revalidateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'

const CAMPOS = { thumbnail: { estado: 'falhou', destino: 'A', em: '2026-10-16T10:00:00Z', forcado: false, escreveu: false, erro: { status: 500 }, attempts: 1 } }
const FEITO = { resultado: 'feito', campos: CAMPOS }

beforeEach(() => {
  vi.clearAllMocks()
  settle.mockResolvedValue(FEITO)
  denyUnlessSiteAdmin.mockResolvedValue(null)
  varianteOriginalId.mockResolvedValue('A')
  requireSiteScope.mockResolvedValue({ ok: true })
})

describe('P4a T7: chamadores humanos', () => {
  it('pauseAbTest chama settleOnAir(original, pausa) depois de requireEditAccess, com o siteId da sessão', async () => {
    const r = await pauseAbTest('t1', 7)
    expect(requireSiteScope).toHaveBeenCalled()
    expect(settle).toHaveBeenCalledWith('t1', { siteId: SITE_DA_SESSAO, destino: { tipo: 'original' }, motivo: 'pausa', humano: true, seqEsperado: 7 })
    expect(r).toEqual({ ok: true, resultado: 'feito', campos: CAMPOS })
    expect(denyUnlessSiteAdmin).not.toHaveBeenCalled()
  })

  it('sessão expirada vira sem_permissao e não chama settleOnAir', async () => {
    requireSiteScope.mockResolvedValueOnce({ ok: false, reason: 'unauthenticated' })
    expect(await pauseAbTest('t1', 7)).toEqual({ ok: false, resultado: 'sem_permissao', error: 'unauthenticated' })
    expect(settle).not.toHaveBeenCalled()
  })

  it('sessão expirada em endAbTest e revertWinner vira sem_permissao e não chama settleOnAir', async () => {
    requireSiteScope.mockResolvedValueOnce({ ok: false, reason: 'unauthenticated' })
    expect(await endAbTest('t1', { destino: 'original', seqVisto: 7 })).toEqual({ ok: false, resultado: 'sem_permissao', error: 'unauthenticated' })
    requireSiteScope.mockResolvedValueOnce({ ok: false, reason: 'forbidden' })
    expect(await revertWinner('t1', 7)).toEqual({ ok: false, resultado: 'sem_permissao', error: 'forbidden' })
    expect(settle).not.toHaveBeenCalled()
  })

  it('endAbTest com variante exige site admin; sem permissão → sem_permissao com a frase, sem chamar settleOnAir', async () => {
    denyUnlessSiteAdmin.mockResolvedValueOnce({ ok: false, error: 'x' })
    const r = await endAbTest('t1', { destino: 'variante', varianteId: 'B', seqVisto: 7 })
    expect(r).toEqual({ ok: false, resultado: 'sem_permissao', error: 'Só quem administra o site pode deixar uma variante no ar. Você pode voltar ao original.' })
    expect(settle).not.toHaveBeenCalled()
  })

  it('endAbTest com variante não original e admin → destino variante', async () => {
    await endAbTest('t1', { destino: 'variante', varianteId: 'B', seqVisto: 7 })
    expect(varianteOriginalId).toHaveBeenCalledWith('t1', SITE_DA_SESSAO)
    expect(denyUnlessSiteAdmin).toHaveBeenCalledWith(SITE_DA_SESSAO, expect.any(String))
    expect(settle).toHaveBeenCalledWith('t1', expect.objectContaining({ siteId: SITE_DA_SESSAO, destino: { tipo: 'variante', id: 'B' }, motivo: 'encerrado', humano: true }))
  })

  it('endAbTest com o id da variante original → destino original, sem exigir site admin (17)', async () => {
    varianteOriginalId.mockResolvedValue('A')
    await endAbTest('t1', { destino: 'variante', varianteId: 'A', seqVisto: 7 })
    expect(denyUnlessSiteAdmin).not.toHaveBeenCalled()
    expect(settle).toHaveBeenCalledWith('t1', expect.objectContaining({ destino: { tipo: 'original' }, motivo: 'encerrado' }))
  })

  it('endAbTest destino original não exige site admin', async () => {
    await endAbTest('t1', { destino: 'original', seqVisto: 7 })
    expect(denyUnlessSiteAdmin).not.toHaveBeenCalled()
    expect(settle).toHaveBeenCalledWith('t1', expect.objectContaining({ destino: { tipo: 'original' } }))
  })

  it('endAbTest repassa forcar só quando veio', async () => {
    await endAbTest('t1', { destino: 'variante', varianteId: 'B', seqVisto: 7 })
    expect(settle.mock.calls[0][1]).not.toHaveProperty('forcar')
    await endAbTest('t1', { destino: 'variante', varianteId: 'B', forcar: true, seqVisto: 7 })
    expect(settle.mock.calls[1][1]).toMatchObject({ forcar: true })
  })

  describe('D3: CAS pelo que a tela viu (seqVisto)', () => {
    it('pauseAbTest e endAbTest repassam seqVisto como seqEsperado ao settleOnAir', async () => {
      await pauseAbTest('t1', 3)
      expect(settle.mock.calls[0][1]).toMatchObject({ seqEsperado: 3, humano: true })
      await endAbTest('t1', { destino: 'original', seqVisto: 9 })
      expect(settle.mock.calls[1][1]).toMatchObject({ seqEsperado: 9, motivo: 'encerrado' })
      await endAbTest('t1', { destino: 'variante', varianteId: 'B', seqVisto: 11 })
      expect(settle.mock.calls[2][1]).toMatchObject({ seqEsperado: 11 })
    })

    it('encerrar recusado depois de uma pausa em outra aba: resultado mudou, frase exata, sem revalidar', async () => {
      settle.mockResolvedValueOnce({ resultado: 'mudou', campos: null })
      expect(await endAbTest('t1', { destino: 'original', seqVisto: 4 })).toEqual({ ok: false, resultado: 'mudou', error: 'O teste mudou em outra aba. Reabra para decidir.' })
      expect(revalidateTag).not.toHaveBeenCalled()
    })

    it('pausar recusado depois de um encerrar em outra aba: resultado mudou', async () => {
      settle.mockResolvedValueOnce({ resultado: 'mudou', campos: null })
      expect(await pauseAbTest('t1', 4)).toEqual({ ok: false, resultado: 'mudou', error: 'O teste mudou em outra aba. Reabra para decidir.' })
    })

    it('seqVisto ausente, negativo ou fracionário: erro, settleOnAir não roda', async () => {
      expect(await pauseAbTest('t1', undefined as unknown as number)).toMatchObject({ ok: false, resultado: 'erro' })
      expect(await pauseAbTest('t1', -1)).toMatchObject({ ok: false, resultado: 'erro' })
      expect(await endAbTest('t1', { destino: 'original', seqVisto: 1.5 })).toMatchObject({ ok: false, resultado: 'erro' })
      expect(settle).not.toHaveBeenCalled()
    })
  })

  it('precisa_confirmar sobe como ok:true com os campos', async () => {
    const campos = [{ campo: 'titulo', valor_atual: 'x' }]
    settle.mockResolvedValueOnce({ resultado: 'precisa_confirmar', campos })
    expect(await endAbTest('t1', { destino: 'variante', varianteId: 'B', seqVisto: 7 })).toEqual({ ok: true, resultado: 'precisa_confirmar', campos })
  })

  it('em_andamento vira ok:false com a frase exata', async () => {
    settle.mockResolvedValueOnce({ resultado: 'em_andamento', campos: null })
    expect(await pauseAbTest('t1', 7)).toEqual({ ok: false, resultado: 'em_andamento', error: 'Outra tentativa está em andamento. Tente de novo em instantes.' })
    expect(MSG_EM_ANDAMENTO).toBe('Outra tentativa está em andamento. Tente de novo em instantes.')
  })

  it('ja_encerrado vira ok:false resultado ja_encerrado', async () => {
    settle.mockResolvedValueOnce({ resultado: 'ja_encerrado', campos: null })
    expect(await endAbTest('t1', { destino: 'original', seqVisto: 7 })).toMatchObject({ ok: false, resultado: 'ja_encerrado' })
  })

  it('Y-D2: destino_invalido vira ok:false resultado erro', async () => {
    settle.mockResolvedValueOnce({ resultado: 'destino_invalido', campos: null })
    expect(await endAbTest('t1', { destino: 'variante', varianteId: 'X', seqVisto: 7 })).toEqual({ ok: false, resultado: 'erro', error: 'Variante inválida para este teste.' })
  })

  it('revertWinner mantém denyUnlessSiteAdmin e chama settleOnAir(original, reverter)', async () => {
    await revertWinner('t1', 7)
    expect(denyUnlessSiteAdmin).toHaveBeenCalledWith(SITE_DA_SESSAO, expect.any(String))
    expect(settle).toHaveBeenCalledWith('t1', { siteId: SITE_DA_SESSAO, destino: { tipo: 'original' }, motivo: 'reverter', humano: true, seqEsperado: 7 })
  })

  it('revertWinner sem admin → sem_permissao, sem settleOnAir', async () => {
    denyUnlessSiteAdmin.mockResolvedValueOnce({ ok: false, error: 'Só admin.' })
    expect(await revertWinner('t1', 7)).toEqual({ ok: false, resultado: 'sem_permissao', error: 'Só admin.' })
    expect(settle).not.toHaveBeenCalled()
  })

  it('P4b T9: revertWinner com seqVisto velho -> mudou (frase exata); seqVisto inválido -> erro sem settleOnAir', async () => {
    settle.mockResolvedValueOnce({ resultado: 'mudou', campos: null })
    expect(await revertWinner('t1', 6)).toEqual({ ok: false, resultado: 'mudou', error: 'O teste mudou em outra aba. Reabra para decidir.' })
    settle.mockClear()
    expect(await revertWinner('t1', -3)).toMatchObject({ ok: false, resultado: 'erro' })
    expect(settle).not.toHaveBeenCalled()
  })

  it('applyWinnerNow e cancelGracePeriod não existem mais', async () => {
    const m = await import('@/app/cms/(authed)/youtube/ab-lab/actions')
    expect('applyWinnerNow' in m).toBe(false)
    expect('cancelGracePeriod' in m).toBe(false)
  })

  it('as três páginas (detalhe, lista do A/B e vídeos) exportam maxDuration = 60 (lido do fonte)', () => {
    for (const p of ['ab-lab/[testId]/page.tsx', 'ab-lab/page.tsx', 'videos/page.tsx']) {
      const fonte = fs.readFileSync(`src/app/cms/(authed)/youtube/${p}`, 'utf8')
      expect(fonte, p).toMatch(/^export const maxDuration = 60\b/m)
    }
  })

  it('Y-D6: video-row-actions.tsx não chama endAbTest(abTest.id) sem destino', () => {
    expect(fs.readFileSync('src/app/cms/(authed)/youtube/videos/video-row-actions.tsx', 'utf8')).not.toMatch(/endAbTest\(abTest\.id\)/)
  })

  it('src não tem mais carência nem aplicar vencedor', () => {
    const base = 'src/app/cms/(authed)/youtube/ab-lab/_components/active-detail.tsx'
    const f = fs.readFileSync(base, 'utf8')
    expect(f).not.toMatch(/applyWinnerNow|cancelGracePeriod|Cancelar carência|Aplicar vencedor/)
  })

  describe('depois de sair do ar (concluirSaida)', () => {
    const chamadas = [
      ['pauseAbTest', () => pauseAbTest('t1', 7)],
      ['endAbTest', () => endAbTest('t1', { destino: 'original', seqVisto: 7 })],
      ['revertWinner', () => revertWinner('t1', 7)],
    ] as const

    it.each(chamadas)('DEVE-1: %s com feito revalida a tag youtube e a tela do A/B Lab', async (_n, run) => {
      await run()
      expect(revalidateTag).toHaveBeenCalledWith('youtube', { expire: 0 })
      expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
    })

    it.each(chamadas)('DEVE-1 (desvio 7): %s não revalida em em_andamento, ja_encerrado nem precisa_confirmar', async (_n, run) => {
      for (const r of [
        { resultado: 'em_andamento', campos: null },
        { resultado: 'ja_encerrado', campos: null },
        { resultado: 'precisa_confirmar', campos: [{ campo: 'titulo', valor_atual: 'x' }] },
      ]) settle.mockResolvedValueOnce(r)
      await run(); await run(); await run()
      expect(revalidateTag).not.toHaveBeenCalled()
      expect(revalidatePath).not.toHaveBeenCalled()
    })

    it.each(chamadas)('DEVE-4: %s com settleOnAir que lança vira erro, vai ao Sentry uma vez e revalida', async (_n, run) => {
      const falha = new Error('banco caiu')
      settle.mockRejectedValueOnce(falha)
      const r = await run()
      expect(r).toMatchObject({ ok: false, resultado: 'erro' })
      expect(Sentry.captureException).toHaveBeenCalledTimes(1)
      expect(Sentry.captureException).toHaveBeenCalledWith(falha, expect.objectContaining({ tags: { area: 'ab-acao-saida' } }))
      expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
    })
  })
})
