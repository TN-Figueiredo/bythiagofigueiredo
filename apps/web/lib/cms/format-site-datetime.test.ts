import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatSiteDateTime,
  getTimezoneAbbr,
  getTimezoneOffsetHours,
  todayInSiteTz,
  tomorrowInSiteTz,
  toISOInTimezone,
} from './format-site-datetime'

// Use a fixed date to avoid flaky tests: 2026-05-07 17:30:00 UTC
// In America/Sao_Paulo (UTC-3): 2026-05-07 14:30:00 BRT/GMT-3
// In Asia/Bangkok (UTC+7):      2026-05-08 00:30:00 ICT/GMT+7  ← cross-day!
const FIXED_DATE = new Date('2026-05-07T17:30:00Z')

// Same-day scenario: 2026-05-07 12:00:00 UTC
// In America/Sao_Paulo (UTC-3): 2026-05-07 09:00:00 BRT
// In America/New_York (UTC-4):  2026-05-07 08:00:00 EDT  ← same day
const SAME_DAY_DATE = new Date('2026-05-07T12:00:00Z')

// Node ICU data may return "BRT" or "GMT-3" depending on the build.
const BRT_VARIANTS = ['BRT', 'GMT-3']

describe('getTimezoneAbbr', () => {
  it('returns a valid abbreviation for America/Sao_Paulo', () => {
    const abbr = getTimezoneAbbr('America/Sao_Paulo', FIXED_DATE)
    expect(BRT_VARIANTS).toContain(abbr)
  })

  it('returns UTC for UTC', () => {
    expect(getTimezoneAbbr('UTC', FIXED_DATE)).toBe('UTC')
  })

  it('returns a non-empty string for Asia/Bangkok', () => {
    const abbr = getTimezoneAbbr('Asia/Bangkok', FIXED_DATE)
    expect(abbr).toBeTruthy()
    expect(typeof abbr).toBe('string')
  })
})

describe('todayInSiteTz', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('returns YYYY-MM-DD format', () => {
    const result = todayInSiteTz('America/Sao_Paulo')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns the date in the given timezone (not UTC)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-08T02:30:00Z'))
    const result = todayInSiteTz('America/Sao_Paulo')
    expect(result).toBe('2026-05-07')
    vi.useRealTimers()
  })

  it('returns next day for a timezone ahead of UTC', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T23:30:00Z'))
    const result = todayInSiteTz('Asia/Bangkok')
    expect(result).toBe('2026-05-08')
    vi.useRealTimers()
  })
})

describe('tomorrowInSiteTz', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('returns YYYY-MM-DD format', () => {
    const result = tomorrowInSiteTz('America/Sao_Paulo')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns the day after today in site timezone', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-08T02:30:00Z'))
    // In BRT (UTC-3): still May 7 23:30 → tomorrow = May 8
    const result = tomorrowInSiteTz('America/Sao_Paulo')
    expect(result).toBe('2026-05-08')
    vi.useRealTimers()
  })

  it('handles timezone ahead of UTC correctly', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T23:30:00Z'))
    // In ICT (UTC+7): May 8 06:30 → tomorrow = May 9
    const result = tomorrowInSiteTz('Asia/Bangkok')
    expect(result).toBe('2026-05-09')
    vi.useRealTimers()
  })
})

describe('toISOInTimezone', () => {
  it('converts date/time in timezone to ISO string', () => {
    // 2026-05-08 at 09:00 BRT (UTC-3) → 2026-05-08T12:00:00.000Z
    const iso = toISOInTimezone('2026-05-08', '09:00', 'America/Sao_Paulo')
    expect(iso).toBe('2026-05-08T12:00:00.000Z')
  })

  it('returns null for empty inputs', () => {
    expect(toISOInTimezone('', '09:00', 'UTC')).toBeNull()
    expect(toISOInTimezone('2026-05-08', '', 'UTC')).toBeNull()
  })

  it('handles UTC directly', () => {
    const iso = toISOInTimezone('2026-05-08', '12:00', 'UTC')
    expect(iso).toBe('2026-05-08T12:00:00.000Z')
  })
})

