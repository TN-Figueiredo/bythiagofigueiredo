import { describe, it, expect } from 'vitest'
import {
  calculateBayesianConfidence,
  calculateZTest,
  normalCdf,
  calculatePlayoffStats,
} from '@/lib/youtube/ab-statistics'
import type { VariantStats } from '@/lib/youtube/ab-types'

function makeVariant(id: string, impressions: number, clicks: number): VariantStats {
  return {
    variant_id: id,
    label: id,
    blob_url: null,
    title_text: null,
    description_text: null,
    metadata: {},
    is_original: id === 'A',
    total_impressions: impressions,
    total_clicks: clicks,
    avg_ctr: impressions > 0 ? clicks / impressions : 0,
    cycles_completed: 7,
  }
}

describe('normalCdf', () => {
  it('returns 0.5 for z=0', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4)
  })
  it('returns ~0.9772 for z=2', () => {
    expect(normalCdf(2)).toBeCloseTo(0.9772, 3)
  })
})

describe('calculateZTest', () => {
  it('detects significant difference with large samples', () => {
    const a = makeVariant('A', 5000, 250)
    const b = makeVariant('B', 5000, 350)
    const result = calculateZTest(a, b)
    expect(result.zScore).toBeGreaterThan(2)
    expect(result.pValue).toBeLessThan(0.05)
    expect(result.significant).toBe(true)
  })

  it('does not detect significance with small samples', () => {
    const a = makeVariant('A', 100, 5)
    const b = makeVariant('B', 100, 7)
    const result = calculateZTest(a, b)
    expect(result.significant).toBe(false)
  })

  it('handles equal CTRs', () => {
    const a = makeVariant('A', 1000, 50)
    const b = makeVariant('B', 1000, 50)
    const result = calculateZTest(a, b)
    expect(result.zScore).toBeCloseTo(0, 1)
    expect(result.significant).toBe(false)
  })

  it('handles zero impressions gracefully in zTest', () => {
    const result = calculateZTest(
      { variant_id: 'a', label: 'A', blob_url: null, is_original: true, total_impressions: 0, total_clicks: 0, avg_ctr: 0, cycles_completed: 0 },
      { variant_id: 'b', label: 'B', blob_url: null, is_original: false, total_impressions: 1000, total_clicks: 50, avg_ctr: 0.05, cycles_completed: 5 }
    )
    expect(result.zScore).toBe(0)
    expect(result.pValue).toBe(1)
    expect(result.significant).toBe(false)
  })

  it('handles both variants having zero impressions', () => {
    const result = calculateZTest(
      { variant_id: 'a', label: 'A', blob_url: null, is_original: true, total_impressions: 0, total_clicks: 0, avg_ctr: 0, cycles_completed: 0 },
      { variant_id: 'b', label: 'B', blob_url: null, is_original: false, total_impressions: 0, total_clicks: 0, avg_ctr: 0, cycles_completed: 0 }
    )
    expect(result.zScore).toBe(0)
    expect(result.pValue).toBe(1)
    expect(result.significant).toBe(false)
  })
})

