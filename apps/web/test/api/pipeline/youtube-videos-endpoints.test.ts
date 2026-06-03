import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

// ─── Constants ─────────────────────────────────────────────────────────────

const SITE_ID = '11111111-1111-1111-1111-111111111111'
const CHANNEL_ID = '22222222-2222-2222-2222-222222222222'
const VIDEO_ID = '33333333-3333-3333-3333-333333333333'
const CATEGORY_ID = '44444444-4444-4444-4444-444444444444'

// ─── Scoring mocks ────────────────────────────────────────────────────────

vi.mock('@/lib/youtube/scoring', () => ({
  scoreVideo: vi.fn().mockReturnValue({
    videoId: '33333333-3333-3333-3333-333333333333',
    overall: 72,
    grade: 'B',
    axes: [
      { axis: 'ctr', raw: 5, normalized: 75, weight: 0.25, weighted: 18.75 },
      { axis: 'retention', raw: 45, normalized: 65, weight: 0.2, weighted: 13 },
      { axis: 'reach', raw: 60, normalized: 70, weight: 0.15, weighted: 10.5 },
      { axis: 'engagement', raw: 3, normalized: 80, weight: 0.15, weighted: 12 },
      { axis: 'growth', raw: 2, normalized: 60, weight: 0.15, weighted: 9 },
      { axis: 'sub_impact', raw: 1.5, normalized: 55, weight: 0.1, weighted: 5.5 },
    ],
    evergreenBonus: 0,
    lifecycle: 'maturing',
    ageDays: 30,
  }),
  computeBaseline: vi.fn().mockReturnValue({
    medianCtr: 4.5,
    medianRetention: 42,
    medianReach: 50,
    medianEngagement: 3.2,
    medianGrowth: 1.5,
    medianSubImpact: 1.0,
    channelDailyMean: 1000,
    subscriberCount: 5000,
    medianViewCount: 3000,
  }),
  computeTrend: vi.fn().mockReturnValue({
    direction: 'up',
    velocity: 2.5,
    streak: 3,
    label: 'Subindo',
  }),
  assignGrade: vi.fn().mockImplementation((score: number) => {
    if (score >= 85) return 'A'
    if (score >= 65) return 'B'
    if (score >= 40) return 'C'
    return 'D'
  }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

// ─── Supabase chain builder ────────────────────────────────────────────────

type QueryResult = { data: unknown; error: unknown }

/**
 * Builds a fluent Supabase query mock.
 * Every chainable method returns `this` so calls like `.select().eq().order().limit()` work.
 * Resolves to the provided result on `await` (via `.then()`).
 */
function buildQuery(result: QueryResult): Record<string, unknown> {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'eq', 'in', 'not', 'is', 'gte', 'lt', 'like',
    'order', 'limit', 'single', 'maybeSingle', 'update', 'insert',
    'delete', 'upsert',
  ]
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  // Make the chain thenable so `await query` resolves to result
  chain.then = (resolve: (v: QueryResult) => void) => resolve(result)
  return chain
}

function makeMockSupabase(tableResults: Record<string, QueryResult>) {
  return {
    from: vi.fn((table: string) => {
      const result = tableResults[table] ?? { data: null, error: null }
      return buildQuery(result)
    }),
  }
}

function makeCtx(supabase: ReturnType<typeof makeMockSupabase>): ServiceContext {
  return {
    siteId: SITE_ID,
    permissions: ['read', 'write'],
    keyHash: 'test',
    supabase: supabase as unknown as ServiceContext['supabase'],
  }
}

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import {
  listVideos,
  getVideoDetail,
  listCategories,
  updateCategoryKeywords,
} from '@/lib/pipeline/services/youtube'

// ===========================================================================
// listVideos
// ===========================================================================

describe('listVideos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns videos with category slug', async () => {
    const videos = [
      {
        id: VIDEO_ID,
        youtube_video_id: 'yt-abc',
        title: 'Test Video',
        view_count: 5000,
        like_count: 200,
        comment_count: 50,
        ctr: 5.2,
        avg_view_percentage: 45,
        published_at: '2026-01-15T10:00:00Z',
        category_id: CATEGORY_ID,
        thumbnail_url: 'https://img.youtube.com/thumb.jpg',
        duration_seconds: 600,
        is_featured: false,
        is_hidden: false,
        youtube_categories: { slug: 'tutorials' },
      },
    ]

    const supabase = makeMockSupabase({
      youtube_channels: { data: { id: CHANNEL_ID }, error: null },
      youtube_videos: { data: videos, error: null },
    })

    const ctx = makeCtx(supabase)
    const result = await listVideos(ctx, { channelId: CHANNEL_ID })

    expect(result.data.videos).toHaveLength(1)
    expect(result.data.videos[0]!.category_slug).toBe('tutorials')
    expect(result.data.videos[0]!.title).toBe('Test Video')
    expect(result.data.videos[0]!.views).toBe(5000)
    expect(result.data.count).toBe(1)
  })

  it('filters by channel_id (verifies channel belongs to site)', async () => {
    const supabase = makeMockSupabase({
      youtube_channels: { data: { id: CHANNEL_ID }, error: null },
      youtube_videos: { data: [], error: null },
    })

    const ctx = makeCtx(supabase)
    await listVideos(ctx, { channelId: CHANNEL_ID })

    // Verify youtube_channels was queried with channel_id + site_id
    const fromCalls = supabase.from.mock.calls
    expect(fromCalls[0]![0]).toBe('youtube_channels')

    const channelQuery = supabase.from.mock.results[0]!.value
    expect(channelQuery.select).toHaveBeenCalled()
    expect(channelQuery.eq).toHaveBeenCalledWith('id', CHANNEL_ID)
    expect(channelQuery.eq).toHaveBeenCalledWith('site_id', SITE_ID)
  })

  it('filters by category_id', async () => {
    const supabase = makeMockSupabase({
      youtube_channels: { data: { id: CHANNEL_ID }, error: null },
      youtube_videos: { data: [], error: null },
    })

    const ctx = makeCtx(supabase)
    await listVideos(ctx, { channelId: CHANNEL_ID, categoryId: CATEGORY_ID })

    // The second from() call is for youtube_videos
    const videosQuery = supabase.from.mock.results[1]!.value
    expect(videosQuery.eq).toHaveBeenCalledWith('category_id', CATEGORY_ID)
  })

  it('respects limit and cursor pagination', async () => {
    const supabase = makeMockSupabase({
      youtube_channels: { data: { id: CHANNEL_ID }, error: null },
      youtube_videos: { data: [], error: null },
    })

    const ctx = makeCtx(supabase)
    const cursor = '2026-01-01T00:00:00Z'
    await listVideos(ctx, { channelId: CHANNEL_ID, limit: 10, cursor })

    const videosQuery = supabase.from.mock.results[1]!.value
    expect(videosQuery.limit).toHaveBeenCalledWith(10)
    expect(videosQuery.lt).toHaveBeenCalledWith('published_at', cursor)
  })

  it('returns empty array when no videos', async () => {
    const supabase = makeMockSupabase({
      youtube_channels: { data: { id: CHANNEL_ID }, error: null },
      youtube_videos: { data: [], error: null },
    })

    const ctx = makeCtx(supabase)
    const result = await listVideos(ctx, { channelId: CHANNEL_ID })

    expect(result.data.videos).toEqual([])
    expect(result.data.count).toBe(0)
  })

  it('returns NOT_FOUND when channel does not belong to site', async () => {
    const supabase = makeMockSupabase({
      youtube_channels: { data: null, error: null },
    })

    const ctx = makeCtx(supabase)
    await expect(
      listVideos(ctx, { channelId: CHANNEL_ID }),
    ).rejects.toThrow(PipelineServiceError)

    try {
      await listVideos(ctx, { channelId: CHANNEL_ID })
    } catch (e) {
      expect((e as PipelineServiceError).code).toBe('NOT_FOUND')
      expect((e as PipelineServiceError).status).toBe(404)
    }
  })
})

// ===========================================================================
// getVideoDetail
// ===========================================================================

describe('getVideoDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeDetailSupabase() {
    const video = {
      id: VIDEO_ID,
      youtube_video_id: 'yt-abc',
      title: 'Detail Video',
      published_at: '2026-01-15T10:00:00Z',
      ctr: 5.2,
      impressions: 10000,
      avg_view_percentage: 45,
      avg_view_duration_seconds: 270,
      retention_curve: [100, 85, 70, 55, 40],
      traffic_sources: { browse: 40, search: 20, suggested: 25, external: 5, direct: 5, notifications: 3, playlists: 2 },
      view_count: 5000,
      like_count: 200,
      comment_count: 50,
      channel_id: CHANNEL_ID,
      site_id: SITE_ID,
    }

    const channelVideos = [
      { id: VIDEO_ID, ctr: 5.2, avg_view_percentage: 45, traffic_sources: null, view_count: 5000 },
      { id: 'other-vid', ctr: 4.0, avg_view_percentage: 40, traffic_sources: null, view_count: 3000 },
    ]

    const dailyAnalytics = [
      { date: '2026-01-16', views: 500, likes: 20, comments: 5, shares: 2, subscribers_gained: 3, impressions: 1000 },
      { date: '2026-01-17', views: 450, likes: 18, comments: 4, shares: 1, subscribers_gained: 2, impressions: 900 },
    ]

    const gradeHistory = [
      { week_iso: '2026-W01', score: 68 },
      { week_iso: '2026-W02', score: 70 },
      { week_iso: '2026-W03', score: 72 },
    ]

    const optimizationCycle = [{ state: 'diagnosed' }]

    // Create separate query chains per table so each from() call gets its own chain
    const tableData: Record<string, QueryResult[]> = {
      youtube_videos: [
        { data: video, error: null },          // first call: single video
        { data: channelVideos, error: null },   // second call: channel videos for baseline
      ],
      youtube_channels: [
        { data: { id: CHANNEL_ID, subscriber_count: 5000 }, error: null },
      ],
      youtube_video_analytics: [
        { data: dailyAnalytics, error: null },
      ],
      optimization_cycles: [
        { data: optimizationCycle, error: null },
      ],
      video_grade_history: [
        { data: gradeHistory, error: null },
      ],
    }

    const callCounts: Record<string, number> = {}

    const supabase = {
      from: vi.fn((table: string) => {
        const idx = callCounts[table] ?? 0
        callCounts[table] = idx + 1
        const results = tableData[table]
        const result = results?.[idx] ?? results?.[0] ?? { data: null, error: null }
        return buildQuery(result)
      }),
    }

    return supabase
  }

  it('returns 6-axis scoring breakdown', async () => {
    const supabase = makeDetailSupabase()
    const ctx = makeCtx(supabase)
    const result = await getVideoDetail(ctx, VIDEO_ID)

    expect(result.data.axes).toHaveLength(6)
    const axisNames = result.data.axes.map(a => a.axis)
    expect(axisNames).toContain('ctr')
    expect(axisNames).toContain('retention')
    expect(axisNames).toContain('reach')
    expect(axisNames).toContain('engagement')
    expect(axisNames).toContain('growth')
    expect(axisNames).toContain('sub_impact')

    for (const axis of result.data.axes) {
      expect(typeof axis.score).toBe('number')
      expect(typeof axis.grade).toBe('string')
      expect(typeof axis.channelMedian).toBe('number')
    }
  })

  it('returns retention curve', async () => {
    const supabase = makeDetailSupabase()
    const ctx = makeCtx(supabase)
    const result = await getVideoDetail(ctx, VIDEO_ID)

    expect(result.data.retentionCurve).toEqual([100, 85, 70, 55, 40])
  })

  it('returns traffic sources', async () => {
    const supabase = makeDetailSupabase()
    const ctx = makeCtx(supabase)
    const result = await getVideoDetail(ctx, VIDEO_ID)

    expect(result.data.trafficSources).toEqual({
      browse: 40, search: 20, suggested: 25, external: 5,
      direct: 5, notifications: 3, playlists: 2,
    })
  })

  it('returns optimization state', async () => {
    const supabase = makeDetailSupabase()
    const ctx = makeCtx(supabase)
    const result = await getVideoDetail(ctx, VIDEO_ID)

    expect(result.data.optimizationState).toBe('diagnosed')
  })

  it('returns grade history with trend', async () => {
    const supabase = makeDetailSupabase()
    const ctx = makeCtx(supabase)
    const result = await getVideoDetail(ctx, VIDEO_ID)

    expect(result.data.gradeHistory).toHaveLength(3)
    expect(result.data.gradeHistory[0]).toEqual({ week: '2026-W01', score: 68 })
    expect(result.data.gradeHistory[2]).toEqual({ week: '2026-W03', score: 72 })

    expect(result.data.trend).toBeDefined()
    expect(result.data.trend.direction).toBe('up')
    expect(typeof result.data.trend.velocity).toBe('number')
  })

  it('returns error for non-existent video', async () => {
    const supabase = makeMockSupabase({
      youtube_videos: { data: null, error: { code: 'PGRST116', message: 'not found' } },
    })

    const ctx = makeCtx(supabase)
    await expect(
      getVideoDetail(ctx, VIDEO_ID),
    ).rejects.toThrow(PipelineServiceError)

    try {
      await getVideoDetail(ctx, VIDEO_ID)
    } catch (e) {
      expect((e as PipelineServiceError).code).toBe('NOT_FOUND')
      expect((e as PipelineServiceError).status).toBe(404)
    }
  })

  it('returns VALIDATION_ERROR for invalid video ID format', async () => {
    const supabase = makeMockSupabase({})
    const ctx = makeCtx(supabase)

    await expect(
      getVideoDetail(ctx, 'not-a-uuid'),
    ).rejects.toThrow(PipelineServiceError)

    try {
      await getVideoDetail(ctx, 'not-a-uuid')
    } catch (e) {
      expect((e as PipelineServiceError).code).toBe('VALIDATION_ERROR')
      expect((e as PipelineServiceError).status).toBe(400)
    }
  })
})

