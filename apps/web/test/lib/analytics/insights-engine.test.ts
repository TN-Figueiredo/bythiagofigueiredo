import { describe, it, expect } from 'vitest'
import { generateInsights } from '@/lib/analytics/insights-engine'
import type { FunnelData, ClickedLink } from '@/app/cms/(authed)/analytics/types'

function makeFunnel(overrides: Partial<FunnelData> = {}): FunnelData {
  return {
    views: 1000,
    read50: 500,
    clickedLink: 200,
    nlOpened: 100,
    subscribed: 20,
    ...overrides,
  }
}

function makeLinks(overrides: Partial<{ topLinks: ClickedLink[]; totalClicks: number; prevTotalClicks?: number }> = {}) {
  return {
    topLinks: overrides.topLinks ?? [
      { url: 'https://example.com/link1', linkType: 'external' as const, clicks: 50, topSource: 'blog' },
    ],
    totalClicks: overrides.totalClicks ?? 50,
    prevTotalClicks: overrides.prevTotalClicks,
  }
}

describe('generateInsights', () => {
  it('returns max 3 insights', () => {
    const funnel = makeFunnel()
    const links = makeLinks({ prevTotalClicks: 10 })
    const insights = generateInsights(funnel, links)
    expect(insights.length).toBeLessThanOrEqual(3)
  })

  it('identifies biggest funnel leak as red', () => {
    const funnel = makeFunnel({ views: 1000, read50: 100, clickedLink: 80, nlOpened: 70, subscribed: 60 })
    const insights = generateInsights(funnel, makeLinks())
    const leakCard = insights.find((c) => c.id === 'funnel-leak')
    expect(leakCard).toBeDefined()
    expect(leakCard!.color).toBe('red')
    expect(leakCard!.body).toContain('90%') // 1000 → 100 = 90% drop
  })

  it('detects click growth as green', () => {
    const funnel = makeFunnel()
    const links = makeLinks({ totalClicks: 200, prevTotalClicks: 100 })
    const insights = generateInsights(funnel, links)
    const growthCard = insights.find((c) => c.id === 'click-growth')
    expect(growthCard).toBeDefined()
    expect(growthCard!.color).toBe('green')
    expect(growthCard!.body).toContain('100%')
  })

  it('falls back to winning link when no previous period', () => {
    const funnel = makeFunnel()
    const links = makeLinks({ topLinks: [{ url: 'https://winner.com', linkType: 'external', clicks: 99, topSource: 'blog' }] })
    const insights = generateInsights(funnel, links)
    const winCard = insights.find((c) => c.id === 'winning-link')
    expect(winCard).toBeDefined()
    expect(winCard!.color).toBe('green')
  })

  it('identifies no-conversion opportunity as indigo', () => {
    const funnel = makeFunnel({ subscribed: 0 })
    const links = makeLinks()
    const insights = generateInsights(funnel, links)
    const opp = insights.find((c) => c.id === 'no-conversions')
    expect(opp).toBeDefined()
    expect(opp!.color).toBe('indigo')
  })

  it('identifies low conversion rate as indigo', () => {
    const funnel = makeFunnel({ views: 1000, read50: 500, subscribed: 5 })
    const links = makeLinks({ prevTotalClicks: 10 })
    const insights = generateInsights(funnel, links)
    const opp = insights.find((c) => c.color === 'indigo')
    expect(opp).toBeDefined()
  })

  it('returns empty array when all metrics are zero', () => {
    const funnel = makeFunnel({ views: 0, read50: 0, clickedLink: 0, nlOpened: 0, subscribed: 0 })
    const links = makeLinks({ topLinks: [], totalClicks: 0 })
    const insights = generateInsights(funnel, links)
    expect(insights).toHaveLength(0)
  })
})
