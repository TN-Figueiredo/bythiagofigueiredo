// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const loadRows = vi.fn()
vi.mock('@/lib/youtube/observatorio/load', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/observatorio/load')>()),
  loadRows: (...a: unknown[]) => loadRows(...a),
  rowsToDataset: () => ({}),
}))
vi.mock('@/lib/youtube/observatorio/index', () => ({ createObservatory: () => ({}) }))
const captureMessage = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a) }))

const lerProprios = vi.fn()
const lerIndiceDeLugar = vi.fn()
vi.mock('@/lib/youtube/observatorio/sinais/lugares-do-site', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/observatorio/sinais/lugares-do-site')>()),
  lerProprios: (...a: unknown[]) => lerProprios(...a),
  lerIndiceDeLugar: (...a: unknown[]) => lerIndiceDeLugar(...a),
  lerEntradasDeLugar: async () => ({ raws: new Map(), existentes: new Map() }),
  calcularLugares: () => ({ lugarDe: () => [], conhecido: () => true, textoDe: () => '', regravar: [{}, {}] }),
  gravarLugares: async () => undefined,
}))
vi.mock('@/lib/youtube/observatorio/sinais/projecao', () => ({
  projetarOutliers: () => ({
    outliers: [{ videoId: 'v1', canalId: 'c1', formato: 'long', publishedAt: '2026-10-20T00:00:00.000Z', mult: 4, multTela: 2.5, vpd7: 900, nCanal: 10, chaves: ['pt'], tokens: [], deHoje: true }],
    canaisSemRitmo: 0, canaisTotal: 3, outliersSemLugar: 1, outliersDescartados: 2,
  }),
  recomporVistos: () => ({ outliers: [], ancorasPorChave: new Map() }),
}))
const calcular = vi.fn()
vi.mock('@/lib/youtube/observatorio/sinais/oportunidades', () => ({ calcularOportunidades: (...a: unknown[]) => calcular(...a) }))

import { rodarSinaisDoNicho } from '@/lib/youtube/observatorio/sinais/gravador'
import { sinaisDoNicho } from '@/lib/youtube/agenda/tarefas/sinais-do-nicho'
import { PESADA_FIM_MS } from '@/lib/youtube/agenda/relogio'

interface Dados { sites: string[]; abertas: string[]; temLinha: boolean; rpc: ReturnType<typeof vi.fn> }
function fakeSb(d: Dados): SupabaseClient {
  const tabela = (nome: string): unknown[] => {
    if (nome === 'competitor_channels') return d.sites.map((s, i) => ({ id: 'ch' + i, site_id: s }))
    if (nome === 'niche_signals') return d.abertas.length > 0 || d.temLinha ? (d.abertas.length > 0 ? d.abertas.map(k => ({ subject_key: k, id: 'x' })) : [{ id: 'x' }]) : []
    return []
  }
  const from = (nome: string): unknown => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'gte', 'order', 'limit', 'range']) q[m] = () => q
    q.then = (ok: (v: unknown) => void) => ok({ data: tabela(nome), error: null })
    return q
  }
  const rpc = (nome: string, args: unknown): Promise<unknown> =>
    nome === 'niche_signals_ancoras' ? Promise.resolve({ data: [], error: null }) : d.rpc(nome, args)
  return { from, rpc } as unknown as SupabaseClient
}
const dados = (o: Partial<Dados> = {}): Dados => ({
  sites: ['A'], abertas: [], temLinha: false, rpc: vi.fn().mockResolvedValue({ data: { novos: 1, atualizados: 0, expirados: 0 }, error: null }), ...o,
})
const nucleo = (chaves: string[] = []) => ({
  itens: chaves.map(k => ({ kind: 'destino', subjectKey: k, evidence: {}, forca: 1, acao: 'video_novo', motivo: 'm', notificarComo: 'individual' })),
  motivoVazio: null, contagens: { canais_total: 3 },
})

