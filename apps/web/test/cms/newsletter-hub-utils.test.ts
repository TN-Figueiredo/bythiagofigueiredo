import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  maskEmail,
  calculateEngagementScore,
  calculateHealthScore,
  formatNumber,
  formatPercent,
  formatRelativeDate,
} from '../../src/app/cms/(authed)/newsletters/_hub/hub-utils'

describe('maskEmail', () => {
  it('masks normal email preserving first and last chars', () => {
    expect(maskEmail('test@example.com')).toBe('t***t@example.com')
  })

  it('handles single-char local part', () => {
    expect(maskEmail('a@example.com')).toBe('a***a@example.com')
  })

  it('returns [anonymized] for SHA256 hashes', () => {
    const hash = 'a'.repeat(64)
    expect(maskEmail(hash)).toBe('[anonymized]')
  })

  it('returns empty string for empty input', () => {
    expect(maskEmail('')).toBe('')
  })

  it('returns as-is when no domain present', () => {
    expect(maskEmail('nodomain')).toBe('nodomain')
  })

  it('masks longer local parts correctly', () => {
    expect(maskEmail('john.doe@company.org')).toBe('j***e@company.org')
  })
})

describe('calculateEngagementScore', () => {
  it('returns ~100 for perfect engagement', () => {
    const score = calculateEngagementScore({
      opens30d: 10,
      clicks30d: 10,
      editionsReceived30d: 10,
      daysSinceLastOpen: 0,
    })
    expect(score).toBe(100)
  })

  it('returns 0 for zero activity and stale subscriber', () => {
    const score = calculateEngagementScore({
      opens30d: 0,
      clicks30d: 0,
      editionsReceived30d: 0,
      daysSinceLastOpen: 30,
    })
    expect(score).toBe(0)
  })

  it('returns mid-range for opens only, no clicks', () => {
    const score = calculateEngagementScore({
      opens30d: 5,
      clicks30d: 0,
      editionsReceived30d: 5,
      daysSinceLastOpen: 0,
    })
    expect(score).toBeGreaterThanOrEqual(40)
    expect(score).toBeLessThanOrEqual(70)
  })

  it('penalizes old subscribers via daysSinceLastOpen', () => {
    const recent = calculateEngagementScore({
      opens30d: 5,
      clicks30d: 3,
      editionsReceived30d: 5,
      daysSinceLastOpen: 1,
    })
    const stale = calculateEngagementScore({
      opens30d: 5,
      clicks30d: 3,
      editionsReceived30d: 5,
      daysSinceLastOpen: 28,
    })
    expect(recent).toBeGreaterThan(stale)
  })

  it('clamps score between 0 and 100', () => {
    const score = calculateEngagementScore({
      opens30d: 1000,
      clicks30d: 1000,
      editionsReceived30d: 1,
      daysSinceLastOpen: 0,
    })
    expect(score).toBeLessThanOrEqual(100)
    expect(score).toBeGreaterThanOrEqual(0)
  })
})

describe('calculateHealthScore', () => {
  const perfectInput = {
    spf: true,
    dkim: true,
    dmarc: true,
    bounceRate: 0.5,
    complaintRate: 0.01,
    avgOpenRate: 40,
    subscriberGrowthRate: 10,
    lgpdConsentRate: 100,
  }

  it('returns high score (80+) with all good metrics', () => {
    expect(calculateHealthScore(perfectInput)).toBeGreaterThanOrEqual(80)
  })

  it('returns lower score when all auth checks fail', () => {
    const noAuth = { ...perfectInput, spf: false, dkim: false, dmarc: false }
    expect(calculateHealthScore(noAuth)).toBeLessThan(calculateHealthScore(perfectInput))
  })

  it('reduces score with high bounce rate (5%+)', () => {
    const highBounce = { ...perfectInput, bounceRate: 6 }
    expect(calculateHealthScore(highBounce)).toBeLessThan(calculateHealthScore(perfectInput))
  })

  it('drops ~25 points with zero compliance', () => {
    const noCons = { ...perfectInput, lgpdConsentRate: 0 }
    const diff = calculateHealthScore(perfectInput) - calculateHealthScore(noCons)
    expect(diff).toBeGreaterThanOrEqual(20)
    expect(diff).toBeLessThanOrEqual(30)
  })

  it('handles negative growth without going negative', () => {
    const negGrowth = { ...perfectInput, subscriberGrowthRate: -8 }
    const score = calculateHealthScore(negGrowth)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThan(calculateHealthScore(perfectInput))
  })

  it('clamps to 0-100 range', () => {
    const worst = {
      spf: false, dkim: false, dmarc: false,
      bounceRate: 10, complaintRate: 5,
      avgOpenRate: 0, subscriberGrowthRate: -20,
      lgpdConsentRate: 0,
    }
    expect(calculateHealthScore(worst)).toBeGreaterThanOrEqual(0)
    expect(calculateHealthScore(perfectInput)).toBeLessThanOrEqual(100)
  })
})

describe('formatNumber', () => {
  it('returns plain number below 1000', () => {
    expect(formatNumber(999)).toBe('999')
  })

  it('formats 1000 as 1k', () => {
    expect(formatNumber(1000)).toBe('1k')
  })

  it('formats 1500 as 1.5k', () => {
    expect(formatNumber(1500)).toBe('1.5k')
  })

  it('formats 10000 as 10k', () => {
    expect(formatNumber(10000)).toBe('10k')
  })

  it('formats 0 as 0', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatPercent', () => {
  it('formats to one decimal with % suffix', () => {
    expect(formatPercent(12.345)).toBe('12.3%')
  })

  it('adds trailing zero when needed', () => {
    expect(formatPercent(5)).toBe('5.0%')
  })

  it('handles zero', () => {
    expect(formatPercent(0)).toBe('0.0%')
  })
})

describe('formatRelativeDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "agora" for < 1 minute ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-30T12:00:30Z'))
    expect(formatRelativeDate('2026-04-30T12:00:00Z')).toBe('agora')
  })

  it('returns minutes for 1-59 min ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-30T12:05:00Z'))
    expect(formatRelativeDate('2026-04-30T12:00:00Z')).toBe('5min')
  })

  it('returns hours for 1-23 hours ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-30T14:00:00Z'))
    expect(formatRelativeDate('2026-04-30T12:00:00Z')).toBe('2h')
  })

  it('returns days for 1-29 days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-03T12:00:00Z'))
    expect(formatRelativeDate('2026-04-30T12:00:00Z')).toBe('3d')
  })

  it('returns months for 30+ days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T12:00:00Z'))
    expect(formatRelativeDate('2026-04-30T12:00:00Z')).toBe('2m')
  })
})
