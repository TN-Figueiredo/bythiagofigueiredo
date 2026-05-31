import { describe, it, expect } from 'vitest'
import { computeOutlierScore, computeRevenueRange, computeDaysRemaining } from '@/lib/youtube/ab-computed'

describe('computeOutlierScore', () => {
  it('returns null with fewer than 9 predecessors', () => {
    expect(computeOutlierScore(1000, [100, 200, 300])).toBeNull()
  })

  it('returns null when multiplier < 2', () => {
    const predecessors = [100, 100, 100, 100, 100, 100, 100, 100, 100]
    expect(computeOutlierScore(140, predecessors)).toBeNull()
  })

  it('returns blue badge for 2-5x median', () => {
    const predecessors = [100, 100, 100, 100, 100, 100, 100, 100, 100]
    const result = computeOutlierScore(300, predecessors)
    expect(result).toEqual({ multiplier: 3, badge: 'blue' })
  })

  it('returns purple badge for 5-10x median', () => {
    const predecessors = [100, 100, 100, 100, 100, 100, 100, 100, 100]
    const result = computeOutlierScore(700, predecessors)
    expect(result).toEqual({ multiplier: 7, badge: 'purple' })
  })

  it('returns red badge for >10x median', () => {
    const predecessors = [100, 100, 100, 100, 100, 100, 100, 100, 100]
    const result = computeOutlierScore(1500, predecessors)
    expect(result).toEqual({ multiplier: 15, badge: 'red' })
  })

  it('handles zero median safely (uses 1 as floor)', () => {
    const predecessors = [0, 0, 0, 0, 0, 0, 0, 0, 0]
    const result = computeOutlierScore(100, predecessors)
    expect(result).toEqual({ multiplier: 100, badge: 'red' })
  })
})

describe('computeRevenueRange', () => {
  it('computes range from views and default RPM', () => {
    const result = computeRevenueRange(10000)
    expect(result).toEqual({ low: 5, high: 40, currency: 'BRL', isDefault: true })
  })

  it('uses custom RPM', () => {
    const result = computeRevenueRange(10000, [2.0, 6.0])
    expect(result).toEqual({ low: 20, high: 60, currency: 'BRL', isDefault: false })
  })

  it('returns 0 for 0 views', () => {
    const result = computeRevenueRange(0)
    expect(result.low).toBe(0)
    expect(result.high).toBe(0)
  })
})

describe('computeDaysRemaining', () => {
  it('returns null with fewer than 5 data points', () => {
    expect(computeDaysRemaining([100, 90, 80])).toBeNull()
  })

  it('estimates days via exponential decay', () => {
    const impressions = [1000, 800, 640, 512, 410]
    const result = computeDaysRemaining(impressions)
    expect(result).not.toBeNull()
    expect(result!.days).toBeGreaterThan(0)
    expect(result!.model).toBe('exponential')
  })

  it('falls back to linear when lambda < 0.01 (flat curve)', () => {
    const impressions = [1000, 999, 998, 997, 996]
    const result = computeDaysRemaining(impressions)
    expect(result).not.toBeNull()
    expect(result!.model).toBe('linear')
  })

  it('returns 0 days when current is already below threshold', () => {
    const impressions = [100, 80, 60, 40, 20]
    const result = computeDaysRemaining(impressions, 50)
    expect(result).not.toBeNull()
    expect(result!.days).toBe(0)
  })
})
