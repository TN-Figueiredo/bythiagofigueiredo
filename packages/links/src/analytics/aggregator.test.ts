import { describe, it, expect } from 'vitest'
import { aggregateMetrics, groupByDate } from './aggregator.js'
import type { DailyMetric } from '../types.js'

function makeMetric(overrides: Partial<DailyMetric> = {}): DailyMetric {
  return {
    linkId: 'link-1',
    date: '2026-05-01',
    clicks: 10,
    uniqueVisitors: 8,
    bots: 1,
    topCountry: 'BR',
    topReferrer: 'google',
    topDevice: 'desktop',
    ...overrides,
  }
}

describe('aggregateMetrics', () => {
  it('sums clicks, unique visitors, and bots', () => {
    const daily = [
      makeMetric({ clicks: 10, uniqueVisitors: 8, bots: 1 }),
      makeMetric({ date: '2026-05-02', clicks: 20, uniqueVisitors: 15, bots: 3 }),
    ]
    const result = aggregateMetrics(daily)
    expect(result.totalClicks).toBe(30)
    expect(result.uniqueVisitors).toBe(23)
    expect(result.totalBots).toBe(4)
  })

  it('aggregates by country', () => {
    const daily = [
      makeMetric({ topCountry: 'BR', clicks: 10 }),
      makeMetric({ date: '2026-05-02', topCountry: 'US', clicks: 5 }),
      makeMetric({ date: '2026-05-03', topCountry: 'BR', clicks: 7 }),
    ]
    const result = aggregateMetrics(daily)
    expect(result.byCountry['BR']).toBe(17)
    expect(result.byCountry['US']).toBe(5)
  })

  it('aggregates by referrer', () => {
    const daily = [
      makeMetric({ topReferrer: 'google', clicks: 10 }),
      makeMetric({ date: '2026-05-02', topReferrer: 'social', clicks: 5 }),
    ]
    const result = aggregateMetrics(daily)
    expect(result.byReferrer['google']).toBe(10)
    expect(result.byReferrer['social']).toBe(5)
  })

  it('aggregates by device', () => {
    const daily = [
      makeMetric({ topDevice: 'desktop', clicks: 10 }),
      makeMetric({ date: '2026-05-02', topDevice: 'mobile', clicks: 5 }),
    ]
    const result = aggregateMetrics(daily)
    expect(result.byDevice['desktop']).toBe(10)
    expect(result.byDevice['mobile']).toBe(5)
  })

  it('includes dailyBreakdown', () => {
    const daily = [makeMetric(), makeMetric({ date: '2026-05-02' })]
    const result = aggregateMetrics(daily)
    expect(result.dailyBreakdown).toHaveLength(2)
  })

  it('handles empty array', () => {
    const result = aggregateMetrics([])
    expect(result.totalClicks).toBe(0)
    expect(result.uniqueVisitors).toBe(0)
    expect(result.dailyBreakdown).toHaveLength(0)
  })
})

describe('groupByDate', () => {
  it('merges rows with the same date', () => {
    const daily = [
      makeMetric({ date: '2026-05-01', clicks: 5, uniqueVisitors: 3, bots: 0 }),
      makeMetric({ date: '2026-05-01', clicks: 7, uniqueVisitors: 5, bots: 1 }),
      makeMetric({ date: '2026-05-02', clicks: 10, uniqueVisitors: 8, bots: 2 }),
    ]
    const result = groupByDate(daily)
    expect(result).toHaveLength(2)
    expect(result[0]!.date).toBe('2026-05-01')
    expect(result[0]!.clicks).toBe(12)
    expect(result[0]!.uniqueVisitors).toBe(8)
    expect(result[0]!.bots).toBe(1)
    expect(result[1]!.date).toBe('2026-05-02')
    expect(result[1]!.clicks).toBe(10)
  })

  it('returns sorted by date ascending', () => {
    const daily = [
      makeMetric({ date: '2026-05-03' }),
      makeMetric({ date: '2026-05-01' }),
      makeMetric({ date: '2026-05-02' }),
    ]
    const result = groupByDate(daily)
    expect(result.map((d) => d.date)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])
  })

  it('handles empty array', () => {
    expect(groupByDate([])).toEqual([])
  })
})
