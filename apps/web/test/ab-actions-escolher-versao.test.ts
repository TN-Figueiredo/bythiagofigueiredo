// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const { SITE } = vi.hoisted(() => ({ SITE: 'site-sessao' }))
const settle = vi.fn()
const denyUnlessSiteAdmin = vi.fn()
const requireSiteScope = vi.fn()
const servico = vi.fn()

vi.mock('@/lib/cms/auth-guards', () => ({ denyUnlessSiteAdmin: (...a: unknown[]) => denyUnlessSiteAdmin(...a) }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: SITE }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => servico() }))
vi.mock('@/lib/youtube/ab-settle', () => ({ settleOnAir: (...a: unknown[]) => settle(...a), ORIGINAL: { tipo: 'original' }, TETO_MS: 55000 }))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ getChannelTier: vi.fn() }))
vi.mock('@/lib/youtube/prompt-scoring', () => ({ scoreForPrompt: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { escolherVersao } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { escolherVersaoCore, porqueDe } from '@/lib/youtube/ab-escolha'
import type { RestoreStatus } from '@/lib/youtube/ab-restore'

const T = '00000000-0000-4000-8000-0000000000'
const TESTE = `${T}01`, VA = `${T}0a`, VB = `${T}0b`, VC = `${T}0c`, VOUTRO = `${T}0d`
const FIM = '2026-10-10T12:00:00.000Z'
const em = (min: number) => new Date(Date.parse(FIM) + min * 60_000).toISOString()
const campo = (estado: string, destino: string, min: number, escreveu: boolean | null = true, erro: unknown = null) =>
  ({ estado, destino, em: em(min), forcado: false, escreveu, erro, attempts: 0 })

type Fila = Record<string, unknown>
function fake(init: { teste?: Fila; variantes?: Fila[]; historico?: Fila[]; erroNoTeste?: boolean; updateRows?: number } = {}) {
  const teste: Fila = {
    id: TESTE, site_id: SITE, test_type: 'title', status: 'completed', restore_seq: 4, completed_at: FIM, completed_reason: 'regra_v2',
    winner_variant_id: null, winner_applied_at: null, escolha_variant_id: null, escolha_em: null,
    result_metadata: { v2: { desfecho: 'vencedor_provavel', vencedor_sugerido: VB } },
    restore_status: { title: campo('ok', 'original', 1) }, ...init.teste,
  }
  const variantes = init.variantes ?? [
    { id: VA, label: 'original', is_original: true }, { id: VB, label: 'B', is_original: false }, { id: VC, label: 'C', is_original: false },
  ]
  const updates: Array<{ patch: Fila; filtros: Array<[string, string, unknown]> }> = []
  const supabase = {
    from(tabela: string) {
      const filtros: Array<[string, string, unknown]> = []
      let patch: Fila | null = null
      const dados = (): unknown =>
        tabela === 'ab_tests' ? (init.erroNoTeste ? null : teste) : tabela === 'ab_test_variants' ? variantes : (init.historico ?? [])
      const q: Record<string, unknown> = {
        select: () => q,
        update: (p: Fila) => { patch = p; return q },
        eq: (c: string, v: unknown) => { filtros.push(['eq', c, v]); return q },
        is: (c: string, v: unknown) => { filtros.push(['is', c, v]); return q },
        order: () => q, limit: () => q,
        maybeSingle: () => Promise.resolve({ data: dados(), error: init.erroNoTeste ? { message: 'boom' } : null }),
        then: (ok: (v: unknown) => unknown) => {
          if (patch) {
            updates.push({ patch, filtros })
            const n = init.updateRows ?? 1
            return Promise.resolve({ data: Array.from({ length: n }, () => ({ id: TESTE })), error: null }).then(ok)
          }
          return Promise.resolve({ data: dados(), error: null }).then(ok)
        },
      }
      return q
    },
  } as unknown as SupabaseClient
  return { supabase, updates, teste }
}
const entrada = (o: Partial<Parameters<typeof escolherVersaoCore>[0]> = {}) => ({ testId: TESTE, varianteId: VC, seqVisto: 4, siteId: SITE, userId: 'user-1', ...o })
const feito = (campos: RestoreStatus, seq = 5) => ({ resultado: 'feito' as const, campos, seq })

beforeEach(() => {
  vi.clearAllMocks()
  denyUnlessSiteAdmin.mockResolvedValue(null)
  requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'user-1' } })
})