beforeEach(() => {
  loadRows.mockReset().mockResolvedValue({})
  captureMessage.mockReset()
  lerProprios.mockReset().mockResolvedValue([])
  lerIndiceDeLugar.mockReset().mockResolvedValue({ versao: 1, porAlias: new Map(), nMax: 1 })
  calcular.mockReset().mockReturnValue(nucleo(['pt']))
})
afterEach(() => vi.useRealTimers())

const rodar = (d: Dados, prazoMs = 85_000) => rodarSinaisDoNicho({ sb: fakeSb(d), agora: new Date('2026-10-22T10:00:00Z'), prazoMs, inicioMs: 3 })

describe('rodarSinaisDoNicho', () => {
  it('site A lança, site B grava: RPC chamada 1x, falhas 1, motivo site_falhou', async () => {
    const d = dados({ sites: ['A', 'B'] })
    loadRows.mockImplementation(async (o: { siteId: string }) => { if (o.siteId === 'A') throw new Error('segredo do banco'); return {} })
    const r = await rodar(d)
    expect(d.rpc).toHaveBeenCalledTimes(1)
    expect((d.rpc.mock.calls[0]?.[1] as { p_site: string }).p_site).toBe('B')
    expect(r).toMatchObject({ sites: 2, novos: 1, falhas: 1, motivo: 'site_falhou', outliers: 1, outliersSemLugar: 1, outliersDescartados: 2, lugaresRegravados: 2, inicioMs: 3 })
    expect(JSON.stringify(r)).not.toContain('segredo')
    expect(JSON.stringify(captureMessage.mock.calls)).not.toContain('segredo')
  })

  it('loadRows estoura o prazo: motor_estourou, nenhuma RPC', async () => {
    vi.useFakeTimers()
    loadRows.mockReturnValue(new Promise(() => undefined))
    const d = dados()
    const p = rodar(d)
    await vi.advanceTimersByTimeAsync(85_001)
    const r = await p
    expect(r).toMatchObject({ falhas: 1, motivo: 'motor_estourou' })
    expect(d.rpc).not.toHaveBeenCalled()
  })

  it('prazo esgota DEPOIS do loadRows: motor_estourou e a RPC nao e chamada', async () => {
    vi.useFakeTimers()
    loadRows.mockImplementation(async () => { vi.setSystemTime(Date.now() + 86_000); return {} })
    const d = dados()
    const r = await rodar(d)
    expect(r).toMatchObject({ falhas: 1, motivo: 'motor_estourou' })
    expect(d.rpc).not.toHaveBeenCalled()
  })

  it('2 sites, motor_estourou no 1o: o 2o nao comeca sem prazo', async () => {
    vi.useFakeTimers()
    loadRows.mockReturnValue(new Promise(() => undefined))
    const d = dados({ sites: ['A', 'B'] })
    const p = rodar(d)
    await vi.advanceTimersByTimeAsync(85_001)
    const r = await p
    expect(loadRows).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ falhas: 2, motivo: 'motor_estourou' })
    expect(d.rpc).not.toHaveBeenCalled()
  })

  it('1a execucao p_linha_de_base true, com linha anterior false', async () => {
    const a = dados({ temLinha: false })
    await rodar(a)
    expect((a.rpc.mock.calls[0]?.[1] as { p_linha_de_base: boolean }).p_linha_de_base).toBe(true)
    const b = dados({ temLinha: true })
    await rodar(b)
    expect((b.rpc.mock.calls[0]?.[1] as { p_linha_de_base: boolean }).p_linha_de_base).toBe(false)
  })

  it('contrato: modo explicito, atualizar para toda chave aberta, novo para o resto', async () => {
    calcular.mockReturnValue(nucleo(['pt', 'es', 'outlier:v1']))
    const d = dados({ abertas: ['pt', 'outlier:v1'], temLinha: true })
    await rodar(d)
    const lote = (d.rpc.mock.calls[0]?.[1] as { p_lote: Array<{ subject_key: string; modo: string }> }).p_lote
    expect(Object.fromEntries(lote.map(i => [i.subject_key, i.modo]))).toEqual({ pt: 'atualizar', es: 'novo', 'outlier:v1': 'atualizar' })
    expect(lote.every(i => i.modo === 'atualizar' || i.modo === 'novo')).toBe(true)
  })

  it('p_vistos dos outliers de hoje e p_estado com rule_version e contagens', async () => {
    const d = dados()
    await rodar(d)
    const a = d.rpc.mock.calls[0]?.[1] as { p_vistos: unknown[]; p_estado: Record<string, unknown> }
    expect(a.p_vistos).toEqual([{ video_id: 'v1', canal_id: 'c1', formato: 'long', published_at: '2026-10-20T00:00:00.000Z', n_canal: 10, mult_max: 4, vpd7_max: 900, chaves: ['pt'] }])
    expect(a.p_estado).toMatchObject({ rule_version: 'sinais-v1+semente-1', motivo_vazio: null })
  })

  it('erro da RPC: gravar_falhou; SQLSTATE 42883: schema_ausente; sem texto do banco', async () => {
    const a = dados({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key segredo' } }) })
    const ra = await rodar(a)
    expect(ra).toMatchObject({ falhas: 1, motivo: 'gravar_falhou' })
    const b = dados({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '42883', message: 'function does not exist' } }) })
    expect((await rodar(b)).motivo).toBe('schema_ausente')
    expect(JSON.stringify(captureMessage.mock.calls)).not.toContain('segredo')
  })

  it('semente incompleta: nada gravado, motivo semente_incompleta', async () => {
    const { ErroSementeIncompleta } = await import('@/lib/youtube/observatorio/sinais/lugares-do-site')
    lerIndiceDeLugar.mockRejectedValue(new ErroSementeIncompleta(3, 10))
    const d = dados()
    expect(await rodar(d)).toMatchObject({ motivo: 'semente_incompleta' })
    expect(d.rpc).not.toHaveBeenCalled()
  })
})

