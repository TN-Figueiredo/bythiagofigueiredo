import { describe, it, expect } from 'vitest'
import { comparePeriods } from './comparator.js'
import type { AggregatedMetrics } from '../types.js'

function makeAggregated(overrides: Partial<AggregatedMetrics> = {}): AggregatedMetrics {
  return {
    totalClicks: 100,
    uniqueVisitors: 80,
    totalBots: 5,
    byCountry: {},
    byReferrer: {} as Record<string, number>,
    byDevice: {} as Record<string, number>,
    byBrowser: {},
    byOs: {},
    dailyBreakdown: [],
    ...overrides,
  }
}

describe('comparePeriods', () => {
  it('computes positive delta when current > previous', () => {
    const current = makeAggregated({ totalClicks: 150, uniqueVisitors: 120, totalBots: 10 })
    const previous = makeAggregated({ totalClicks: 100, uniqueVisitors: 80, totalBots: 5 })

    const result = comparePeriods(current, previous)
    expect(result.delta.clicks).toBe(50)
    expect(result.delta.clicksPercent).toBe(50)
    expect(result.delta.uniqueVisitors).toBe(40)
    expect(result.delta.uniqueVisitorsPercent).toBe(50)
    expect(result.delta.bots).toBe(5)
    expect(result.delta.botsPercent).toBe(100)
  })

  it('computes negative delta when current < previous', () => {
    const current = makeAggregated({ totalClicks: 50 })
    const previous = makeAggregated({ totalClicks: 100 })

    const result = comparePeriods(current, previous)
    expect(result.delta.clicks).toBe(-50)
    expect(result.delta.clicksPercent).toBe(-50)
  })

  it('handles zero previous (avoids division by zero)', () => {
    const current = makeAggregated({ totalClicks: 100 })
    const previous = makeAggregated({ totalClicks: 0 })

    const result = comparePeriods(current, previous)
    expect(result.delta.clicksPercent).toBe(100) // 100% when previous is 0 and current > 0
  })

  it('handles both zero', () => {
    const current = makeAggregated({ totalClicks: 0 })
    const previous = makeAggregated({ totalClicks: 0 })

    const result = comparePeriods(current, previous)
    expect(result.delta.clicks).toBe(0)
    expect(result.delta.clicksPercent).toBe(0)
  })

  it('returns both periods in the result', () => {
    const current = makeAggregated({ totalClicks: 200 })
    const previous = makeAggregated({ totalClicks: 100 })

    const result = comparePeriods(current, previous)
    expect(result.current.totalClicks).toBe(200)
    expect(result.previous.totalClicks).toBe(100)
  })
})
