import { describe, it, expect } from 'vitest'
import { SOURCE_COLORS, SOURCE_LABELS, type SourceId, type LinkDisplay, type LinktreeDisplay, type AnalyticsDisplay } from './types'

describe('SOURCE_COLORS', () => {
  it('has all 6 source types', () => {
    const keys = Object.keys(SOURCE_COLORS)
    expect(keys).toHaveLength(6)
    expect(keys).toContain('newsletter')
    expect(keys).toContain('social')
    expect(keys).toContain('blog')
    expect(keys).toContain('qr')
    expect(keys).toContain('campaign')
    expect(keys).toContain('manual')
  })

  it('all values are valid hex colors', () => {
    for (const color of Object.values(SOURCE_COLORS)) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('newsletter is purple #A77CE8', () => {
    expect(SOURCE_COLORS.newsletter).toBe('#A77CE8')
  })

  it('social is cyan #3FA9C0', () => {
    expect(SOURCE_COLORS.social).toBe('#3FA9C0')
  })

  it('blog is green #46B17E', () => {
    expect(SOURCE_COLORS.blog).toBe('#46B17E')
  })

  it('qr is amber #E0A23C', () => {
    expect(SOURCE_COLORS.qr).toBe('#E0A23C')
  })

  it('campaign is blue #5B7FD6', () => {
    expect(SOURCE_COLORS.campaign).toBe('#5B7FD6')
  })

  it('manual is gray #8A8F98', () => {
    expect(SOURCE_COLORS.manual).toBe('#8A8F98')
  })
})

describe('SOURCE_LABELS', () => {
  it('has all 6 source types with Portuguese labels', () => {
    expect(SOURCE_LABELS.newsletter).toBe('Newsletter')
    expect(SOURCE_LABELS.social).toBe('Social')
    expect(SOURCE_LABELS.blog).toBe('Blog')
    expect(SOURCE_LABELS.qr).toBe('QR')
    expect(SOURCE_LABELS.campaign).toBe('Campanha')
    expect(SOURCE_LABELS.manual).toBe('Manual')
  })
})

describe('Type shapes (compile-time check)', () => {
  it('LinkDisplay has required fields', () => {
    const link: LinkDisplay = {
      id: '1',
      title: 'Test',
      slug: '/abc',
      source: 'newsletter',
      badge: 'Newsletter',
      dest: 'https://example.com',
      status: 'active',
      clicks: 100,
      last30: 50,
      unique: 30,
      scans: 10,
      topCountry: 'BR',
      ctr: 5.2,
      created: '09 mai 2026',
      health: 'ok',
      redirect: 301,
      clickIds: true,
      spark: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    }
    expect(link.id).toBe('1')
    expect(link.source).toBe('newsletter')
  })

  it('LinktreeDisplay has required fields', () => {
    const tree: LinktreeDisplay = {
      url: 'https://go.example.com',
      pageviews: 1000,
      last30: 500,
      unique: 300,
      engagement: 12.5,
      topCountry: 'BR',
      spark: Array.from({ length: 30 }, (_, i) => i),
      blocks: [{ id: '1', label: 'Blog', section: 'Geral', clicks: 50, ctr: 5.0 }],
      sharedLinks: [{ id: '1', icon: 'link-2', labelPt: 'Blog', labelEn: 'Blog', url: 'https://example.com' }],
    }
    expect(tree.url).toBe('https://go.example.com')
  })

  it('AnalyticsDisplay has required fields', () => {
    const analytics: AnalyticsDisplay = {
      totalClicks: 1000,
      prevClicks: 800,
      unique: 500,
      prevUnique: 400,
      ctr: 12.5,
      prevCtr: 10.0,
      qrShare: 15.2,
      byDay: Array.from({ length: 30 }, () => 10),
      byDayPrev: Array.from({ length: 30 }, () => 8),
      bySource: [{ id: 'newsletter', clicks: 100, pct: 50 }],
      devices: [{ k: 'Mobile', v: 60, color: '#3FA9C0' }],
      browsers: [{ k: 'Chrome', v: 70 }],
      os: [{ k: 'iOS', v: 40 }],
      referrers: [{ k: 'google.com', v: 30 }],
      countries: [{ code: 'BR', name: 'Brazil', v: 100, cities: ['Sao Paulo'] }],
      heatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
      topLinks: [],
      insights: [{ tone: 'up', icon: 'trendingUp', text: 'Traffic is growing' }],
    }
    expect(analytics.totalClicks).toBe(1000)
  })
})