describe('escolherVersao (action): sessão', () => {
  it('sem admin do site: sem_permissao antes de qualquer leitura', async () => {
    denyUnlessSiteAdmin.mockResolvedValueOnce({ error: 'negado' })
    expect(await escolherVersao(TESTE, VC, 4)).toEqual({ ok: false, resultado: 'sem_permissao', error: 'negado' })
    expect(servico).not.toHaveBeenCalled(); expect(settle).not.toHaveBeenCalled()
  })
  it('ids que não são uuid: erro, sem leitura', async () => {
    const r = await escolherVersao('x', VC, 4)
    expect(r).toMatchObject({ ok: false, resultado: 'erro' }); expect(servico).not.toHaveBeenCalled()
  })
  it('sessão sem edição: sem_permissao', async () => {
    requireSiteScope.mockResolvedValueOnce({ ok: false, reason: 'forbidden' })
    expect(await escolherVersao(TESTE, VC, 4)).toMatchObject({ ok: false, resultado: 'sem_permissao' })
    expect(servico).not.toHaveBeenCalled()
  })
})

describe('escolherVersaoCore: validações', () => {
  it('teste de outro site / inexistente: ja_encerrado', async () => {
    const f = fake(); (f.supabase as unknown as { from: unknown }).from = () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) })
    expect(await escolherVersaoCore(entrada(), { supabase: f.supabase, settle })).toMatchObject({ ok: false, resultado: 'ja_encerrado' })
  })
  it('leitura do teste com erro: erro, nunca segue', async () => {
    const f = fake({ erroNoTeste: true })
    expect(await escolherVersaoCore(entrada(), { supabase: f.supabase, settle })).toMatchObject({ ok: false, resultado: 'erro' })
    expect(settle).not.toHaveBeenCalled()
  })
  it('teste não concluído ou fora da regra v2: ja_encerrado', async () => {
    expect(await escolherVersaoCore(entrada(), { supabase: fake({ teste: { status: 'paused' } }).supabase, settle })).toMatchObject({ resultado: 'ja_encerrado' })
    expect(await escolherVersaoCore(entrada(), { supabase: fake({ teste: { completed_reason: 'inconclusive' } }).supabase, settle })).toMatchObject({ resultado: 'ja_encerrado' })
  })
  it('variante de outro teste: erro', async () => {
    expect(await escolherVersaoCore(entrada({ varianteId: VOUTRO }), { supabase: fake().supabase, settle })).toMatchObject({ ok: false, resultado: 'erro' })
  })
  it('sem original ou com duas originais: erro', async () => {
    const sem = [{ id: VB, label: 'B', is_original: false }, { id: VC, label: 'C', is_original: false }]
    const duas = [{ id: VA, label: 'original', is_original: true }, { id: VB, label: 'B', is_original: true }, { id: VC, label: 'C', is_original: false }]
    expect(await escolherVersaoCore(entrada(), { supabase: fake({ variantes: sem }).supabase, settle })).toMatchObject({ resultado: 'erro' })
    expect(await escolherVersaoCore(entrada(), { supabase: fake({ variantes: duas }).supabase, settle })).toMatchObject({ resultado: 'erro' })
  })
  it('seqVisto velho: mudou, sem settle', async () => {
    expect(await escolherVersaoCore(entrada({ seqVisto: 2 }), { supabase: fake().supabase, settle })).toMatchObject({ resultado: 'mudou' })
    expect(settle).not.toHaveBeenCalled()
  })
})

