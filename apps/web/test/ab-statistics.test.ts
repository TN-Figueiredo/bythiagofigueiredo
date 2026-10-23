import { describe, it, expect } from 'vitest'
import {
  calculateBayesianConfidence,
  zDuasProporcoes,
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

describe('zDuasProporcoes', () => {
  it('detects significant difference with large samples', () => {
    const r = zDuasProporcoes(makeVariant('A', 5000, 250), makeVariant('B', 5000, 350))
    expect(r.estado).toBe('calculado')
    if (r.estado === 'calculado') {
      expect(r.z).toBeGreaterThan(2)
      expect(r.p).toBeLessThan(0.05)
    }
  })

  it('does not detect significance with small samples', () => {
    const r = zDuasProporcoes(makeVariant('A', 100, 5), makeVariant('B', 100, 7))
    expect(r.estado).toBe('calculado')
    if (r.estado === 'calculado') expect(r.p).toBeGreaterThanOrEqual(0.05)
  })

  it('handles equal CTRs', () => {
    const r = zDuasProporcoes(makeVariant('A', 1000, 50), makeVariant('B', 1000, 50))
    expect(r.estado).toBe('calculado')
    if (r.estado === 'calculado') expect(r.z).toBeCloseTo(0, 1)
  })

  it('zero impressions dá sem_volume, não pValue 1', () => {
    expect(zDuasProporcoes(makeVariant('A', 0, 0), makeVariant('B', 1000, 50)).estado).toBe('sem_volume')
  })

  it('both variants with zero impressions dá sem_volume', () => {
    expect(zDuasProporcoes(makeVariant('A', 0, 0), makeVariant('B', 0, 0)).estado).toBe('sem_volume')
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
