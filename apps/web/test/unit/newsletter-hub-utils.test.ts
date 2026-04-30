import { describe, it, expect } from 'vitest'
import { maskEmail, calculateEngagementScore, calculateHealthScore, formatNumber, formatPercent } from '../../src/app/cms/(authed)/newsletters/_hub/hub-utils'

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