// ===========================================================================
// listCategories
// ===========================================================================

describe('listCategories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns categories with match_keywords and video_count', async () => {
    const categories = [
      { id: CATEGORY_ID, slug: 'tutorials', name_pt: 'Tutoriais', match_keywords: ['tutorial', 'como fazer'], auto_approve: true },
      { id: '55555555-5555-5555-5555-555555555555', slug: 'vlogs', name_pt: 'Vlogs', match_keywords: ['vlog', 'dia a dia'], auto_approve: false },
    ]

    const videos = [
      { category_id: CATEGORY_ID },
      { category_id: CATEGORY_ID },
      { category_id: CATEGORY_ID },
      { category_id: '55555555-5555-5555-5555-555555555555' },
    ]

    const tableData: Record<string, QueryResult[]> = {
      youtube_categories: [{ data: categories, error: null }],
      youtube_videos: [{ data: videos, error: null }],
    }

    const callCounts: Record<string, number> = {}
    const supabase = {
      from: vi.fn((table: string) => {
        const idx = callCounts[table] ?? 0
        callCounts[table] = idx + 1
        const results = tableData[table]
        const result = results?.[idx] ?? results?.[0] ?? { data: null, error: null }
        return buildQuery(result)
      }),
    }

    const ctx = makeCtx(supabase)
    const result = await listCategories(ctx)

    expect(result.data.categories).toHaveLength(2)

    const tutorials = result.data.categories.find(c => c.slug === 'tutorials')!
    expect(tutorials.match_keywords).toEqual(['tutorial', 'como fazer'])
    expect(tutorials.video_count).toBe(3)

    const vlogs = result.data.categories.find(c => c.slug === 'vlogs')!
    expect(vlogs.video_count).toBe(1)
  })

  it('sorted by sort_order', async () => {
    const categories = [
      { id: '11111111-0000-0000-0000-000000000001', slug: 'first', name_pt: 'First', match_keywords: [], auto_approve: true },
      { id: '11111111-0000-0000-0000-000000000002', slug: 'second', name_pt: 'Second', match_keywords: [], auto_approve: true },
    ]

    const tableData: Record<string, QueryResult[]> = {
      youtube_categories: [{ data: categories, error: null }],
      youtube_videos: [{ data: [], error: null }],
    }

    const callCounts: Record<string, number> = {}
    const supabase = {
      from: vi.fn((table: string) => {
        const idx = callCounts[table] ?? 0
        callCounts[table] = idx + 1
        const results = tableData[table]
        const result = results?.[idx] ?? results?.[0] ?? { data: null, error: null }
        return buildQuery(result)
      }),
    }

    const ctx = makeCtx(supabase)
    await listCategories(ctx)

    // Verify that order was called with sort_order ascending on the categories query
    const categoriesQuery = supabase.from.mock.results[0]!.value
    expect(categoriesQuery.order).toHaveBeenCalledWith('sort_order', { ascending: true })
  })

  it('returns empty categories when none exist', async () => {
    const tableData: Record<string, QueryResult[]> = {
      youtube_categories: [{ data: [], error: null }],
      youtube_videos: [{ data: [], error: null }],
    }

    const callCounts: Record<string, number> = {}
    const supabase = {
      from: vi.fn((table: string) => {
        const idx = callCounts[table] ?? 0
        callCounts[table] = idx + 1
        const results = tableData[table]
        const result = results?.[idx] ?? results?.[0] ?? { data: null, error: null }
        return buildQuery(result)
      }),
    }

    const ctx = makeCtx(supabase)
    const result = await listCategories(ctx)

    expect(result.data.categories).toEqual([])
  })
})

