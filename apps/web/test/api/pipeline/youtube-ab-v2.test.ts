// S8-F4 T10b: projeção v2 no Cowork, avisos honestos e paridade nas rotas agregadas.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ServiceContext } from '@/lib/pipeline/services/types'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/analytics-sync', () => ({ getIsoWeek: vi.fn().mockReturnValue('2026-W23') }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ scoreVideo: vi.fn(), computeBaseline: vi.fn(), computeTrend: vi.fn(), assignGrade: vi.fn() }))
vi.mock('@/lib/youtube/analytics-client', () => ({ fetchYtDemographics: vi.fn(), fetchYtSearchTerms: vi.fn() }))
vi.mock('@/lib/youtube/ab-gravacao/aviso-volume', async (orig) => ({ ...(await orig<object>()), avisoDeVolume: vi.fn() }))

import {
  AVISO_SEM_ESTATISTICA, AVISO_SEM_METRICA_DE_ENTREGA, getAbDashboard, getAbLearnings, getAbPerformance, getAbTest, getAbVideoHistory, projetarTeste,
} from '@/lib/pipeline/services/youtube'
import * as Sentry from '@sentry/nextjs'
import { avisoDeVolume } from '@/lib/youtube/ab-gravacao/aviso-volume'

const SITE = 's1'
const AGORA = new Date('2026-10-24T15:00:00Z')

type Res = { data: unknown; error: unknown }
function chain(result: Res) {
  const self: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'not', 'in', 'is', 'gte', 'gt', 'lte', 'lt', 'order', 'limit', 'range', 'filter']) self[m] = vi.fn(() => self)
  self.single = vi.fn().mockResolvedValue(result)
  self.maybeSingle = vi.fn().mockResolvedValue(result)
  self.then = (ok: (v: Res) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(result).then(ok, ko)
  return self
}
function sbDe(tabelas: Record<string, Res>) {
  const from = vi.fn((t: string) => chain(tabelas[t] ?? { data: [], error: null }))
  return { from }
}
const ctx = (sb: unknown): ServiceContext => ({ siteId: SITE, permissions: ['read'], supabase: sb as ServiceContext['supabase'] })
const nDeFrom = (sb: { from: ReturnType<typeof vi.fn> }, t: string) => sb.from.mock.calls.filter(([x]) => x === t).length

const v2Calculado = (lift: number, extra: Record<string, unknown> = {}) => ({
  desfecho: 'vencedor_provavel', provisorio: false, n: 10315, p1: 0.04, base_estimada: false, gl: 6, p_adj: 0.01, vencedor_sugerido: 'b',
  por_variante: [{ variant_id: 'b', alfa: 0.05, z: 3, z_adj: 2.5, p_adj: 0.01, sinais_por_bloco: [1], passa: true, lift }],
  ultima_avaliacao: { em: '2026-10-24T10:00:00Z', acao: 'seguir', dias_relogio: 10, dias_validos: { o: 5, b: 5 }, blocos_completos: 2, volume: { o: 1, b: 1 } },
  ...extra,
})
const linhaV2 = (v2: unknown, o: Record<string, unknown> = {}) => ({
  id: 't1', status: 'completed', regra_duracao: 'v2', started_at: '2026-10-10T12:00:00Z', completed_at: '2026-10-22T12:00:00Z', paused_at: null,
  config: {}, original_title: 'x', completed_reason: 'regra_v2', winner_variant_id: null, parent_test_id: null, test_type: 'thumbnail',
  variants: [{ id: 'o', is_original: true, sort_order: 0 }, { id: 'b', is_original: false, sort_order: 1 }],
  cycles: [{ id: 'c1', test_id: 't1', variant_id: 'o', started_at: '2026-10-10T12:00:00Z', ended_at: null, cycle_number: 1 }],
  result_metadata: { v2 }, ...o,
})
const dia = (testId: string, imp: number) => ({
  test_id: testId, day_pt: '2026-10-15', site_id: SITE, variant_id: 'o', motivo_sem_variante: null, alcance_estado: 'medido', impressoes: imp, ctr: 0.05,
  views: null, views_estado: 'nao_medido', retratado_em: '2026-10-20T00:00:00Z', final: true,
})

