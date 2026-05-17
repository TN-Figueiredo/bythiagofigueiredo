import { describe, it, expect } from 'vitest'
import { resolveDateRange, resolvePrevDateRange, getDaysBetween } from '@/lib/analytics/date-range'

const TOLERANCE_MS = 1000

function daysInMs(days: number) {
  return days * 24 * 60 * 60 * 1000
}

describe('resolveDateRange', () => {
  it('preset 7d returns a range spanning 7 days', () => {
    const { start, end } = resolveDateRange({ type: 'preset', value: '7d' })
    const span = end.getTime() - start.getTime()
    expect(span).toBeCloseTo(daysInMs(7), -3)
  })

  it('preset 30d returns a range spanning 30 days', () => {
    const { start, end } = resolveDateRange({ type: 'preset', value: '30d' })
    const span = end.getTime() - start.getTime()
    expect(span).toBeCloseTo(daysInMs(30), -3)
  })

  it('preset 90d returns a range spanning 90 days', () => {
    const { start, end } = resolveDateRange({ type: 'preset', value: '90d' })
    const span = end.getTime() - start.getTime()
    expect(span).toBeCloseTo(daysInMs(90), -3)
  })

  it('custom period uses provided start/end dates', () => {
    const { start, end } = resolveDateRange({
      type: 'custom',
      start: '2026-01-01',
      end: '2026-01-15',
    })
    expect(start.toISOString().slice(0, 10)).toBe('2026-01-01')
    expect(end.toISOString().slice(0, 10)).toBe('2026-01-15')
  })

  it('end date is approximately now for presets', () => {
    const now = Date.now()
    const { end } = resolveDateRange({ type: 'preset', value: '7d' })
    expect(Math.abs(end.getTime() - now)).toBeLessThan(TOLERANCE_MS)
  })
})

describe('resolvePrevDateRange', () => {
  it('returns null for custom periods', () => {
    const result = resolvePrevDateRange({
      type: 'custom',
      start: '2026-01-01',
      end: '2026-01-15',
    })
    expect(result).toBeNull()
  })

  it('returns null for all period', () => {
    const result = resolvePrevDateRange({ type: 'preset', value: 'all' })
    expect(result).toBeNull()
  })

  it('for 7d: end is ~7 days ago and start is ~14 days ago', () => {
    const now = Date.now()
    const result = resolvePrevDateRange({ type: 'preset', value: '7d' })
    expect(result).not.toBeNull()
    const { start, end } = result!
    expect(Math.abs(end.getTime() - (now - daysInMs(7)))).toBeLessThan(TOLERANCE_MS)
    expect(Math.abs(start.getTime() - (now - daysInMs(14)))).toBeLessThan(TOLERANCE_MS)
  })

  it('for 30d: end is ~30 days ago and start is ~60 days ago', () => {
    const now = Date.now()
    const result = resolvePrevDateRange({ type: 'preset', value: '30d' })
    expect(result).not.toBeNull()
    const { start, end } = result!
    expect(Math.abs(end.getTime() - (now - daysInMs(30)))).toBeLessThan(TOLERANCE_MS)
    expect(Math.abs(start.getTime() - (now - daysInMs(60)))).toBeLessThan(TOLERANCE_MS)
  })

  it('previous range end matches current range start (no gaps)', () => {
    const period = { type: 'preset', value: '7d' } as const
    const current = resolveDateRange(period)
    const prev = resolvePrevDateRange(period)
    expect(prev).not.toBeNull()
    expect(Math.abs(prev!.end.getTime() - current.start.getTime())).toBeLessThan(TOLERANCE_MS)
  })
})

describe('getDaysBetween', () => {
  it('returns 1 for same-day range', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const end = new Date('2026-01-01T12:00:00Z')
    expect(getDaysBetween(start, end)).toBe(1)
  })

  it('returns exact days for full-day boundaries', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const end = new Date('2026-01-08T00:00:00Z')
    expect(getDaysBetween(start, end)).toBe(7)
  })

  it('rounds up partial days', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const end = new Date('2026-01-02T01:00:00Z')
    expect(getDaysBetween(start, end)).toBe(2)
  })
})
