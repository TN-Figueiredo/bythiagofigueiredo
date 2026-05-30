import { describe, it, expect } from 'vitest'
import { aggregateByUtm } from './utm-attribution.js'
import { recalcWithoutBots } from './bot-filter-metrics.js'
import { computeNewVsReturning } from './new-vs-returning.js'
import { computeConversion } from './goals.js'
import { computeQrFunnel } from './qr-funnel.js'
import { generateCsv } from './csv-export.js'

describe('Analytics boundary conditions', () => {
  describe('UTM with single row', () => {
    it('returns 100% for single source', () => {
      const result = aggregateByUtm(
        [{ utm_source: 'google', utm_medium: null, utm_campaign: null, clicks: 50 }],
        'source',
      )
      expect(result).toHaveLength(1)
      expect(result[0].pct).toBe(100)
    })

    it('handles all-null UTM as (direct)', () => {
      const result = aggregateByUtm(
        [{ utm_source: null, utm_medium: null, utm_campaign: null, clicks: 10 }],
        'source',
      )
      expect(result[0].key).toBe('(direct)')
    })

    it('handles zero clicks returning empty array', () => {
      const result = aggregateByUtm(
        [{ utm_source: 'google', utm_medium: null, utm_campaign: null, clicks: 0 }],
        'source',
      )
      // total = 0, so returns []
      expect(result).toEqual([])
    })

    it('handles all-null for medium dimension', () => {
      const result = aggregateByUtm(
        [{ utm_source: 'google', utm_medium: null, utm_campaign: null, clicks: 5 }],
        'medium',
      )
      expect(result[0].key).toBe('(direct)')
    })

    it('handles duplicate sources merging clicks', () => {
      const result = aggregateByUtm(
        [
          { utm_source: 'google', utm_medium: null, utm_campaign: null, clicks: 30 },
          { utm_source: 'google', utm_medium: null, utm_campaign: null, clicks: 20 },
        ],
        'source',
      )
      expect(result).toHaveLength(1)
      expect(result[0].clicks).toBe(50)
      expect(result[0].pct).toBe(100)
    })
  })

  describe('Bot filter with mixed data', () => {
    it('returns 0 bot percentage when no bots', () => {
      const result = recalcWithoutBots([
        { clicks: 100, unique_visitors: 50, is_bot: false },
      ])
      expect(result.botPct).toBe(0)
      expect(result.botClicks).toBe(0)
    })

    it('returns 100% when all bots', () => {
      const result = recalcWithoutBots([
        { clicks: 100, unique_visitors: 0, is_bot: true },
      ])
      expect(result.botPct).toBe(100)
      expect(result.totalClicks).toBe(0)
    })

    it('includes bot clicks in total when includeBots=true', () => {
      const result = recalcWithoutBots(
        [{ clicks: 100, unique_visitors: 0, is_bot: true }],
        true,
      )
      expect(result.totalClicks).toBe(100)
      expect(result.botPct).toBe(100)
    })

    it('handles multiple bot rows accumulating', () => {
      const result = recalcWithoutBots([
        { clicks: 50, unique_visitors: 0, is_bot: true },
        { clicks: 30, unique_visitors: 0, is_bot: true },
        { clicks: 20, unique_visitors: 10, is_bot: false },
      ])
      expect(result.botClicks).toBe(80)
      expect(result.totalClicks).toBe(20)
      expect(result.botPct).toBe(80)
    })
  })

  describe('New vs returning with edge ratios', () => {
    it('handles 100% new visitors', () => {
      const result = computeNewVsReturning([
        { is_returning: false, clicks: 100 },
      ])
      expect(result.newPct).toBe(100)
      expect(result.returningPct).toBe(0)
    })

    it('handles 100% returning visitors', () => {
      const result = computeNewVsReturning([
        { is_returning: true, clicks: 100 },
      ])
      expect(result.newPct).toBe(0)
      expect(result.returningPct).toBe(100)
    })

    it('returns donut segments that sum to ~100', () => {
      const result = computeNewVsReturning([
        { is_returning: false, clicks: 33 },
        { is_returning: true, clicks: 67 },
      ])
      // Due to rounding, values might not perfectly sum to 100
      const sum = result.donut[0].v + result.donut[1].v
      expect(sum).toBeGreaterThanOrEqual(99)
      expect(sum).toBeLessThanOrEqual(101)
    })

    it('handles very small clicks', () => {
      const result = computeNewVsReturning([
        { is_returning: false, clicks: 1 },
        { is_returning: true, clicks: 1 },
      ])
      expect(result.newPct).toBe(50)
      expect(result.returningPct).toBe(50)
    })
  })

  describe('Conversion edge cases', () => {
    it('handles conversions > views (caps at 100%)', () => {
      const result = computeConversion(50, 200)
      expect(result.rate).toBe(100)
      expect(result.progress).toBe(1)
    })

    it('handles 0 conversions', () => {
      const result = computeConversion(1000, 0)
      expect(result.rate).toBe(0)
      expect(result.label).toBe('0.0%')
    })

    it('handles 1 view 1 conversion (100%)', () => {
      const result = computeConversion(1, 1)
      expect(result.rate).toBe(100)
      expect(result.progress).toBe(1)
      expect(result.label).toBe('100.0%')
    })

    it('handles very small conversion rate', () => {
      const result = computeConversion(1000000, 1)
      expect(result.rate).toBeCloseTo(0.0001, 4)
      expect(result.label).toBe('0.0%')
    })
  })

  describe('QR funnel edge cases', () => {
    it('handles conversions > clicks > scans (weird data)', () => {
      const result = computeQrFunnel({ scans: 10, clicks: 20, conversions: 30 })
      // clicks pct capped at 100, conversions pct capped at 100
      expect(result.steps[1].pct).toBe(100)
      expect(result.steps[2].pct).toBe(100)
    })

    it('handles all zeros', () => {
      const result = computeQrFunnel({ scans: 0, clicks: 0, conversions: 0 })
      expect(result.steps[0].pct).toBe(0)
      expect(result.steps[1].pct).toBe(0)
      expect(result.steps[2].pct).toBe(0)
      expect(result.overallRate).toBe(0)
    })

    it('handles scans only (no clicks or conversions)', () => {
      const result = computeQrFunnel({ scans: 500, clicks: 0, conversions: 0 })
      expect(result.steps[0].pct).toBe(100)
      expect(result.steps[1].pct).toBe(0)
      expect(result.steps[2].pct).toBe(0)
      expect(result.overallRate).toBe(0)
    })
  })

  describe('CSV with special characters', () => {
    it('handles empty string values', () => {
      const csv = generateCsv(['A'], [{ A: '' }])
      expect(csv).toBe('A\r\n\r\n')
    })

    it('handles unicode characters', () => {
      const csv = generateCsv(['Name'], [{ Name: 'São Paulo' }])
      expect(csv).toContain('São Paulo')
    })

    it('handles tab characters in values (CSV injection prefix)', () => {
      const csv = generateCsv(['Data'], [{ Data: '\tmalicious' }])
      // Tab at start triggers CSV injection escape: "'\tmalicious"
      expect(csv).toContain("\"'")
    })

    it('handles missing column value falling back to empty string', () => {
      const csv = generateCsv(['A', 'B'], [{ A: 'hello' }])
      // B is missing from row, so falls back to ''
      expect(csv).toBe('A,B\r\nhello,\r\n')
    })

    it('handles carriage return in values', () => {
      const csv = generateCsv(['X'], [{ X: 'line1\rline2' }])
      // \r triggers quoting
      expect(csv).toContain('"line1\rline2"')
    })
  })
})