describe('escolherVersaoCore: sem escrita no YouTube', () => {
  it('Manter A com A confirmada: UPDATE com CAS, restore_seq + 1, updated_at, sem settle; resultado guardado', async () => {
    const f = fake()
    const r = await escolherVersaoCore(entrada({ varianteId: VA }), { supabase: f.supabase, settle })
    expect(r).toEqual({ ok: true, resultado: 'guardado', restoreSeq: 5 })
    expect(settle).not.toHaveBeenCalled()
    expect(f.updates).toHaveLength(1)
    expect(f.updates[0]!.patch).toMatchObject({ escolha_variant_id: VA, escolha_por: 'user-1', restore_seq: 5 })
    expect(typeof f.updates[0]!.patch.updated_at).toBe('string')
    expect(f.updates[0]!.filtros).toEqual(expect.arrayContaining([['eq', 'restore_seq', 4], ['eq', 'status', 'completed'], ['eq', 'site_id', SITE]]))
    expect('winner_variant_id' in f.updates[0]!.patch).toBe(false) // sugerida B ≠ A
  })
  it('C confirmada e escolha nula: um UPDATE com escolha = C, resposta no_ar; vencedor intacto', async () => {
    const f = fake({ teste: { restore_status: { title: campo('ok', VC, 1) } } })
    const r = await escolherVersaoCore(entrada(), { supabase: f.supabase, settle })
    expect(r).toMatchObject({ ok: true, resultado: 'no_ar', noAr: { tipo: 'confirmado', letra: 'C' }, restoreSeq: 5 })
    expect(f.updates[0]!.patch).toMatchObject({ escolha_variant_id: VC, restore_seq: 5 })
    expect('winner_variant_id' in f.updates[0]!.patch).toBe(false)
  })
  it('escolha já igual ao destino: no_ar sem escrever nada, com o seqVisto', async () => {
    const f = fake({ teste: { restore_status: { title: campo('ok', VC, 1) }, escolha_variant_id: VC, escolha_em: em(2) } })
    const r = await escolherVersaoCore(entrada(), { supabase: f.supabase, settle })
    expect(r).toMatchObject({ ok: true, resultado: 'no_ar', restoreSeq: 4 }); expect(f.updates).toEqual([])
  })
  it('destino = sugerida com regra_v2 e vencedor nulo: o mesmo UPDATE grava manual_winner e a sugerida, com winner nulo no where', async () => {
    const f = fake({ teste: { restore_status: { title: campo('ok', VB, 1) } } })
    await escolherVersaoCore(entrada({ varianteId: VB }), { supabase: f.supabase, settle })
    expect(f.updates[0]!.patch).toMatchObject({ completed_reason: 'manual_winner', winner_variant_id: VB, escolha_variant_id: VB })
    expect(f.updates[0]!.filtros).toEqual(expect.arrayContaining([['is', 'winner_variant_id', null]]))
  })
  it('sugerida = original e A confirmada: Manter grava o vencedor da original (P2)', async () => {
    const f = fake({ teste: { result_metadata: { v2: { desfecho: 'vencedor_provavel', vencedor_sugerido: VA } } } })
    const r = await escolherVersaoCore(entrada({ varianteId: VA }), { supabase: f.supabase, settle })
    expect(r).toMatchObject({ resultado: 'guardado' })
    expect(f.updates[0]!.patch).toMatchObject({ completed_reason: 'manual_winner', winner_variant_id: VA })
  })
  it('zero linhas atualizadas: mudou', async () => {
    const f = fake({ updateRows: 0 })
    expect(await escolherVersaoCore(entrada({ varianteId: VA }), { supabase: f.supabase, settle })).toMatchObject({ ok: false, resultado: 'mudou' })
  })
})

