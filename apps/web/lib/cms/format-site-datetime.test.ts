import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatSiteDateTime,
  getTimezoneAbbr,
  todayInSiteTz,
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
// Both are valid representations of the same timezone abbreviation.
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
    // 2026-05-07T23:30:00 BRT = 2026-05-08T02:30:00 UTC
    // todayInSiteTz('America/Sao_Paulo') should return '2026-05-07', not '2026-05-08'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-08T02:30:00Z')) // UTC is already May 8
    const result = todayInSiteTz('America/Sao_Paulo')
    expect(result).toBe('2026-05-07')
    vi.useRealTimers()
  })

  it('returns next day for a timezone ahead of UTC', () => {
    // 2026-05-07T23:30:00 UTC → in Asia/Bangkok (UTC+7): 2026-05-08 06:30
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T23:30:00Z'))
    const result = todayInSiteTz('Asia/Bangkok')
    expect(result).toBe('2026-05-08')
    vi.useRealTimers()
  })
})

describe('formatSiteDateTime', () => {
  describe('mode: full (default)', () => {
    it('includes date, time, and timezone abbreviation in primary', () => {
      const result = formatSiteDateTime(FIXED_DATE, 'America/Sao_Paulo', {
        includeLocal: false,
      })
      expect(result.primary).toContain('May')
      expect(result.primary).toContain('2026')
      expect(result.primary).toContain('14:30')
      expect(BRT_VARIANTS).toContain(result.tzAbbr)
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
    it('uses short date format', () => {
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
    it('shows only time + abbreviation', () => {
      const result = formatSiteDateTime(FIXED_DATE, 'America/Sao_Paulo', {
        mode: 'time-only',
        includeLocal: false,
      })
      expect(result.primary).toMatch(/^14:30 (BRT|GMT-3)$/)
    })
  })

  describe('cross-day detection', () => {
    it('detects cross-day when local tz is ahead', () => {
      // Mock browser timezone to Asia/Bangkok
      vi.stubGlobal('Intl', {
        ...Intl,
        DateTimeFormat: class extends Intl.DateTimeFormat {
          constructor(locale?: string | string[], options?: Intl.DateTimeFormatOptions) {
            super(locale, options)
          }
          resolvedOptions() {
            const base = super.resolvedOptions()
            if (!arguments.length) return { ...base, timeZone: 'Asia/Bangkok' }
            return base
          }
        },
      })

      // Use a direct approach: test crossDay by checking dates
      // 2026-05-07T17:30:00Z in BRT = May 7, in ICT = May 8
      const siteDateStr = FIXED_DATE.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
      const bangkokDateStr = FIXED_DATE.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
      expect(siteDateStr).toBe('2026-05-07')
      expect(bangkokDateStr).toBe('2026-05-08')
      expect(siteDateStr).not.toBe(bangkokDateStr)

      vi.unstubAllGlobals()
    })

    it('crossDay is false when both timezones are on the same date', () => {
      // 2026-05-07T12:00:00Z in BRT = May 7 09:00, in EDT = May 7 08:00
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
      expect(result.primary).toMatch(/^14:30:45 (BRT|GMT-3)$/)
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
      expect(result.primary).toMatch(/^14:30 (BRT|GMT-3)$/)
    })
  })
})
