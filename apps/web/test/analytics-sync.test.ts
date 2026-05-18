import { describe, it, expect } from 'vitest'
import {
  computeViewDeltas,
  detectViral,
  getIsoWeek,
} from '@/lib/youtube/analytics-sync'

describe('computeViewDeltas', () => {
  it('computes delta from previous count', () => {
    const result = computeViewDeltas(1500, 1000, 400)
    expect(result.delta_today).toBe(500)
    expect(result.yesterday).toBe(400)
  })

  it('handles first sync — no previous data (all zeros)', () => {
    const result = computeViewDeltas(1000, 0, 0)
    expect(result.delta_today).toBe(1000)
    expect(result.yesterday).toBe(0)
  })

  it('handles no change since last sync', () => {
    const result = computeViewDeltas(1000, 1000, 200)
    expect(result.delta_today).toBe(0)
    expect(result.yesterday).toBe(200)
  })

  it('clamps negative delta to 0 (view count correction / API jitter)', () => {
    const result = computeViewDeltas(900, 1000, 50)
    expect(result.delta_today).toBe(0)
  })

  it('passes previousYesterday through unchanged', () => {
    const result = computeViewDeltas(200, 100, 999)
    expect(result.yesterday).toBe(999)
  })

  it('handles zero current view count', () => {
    const result = computeViewDeltas(0, 0, 0)
    expect(result.delta_today).toBe(0)
    expect(result.yesterday).toBe(0)
  })

  it('handles large view counts correctly', () => {
    const result = computeViewDeltas(10_000_000, 9_900_000, 80_000)
    expect(result.delta_today).toBe(100_000)
    expect(result.yesterday).toBe(80_000)
  })
})

describe('detectViral', () => {
  it('detects viral when 48h views >= 5x channel average', () => {
    // 5000 + 800 = 5800; 5x avg = 5 * 200 = 1000 → 5800 >= 1000 ✓
    expect(detectViral(5000, 800, 200)).toBe(true)
  })

  it('does not flag below 5x threshold', () => {
    // 400 + 200 = 600; 5x avg = 5 * 200 = 1000 → 600 < 1000 ✗
    expect(detectViral(400, 200, 200)).toBe(false)
  })

  it('handles zero channel average — returns false (no division)', () => {
    expect(detectViral(100, 0, 0)).toBe(false)
    expect(detectViral(100_000, 50_000, 0)).toBe(false)
  })

  it('handles negative channel average — returns false', () => {
    expect(detectViral(100, 100, -1)).toBe(false)
  })

  it('returns false when both deltas are zero', () => {
    expect(detectViral(0, 0, 100)).toBe(false)
  })

  it('detects viral exactly at the 5x boundary', () => {
    // deltaToday=250, deltaYesterday=250, views48h=500, channelAvg48h=100 → 500 = 5*100 → true
    expect(detectViral(250, 250, 100)).toBe(true)
  })

  it('does not detect viral just below the 5x boundary', () => {
    // views48h = 499, 5x avg = 500 → 499 < 500 ✗
    expect(detectViral(249, 250, 100)).toBe(false)
  })

  it('handles NaN delta values — result is false (NaN comparisons return false)', () => {
    expect(detectViral(NaN, 0, 100)).toBe(false)
    expect(detectViral(0, NaN, 100)).toBe(false)
  })
})

describe('getIsoWeek', () => {
  it('returns correct ISO week string format', () => {
    const result = getIsoWeek(new Date('2026-05-17'))
    expect(result).toMatch(/^2026-W\d{2}$/)
  })

  it('returns 2026-W20 for 2026-05-17 (Sunday of ISO W20)', () => {
    // 2026-05-11 (Mon) – 2026-05-17 (Sun) is ISO W20
    expect(getIsoWeek(new Date('2026-05-17'))).toBe('2026-W20')
  })

  it('returns 2026-W19 for 2026-05-11 (Monday start of W19)', () => {
    expect(getIsoWeek(new Date('2026-05-11'))).toBe('2026-W19')
  })

  it('returns 2026-W01 for 2026-01-05 (first full ISO week of 2026)', () => {
    // ISO W01 2026: Jan 5 (Mon) – Jan 11 (Sun)
    expect(getIsoWeek(new Date('2026-01-05'))).toBe('2026-W01')
  })

  it('returns 2026-W01 for 2026-01-01 (Jan 1 belongs to W01 of 2026)', () => {
    // Jan 1 2026 is a Thursday — belongs to W01 2026
    expect(getIsoWeek(new Date('2026-01-01'))).toBe('2026-W01')
  })

  it('Dec 31 2026 belongs to W53 of 2026', () => {
    // Dec 31 2026 is a Thursday — belongs to W53 of 2026
    expect(getIsoWeek(new Date('2026-12-31'))).toBe('2026-W53')
  })

  it('Jan 1 2024 belongs to W01 of 2024 (Monday starts ISO W01)', () => {
    // Use local-time constructor to avoid UTC→local shift (São Paulo UTC-3 would make '2024-01-01' → Dec 31)
    expect(getIsoWeek(new Date(2024, 0, 1))).toBe('2024-W01')
  })

  it('Dec 31 2018 belongs to W52 of 2018 (year boundary)', () => {
    // Dec 31 2018 is a Monday but falls in the last ISO week of 2018
    expect(getIsoWeek(new Date('2018-12-31'))).toBe('2018-W52')
  })

  it('Dec 28 2020 belongs to W52 of 2020', () => {
    // Dec 28 2020 is a Monday in ISO week 52 of 2020
    expect(getIsoWeek(new Date('2020-12-28'))).toBe('2020-W52')
  })

  it('week number is zero-padded to 2 digits', () => {
    // W01 should be "W01", not "W1"
    const result = getIsoWeek(new Date('2026-01-05'))
    expect(result).toMatch(/W\d{2}$/)
    expect(result.split('-W')[1]!.length).toBe(2)
  })

  it('is stable — same date always returns same string', () => {
    const date = new Date('2026-03-15')
    expect(getIsoWeek(date)).toBe(getIsoWeek(date))
  })
})