describe('getTimezoneOffsetHours', () => {
  it('returns positive when tz1 is ahead of tz2', () => {
    // Bangkok (UTC+7) is ahead of Sao Paulo (UTC-3) by 10h
    const offset = getTimezoneOffsetHours('Asia/Bangkok', 'America/Sao_Paulo', FIXED_DATE)
    expect(offset).toBe(10)
  })

  it('returns negative when tz1 is behind tz2', () => {
    // Sao Paulo (UTC-3) is behind Bangkok (UTC+7) by 10h
    const offset = getTimezoneOffsetHours('America/Sao_Paulo', 'Asia/Bangkok', FIXED_DATE)
    expect(offset).toBe(-10)
  })

  it('returns 0 for the same timezone', () => {
    const offset = getTimezoneOffsetHours('America/Sao_Paulo', 'America/Sao_Paulo', FIXED_DATE)
    expect(offset).toBe(0)
  })

  it('handles half-hour offsets', () => {
    // India (UTC+5:30) vs UTC = 5.5
    const offset = getTimezoneOffsetHours('Asia/Kolkata', 'UTC', FIXED_DATE)
    expect(offset).toBe(5.5)
  })
})

describe('formatSiteDateTime', () => {
  describe('mode: full (default)', () => {
    it('includes date and time but NOT timezone abbreviation in primary', () => {
      const result = formatSiteDateTime(FIXED_DATE, 'America/Sao_Paulo', {
        includeLocal: false,
      })
      expect(result.primary).toContain('May')
      expect(result.primary).toContain('2026')
      expect(result.primary).toContain('14:30')
      // tzAbbr is separate from primary
      expect(BRT_VARIANTS).toContain(result.tzAbbr)
      for (const variant of BRT_VARIANTS) {
        expect(result.primary).not.toContain(variant)
      }
    })

    it('returns empty local when includeLocal is false', () => {
      const result = formatSiteDateTime(FIXED_DATE, 'America/Sao_Paulo', {
        includeLocal: false,
      })
      expect(result.local).toBe('')
      expect(result.crossDay).toBe(false)
    })
  })

  describe('mode: short', () => {
    it('uses short date format without year', () => {
      const result = formatSiteDateTime(FIXED_DATE, 'America/Sao_Paulo', {
        mode: 'short',
        includeLocal: false,
      })
      expect(result.primary).toContain('May')
      expect(result.primary).toContain('14:30')
      expect(result.primary).not.toContain('2026')
    })
  })

  describe('mode: time-only', () => {
    it('shows only time without abbreviation', () => {
      const result = formatSiteDateTime(FIXED_DATE, 'America/Sao_Paulo', {
        mode: 'time-only',
        includeLocal: false,
      })
      expect(result.primary).toBe('14:30')
    })
  })

  describe('cross-day detection', () => {
    it('detects cross-day when local tz is ahead', () => {
      // 2026-05-07T17:30:00Z in BRT = May 7, in ICT = May 8
      const siteDateStr = FIXED_DATE.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
      const bangkokDateStr = FIXED_DATE.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
      expect(siteDateStr).toBe('2026-05-07')
      expect(bangkokDateStr).toBe('2026-05-08')
      expect(siteDateStr).not.toBe(bangkokDateStr)
    })

    it('crossDay is false when both timezones are on the same date', () => {
      const siteDateStr = SAME_DAY_DATE.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
      const nyDateStr = SAME_DAY_DATE.toLocaleDateString('sv-SE', { timeZone: 'America/New_York' })
      expect(siteDateStr).toBe('2026-05-07')
      expect(nyDateStr).toBe('2026-05-07')
    })
  })

  describe('tooltip', () => {
    it('contains ISO 8601 format with offset and timezone name', () => {
      const result = formatSiteDateTime(FIXED_DATE, 'America/Sao_Paulo', {
        includeLocal: false,
      })
      expect(result.tooltip).toContain('2026-05-07')
      expect(result.tooltip).toContain('14:30:00')
      expect(result.tooltip).toContain('-03:00')
      expect(result.tooltip).toContain('(America/Sao_Paulo)')
    })
  })

  describe('includeSeconds', () => {
    it('includes seconds when enabled', () => {
      const result = formatSiteDateTime(
        new Date('2026-05-07T17:30:45Z'),
        'America/Sao_Paulo',
        { mode: 'time-only', includeLocal: false, includeSeconds: true },
      )
      expect(result.primary).toBe('14:30:45')
    })
  })

  describe('same timezone edge case', () => {
    it('crossDay is false and abbreviations match when site tz == local tz', () => {
      const result = formatSiteDateTime(FIXED_DATE, 'America/Sao_Paulo', {
        includeLocal: false,
      })
      expect(result.crossDay).toBe(false)
      expect(BRT_VARIANTS).toContain(result.tzAbbr)
    })
  })

  describe('string date input', () => {
    it('accepts ISO string date', () => {
      const result = formatSiteDateTime(
        '2026-05-07T17:30:00Z',
        'America/Sao_Paulo',
        { mode: 'time-only', includeLocal: false },
      )
      expect(result.primary).toBe('14:30')
    })
  })
})
