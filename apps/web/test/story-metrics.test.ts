import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/social/actions/_shared', () => ({
  requireEditAccess: vi.fn().mockResolvedValue({ siteId: '11111111-1111-1111-1111-111111111111', userId: 'u1' }),
}))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireEditAccess } from '@/lib/social/actions/_shared'
import { getStoryInsights } from '@/lib/social/actions/story-metrics'

// ---------------------------------------------------------------------------
// Fluent query builder factory
// ---------------------------------------------------------------------------

type QueryResult = {
  data: unknown[] | null
  error: { message: string } | null
}

function buildChain(result: QueryResult) {
  const chain: Record<string, unknown> = {}
  const fluent = ['select', 'eq', 'neq', 'order', 'limit', 'gt', 'gte', 'lt', 'lte']
  for (const m of fluent) {
    chain[m] = vi.fn(() => chain)
  }
  chain.then = (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SITE_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_SITE_ID = '22222222-2222-2222-2222-222222222222'
const POST_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

let mockFrom: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireEditAccess).mockResolvedValue({ siteId: SITE_ID, userId: 'u1' })
  mockFrom = vi.fn()
  vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: mockFrom } as never)
})

// ---------------------------------------------------------------------------
// getStoryInsights
// ---------------------------------------------------------------------------

