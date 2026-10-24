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

beforeEach(() => { ESPIAO.mockClear(); semear() })

describe('S8-F3 T3: a fonte da tela lê o placar', () => {
  it('1: números do placar nas variantes', async () => {
    const r = await getTestResults('t1')
    const a = r!.variants.find(v => v.variant_id === 'v-a')!
    const b = r!.variants.find(v => v.variant_id === 'v-b')!
    expect([a.total_impressions, a.total_clicks, a.avg_ctr]).toEqual([4000, 200, 0.05])
    expect(b.total_impressions).toBe(3000)
    expect(b.total_clicks).toBe(240)
    expect(b.avg_ctr).toBeCloseTo(0.08, 10)
    expect(r!.placar!.dias_descartados).toBe(1)
    expect(r!.placar!.variantes[1]!.dias_aguardando).toBe(1)
    expect(r!.faixa_dias).toHaveLength(9)
  })

  it('2: sem vencedor (C-11, D-F3-2)', async () => {
    const r = await getTestResults('t1')
    expect(r!.confidence).toBeNull()
    expect(r!.suggested_winner_id).toBeNull()
    expect(r!.is_significant).toBe(false)
    const d = await toDetailView(r!)
    if (d.status !== 'active') throw new Error('esperava ativo')
    expect(ESPIAO).not.toHaveBeenCalled()
    expect(d.variants.map(v => v.pBest)).toEqual([null, null])
    expect(d.gates.find(g => g.name === 'confidence')!.estado).toBe('nao_medido')
    expect(d.gates.find(g => g.name === 'min_impressions')!.value).toMatch(/3[.,\s]?000/)
  })

  it('2b: vitória da máquina nunca vira vencedor na v1 (I1)', async () => {
    semear(
      { status: 'completed', completed_at: dias(1), completed_reason: 'auto_winner', winner_variant_id: 'v-b' },
      [...[10, 9, 8, 7].map(n => dia('v-a', n, 'medido', 1000, 0.05)), ...[10, 9, 8, 7].map(n => dia('v-b', n, 'medido', 1000, 0.08))],
    )
    const d = await toDetailView((await getTestResults('t1'))!)
    if (d.status !== 'completed') throw new Error('esperava concluído')
    expect(d.outcome).toBe('playoff')
  })

  it('2c: o gate de volume lê impressoes_com_ctr (I4)', async () => {
    semear({}, [...diasPadrao(), dia('v-b', 5, 'medido', 5000, null)])
    const r = await getTestResults('t1')
    const b = r!.variants.find(v => v.variant_id === 'v-b')!
    expect(b.total_impressions).toBe(8000)
    expect(b.impressoes_com_ctr).toBe(3000)
    const d = await toDetailView(r!)
    if (d.status !== 'active') throw new Error('esperava ativo')
    const g = d.gates.find(x => x.name === 'min_impressions')!
    expect(JSON.stringify(g)).toMatch(/3[.,\s]?000/)
    expect(JSON.stringify(g)).not.toMatch(/4[.,\s]?000/)
  })

  it('3: C-8, B sem dia fica nulo e nunca 0', async () => {
    semear({}, diasPadrao().filter(d => d.variant_id !== 'v-b'))
    const r = await getTestResults('t1')
    const b = r!.variants.find(v => v.variant_id === 'v-b')!
    expect(b.total_impressions).toBeNull()
    expect(b.avg_ctr).toBeNull()
    expect(b.impressoes_com_ctr).toBeNull()
    const d = await toDetailView(r!)
    if (d.status !== 'active') throw new Error('esperava ativo')
    expect(d.gates.find(g => g.name === 'min_impressions')!.estado).toBe('nao_medido')
    expect(d.variants.find(v => v.label === 'B')!.impressions).toBeNull()
    expect(d.confirmedData.lift).toBeNull()
  })

  for (const tabela of ['ab_test_dias', 'ab_test_variants', 'ab_test_cycles', 'ab_tests']) {
    it(`4: erro em ${tabela} rejeita, nunca null`, async () => {
      estado.falha = q => (q.table === tabela ? { code: 'XX000', message: 'boom' } : null)
      await expect(getTestResults('t1')).rejects.toThrow(new RegExp(tabela))
    })
  }
  it('4b: teste inexistente devolve null; CTR 4.12 rejeita', async () => {
    await expect(getTestResults('nao-existe')).resolves.toBeNull()
    semear({}, [...diasPadrao(), dia('v-a', 5, 'medido', 100, 4.12)])
    await expect(getTestResults('t1')).rejects.toThrow(/ab_test_dias/)
  })

  it('5: filtro de site', async () => {
    semear({}, [...diasPadrao(), dia('v-a', 5, 'medido', 9999, 0.5, {}, 'site-2')])
    const r = await getTestResults('t1')
    expect(r!.variants.find(v => v.variant_id === 'v-a')!.total_impressions).toBe(4000)
    const qs = estado.fake!.on('ab_test_dias')
    expect(qs.length).toBeGreaterThan(0)
    expect(qs[0]!.filters).toContainEqual({ op: 'eq', col: 'site_id', value: 'site-1' })
  })
})