describe('projetarTeste v2', () => {
  it('result_metadata.v2 traz os campos da decisão e o relógio vem de estadoV2DoTeste', () => {
    const out = projetarTeste(linhaV2(v2Calculado(0.25), { status: 'active', completed_at: null }), AGORA, null) as { result_metadata: { v2: Record<string, unknown>; ctr_lift_percent: number | null } }
    expect(out.result_metadata.v2).toMatchObject({ desfecho: 'vencedor_provavel', provisorio: false, n: 10315, p1: 0.04, base_estimada: false, gl: 6, p_adj: 0.01, vencedor_sugerido: 'b' })
    expect(out.result_metadata.v2.por_variante).toHaveLength(1)
    expect(out.result_metadata.v2.relogio).toMatchObject({ estado: 'ativo', teto: 15, ultima_avaliacao: { acao: 'seguir' } })
    expect(typeof (out.result_metadata.v2.relogio as { idade_horas: number }).idade_horas).toBe('number')
    expect(out.result_metadata.ctr_lift_percent).toBe(25)
  })
  it('provisorio_ate: só com provisorio=true e encerrado_em_dia; senão null (T12 T1)', () => {
    const ate = (v2: unknown) => (projetarTeste(linhaV2(v2), AGORA, null) as { result_metadata: { v2: { provisorio_ate: string | null } } }).result_metadata.v2.provisorio_ate
    expect(ate(v2Calculado(0.25, { provisorio: false, encerrado_em_dia: '2026-10-24' }))).toBeNull()
    expect(ate(v2Calculado(0.25, { provisorio: true }))).toBeNull()
    expect(ate(v2Calculado(0.25, { provisorio: true, encerrado_em_dia: '2026-10-24' }))).toBe('2026-11-04')
  })
  it('teste pausado => estado pausado, sem idade de avaliação', () => {
    const out = projetarTeste(linhaV2(v2Calculado(0.25), { status: 'paused', paused_at: '2026-10-23T00:00:00Z', completed_at: null }), AGORA, null) as { result_metadata: { v2: { relogio: { estado: string; idade_horas: number | null } } } }
    expect(out.result_metadata.v2.relogio).toMatchObject({ estado: 'pausado', idade_horas: null })
  })
  it('lift só em vencedor_provavel ou sem_diferenca_detectavel com sugerida; senão null', () => {
    const lift = (v2: unknown) => (projetarTeste(linhaV2(v2), AGORA, null) as { result_metadata: { ctr_lift_percent: number | null } }).result_metadata.ctr_lift_percent
    expect(lift(v2Calculado(0.25, { desfecho: 'inconclusivo_por_volume' }))).toBeNull()
    expect(lift(v2Calculado(0.25, { desfecho: 'sem_diferenca_detectavel' }))).toBe(25)
    expect(lift(v2Calculado(0.25, { desfecho: 'sem_diferenca_detectavel', vencedor_sugerido: null }))).toBeNull()
  })
  it('v2 ilegível => { ilegivel: true }; teste v1 => sem v2', () => {
    const o = (r: unknown) => (projetarTeste(r as Record<string, unknown>, AGORA, null) as { result_metadata: { v2?: unknown } }).result_metadata.v2
    expect(o(linhaV2({ desfecho: 'nao_existe' }))).toEqual({ ilegivel: true })
    expect(o(linhaV2(null, { regra_duracao: 'v1', result_metadata: {} }))).toBeUndefined()
  })
  it('placar.estatistica = calculada só com p_adj', () => {
    const placar = { regra: 'v2', estatistica: 'nao_calculada', variantes: [{ variant_id: 'o', impressoes: 10 }] } as never
    const est = (v2: unknown) => (projetarTeste(linhaV2(v2), AGORA, placar) as { placar: { estatistica: string }; aviso: unknown })
    expect(est(v2Calculado(0.2)).placar.estatistica).toBe('calculada')
    expect(est(v2Calculado(0.2)).aviso).toBeNull()
    expect(est(v2Calculado(0.2, { p_adj: null })).placar.estatistica).toBe('nao_calculada')
    expect(est(v2Calculado(0.2, { p_adj: null })).aviso).toBe(AVISO_SEM_ESTATISTICA)
  })
})

