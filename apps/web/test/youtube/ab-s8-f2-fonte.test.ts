// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { bancoFalso } from '../helpers/ab-banco-falso'
import { makeTestRow, makeTestWithVariants } from '../helpers/ab-fixtures'
import type { AbTestResults, VariantStats } from '@/lib/youtube/ab-types'

const estado = vi.hoisted(() => ({ sementes: {} as Record<string, unknown[]> }))

vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => bancoFalso(estado.sementes) }))
vi.mock('@/lib/youtube/ab-statistics', async (orig) => {
  const real = await orig<typeof import('@/lib/youtube/ab-statistics')>()
  return { ...real, calculateBayesianConfidence: vi.fn((...a: Parameters<typeof real.calculateBayesianConfidence>) => real.calculateBayesianConfidence(...a)) }
})

import { getTestResults, toDetailView, toCardView, temVolumeParaBayes } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { SEM_MEDICAO_DE_ENTREGA } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-constants'

const ESPIAO = vi.mocked(calculateBayesianConfidence)
const QUERIES = readFileSync('src/app/cms/(authed)/youtube/ab-lab/queries.ts', 'utf8')
const dias = (n: number) => new Date(Date.now() - n * 86400000).toISOString()

function ciclo(id: string, n: number, variant: string, o: Record<string, unknown>) {
  return {
    id, test_id: 't1', variant_id: variant, cycle_number: n, started_at: dias(5), ended_at: dias(4),
    backfill_status: 'pending', backfill_attempts: 0, applied_metadata: null, created_at: dias(5), ...o,
  }
}
const VARIANTES = [
  { id: 'v-a', test_id: 't1', label: 'original', is_original: true, blob_url: null, blob_key: null, file_size_bytes: null, dimensions: null, title_text: null, metadata: {}, sort_order: 0, created_at: dias(9), source_variant_id: null },
  { id: 'v-b', test_id: 't1', label: 'B', is_original: false, blob_url: null, blob_key: null, file_size_bytes: null, dimensions: null, title_text: null, metadata: {}, sort_order: 1, created_at: dias(9), source_variant_id: null },
]
function semear(testOverrides: Record<string, unknown> = {}) {
  estado.sementes = {
    ab_tests: [{ ...makeTestRow({ id: 't1', site_id: 'site-1', status: 'active', started_at: dias(9) }), youtube_videos: { youtube_video_id: 'Abc123def45' }, ...testOverrides }],
    ab_test_variants: VARIANTES,
    ab_test_cycles: [
      ciclo('c1', 1, 'v-a', { backfill_status: 'confirmed', impressions: 1200, clicks: 0, ctr: 0 }),
      ciclo('c2', 2, 'v-b', { backfill_status: 'confirmed', impressions: 900, clicks: 0, ctr: 0 }),
      ciclo('c3', 3, 'v-a', { ended_at: null }),
      ciclo('c4', 4, 'v-b', {}),
      ciclo('c5', 5, 'v-a', { end_reason: 'pausa' }),
    ],
    ab_test_polls: [],
  }
}
function vs(id: string, imp: number | null, clk: number | null, label = id, original = false): VariantStats {
  return { variant_id: id, label, blob_url: null, title_text: null, metadata: {}, is_original: original,
    total_impressions: imp, total_clicks: clk, avg_ctr: imp && clk !== null ? clk / imp : null, cycles_completed: 1 }
}
function resultados(variants: VariantStats[], testO: Record<string, unknown> = {}): AbTestResults {
  return {
    test: makeTestRow({ id: 't1', status: 'active', ...testO } as never), variants, confidence: null, is_significant: false,
    suggested_winner_id: null, timeline: [], data_freshness: new Date().toISOString(),
  } as unknown as AbTestResults
}

beforeEach(() => { ESPIAO.mockClear(); semear() })

