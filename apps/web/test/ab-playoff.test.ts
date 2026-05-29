import { describe, it, expect } from 'vitest'
import { checkPlayoffEligibility, selectPlayoffVariants } from '@/lib/youtube/ab-playoff'
import type { VariantStats } from '@/lib/youtube/ab-types'

function makeVariant(
  id: string,
  impressions: number,
  clicks: number,
  opts: { is_original?: boolean; cycles?: number } = {},
): VariantStats {
  return {
    variant_id: id,
    label: id,
    blob_url: null,
    title_text: null,
    description_text: null,
    metadata: {},
    is_original: opts.is_original ?? false,
    total_impressions: impressions,
    total_clicks: clicks,
    avg_ctr: impressions > 0 ? clicks / impressions : 0,
    cycles_completed: opts.cycles ?? 4,
  }
}

describe('checkPlayoffEligibility', () => {
  const baseTest = {
    completed_reason: 'inconclusive' as const,
    test_type: 'thumbnail' as const,
    round_number: 1,
    parent_test_id: null,
    playoff_test_id: null,
    started_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  }

  const baseVariants = [
    makeVariant('orig', 3000, 150, { is_original: true, cycles: 4 }),
    makeVariant('B', 3000, 210, { cycles: 4 }),
    makeVariant('C', 3000, 180, { cycles: 4 }),
    makeVariant('D', 3000, 120, { cycles: 4 }),
  ]

  it('returns eligible for valid inconclusive thumbnail test', () => {
    const result = checkPlayoffEligibility(baseTest, baseVariants, true)
    expect(result.eligible).toBe(true)
  })

  it('rejects non-inconclusive test', () => {
    const result = checkPlayoffEligibility(
      { ...baseTest, completed_reason: 'auto_resolve' as const },
      baseVariants, true,
    )
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('inconclusive')
  })

  it('rejects title-only test type', () => {
    const result = checkPlayoffEligibility(
      { ...baseTest, test_type: 'title' as const },
      baseVariants, true,
    )
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('type')
  })

  it('rejects round 2 test', () => {
    const result = checkPlayoffEligibility(
      { ...baseTest, round_number: 2, parent_test_id: 'parent-1' },
      baseVariants, true,
    )
    expect(result.eligible).toBe(false)
  })

  it('rejects when playoff already exists', () => {
    const result = checkPlayoffEligibility(
      { ...baseTest, playoff_test_id: 'existing-playoff' },
      baseVariants, true,
    )
    expect(result.eligible).toBe(false)
  })

  it('rejects fewer than 3 non-original variants with data', () => {
    const variants = [
      makeVariant('orig', 3000, 150, { is_original: true, cycles: 4 }),
      makeVariant('B', 3000, 210, { cycles: 4 }),
      makeVariant('C', 3000, 180, { cycles: 4 }),
    ]
    const result = checkPlayoffEligibility(baseTest, variants, true)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('3 non-original')
  })

  it('rejects when avg daily impressions < 500', () => {
    const lowTraffic = [
      makeVariant('orig', 300, 15, { is_original: true, cycles: 4 }),
      makeVariant('B', 300, 21, { cycles: 4 }),
      makeVariant('C', 300, 18, { cycles: 4 }),
      makeVariant('D', 300, 12, { cycles: 4 }),
    ]
    const result = checkPlayoffEligibility(baseTest, lowTraffic, true)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('impressions')
  })

  it('rejects when cycles not fully backfilled', () => {
    const result = checkPlayoffEligibility(baseTest, baseVariants, false)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('backfill')
  })

  it('rejects when any variant has < 2 cycles', () => {
    const variants = [
      makeVariant('orig', 3000, 150, { is_original: true, cycles: 4 }),
      makeVariant('B', 3000, 210, { cycles: 4 }),
      makeVariant('C', 3000, 180, { cycles: 1 }),
      makeVariant('D', 3000, 120, { cycles: 4 }),
    ]
    const result = checkPlayoffEligibility(baseTest, variants, true)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('cycles')
  })

  it('rejects when any variant has < 200 impressions', () => {
    const variants = [
      makeVariant('orig', 3000, 150, { is_original: true, cycles: 4 }),
      makeVariant('B', 3000, 210, { cycles: 4 }),
      makeVariant('C', 150, 10, { cycles: 4 }),
      makeVariant('D', 3000, 120, { cycles: 4 }),
    ]
    const result = checkPlayoffEligibility(baseTest, variants, true)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('200 impressions')
  })

  it('accepts combo test type', () => {
    const result = checkPlayoffEligibility(
      { ...baseTest, test_type: 'combo' as const },
      baseVariants, true,
    )
    expect(result.eligible).toBe(true)
  })
})

describe('selectPlayoffVariants', () => {
  it('selects top 2 by P(top2)', () => {
    const variants = [
      makeVariant('orig', 5000, 250, { is_original: true }),
      makeVariant('B', 5000, 350),
      makeVariant('C', 5000, 300),
      makeVariant('D', 5000, 200),
    ]
    const result = selectPlayoffVariants(variants)
    expect(result).not.toBeNull()
    expect(result!.variantIds).toHaveLength(2)
    expect(result!.variantIds).toContain('B')
  })

  it('returns null when original is P(best)', () => {
    const variants = [
      makeVariant('orig', 5000, 500, { is_original: true }),
      makeVariant('B', 5000, 250),
      makeVariant('C', 5000, 200),
      makeVariant('D', 5000, 150),
    ]
    const result = selectPlayoffVariants(variants)
    expect(result).toBeNull()
  })

  it('returns null when fewer than 4 variants', () => {
    const variants = [
      makeVariant('orig', 5000, 250, { is_original: true }),
      makeVariant('B', 5000, 350),
      makeVariant('C', 5000, 300),
    ]
    const result = selectPlayoffVariants(variants)
    expect(result).toBeNull()
  })

  it('returns null when P(top2) gap between 2nd and 3rd < 5pp', () => {
    const variants = [
      makeVariant('orig', 5000, 250, { is_original: true }),
      makeVariant('B', 5000, 255),
      makeVariant('C', 5000, 253),
      makeVariant('D', 5000, 252),
    ]
    const result = selectPlayoffVariants(variants)
    expect(result).toBeNull()
  })
})
