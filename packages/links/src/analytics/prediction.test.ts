import { describe, it, expect } from 'vitest'
import { predictClicks } from './prediction.js'
import type { DailyMetric } from '../types.js'

function makeDaily(date: string, clicks: number): DailyMetric {
  return {
    linkId: 'link-1',
    date,
    clicks,
    uniqueVisitors: clicks,
    bots: 0,
    topCountry: null,
    topReferrer: null,
    topDevice: null,
  }
}

describe('predictClicks', () => {
  it('predicts linearly increasing traffic', () => {
    const daily = [
      makeDaily('2026-05-01', 10),
      makeDaily('2026-05-02', 20),
      makeDaily('2026-05-03', 30),
      makeDaily('2026-05-04', 40),
      makeDaily('2026-05-05', 50),
    ]

    const result = predictClicks(daily, 3)
    expect(result.forecastDays).toBe(3)
    expect(result.predictedClicks).toHaveLength(3)
    // With perfect linear data (y=10x+10): x=5→60, x=6→70, x=7→80
    expect(result.predictedClicks[0]).toBe(60)
    expect(result.predictedClicks[1]).toBe(70)
    expect(result.predictedClicks[2]).toBe(80)
    expect(result.slope).toBeCloseTo(10, 5)
    expect(result.intercept).toBeCloseTo(10, 5)
    // R² should be 1.0 for perfect linear data, and confidence = R² * dataSufficiency
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('handles flat traffic (zero slope)', () => {
    const daily = [
      makeDaily('2026-05-01', 100),
      makeDaily('2026-05-02', 100),
      makeDaily('2026-05-03', 100),
    ]

    const result = predictClicks(daily, 2)
    expect(result.slope).toBeCloseTo(0, 5)
    expect(result.predictedClicks[0]).toBe(100)
    expect(result.predictedClicks[1]).toBe(100)
  })

  it('never predicts negative clicks', () => {
    const daily = [
      makeDaily('2026-05-01', 100),
      makeDaily('2026-05-02', 50),
      makeDaily('2026-05-03', 10),
    ]

    const result = predictClicks(daily, 10)
    for (const p of result.predictedClicks) {
      expect(p).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns zero confidence for insufficient data (< 2 days)', () => {
    const daily = [makeDaily('2026-05-01', 10)]
    const result = predictClicks(daily, 3)
    expect(result.confidence).toBe(0)
    expect(result.predictedClicks).toEqual([0, 0, 0])
  })

  it('handles empty data', () => {
    const result = predictClicks([], 3)
    expect(result.confidence).toBe(0)
    expect(result.predictedClicks).toEqual([0, 0, 0])
  })

  it('generates correct future dates', () => {
    const daily = [
      makeDaily('2026-05-01', 10),
      makeDaily('2026-05-02', 20),
    ]
    const result = predictClicks(daily, 3)
    expect(result.dates).toEqual(['2026-05-03', '2026-05-04', '2026-05-05'])
  })

  it('data sufficiency scales confidence for < 30 data points', () => {
    // 5 perfect linear points: R²=1.0, sufficiency=5/30≈0.167
    const daily = Array.from({ length: 5 }, (_, i) =>
      makeDaily(`2026-05-${String(i + 1).padStart(2, '0')}`, (i + 1) * 10),
    )
    const result = predictClicks(daily, 1)
    expect(result.confidence).toBeCloseTo(5 / 30, 2) // R²=1, sufficiency=5/30
  })
})