describe('get_test de rascunho: aviso_volume (paridade com a tela)', () => {
  beforeEach(() => vi.clearAllMocks())
  it('draft traz o aviso devolvido por avisoDeVolume; não-draft não chama', async () => {
    const aviso = { estado: 'sem_variantes', texto: 'adicione as variantes para estimar o volume' }
    vi.mocked(avisoDeVolume).mockResolvedValue({ ok: true, aviso } as never)
    const sb = sbDe({ ab_tests: { data: linhaV2(null, { status: 'draft', result_metadata: {} }), error: null } })
    const r = await getAbTest(ctx(sb), 't1')
    expect((r.data as unknown as { aviso_volume: unknown }).aviso_volume).toEqual(aviso)
    expect(avisoDeVolume).toHaveBeenCalledWith(expect.anything(), SITE, 't1', expect.any(Date))
    vi.mocked(avisoDeVolume).mockClear()
    await getAbTest(ctx(sbDe({ ab_tests: { data: linhaV2(null), error: null } })), 't1')
    expect(avisoDeVolume).not.toHaveBeenCalled()
  })
  it('Phil D3: rascunho v1 não chama avisoDeVolume e não traz aviso (a regra v2 não vale para ele)', async () => {
    vi.mocked(avisoDeVolume).mockClear()
    const sb = sbDe({ ab_tests: { data: linhaV2(null, { status: 'draft', regra_duracao: 'v1', result_metadata: {} }), error: null } })
    const r = await getAbTest(ctx(sb), 't1')
    expect(avisoDeVolume).not.toHaveBeenCalled()
    expect((r.data as unknown as { aviso_volume: unknown }).aviso_volume ?? null).toBeNull()
  })
  it('Phil D2: leitura do aviso falha => 200, aviso_volume null, aviso_volume_erro preenchido, nunca 500', async () => {
    vi.mocked(avisoDeVolume).mockResolvedValue({ ok: false, erro: 'leitura da entrega falhou' })
    const sb = sbDe({ ab_tests: { data: linhaV2(null, { status: 'draft', result_metadata: {} }), error: null } })
    const r = await getAbTest(ctx(sb), 't1')
    expect(r.error).toBeFalsy()
    expect(r.data).toMatchObject({ aviso_volume: null, aviso_volume_erro: 'leitura da entrega falhou' })
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })
  it('Phil D2: avisoDeVolume que lança também não derruba o get_test', async () => {
    vi.mocked(avisoDeVolume).mockRejectedValue(new Error('boom'))
    const sb = sbDe({ ab_tests: { data: linhaV2(null, { status: 'draft', result_metadata: {} }), error: null } })
    const r = await getAbTest(ctx(sb), 't1')
    expect(r.data).toMatchObject({ aviso_volume: null, aviso_volume_erro: expect.any(String) })
  })
})

describe('rotas agregadas: aviso honesto e uma leitura de dias', () => {
  beforeEach(() => vi.clearAllMocks())
  const concluidos = (n: number, v2PorIndice: Record<number, unknown> = {}) =>
    Array.from({ length: n }, (_, i) => linhaV2(v2PorIndice[i] ?? null, {
      id: `t${i}`, winner_variant_id: null, result_metadata: v2PorIndice[i] ? { v2: v2PorIndice[i] } : {}, youtube_video_id: 'yt1', test_type: 'thumbnail',
      winner: null,
    }))
  const rotas: Array<[string, (c: ServiceContext) => Promise<{ data: unknown }>]> = [
    ['getAbDashboard', (c) => getAbDashboard(c)],
    ['getAbVideoHistory', (c) => getAbVideoHistory(c, 'yt1')],
    ['getAbLearnings', (c) => getAbLearnings(c)],
    ['getAbPerformance', (c) => getAbPerformance(c)],
  ]
  // learnings e performance só olham teste com vitória humana
  const humano = (n: number) => concluidos(n).map((t) => ({ ...t, completed_reason: 'manual_winner', winner_variant_id: 'b', winner: [{ id: 'b', label: 'B', title_text: null, metadata: {} }] }))
  const linhas = (nome: string, n: number) => (nome === 'getAbLearnings' || nome === 'getAbPerformance' ? humano(n) : concluidos(n))

  for (const [nome, rota] of rotas) {
    it(`${nome}: 20 concluídos, placar medido em 1, sem p_adj => AVISO_SEM_ESTATISTICA e 1 leitura de dias`, async () => {
      const sb = sbDe({ ab_tests: { data: linhas(nome, 20), error: null }, ab_test_variants: { data: [], error: null }, ab_test_dias: { data: [dia('t3', 1000)], error: null } })
      const r = await rota(ctx(sb))
      expect((r.data as { aviso: unknown }).aviso).toBe(AVISO_SEM_ESTATISTICA)
      expect(nDeFrom(sb, 'ab_test_dias')).toBe(1)
    })
    it(`${nome}: sem nenhum placar => AVISO_SEM_METRICA_DE_ENTREGA`, async () => {
      const sb = sbDe({ ab_tests: { data: linhas(nome, 3), error: null }, ab_test_variants: { data: [], error: null }, ab_test_dias: { data: [], error: null } })
      expect(((await rota(ctx(sb))).data as { aviso: unknown }).aviso).toBe(AVISO_SEM_METRICA_DE_ENTREGA)
    })
    it(`${nome}: um placar com p_adj na resposta => sem aviso de falta de estatística`, async () => {
      const rows = linhas(nome, 3).map((t, i) => (i === 0 ? { ...t, result_metadata: { v2: v2Calculado(0.2) } } : t))
      const sb = sbDe({ ab_tests: { data: rows, error: null }, ab_test_variants: { data: [], error: null }, ab_test_dias: { data: [dia('t1', 1000)], error: null } })
      expect(((await rota(ctx(sb))).data as { aviso: unknown }).aviso).toBeNull()
    })
  }
})

