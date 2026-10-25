// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakePostgrest, type FakeQuery } from '../helpers/fake-postgrest'
import { makeTestRow } from '../helpers/ab-fixtures'

const estado = vi.hoisted(() => ({
  tabelas: {} as Record<string, Array<Record<string, unknown>>>,
  falha: null as null | ((q: FakeQuery) => { code?: string; message: string } | null),
  fake: null as null | ReturnType<typeof import('../helpers/fake-postgrest').fakePostgrest>,
}))

vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => estado.fake!.client }))
vi.mock('@/lib/youtube/ab-statistics', async (orig) => {
  const real = await orig<typeof import('@/lib/youtube/ab-statistics')>()
  return { ...real, calculateBayesianConfidence: vi.fn((...a: Parameters<typeof real.calculateBayesianConfidence>) => real.calculateBayesianConfidence(...a)) }
})

import { getTestResults, toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { diasDaDecisao, type CicloComNumero } from '@/lib/youtube/ab-gravacao/decisao-v2'
import { diaDoTeste } from '@/lib/youtube/ab-dia-do-teste'

const ESPIAO = vi.mocked(calculateBayesianConfidence)
const dias = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
const diaPt = (n: number) => dias(n).slice(0, 10)

type Row = Record<string, unknown>
function ciclo(id: string, n: number, variant: string, o: Row = {}): Row {
  return {
    id, test_id: 't1', variant_id: variant, cycle_number: n, started_at: dias(5), ended_at: dias(4),
    backfill_status: 'pending', backfill_attempts: 0, applied_metadata: null, created_at: dias(5), ...o,
  }
}
const VARIANTES: Row[] = [
  { id: 'v-a', test_id: 't1', label: 'original', is_original: true, blob_url: null, blob_key: null, file_size_bytes: null, dimensions: null, title_text: null, metadata: {}, sort_order: 0, created_at: dias(9), source_variant_id: null },
  { id: 'v-b', test_id: 't1', label: 'B', is_original: false, blob_url: null, blob_key: null, file_size_bytes: null, dimensions: null, title_text: null, metadata: {}, sort_order: 1, created_at: dias(9), source_variant_id: null },
]
function dia(variant: string | null, n: number, estadoAlc: string, imp: number | null, ctr: number | null, extra: Row = {}, site = 'site-1'): Row {
  return {
    test_id: 't1', day_pt: diaPt(n), site_id: site, variant_id: variant, motivo_sem_variante: variant === null ? 'menos_de_90' : null,
    alcance_estado: estadoAlc, impressoes: imp, ctr, views: null, views_estado: 'nao_medido',
    retratado_em: dias(1), final: false, ...extra,
  }
}
function diasPadrao(): Row[] {
  return [
    ...[10, 9, 8, 7].map(n => dia('v-a', n, 'medido', 1000, 0.05)),
    ...[10, 9, 8].map(n => dia('v-b', n, 'medido', 1000, 0.08)),
    dia('v-b', 7, 'aguardando', null, null),
    dia(null, 6, 'nao_medido', null, null),
  ]
}
function semear(testO: Row = {}, diasLinhas: Row[] = diasPadrao()) {
  estado.falha = null
  estado.tabelas = {
    ab_tests: [{ ...makeTestRow({ id: 't1', site_id: 'site-1', status: 'active', started_at: dias(12) }), youtube_videos: { youtube_video_id: 'Abc123def45' }, ...testO }],
    ab_test_variants: VARIANTES.map(v => ({ ...v })),
    ab_test_cycles: [ciclo('c1', 1, 'v-a'), ciclo('c2', 2, 'v-b'), ciclo('c3', 3, 'v-a', { ended_at: null })],
    ab_test_polls: [],
    ab_test_dias: diasLinhas,
  }
  estado.fake = fakePostgrest({ tables: estado.tabelas, fail: q => estado.falha?.(q) ?? null })
}

const CONSULTAS_ANTES = 5

const V2 = { regra_duracao: 'v2', config: { max_duration_days: 15, teto_explicito: true }, result_metadata: { v2: { n: 100 } } }
const consultas = () => estado.fake!.queries.length

beforeEach(() => { ESPIAO.mockClear(); semear() })

describe('S8-F4 T12 T5: a fonte da tela entrega v2', () => {
  it('Y4: diasDaDecisao mapeia ciclo e bloco (V = 2) e o getTestResults usa a mesma função', async () => {
    semear(V2)
    const r = await getTestResults('t1')
    const ciclos = r!.timeline as unknown as CicloComNumero[]
    const linhas = diasPadrao() as Array<{ day_pt: string; variant_id: string | null; alcance_estado: 'medido'; impressoes: number | null; ctr: number | null; final: boolean }>
    const doBanco = [...linhas].sort((a, b) => a.day_pt.localeCompare(b.day_pt)) // a leitura ordena por dia
    expect(r!.dias_decisao).toEqual(diasDaDecisao(doBanco, ciclos, 2))
    expect(r!.dias_decisao).toHaveLength(linhas.length)
    expect(r!.dias_decisao.every(d => d.bloco === null || Number.isInteger(d.bloco))).toBe(true)
  })

  it('v2 ativo: view.v2.fase = ativo e dayOf = relógio por dias fechados', async () => {
    semear(V2)
    const d = await toDetailView((await getTestResults('t1'))!)
    expect(d.v2?.fase).toBe('ativo')
    if (d.v2?.fase !== 'ativo') return
    expect(d.dayOf).toBe(d.v2.dia)
    expect(d.durationDays).toBe(d.v2.teto)
    expect(d.v2.teto).toBe(15)
    expect(d.v2.dia).toBeGreaterThanOrEqual(4)
  })

  it('v1: view.v2 nulo e dayOf como hoje', async () => {
    const r = (await getTestResults('t1'))!
    const d = await toDetailView(r)
    expect(d.v2 ?? null).toBeNull()
    expect(d.dayOf).toBe(diaDoTeste(r.test.started_at, r.test.completed_at, new Date()) ?? 0)
  })

  it('zero consulta nova: v1 e v2 fazem o mesmo número de leituras', async () => {
    await getTestResults('t1')
    const v1 = consultas()
    semear(V2)
    await getTestResults('t1')
    expect(consultas()).toBe(v1)
    expect(v1).toBe(CONSULTAS_ANTES)
  })
})
