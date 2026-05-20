import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

describe('getLinktreeInsights', () => {
  let getLinktreeInsights: typeof import('@/lib/linktree/insights').getLinktreeInsights

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('@/lib/linktree/insights')
    getLinktreeInsights = mod.getLinktreeInsights
  })

  it('returns empty insights when insufficient data (fewer than 7 days)', async () => {
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-04-20', '2026-05-20')
    expect(insights).toEqual([])
  })

  it('returns empty insights when exactly 6 rows (below threshold)', async () => {
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    const days = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      pageviews: 10,
      unique_visitors: 8,
      link_clicks: 5,
      link_clicks_by_key: {},
      countries: { BR: 5 },
    }))
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-01', '2026-05-06')
    expect(insights).toEqual([])
  })

  it('detects traffic increase above 20%', async () => {
    const days = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 7).padStart(2, '0')}`,
      pageviews: i < 7 ? 10 : 15,
      unique_visitors: i < 7 ? 8 : 12,
      link_clicks: 5,
      link_clicks_by_key: {},
      countries: { BR: 5 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-07', '2026-05-20')
    const trafficInsight = insights.find((i) => i.id === 'traffic-trend')
    expect(trafficInsight).toBeDefined()
    expect(trafficInsight!.severity).toBe('positive')
  })

  it('detects traffic decrease below -20%', async () => {
    const days = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 7).padStart(2, '0')}`,
      pageviews: i < 7 ? 20 : 10,
      unique_visitors: i < 7 ? 15 : 8,
      link_clicks: 5,
      link_clicks_by_key: {},
      countries: { BR: 5 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-07', '2026-05-20')
    const trafficInsight = insights.find((i) => i.id === 'traffic-trend')
    expect(trafficInsight).toBeDefined()
    expect(trafficInsight!.severity).toBe('warning')
  })

  it('does not emit traffic-trend when change is within ±20%', async () => {
    // 7-day priors: 100 views each, recents: 115 (15% change, below threshold)
    const days = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 7).padStart(2, '0')}`,
      pageviews: i < 7 ? 100 : 115,
      unique_visitors: i < 7 ? 80 : 92,
      link_clicks: 5,
      link_clicks_by_key: {},
      countries: { BR: 5 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-07', '2026-05-20')
    const trafficInsight = insights.find((i) => i.id === 'traffic-trend')
    expect(trafficInsight).toBeUndefined()
  })

  it('identifies top-performer link', async () => {
    const days = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(i + 14).padStart(2, '0')}`,
      pageviews: 10,
      unique_visitors: 8,
      link_clicks: 20,
      link_clicks_by_key: { 'highlight': 10, 'social:instagram': 5, 'blog:pt:post-1': 5 },
      countries: { BR: 8 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-14', '2026-05-20')
    const topPerformer = insights.find((i) => i.id === 'top-performer')
    expect(topPerformer).toBeDefined()
    expect(topPerformer!.severity).toBe('info')
    expect(topPerformer!.description).toContain('highlight')
  })

  it('emits geo-concentration when >60% from one country', async () => {
    const days = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(i + 14).padStart(2, '0')}`,
      pageviews: 10,
      unique_visitors: 8,
      link_clicks: 5,
      link_clicks_by_key: {},
      countries: { BR: 70, US: 10, DE: 5, FR: 5, AR: 5, CO: 3, CL: 2 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-14', '2026-05-20')
    const geoInsight = insights.find((i) => i.id === 'geo-concentration')
    expect(geoInsight).toBeDefined()
    expect(geoInsight!.title).toContain('BR')
  })

  it('does not emit geo-concentration when traffic is well distributed', async () => {
    const days = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(i + 14).padStart(2, '0')}`,
      pageviews: 10,
      unique_visitors: 8,
      link_clicks: 5,
      link_clicks_by_key: {},
      countries: { BR: 40, US: 35, DE: 25 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-14', '2026-05-20')
    const geoInsight = insights.find((i) => i.id === 'geo-concentration')
    expect(geoInsight).toBeUndefined()
  })

  it('returns empty insights when data is null', async () => {
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-14', '2026-05-20')
    expect(insights).toEqual([])
  })

  // -----------------------------------------------------------------------
  // Engagement-trend insight tests
  // -----------------------------------------------------------------------

  it('emits engagement-trend with severity positive when engagement increases >15%', async () => {
    // Prior 7 days: 10 clicks / 100 views = 10% engagement
    // Recent 7 days: 15 clicks / 100 views = 15% engagement
    // Change: (15% - 10%) / 10% = 50% increase → should fire
    const days = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 7).padStart(2, '0')}`,
      pageviews: 100,
      unique_visitors: 80,
      link_clicks: i < 7 ? 10 : 15,
      link_clicks_by_key: {},
      countries: { BR: 5 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-07', '2026-05-20')
    const engInsight = insights.find((i) => i.id === 'engagement-trend')
    expect(engInsight).toBeDefined()
    expect(engInsight!.severity).toBe('positive')
  })

  it('emits engagement-trend with severity warning when engagement decreases >15%', async () => {
    // Prior 7 days: 20 clicks / 100 views = 20% engagement
    // Recent 7 days: 10 clicks / 100 views = 10% engagement
    // Change: (10% - 20%) / 20% = -50% → should fire as warning
    const days = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 7).padStart(2, '0')}`,
      pageviews: 100,
      unique_visitors: 80,
      link_clicks: i < 7 ? 20 : 10,
      link_clicks_by_key: {},
      countries: { BR: 5 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-07', '2026-05-20')
    const engInsight = insights.find((i) => i.id === 'engagement-trend')
    expect(engInsight).toBeDefined()
    expect(engInsight!.severity).toBe('warning')
  })

  it('does NOT emit engagement-trend when engagement change is exactly 15% or less', async () => {
    // Prior 7 days: 100 clicks / 1000 views = 10% engagement rate
    // Recent 7 days: want exactly 15% change → 10% * 1.15 = 11.5% → 115 clicks / 1000 views
    // Change = (11.5% - 10%) / 10% = 15% exactly → should NOT fire (threshold is >15%)
    const days = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 7).padStart(2, '0')}`,
      pageviews: 1000,
      unique_visitors: 800,
      link_clicks: i < 7 ? 100 : 115,
      link_clicks_by_key: {},
      countries: { BR: 5 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-07', '2026-05-20')
    const engInsight = insights.find((i) => i.id === 'engagement-trend')
    expect(engInsight).toBeUndefined()
  })

  // -----------------------------------------------------------------------
  // Boundary condition tests for traffic-trend threshold
  // -----------------------------------------------------------------------

  it('traffic-trend: exactly 20% change should NOT emit (only >20%)', async () => {
    // Prior 7 days: 100 views each = 700 total
    // Recent 7 days: 120 views each = 840 total
    // Change = (840 - 700) / 700 = 20% exactly → should NOT fire
    const days = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 7).padStart(2, '0')}`,
      pageviews: i < 7 ? 100 : 120,
      unique_visitors: i < 7 ? 80 : 96,
      link_clicks: 5,
      link_clicks_by_key: {},
      countries: { BR: 5 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-07', '2026-05-20')
    const trafficInsight = insights.find((i) => i.id === 'traffic-trend')
    expect(trafficInsight).toBeUndefined()
  })

  it('traffic-trend: 20.1% change SHOULD emit', async () => {
    // Prior 7 days: 1000 views each = 7000 total
    // Recent 7 days: need > 20% → 1000 * 1.201 = 1201 views each = 8407 total
    // Change = (8407 - 7000) / 7000 = 20.1% → should fire
    const days = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 7).padStart(2, '0')}`,
      pageviews: i < 7 ? 1000 : 1201,
      unique_visitors: i < 7 ? 800 : 960,
      link_clicks: 5,
      link_clicks_by_key: {},
      countries: { BR: 5 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-07', '2026-05-20')
    const trafficInsight = insights.find((i) => i.id === 'traffic-trend')
    expect(trafficInsight).toBeDefined()
    expect(trafficInsight!.severity).toBe('positive')
  })

  // -----------------------------------------------------------------------
  // Boundary condition tests for geo-concentration threshold
  // -----------------------------------------------------------------------

  it('geo-concentration: exactly 60% should NOT emit (only >60%)', async () => {
    // Each day: BR=60, US=40 → total BR=420, US=280 → 420/700=60% exactly
    const days = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(i + 14).padStart(2, '0')}`,
      pageviews: 10,
      unique_visitors: 8,
      link_clicks: 5,
      link_clicks_by_key: {},
      countries: { BR: 60, US: 40 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-14', '2026-05-20')
    const geoInsight = insights.find((i) => i.id === 'geo-concentration')
    expect(geoInsight).toBeUndefined()
  })

  it('geo-concentration: >60% SHOULD emit (61% after rounding)', async () => {
    // Each day: BR=605, US=395 → total BR=4235, US=2765 → 4235/7000=60.5%
    // Math.round(60.5) = 61 > 60 → should fire
    const days = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(i + 14).padStart(2, '0')}`,
      pageviews: 10,
      unique_visitors: 8,
      link_clicks: 5,
      link_clicks_by_key: {},
      countries: { BR: 605, US: 395 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-14', '2026-05-20')
    const geoInsight = insights.find((i) => i.id === 'geo-concentration')
    expect(geoInsight).toBeDefined()
    expect(geoInsight!.title).toContain('BR')
  })
})
