// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const cadeia: Record<string, unknown> = {}
for (const m of ['select', 'eq', 'neq', 'not', 'is', 'in', 'gte', 'lt', 'order', 'limit', 'from']) cadeia[m] = vi.fn().mockReturnValue(cadeia)
cadeia.single = vi.fn().mockResolvedValue({ data: null, error: null })
cadeia.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => cadeia }))

import { toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import { makeTestRow } from '../helpers/ab-fixtures'
import { AB_TEST_CONFIG_DEFAULTS } from '@/lib/youtube/ab-types'
import type { AbTestResults, AbTestCycleRow, VariantStats } from '@/lib/youtube/ab-types'

function stats(id: string, label: string, orig: boolean): VariantStats {
  return { variant_id: id, label, blob_url: null, title_text: null, metadata: {}, is_original: orig, total_impressions: 100, total_clicks: 5, avg_ctr: 0.05, cycles_completed: 1 }
}
function ciclo(n: number, variantId: string, inicio: string, fim: string | null): AbTestCycleRow {
  return { id: `c${n}`, test_id: 't', variant_id: variantId, cycle_number: n, started_at: inicio, ended_at: fim, impressions: 1, clicks: 1, ctr: 1, estimated_impressions: null, estimated_clicks: null, estimated_ctr: null, backfill_status: 'confirmed', backfill_attempts: 0, applied_metadata: null, created_at: inicio }
}

function resultados(pattern: 'abba' | 'random', pausedAt: string | null, fechados: number): AbTestResults {
  const vs = [stats('v-a', 'original', true), stats('v-b', 'B', false)]
  const timeline = Array.from({ length: fechados }, (_, i) => ciclo(i, i % 2 ? 'v-b' : 'v-a', `2026-10-0${i + 1}T10:00:00Z`, `2026-10-0${i + 2}T10:00:00Z`))
  return {
    test: makeTestRow({ status: 'paused', paused_at: pausedAt, config: { ...AB_TEST_CONFIG_DEFAULTS, rotation_pattern: pattern } }),
    variants: vs, confidence: 0.5, is_significant: false, suggested_winner_id: null,
    timeline, data_freshness: new Date().toISOString(), youtubeId: 'abc',
  } as AbTestResults
}

describe('M7d T1b: visão do detalhe', () => {
  it('pausedAt vem do paused_at; nulo quando a coluna é nula', async () => {
    const v = await toDetailView(resultados('abba', '2026-10-25T19:40:00Z', 1))
    expect(v.status === 'paused' || v.status === 'active').toBe(true)
    expect((v as { pausedAt: string | null }).pausedAt).toBe('2026-10-25T19:40:00Z')
    expect((await toDetailView(resultados('abba', null, 1)) as { pausedAt: string | null }).pausedAt).toBeNull()
  })
  it('proximaNaRotacao: ABBA, 2 variantes, done=1 segue getNextVariantIndex(abba, 2, 2)', async () => {
    const v = await toDetailView(resultados('abba', null, 1)) as { proximaNaRotacao: string | null }
    expect(v.proximaNaRotacao).toBe(['A', 'B'][getNextVariantIndex('abba', 2, 2)])
  })
  it('random: nulo', async () => {
    expect((await toDetailView(resultados('random', null, 1)) as { proximaNaRotacao: string | null }).proximaNaRotacao).toBeNull()
  })
})