// ===========================================================================
// updateCategoryKeywords
// ===========================================================================

describe('updateCategoryKeywords', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates keywords array', async () => {
    const supabase = makeMockSupabase({
      youtube_categories: { data: { id: CATEGORY_ID, site_id: SITE_ID }, error: null },
    })

    const ctx = makeCtx(supabase)
    const newKeywords = ['react', 'nextjs', 'typescript']
    const result = await updateCategoryKeywords(ctx, { id: CATEGORY_ID, match_keywords: newKeywords })

    expect(result.data.id).toBe(CATEGORY_ID)
    expect(result.data.match_keywords).toEqual(newKeywords)
  })

  it('validates category belongs to site', async () => {
    const OTHER_SITE = '99999999-9999-9999-9999-999999999999'
    const supabase = makeMockSupabase({
      youtube_categories: { data: { id: CATEGORY_ID, site_id: OTHER_SITE }, error: null },
    })

    const ctx = makeCtx(supabase)
    await expect(
      updateCategoryKeywords(ctx, { id: CATEGORY_ID, match_keywords: ['test'] }),
    ).rejects.toThrow(PipelineServiceError)

    try {
      await updateCategoryKeywords(ctx, { id: CATEGORY_ID, match_keywords: ['test'] })
    } catch (e) {
      expect((e as PipelineServiceError).code).toBe('NOT_FOUND')
      expect((e as PipelineServiceError).status).toBe(404)
    }
  })

  it('returns error for non-existent category', async () => {
    const supabase = makeMockSupabase({
      youtube_categories: { data: null, error: null },
    })

    const ctx = makeCtx(supabase)
    await expect(
      updateCategoryKeywords(ctx, { id: CATEGORY_ID, match_keywords: ['test'] }),
    ).rejects.toThrow(PipelineServiceError)

    try {
      await updateCategoryKeywords(ctx, { id: CATEGORY_ID, match_keywords: ['test'] })
    } catch (e) {
      expect((e as PipelineServiceError).code).toBe('NOT_FOUND')
      expect((e as PipelineServiceError).status).toBe(404)
    }
  })

  it('returns VALIDATION_ERROR for invalid category ID format', async () => {
    const supabase = makeMockSupabase({})
    const ctx = makeCtx(supabase)

    await expect(
      updateCategoryKeywords(ctx, { id: 'not-a-uuid', match_keywords: ['test'] }),
    ).rejects.toThrow(PipelineServiceError)

    try {
      await updateCategoryKeywords(ctx, { id: 'not-a-uuid', match_keywords: ['test'] })
    } catch (e) {
      expect((e as PipelineServiceError).code).toBe('VALIDATION_ERROR')
      expect((e as PipelineServiceError).status).toBe(400)
    }
  })
})
