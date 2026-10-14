import { describe, it, expect } from 'vitest'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'

describe('getIsoWeek', () => {
  it('returns correct ISO week string format', () => {
    const result = getIsoWeek(new Date(2026, 4, 17))
    expect(result).toMatch(/^2026-W\d{2}$/)
  })

  it('returns 2026-W20 for 2026-05-17 (Sunday of ISO W20)', () => {
    expect(getIsoWeek(new Date(2026, 4, 17))).toBe('2026-W20')
  })

  it('returns 2026-W20 for 2026-05-11 (Monday start of W20)', () => {
    expect(getIsoWeek(new Date(2026, 4, 11))).toBe('2026-W20')
  })

  it('returns 2026-W02 for 2026-01-05 (Monday start of W02)', () => {
    expect(getIsoWeek(new Date(2026, 0, 5))).toBe('2026-W02')
  })

  it('returns 2026-W01 for 2026-01-01 (Jan 1 belongs to W01 of 2026)', () => {
    expect(getIsoWeek(new Date(2026, 0, 1))).toBe('2026-W01')
  })

  it('Dec 31 2026 belongs to W53 of 2026', () => {
    expect(getIsoWeek(new Date(2026, 11, 31))).toBe('2026-W53')
  })

  it('Jan 1 2024 belongs to W01 of 2024 (Monday starts ISO W01)', () => {
    expect(getIsoWeek(new Date(2024, 0, 1))).toBe('2024-W01')
  })

  it('Dec 31 2018 belongs to W01 of 2019 (year boundary — ISO week crosses into next year)', () => {
    expect(getIsoWeek(new Date(2018, 11, 31))).toBe('2019-W01')
  })

  it('Dec 28 2020 belongs to W53 of 2020 (leap year with 53 ISO weeks)', () => {
    expect(getIsoWeek(new Date(2020, 11, 28))).toBe('2020-W53')
  })

  it('week number is zero-padded to 2 digits', () => {
    const result = getIsoWeek(new Date(2026, 0, 5))
    expect(result).toMatch(/W\d{2}$/)
    expect(result.split('-W')[1]!.length).toBe(2)
  })

  it('is stable — same date always returns same string', () => {
    const date = new Date(2026, 2, 15)
    expect(getIsoWeek(date)).toBe(getIsoWeek(date))
  })
})