describe('dashboard e histórico: desfecho_v2 e lift só com p_adj', () => {
  it('dashboard: contagem por desfecho, avgLift só sobre testes com p_adj, nula se nenhum', async () => {
    const rows = [
      linhaV2(v2Calculado(0.2), { id: 'a' }),
      linhaV2(v2Calculado(0.4, { desfecho: 'sem_diferenca_detectavel' }), { id: 'b' }),
      linhaV2(v2Calculado(0.9, { desfecho: 'inconclusivo_por_volume', p_adj: null }), { id: 'c' }),
    ]
    const sb = sbDe({ ab_tests: { data: rows, error: null }, ab_test_dias: { data: [], error: null } })
    const r = (await getAbDashboard(ctx(sb))).data as unknown as { avgLift: number | null; desfechos_v2: Record<string, number>; desfecho_v2_nota: string }
    expect(r.desfechos_v2).toEqual({ vencedor_provavel: 1, sem_diferenca_detectavel: 1, inconclusivo_por_volume: 1 })
    expect(r.avgLift).toBeCloseTo(30, 6)
    expect(r.desfecho_v2_nota).toContain('vitória só conta quando uma pessoa escolhe')
    const sb2 = sbDe({ ab_tests: { data: [rows[2]], error: null }, ab_test_dias: { data: [], error: null } })
    expect(((await getAbDashboard(ctx(sb2))).data as { avgLift: number | null }).avgLift).toBeNull()
  })
  it('Yannis D1: avgLift é o lift médio dos VENCEDORES (sem_diferenca não tem lift), com a contagem ao lado', async () => {
    const semDif = (id: string) => linhaV2(v2Calculado(0.03, { desfecho: 'sem_diferenca_detectavel', vencedor_sugerido: null }), { id })
    const rows = [linhaV2(v2Calculado(0.25), { id: 'a' }), semDif('b'), semDif('c')]
    const sb = sbDe({ ab_tests: { data: rows, error: null }, ab_test_dias: { data: [], error: null } })
    const r = (await getAbDashboard(ctx(sb))).data as unknown as { avgLift: number | null; vencedores_com_lift: number }
    expect(r.avgLift).toBeCloseTo(25, 6)
    expect(r.vencedores_com_lift).toBe(1)
    const sb2 = sbDe({ ab_tests: { data: [semDif('b')], error: null }, ab_test_dias: { data: [], error: null } })
    expect((await getAbDashboard(ctx(sb2))).data).toMatchObject({ avgLift: null, vencedores_com_lift: 0 })
  })
  it('histórico: desfecho_v2 por teste e liftPercent só com p_adj', async () => {
    const rows = [linhaV2(v2Calculado(0.2), { id: 'a', youtube_video_id: 'yt1' }), linhaV2(v2Calculado(0.9, { p_adj: null }), { id: 'c', youtube_video_id: 'yt1' })]
    const sb = sbDe({ ab_tests: { data: rows, error: null }, ab_test_dias: { data: [], error: null } })
    const t = (await getAbVideoHistory(ctx(sb), 'yt1')).data.tests as unknown as Array<{ id: string; desfecho_v2: string | null; liftPercent: number | null }>
    expect(t.find(x => x.id === 'a')).toMatchObject({ desfecho_v2: 'vencedor_provavel', liftPercent: 20 })
    expect(t.find(x => x.id === 'c')?.liftPercent).toBeNull()
  })
})