describe('S8-F2 T6: a fonte dá nulo', () => {
  it('1: getTestResults não soma views dos ciclos', async () => {
    const r = await getTestResults('t1')
    expect(r).not.toBeNull()
    for (const v of r!.variants) {
      expect(v.total_impressions).toBeNull()
      expect(v.total_clicks).toBeNull()
      expect(v.avg_ctr).toBeNull()
    }
    expect(r!.variants.find(v => v.variant_id === 'v-a')!.cycles_completed).toBe(2)
    expect(r!.variants.find(v => v.variant_id === 'v-b')!.cycles_completed).toBe(2)
    expect(r!.confidence).toBeNull()
    expect(r!.suggested_winner_id).toBeNull()
    expect(r!.is_significant).toBe(false)
  })

  it('2: o Bayes não recebe número dos ciclos', async () => {
    await getTestResults('t1')
    const s = JSON.stringify(ESPIAO.mock.calls)
    expect(s).not.toContain('1200')
    expect(s).not.toContain('900')
    expect(QUERIES).not.toContain('zDuasProporcoes')
  })

  it('3: toDetailView da fonte nula', async () => {
    const r = await getTestResults('t1')
    const d = await toDetailView(r!)
    if (d.status !== 'active' && d.status !== 'paused') throw new Error('esperava ativo')
    for (const v of d.variants) {
      expect(v.impressions).toBeNull(); expect(v.clicks).toBeNull(); expect(v.ctr).toBeNull(); expect(v.pBest).toBeNull()
    }
    const g = (n: string) => d.gates.find(x => x.name === n)!
    expect(g('min_impressions').estado).toBe('nao_medido')
    expect(g('min_impressions').value).toBe('não medido')
    expect(g('confidence').estado).toBe('nao_medido')
    expect(g('stability').estado).toBe('nao_medido')
    expect(Object.values(d.daily).every(a => a.length === 0)).toBe(true)
    expect(d.confTrend).toEqual([])
    expect(d.confirmedData.confidence).toBeNull()
    expect(d.confirmedData.lift).toBeNull()
  })

  it('4: A medida e B nula nunca vira zero nem sem diferença', async () => {
    const r = resultados([vs('v-a', 1000, 50, 'original', true), vs('v-b', null, null, 'B')])
    const d = await toDetailView(r)
    if (d.status !== 'active') throw new Error('esperava ativo')
    expect(d.variants.map(v => v.pBest)).toEqual([null, null])
    expect(d.gates.find(g => g.name === 'min_impressions')!.estado).toBe('nao_medido')
    expect(d.confirmedData.lift).toBeNull()
    expect(d.confirmedData.lift).not.toBe(0)
  })

  const concluido = (reason: string | null) => resultados(
    [vs('v-a', null, null, 'original', true), vs('v-b', null, null, 'B')],
    { status: 'completed', winner_variant_id: 'v-b', completed_reason: reason, completed_at: dias(1) },
  )
  it('5a: vitória humana sem alcance mostra vencedor com nulos', async () => {
    const d = await toDetailView(concluido('manual_apply'))
    if (d.status !== 'completed' || d.outcome !== 'winner') throw new Error('esperava vencedor')
    expect(d.lift).toBeNull()
    expect(d.resultMeta.ctrBefore).toBeNull()
    expect(d.resultMeta.ctrAfter).toBeNull()
    expect(d.resultMeta.totalImpressions).toBeNull()
    expect(SEM_MEDICAO_DE_ENTREGA).toMatch(/não medido/)
  })
  it('5b: auto_winner sem alcance vira playoff sem finalistas', async () => {
    const d = await toDetailView(concluido('auto_winner'))
    if (d.status !== 'completed' || d.outcome !== 'playoff') throw new Error('esperava playoff')
    expect(d.finalists).toEqual([])
  })
  it('5c: sem razão cai na guarda', async () => {
    const d = await toDetailView(concluido(null))
    if (d.status !== 'completed' || d.outcome !== 'playoff') throw new Error('esperava playoff')
    expect(d.finalists).toEqual([])
  })

  it('5d: Bayes calculado com variantes medidas preenche pBest 0 e não null', async () => {
    ESPIAO.mockReturnValueOnce({ estado: 'calculado', winnerId: 'v-b', confidence: 0.99, probabilities: { 'v-a': 0, 'v-b': 1 } } as never)
    const d = await toDetailView(resultados([vs('v-a', 500, 10, 'original', true), vs('v-b', 500, 40, 'B')]))
    if (d.status !== 'active') throw new Error('esperava ativo')
    expect(d.variants.find(v => v.label === 'A')!.pBest).toBe(0)
  })

  it('6: vencedor com ambos medidos e com A nulo', async () => {
    const base = { status: 'completed', winner_variant_id: 'v-b', completed_reason: 'manual_apply', completed_at: dias(1) }
    const d = await toDetailView(resultados([vs('v-a', 1000, 50, 'original', true), vs('v-b', 1000, 80, 'B')], base))
    if (d.status !== 'completed' || d.outcome !== 'winner') throw new Error('winner')
    expect(d.lift).toBeCloseTo(60, 5)
    expect(d.resultMeta.totalImpressions).toBe(2000)
    const a = vs('v-a', 1000, null, 'original', true)
    const d2 = await toDetailView(resultados([a, vs('v-b', 1000, 80, 'B')], base))
    if (d2.status !== 'completed' || d2.outcome !== 'winner') throw new Error('winner')
    expect(d2.lift).toBeNull()
    expect(d2.resultMeta.ctrBefore).toBeNull()
  })

  it('7: cartão segue sem lift e confiança; bloco morto saiu', () => {
    const c = toCardView(makeTestWithVariants())
    expect(c.lift).toBeNull()
    expect(c.confidence).toBeNull()
    expect(QUERIES).not.toContain('statsMap.set(v.id, { impressions')
  })

  it('8: guarda estática', () => {
    expect(QUERIES).not.toMatch(/\b(cycle|c)\.(impressions|clicks|ctr)\b/)
    expect(QUERIES).not.toContain("backfill_status === 'confirmed'")
    const bloco = QUERIES.slice(QUERIES.indexOf('export async function getTestResults'), QUERIES.indexOf('export async function getAbSiteSettings'))
    expect(bloco).not.toMatch(/as AbTestCycleRow\[\]/)
  })

  it('temVolumeParaBayes', () => {
    expect(temVolumeParaBayes([vs('a', 100, 1), vs('b', 100, 1)])).toBe(true)
    expect(temVolumeParaBayes([vs('a', 100, 1), vs('b', null, null)])).toBe(false)
    expect(temVolumeParaBayes([vs('a', 99, 1), vs('b', 100, 1)])).toBe(false)
  })
})