describe('getStoryInsights', () => {
  it('returns null when no metrics found', async () => {
    mockFrom.mockReturnValue(buildChain({ data: [], error: null }))

    const result = await getStoryInsights(SITE_ID, POST_ID)

    expect(result).toBeNull()
    expect(mockFrom).toHaveBeenCalledWith('post_metrics')
  })

  it('returns null on DB error', async () => {
    mockFrom.mockReturnValue(buildChain({ data: null, error: { message: 'connection refused' } }))

    const result = await getStoryInsights(SITE_ID, POST_ID)

    expect(result).toBeNull()
  })

  it('throws on invalid siteId (not UUID)', async () => {
    await expect(getStoryInsights('not-a-uuid', POST_ID)).rejects.toThrow()
    expect(requireEditAccess).not.toHaveBeenCalled()
  })

  it('throws on siteId mismatch (forbidden)', async () => {
    vi.mocked(requireEditAccess).mockResolvedValue({ siteId: SITE_ID, userId: 'u1' })

    await expect(getStoryInsights(OTHER_SITE_ID, POST_ID)).rejects.toThrow('forbidden')
  })

  it('throws on invalid postId (not UUID)', async () => {
    await expect(getStoryInsights(SITE_ID, 'bad-post-id')).rejects.toThrow()
  })

  it('returns aggregate-only when no per-slide data', async () => {
    const metrics = [
      {
        slide_index: null,
        impressions: 500,
        reach: 300,
        likes: 20,
        comments: 10,
        shares: 5,
        link_clicks: 15,
      },
    ]
    mockFrom.mockReturnValue(buildChain({ data: metrics, error: null }))

    const result = await getStoryInsights(SITE_ID, POST_ID)

    expect(result).not.toBeNull()
    expect(result!.post_id).toBe(POST_ID)
    expect(result!.aggregate).toEqual({
      impressions: 500,
      reach: 300,
      replies: 10,
      link_clicks: 15,
    })
    expect(result!.per_slide).toEqual([])
    expect(result!.drop_off).toEqual([])
  })

  it('returns full insights with per-slide and drop-off calculations', async () => {
    const metrics = [
      {
        slide_index: null,
        impressions: 1000,
        reach: 800,
        likes: 50,
        comments: 25,
        shares: 10,
        link_clicks: 30,
      },
      {
        slide_index: 0,
        impressions: 900,
        reach: 700,
        likes: 40,
        comments: 20,
        shares: 8,
        link_clicks: null,
      },
      {
        slide_index: 1,
        impressions: 600,
        reach: 400,
        likes: 25,
        comments: 12,
        shares: 4,
        link_clicks: null,
      },
      {
        slide_index: 2,
        impressions: 300,
        reach: 200,
        likes: 10,
        comments: 5,
        shares: 2,
        link_clicks: null,
      },
    ]
    mockFrom.mockReturnValue(buildChain({ data: metrics, error: null }))

    const result = await getStoryInsights(SITE_ID, POST_ID)

    expect(result).not.toBeNull()
    expect(result!.post_id).toBe(POST_ID)

    // aggregate
    expect(result!.aggregate).toEqual({
      impressions: 1000,
      reach: 800,
      replies: 25,
      link_clicks: 30,
    })

    // per_slide
    expect(result!.per_slide).toHaveLength(3)
    expect(result!.per_slide[0]).toEqual({
      slide_index: 0,
      impressions: 900,
      reach: 700,
      replies: 20,
    })
    expect(result!.per_slide[1]).toEqual({
      slide_index: 1,
      impressions: 600,
      reach: 400,
      replies: 12,
    })
    expect(result!.per_slide[2]).toEqual({
      slide_index: 2,
      impressions: 300,
      reach: 200,
      replies: 5,
    })

    // drop_off
    expect(result!.drop_off).toHaveLength(2)
    expect(result!.drop_off[0]).toEqual({
      from_slide: 0,
      to_slide: 1,
      reach_drop: 300, // 700 - 400
      drop_percentage: (300 / 700) * 100,
    })
    expect(result!.drop_off[1]).toEqual({
      from_slide: 1,
      to_slide: 2,
      reach_drop: 200, // 400 - 200
      drop_percentage: (200 / 400) * 100,
    })
  })

  it('calculates drop_percentage as 0 when previous slide reach is 0', async () => {
    const metrics = [
      {
        slide_index: null,
        impressions: 100,
        reach: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        link_clicks: 0,
      },
      {
        slide_index: 0,
        impressions: 50,
        reach: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        link_clicks: null,
      },
      {
        slide_index: 1,
        impressions: 30,
        reach: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        link_clicks: null,
      },
    ]
    mockFrom.mockReturnValue(buildChain({ data: metrics, error: null }))

    const result = await getStoryInsights(SITE_ID, POST_ID)

    expect(result).not.toBeNull()
    expect(result!.drop_off).toHaveLength(1)
    expect(result!.drop_off[0]).toEqual({
      from_slide: 0,
      to_slide: 1,
      reach_drop: 0,
      drop_percentage: 0, // no division by zero
    })
  })

  it('orders slides by index (data already ordered by query)', async () => {
    const metrics = [
      {
        slide_index: null,
        impressions: 500,
        reach: 400,
        likes: 0,
        comments: 0,
        shares: 0,
        link_clicks: 5,
      },
      {
        slide_index: 0,
        impressions: 400,
        reach: 350,
        likes: 0,
        comments: 3,
        shares: 0,
        link_clicks: null,
      },
      {
        slide_index: 1,
        impressions: 300,
        reach: 250,
        likes: 0,
        comments: 2,
        shares: 0,
        link_clicks: null,
      },
      {
        slide_index: 2,
        impressions: 200,
        reach: 150,
        likes: 0,
        comments: 1,
        shares: 0,
        link_clicks: null,
      },
    ]
    mockFrom.mockReturnValue(buildChain({ data: metrics, error: null }))

    const result = await getStoryInsights(SITE_ID, POST_ID)

    expect(result).not.toBeNull()
    const indices = result!.per_slide.map((s) => s.slide_index)
    expect(indices).toEqual([0, 1, 2])

    // drop_off transitions should follow slide order
    expect(result!.drop_off[0].from_slide).toBe(0)
    expect(result!.drop_off[0].to_slide).toBe(1)
    expect(result!.drop_off[1].from_slide).toBe(1)
    expect(result!.drop_off[1].to_slide).toBe(2)
  })

  it('defaults null metric values to 0 in aggregate', async () => {
    const metrics = [
      {
        slide_index: null,
        impressions: null,
        reach: null,
        likes: null,
        comments: null,
        shares: null,
        link_clicks: null,
      },
    ]
    mockFrom.mockReturnValue(buildChain({ data: metrics, error: null }))

    const result = await getStoryInsights(SITE_ID, POST_ID)

    expect(result).not.toBeNull()
    expect(result!.aggregate).toEqual({
      impressions: 0,
      reach: 0,
      replies: 0,
      link_clicks: 0,
    })
  })

  it('defaults null metric values to 0 in per-slide entries', async () => {
    const metrics = [
      {
        slide_index: null,
        impressions: 100,
        reach: 80,
        likes: 0,
        comments: 0,
        shares: 0,
        link_clicks: 0,
      },
      {
        slide_index: 0,
        impressions: null,
        reach: null,
        likes: null,
        comments: null,
        shares: null,
        link_clicks: null,
      },
    ]
    mockFrom.mockReturnValue(buildChain({ data: metrics, error: null }))

    const result = await getStoryInsights(SITE_ID, POST_ID)

    expect(result).not.toBeNull()
    expect(result!.per_slide[0]).toEqual({
      slide_index: 0,
      impressions: 0,
      reach: 0,
      replies: 0,
    })
  })
})
