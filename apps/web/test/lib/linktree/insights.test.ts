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
})
