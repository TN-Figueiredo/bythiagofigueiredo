import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { maskEmail, calculateEngagementScore, calculateHealthScore, formatNumber, formatPercent, formatDate, formatRelativeDate } from '../../src/app/cms/(authed)/newsletters/_hub/hub-utils'

describe('maskEmail', () => {
  it('masks standard email', () => {
    expect(maskEmail('maria@example.com')).toBe('m***a@example.com')
  })
  it('handles single-char local part', () => {
    expect(maskEmail('a@example.com')).toBe('a***a@example.com')
  })
  it('handles two-char local part', () => {
    expect(maskEmail('ab@example.com')).toBe('a***b@example.com')
  })
  it('returns [anonymized] for sha256 hash emails', () => {
    expect(maskEmail('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe('[anonymized]')
  })
  it('handles empty string', () => {
    expect(maskEmail('')).toBe('')
  })
})

describe('calculateEngagementScore', () => {
  it('returns 100 for perfect engagement', () => {
    const score = calculateEngagementScore({ opens30d: 10, clicks30d: 10, editionsReceived30d: 10, daysSinceLastOpen: 0 })
    expect(score).toBe(100)
  })
  it('returns 0 for zero activity with max decay', () => {
    const score = calculateEngagementScore({ opens30d: 0, clicks30d: 0, editionsReceived30d: 10, daysSinceLastOpen: 60 })
    expect(score).toBe(0)
  })
  it('caps at 100', () => {
    const score = calculateEngagementScore({ opens30d: 20, clicks30d: 20, editionsReceived30d: 10, daysSinceLastOpen: 0 })
    expect(score).toBeLessThanOrEqual(100)
  })
  it('handles zero editions received', () => {
    const score = calculateEngagementScore({ opens30d: 0, clicks30d: 0, editionsReceived30d: 0, daysSinceLastOpen: 30 })
    expect(score).toBeGreaterThanOrEqual(0)
  })
  it('penalizes inactivity via recency decay', () => {
    const active = calculateEngagementScore({ opens30d: 5, clicks30d: 3, editionsReceived30d: 10, daysSinceLastOpen: 1 })
    const stale = calculateEngagementScore({ opens30d: 5, clicks30d: 3, editionsReceived30d: 10, daysSinceLastOpen: 25 })
    expect(active).toBeGreaterThan(stale)
  })
})

describe('calculateHealthScore', () => {
  it('returns high score for healthy metrics', () => {
    const score = calculateHealthScore({
      spf: true, dkim: true, dmarc: true,
      bounceRate: 0.5, complaintRate: 0.01,
      avgOpenRate: 45, subscriberGrowthRate: 5,
      lgpdConsentRate: 100,
    })
    expect(score).toBeGreaterThanOrEqual(80)
  })
  it('penalizes missing SPF/DKIM/DMARC', () => {
    const withAuth = calculateHealthScore({
      spf: true, dkim: true, dmarc: true,
      bounceRate: 1, complaintRate: 0.05,
      avgOpenRate: 30, subscriberGrowthRate: 2,
      lgpdConsentRate: 95,
    })
    const noAuth = calculateHealthScore({
      spf: false, dkim: false, dmarc: false,
      bounceRate: 1, complaintRate: 0.05,
      avgOpenRate: 30, subscriberGrowthRate: 2,
      lgpdConsentRate: 95,
    })
    expect(withAuth).toBeGreaterThan(noAuth)
  })
  it('clamps to 0-100', () => {
    const worst = calculateHealthScore({
      spf: false, dkim: false, dmarc: false,
      bounceRate: 50, complaintRate: 10,
      avgOpenRate: 0, subscriberGrowthRate: -50,
      lgpdConsentRate: 0,
    })
    expect(worst).toBeGreaterThanOrEqual(0)
    expect(worst).toBeLessThanOrEqual(100)
  })
})

describe('formatNumber', () => {
  it('formats thousands with k suffix', () => {
    expect(formatNumber(1500)).toBe('1.5k')
  })
  it('returns plain number below 1000', () => {
    expect(formatNumber(999)).toBe('999')
  })
  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatPercent', () => {
  it('formats with one decimal', () => {
    expect(formatPercent(45.678)).toBe('45.7%')
  })
  it('formats zero', () => {
    expect(formatPercent(0)).toBe('0.0%')
  })
  it('formats 100', () => {
    expect(formatPercent(100)).toBe('100.0%')
  })
})

describe('maskEmail — edge cases', () => {
  it('returns email as-is when no @ symbol', () => {
    expect(maskEmail('notanemail')).toBe('notanemail')
  })
  it('handles very long local part', () => {
    const long = 'abcdefghijklmnopqrstuvwxyz@example.com'
    expect(maskEmail(long)).toBe('a***z@example.com')
  })
  it('handles uppercase SHA256 (not matched — case sensitive)', () => {
    expect(maskEmail('E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855')).not.toBe('[anonymized]')
  })
})

describe('calculateEngagementScore — edge cases', () => {
  it('returns 0 for all zeros and max decay', () => {
    expect(calculateEngagementScore({ opens30d: 0, clicks30d: 0, editionsReceived30d: 0, daysSinceLastOpen: 60 })).toBe(0)
  })
  it('returns 20 for zero opens/clicks but opened today', () => {
    expect(calculateEngagementScore({ opens30d: 0, clicks30d: 0, editionsReceived30d: 10, daysSinceLastOpen: 0 })).toBe(20)
  })
})

describe('calculateHealthScore — edge cases', () => {
  it('returns 0 for worst possible inputs', () => {
    const score = calculateHealthScore({
      spf: false, dkim: false, dmarc: false,
      bounceRate: 100, complaintRate: 100,
      avgOpenRate: 0, subscriberGrowthRate: -100,
      lgpdConsentRate: 0,
    })
    expect(score).toBe(0)
  })
  it('returns 100 for perfect inputs', () => {
    const score = calculateHealthScore({
      spf: true, dkim: true, dmarc: true,
      bounceRate: 0, complaintRate: 0,
      avgOpenRate: 50, subscriberGrowthRate: 20,
      lgpdConsentRate: 100,
    })
    expect(score).toBe(100)
  })
})

describe('formatNumber — edge cases', () => {
  it('formats millions', () => {
    expect(formatNumber(1500000)).toBe('1500k')
  })
  it('formats exact 1000', () => {
    expect(formatNumber(1000)).toBe('1k')
  })
  it('formats negative numbers', () => {
    expect(formatNumber(-5)).toBe('-5')
  })
})

describe('formatDate', () => {
  it('formats a valid ISO date', () => {
    const result = formatDate('2026-04-30T12:00:00Z')
    expect(result).toContain('2026')
  })
  it('formats with en locale', () => {
    const result = formatDate('2026-01-15T12:00:00Z', 'en')
    expect(result).toContain('2026')
    expect(result).toContain('Jan')
  })
})

describe('formatRelativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-30T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "agora" for just now', () => {
    expect(formatRelativeDate('2026-04-30T12:00:00Z')).toBe('agora')
  })
  it('returns minutes for <60min', () => {
    expect(formatRelativeDate('2026-04-30T11:45:00Z')).toBe('15min')
  })
  it('returns hours for <24h', () => {
    expect(formatRelativeDate('2026-04-30T06:00:00Z')).toBe('6h')
  })
  it('returns days for <30d', () => {
    expect(formatRelativeDate('2026-04-25T12:00:00Z')).toBe('5d')
  })
  it('returns months for >=30d', () => {
    expect(formatRelativeDate('2026-02-28T12:00:00Z')).toBe('2m')
  })
})