describe('tarefa sinais_do_nicho', () => {
  const ctx = (sb: SupabaseClient, gasto: number) => { const t0 = 1_700_000_000_000; return { t0, agora: () => t0 + gasto, apiKey: 'k', sb, linhas: null } }

  it('com agora - t0 = 200 s, o prazo e o que resta do PESADA_FIM_MS (85 s) e o loadRows e cortado nele', async () => {
    vi.useFakeTimers()
    loadRows.mockReturnValue(new Promise(() => undefined))
    const p = sinaisDoNicho.rodar(ctx(fakeSb(dados()), 200_000))
    await vi.advanceTimersByTimeAsync(PESADA_FIM_MS - 200_000 - 1)
    expect(loadRows).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2)
    const r = await p
    expect(r).toMatchObject({ estado: 'erro', motivo: 'motor_estourou' })
    expect(r.detalhe).toMatchObject({ inicio_ms: 200_000, falhas: 1 })
  })

  it('ok: detalhe so com numeros e as chaves do brief', async () => {
    const r = await sinaisDoNicho.rodar(ctx(fakeSb(dados()), 0))
    expect(r.estado).toBe('ok')
    expect(Object.keys(r.detalhe ?? {}).sort()).toEqual(['atualizados', 'expirados', 'falhas', 'inicio_ms', 'lugares_regravados', 'ms', 'novos', 'outliers', 'outliers_descartados', 'outliers_sem_lugar', 'sites'])
    expect(Object.values(r.detalhe ?? {}).every(v => typeof v === 'number')).toBe(true)
  })

  it('excecao fora do laco vira inesperado, sem texto de fora', async () => {
    const sb = { from: () => { throw Object.assign(new Error('texto secreto'), { code: '08006' }) } } as unknown as SupabaseClient
    const r = await sinaisDoNicho.rodar(ctx(sb, 0))
    expect(r).toMatchObject({ estado: 'erro', motivo: 'inesperado' })
    expect(JSON.stringify(r)).not.toContain('secreto')
  })
})