describe('calculateBayesianConfidence', () => {
  it('returns high confidence when B clearly better', () => {
    const variants = [
      makeVariant('A', 5000, 250),
      makeVariant('B', 5000, 350),
    ]
    const result = calculateBayesianConfidence(variants)
    expect(result.winnerId).toBe('B')
    expect(result.confidence).toBeGreaterThan(0.95)
  })

  it('returns low confidence when difference is small', () => {
    const variants = [
      makeVariant('A', 200, 10),
      makeVariant('B', 200, 12),
    ]
    const result = calculateBayesianConfidence(variants)
    expect(result.confidence).toBeLessThan(0.9)
  })

  it('handles 3 variants', () => {
    const variants = [
      makeVariant('A', 3000, 150),
      makeVariant('B', 3000, 210),
      makeVariant('C', 3000, 120),
    ]
    const result = calculateBayesianConfidence(variants)
    expect(result.winnerId).toBe('B')
    expect(Object.keys(result.probabilities)).toHaveLength(3)
    const sum = Object.values(result.probabilities).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 1)
  })

  it('returns low confidence with very small sample sizes', () => {
    const variants = [
      makeVariant('A', 10, 1),
      makeVariant('B', 10, 2),
    ]
    const result = calculateBayesianConfidence(variants)
    expect(result.confidence).toBeLessThan(0.95)
  })

  it('handles identical variants', () => {
    const variants = [
      makeVariant('A', 5000, 250),
      makeVariant('B', 5000, 250),
    ]
    const result = calculateBayesianConfidence(variants)
    expect(result.confidence).toBeLessThan(0.7)
  })

  it('probabilities always sum to 1', () => {
    const variants = [
      makeVariant('A', 1000, 50),
      makeVariant('B', 1000, 60),
      makeVariant('C', 1000, 55),
      makeVariant('D', 1000, 45),
    ]
    const result = calculateBayesianConfidence(variants)
    const sum = Object.values(result.probabilities).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 1)
    expect(Object.keys(result.probabilities)).toHaveLength(4)
  })
})

describe('calculatePlayoffStats', () => {
  it('returns both bayesian and ptop2 from same MC samples', () => {
    const variants = [
      makeVariant('A', 3000, 150),
      makeVariant('B', 3000, 210),
      makeVariant('C', 3000, 120),
    ]
    const result = calculatePlayoffStats(variants)

    expect(result.bayesian.winnerId).toBe('B')
    expect(result.bayesian.confidence).toBeGreaterThan(0.5)
    expect(Object.keys(result.ptop2)).toHaveLength(3)

    const ptop2Sum = Object.values(result.ptop2).reduce((a, b) => a + b, 0)
    expect(ptop2Sum).toBeCloseTo(2, 0)
  })

  it('P(best) winner always has highest P(top2)', () => {
    const variants = [
      makeVariant('A', 5000, 500),
      makeVariant('B', 5000, 250),
      makeVariant('C', 5000, 200),
      makeVariant('D', 5000, 150),
    ]
    const result = calculatePlayoffStats(variants)
    expect(result.bayesian.winnerId).toBe('A')
    expect(result.ptop2['A']).toBeGreaterThan(0.95)
  })

  it('weakest variant has lowest P(top2)', () => {
    const variants = [
      makeVariant('A', 5000, 300),
      makeVariant('B', 5000, 350),
      makeVariant('C', 5000, 200),
      makeVariant('D', 5000, 50),
    ]
    const result = calculatePlayoffStats(variants)
    const dScore = result.ptop2['D']!
    for (const [id, score] of Object.entries(result.ptop2)) {
      if (id !== 'D') expect(dScore).toBeLessThanOrEqual(score)
    }
  })

  it('bayesian probabilities sum to 1, ptop2 sums to 2', () => {
    const variants = [
      makeVariant('A', 1000, 50),
      makeVariant('B', 1000, 60),
      makeVariant('C', 1000, 55),
      makeVariant('D', 1000, 45),
    ]
    const result = calculatePlayoffStats(variants)
    const bayesianSum = Object.values(result.bayesian.probabilities).reduce((a, b) => a + b, 0)
    const ptop2Sum = Object.values(result.ptop2).reduce((a, b) => a + b, 0)
    expect(bayesianSum).toBeCloseTo(1, 1)
    expect(ptop2Sum).toBeCloseTo(2, 0)
  })

  it('handles 2 variants — both get P(top2) = 1.0', () => {
    const variants = [
      makeVariant('A', 1000, 50),
      makeVariant('B', 1000, 60),
    ]
    const result = calculatePlayoffStats(variants)
    expect(result.ptop2['A']).toBeCloseTo(1, 1)
    expect(result.ptop2['B']).toBeCloseTo(1, 1)
  })
})