describe('escolherVersaoCore: escrita no YouTube', () => {
  const naoConfirmada = { restore_status: { title: campo('ok', VB, 1) }, restore_seq: 4 }
  it('Manter A com A não confirmada: escreve (escolher com destino na original)', async () => {
    settle.mockResolvedValue(feito({ title: campo('ok', 'original', 9) }))
    const f = fake({ teste: naoConfirmada })
    const r = await escolherVersaoCore(entrada({ varianteId: VA }), { supabase: f.supabase, settle })
    expect(settle).toHaveBeenCalledWith(TESTE, expect.objectContaining({ motivo: 'escolher', destino: { tipo: 'variante', id: VA }, humano: true, seqEsperado: 4, autor: 'user-1' }))
    expect(r).toMatchObject({ ok: true, resultado: 'no_ar', noAr: { letra: 'A' }, restoreSeq: 5 })
    expect(f.updates).toEqual([])
  })
  it('sugerida ≠ original, regra_v2 e vencedor nulo: aplicar_sugerido; C (não sugerida): escolher sem extra', async () => {
    settle.mockResolvedValue(feito({ title: campo('ok', VB, 9) }))
    await escolherVersaoCore(entrada({ varianteId: VB }), { supabase: fake().supabase, settle })
    expect(settle.mock.calls[0]![1]).toMatchObject({ motivo: 'aplicar_sugerido' })
    settle.mockResolvedValue(feito({ title: campo('ok', VC, 9) }))
    await escolherVersaoCore(entrada({ varianteId: VC }), { supabase: fake().supabase, settle })
    expect(settle.mock.calls[1]![1]).toMatchObject({ motivo: 'escolher' })
    expect('extra' in (settle.mock.calls[1]![1] as object)).toBe(false)
    expect('vencedorEsperado' in (settle.mock.calls[1]![1] as object)).toBe(false)
  })
  it('sugerida = original, A com escreveu null: escolher com manual_winner e a letra esperada', async () => {
    settle.mockResolvedValue(feito({ title: campo('ok', 'original', 9) }))
    const f = fake({ teste: { result_metadata: { v2: { desfecho: 'vencedor_provavel', vencedor_sugerido: VA } }, restore_status: { title: campo('falhou', VB, 1, null) } } })
    await escolherVersaoCore(entrada({ varianteId: VA }), { supabase: f.supabase, settle })
    expect(settle.mock.calls[0]![1]).toMatchObject({ motivo: 'escolher', extra: { completed_reason: 'manual_winner', winner_variant_id: VA }, vencedorEsperado: VA })
  })
  it('sugerida que não é variante do teste: tratada como sem sugerida (escolher, sem letra esperada) e Sentry avisa', async () => {
    settle.mockResolvedValue(feito({ title: campo('ok', VB, 9) }))
    const f = fake({ teste: { result_metadata: { v2: { desfecho: 'vencedor_provavel', vencedor_sugerido: VOUTRO } } } })
    await escolherVersaoCore(entrada({ varianteId: VB }), { supabase: f.supabase, settle })
    expect(settle.mock.calls[0]![1]).toMatchObject({ motivo: 'escolher' })
    expect('vencedorEsperado' in (settle.mock.calls[0]![1] as object)).toBe(false)
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })
  it.each([
    ['pulado_drift', null, 'drift'],
    ['pulado_sem_original', null, 'sem_original'],
    ['falhou', { motivo: 'tempo_esgotado' }, 'sem_tempo'],
    ['falhou', { motivo: 'arquivo_do_destino_indisponivel' }, 'arquivo_indisponivel'],
    ['falhou', { status: 403, reason: 'forbidden', chamada: 'videos.update' }, 'youtube'],
  ])('campo %s com escreveu false: recusou (%s -> %s), com o que está no ar relido e o seq do claim', async (estado, erro, porque) => {
    settle.mockResolvedValue(feito({ title: campo(estado, VC, 9, false, erro) }, 5))
    const r = await escolherVersaoCore(entrada({ varianteId: VC }), { supabase: fake({ teste: naoConfirmada }).supabase, settle })
    expect(r).toMatchObject({ ok: false, resultado: 'recusou', porque, restoreSeq: 5, entrou: [] })
    expect((r as { error: string }).error.length).toBeGreaterThan(5)
  })
  it('recusou em combo: entrou lista o campo que deu ok e o misto aparece em noAr', async () => {
    settle.mockResolvedValue(feito({ title: campo('ok', VC, 9), thumbnail: campo('falhou', VC, 9, false, { status: 403, reason: 'x', chamada: 'thumbnails.set' }) }))
    const h = (c: string) => ({ seq: 4, campo: c, destino: VB, estado: 'ok', escreveu: true, em: em(1) })
    const f = fake({ historico: [h('title'), h('thumbnail')], teste: { test_type: 'combo', restore_status: { title: campo('ok', VB, 1), thumbnail: campo('ok', VB, 1) } } })
    const r = await escolherVersaoCore(entrada(), { supabase: f.supabase, settle })
    expect(r).toMatchObject({ ok: false, resultado: 'recusou', entrou: ['title'], noAr: { tipo: 'misto', porCampo: { title: 'C', thumbnail: 'B' } } })
  })
  it('escreveu null em algum campo: incerto com o seq', async () => {
    settle.mockResolvedValue(feito({ title: campo('falhou', VC, 9, null, { status: 0, reason: 'timeout', chamada: 'videos.update' }) }, 5))
    expect(await escolherVersaoCore(entrada(), { supabase: fake({ teste: naoConfirmada }).supabase, settle })).toEqual({ ok: false, resultado: 'incerto', restoreSeq: 5 })
  })
  it('perdido: incerto sem seq; exceção depois da chamada: incerto sem seq (Sentry); exceção antes da chamada (leitura): erro', async () => {
    settle.mockResolvedValueOnce({ resultado: 'perdido', escreveu: true, campos: null })
    expect(await escolherVersaoCore(entrada(), { supabase: fake({ teste: naoConfirmada }).supabase, settle })).toEqual({ ok: false, resultado: 'incerto', restoreSeq: null })
    settle.mockRejectedValueOnce(new Error('rede'))
    expect(await escolherVersaoCore(entrada(), { supabase: fake({ teste: naoConfirmada }).supabase, settle })).toEqual({ ok: false, resultado: 'incerto', restoreSeq: null })
    expect(Sentry.captureException).toHaveBeenCalled()
    expect(await escolherVersaoCore(entrada(), { supabase: fake({ erroNoTeste: true }).supabase, settle })).toMatchObject({ ok: false, resultado: 'erro' })
  })
  it('o resto do settle: precisa_confirmar, mudou, em_andamento, outro_teste, teste_youtube', async () => {
    const r = (x: unknown) => { settle.mockResolvedValueOnce(x); return escolherVersaoCore(entrada(), { supabase: fake({ teste: naoConfirmada }).supabase, settle }) }
    expect(await r({ resultado: 'precisa_confirmar', campos: [{ campo: 'title', valor_atual: 'X' }] })).toMatchObject({ ok: true, resultado: 'precisa_confirmar' })
    expect(await r({ resultado: 'mudou', campos: null })).toMatchObject({ resultado: 'mudou' })
    expect(await r({ resultado: 'em_andamento', campos: null })).toMatchObject({ resultado: 'em_andamento' })
    expect(await r({ resultado: 'outro_teste', campos: null })).toMatchObject({ resultado: 'outro_teste' })
    expect(await r({ resultado: 'teste_youtube', motivo: 'm', campos: null })).toMatchObject({ resultado: 'teste_youtube', error: 'm' })
  })
  it('o vencedor não é tocado pelo caminho de escrita de C: nenhum UPDATE direto em ab_tests', async () => {
    settle.mockResolvedValue(feito({ title: campo('ok', VC, 9) }))
    const f = fake({ teste: naoConfirmada })
    await escolherVersaoCore(entrada({ varianteId: VC }), { supabase: f.supabase, settle })
    expect(f.updates).toEqual([])
  })
  it('forcar é repassado só quando verdadeiro', async () => {
    settle.mockResolvedValue(feito({ title: campo('ok', VC, 9) }))
    await escolherVersaoCore(entrada({ forcar: true }), { supabase: fake({ teste: naoConfirmada }).supabase, settle })
    expect(settle.mock.calls[0]![1]).toMatchObject({ forcar: true })
  })
})

describe('porqueDe', () => {
  it('sem campo falho cai em youtube', () => { expect(porqueDe({ title: campo('ok', VC, 1) } as RestoreStatus, ['title'])).toBe('youtube') })
})
