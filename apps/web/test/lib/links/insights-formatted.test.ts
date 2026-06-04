import { describe, it, expect } from 'vitest'
import { formatInsight, type RawInsight } from '@/lib/links/insights-formatter'

describe('formatInsight', () => {
  it('formats growth insight with up tone', () => {
    const raw: RawInsight = {
      type: 'growth',
      metric: 'clicks',
      value: 25,
      period: '7d',
    }
    const result = formatInsight(raw)
    expect(result.tone).toBe('up')
    expect(result.icon).toBe('trendingUp')
    expect(result.text).toContain('25%')
    expect(result.text).toContain('cresceu')
  })

  it('formats decline insight with red tone', () => {
    const raw: RawInsight = {
      type: 'decline',
      metric: 'clicks',
      value: -15,
      period: '7d',
    }
    const result = formatInsight(raw)
    expect(result.tone).toBe('red')
    expect(result.icon).toBe('trendingDown')
    expect(result.text).toContain('caiu')
  })

  it('formats top performer insight with accent tone', () => {
    const raw: RawInsight = {
      type: 'top_performer',
      metric: 'clicks',
      value: 500,
      linkTitle: 'Landing Page',
    }
    const result = formatInsight(raw)
    expect(result.tone).toBe('accent')
    expect(result.text).toContain('Landing Page')
  })

  it('formats health warning with amber tone', () => {
    const raw: RawInsight = {
      type: 'health_warning',
      metric: 'health',
      value: 3,
    }
    const result = formatInsight(raw)
    expect(result.tone).toBe('amber')
    expect(result.text).toContain('3')
  })

  it('formats milestone with up tone', () => {
    const raw: RawInsight = {
      type: 'milestone',
      metric: 'clicks',
      value: 10000,
    }
    const result = formatInsight(raw)
    expect(result.tone).toBe('up')
    expect(result.text).toContain('10.000')
  })

  it('formats qr_surge with accent tone', () => {
    const raw: RawInsight = {
      type: 'qr_surge',
      metric: 'scans',
      value: 40,
      period: '24h',
    }
    const result = formatInsight(raw)
    expect(result.tone).toBe('accent')
    expect(result.text).toContain('QR')
  })

  it('returns fallback for unknown type', () => {
    const raw = { type: 'unknown', metric: 'x', value: 0 } as RawInsight
    const result = formatInsight(raw)
    expect(result.tone).toBe('accent')
    expect(result.text).toBeTruthy()
  })

  it('formats geo_concentration with amber tone', () => {
    const raw: RawInsight = {
      type: 'geo_concentration',
      metric: 'clicks',
      value: 85,
      linkTitle: 'Brasil',
    }
    const result = formatInsight(raw)
    expect(result.tone).toBe('amber')
    expect(result.icon).toBe('globe')
    expect(result.text).toContain('85%')
    expect(result.text).toContain('Brasil')
  })

  it('formats device_skew mobile with accent tone', () => {
    const raw: RawInsight = {
      type: 'device_skew',
      metric: 'clicks',
      value: 90,
      linkTitle: 'mobile',
    }
    const result = formatInsight(raw)
    expect(result.tone).toBe('accent')
    expect(result.icon).toBe('smartphone')
    expect(result.text).toContain('90%')
    expect(result.text).toContain('mobile')
  })

  it('formats device_skew desktop with accent tone', () => {
    const raw: RawInsight = {
      type: 'device_skew',
      metric: 'clicks',
      value: 85,
      linkTitle: 'desktop',
    }
    const result = formatInsight(raw)
    expect(result.tone).toBe('accent')
    expect(result.text).toContain('desktop')
  })
})
