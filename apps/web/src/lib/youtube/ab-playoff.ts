import type { VariantStats, CompletedReason, TestType } from './ab-types'
import { calculatePlayoffStats } from './ab-statistics'

interface PlayoffTestInfo {
  completed_reason: CompletedReason | null
  test_type: TestType
  round_number: number
  parent_test_id: string | null
  playoff_test_id: string | null
  started_at: string | null
}

interface EligibilityResult {
  eligible: boolean
  reason?: string
}

export function checkPlayoffEligibility(
  test: PlayoffTestInfo,
  variants: VariantStats[],
  allCyclesBackfilled: boolean,
): EligibilityResult {
  if (test.completed_reason !== 'inconclusive') {
    return { eligible: false, reason: 'Only inconclusive tests are eligible' }
  }

  if (test.test_type !== 'thumbnail' && test.test_type !== 'combo') {
    return { eligible: false, reason: 'Only thumbnail/combo type eligible' }
  }

  if (test.round_number !== 1 || test.parent_test_id !== null) {
    return { eligible: false, reason: 'Only Round 1 tests can spawn playoffs' }
  }

  if (test.playoff_test_id !== null) {
    return { eligible: false, reason: 'Playoff already exists' }
  }

  if (!allCyclesBackfilled) {
    return { eligible: false, reason: 'All cycles must be in terminal backfill status' }
  }

  const nonOriginalWithData = variants.filter(v => !v.is_original && v.total_impressions > 0)
  if (nonOriginalWithData.length < 3) {
    return { eligible: false, reason: 'Need ≥ 3 non-original variants with data' }
  }

  for (const v of variants) {
    if (v.cycles_completed < 2) {
      return { eligible: false, reason: `Variant ${v.label} has < 2 confirmed cycles` }
    }
    if (v.total_impressions < 200) {
      return { eligible: false, reason: `Variant ${v.label} has < 200 impressions` }
    }
  }

  const totalImpressions = variants.reduce((s, v) => s + v.total_impressions, 0)
  const startedAt = test.started_at ? new Date(test.started_at) : null
  const daysSinceStart = startedAt
    ? (Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 1
  const avgDailyImpressions = daysSinceStart > 0 ? totalImpressions / daysSinceStart : 0
  if (avgDailyImpressions < 500) {
    return { eligible: false, reason: `Avg daily impressions ${Math.round(avgDailyImpressions)} < 500` }
  }

  return { eligible: true }
}

interface PlayoffSelection {
  variantIds: [string, string]
  labels: [string, string]
  ptop2: Record<string, number>
}

export function selectPlayoffVariants(
  variants: VariantStats[],
): PlayoffSelection | null {
  if (variants.length < 4) return null

  const { bayesian, ptop2 } = calculatePlayoffStats(variants)
  const originalVariant = variants.find(v => v.is_original)

  if (originalVariant && bayesian.winnerId === originalVariant.variant_id) {
    return null
  }

  const sorted = [...variants]
    .sort((a, b) => {
      const diff = (ptop2[b.variant_id] ?? 0) - (ptop2[a.variant_id] ?? 0)
      if (Math.abs(diff) > 0.0001) return diff
      if (a.total_impressions !== b.total_impressions) {
        return b.total_impressions - a.total_impressions
      }
      return (a.is_original ? 999 : 0) - (b.is_original ? 999 : 0)
    })

  const top2 = sorted.slice(0, 2)
  const third = sorted[2]

  if (!top2[0] || !top2[1] || !third) return null

  const secondPtop2 = ptop2[top2[1].variant_id] ?? 0
  const thirdPtop2 = ptop2[third.variant_id] ?? 0

  if (secondPtop2 - thirdPtop2 < 0.05) {
    return null
  }

  return {
    variantIds: [top2[0].variant_id, top2[1].variant_id],
    labels: [top2[0].label, top2[1].label],
    ptop2,
  }
}
