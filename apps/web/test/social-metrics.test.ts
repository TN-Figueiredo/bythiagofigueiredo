import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@tn-figueiredo/social', () => ({
  decrypt: vi.fn((v: string) => v),
  getMasterKey: vi.fn(() => 'test-key'),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

import {
  shouldPollPost,
  fetchFacebookMetrics,
  fetchBlueskyMetrics,
  fetchInstagramMetrics,
  pollMetricsForDelivery,
  type PollCandidate,
} from '@/lib/social/metrics-poller'

describe('shouldPollPost', () => {
  const now = Date.now()

  it('returns true for posts less than 7 days old with last poll over 6h ago', () => {
    const candidate: PollCandidate = {
      postId: 'p1',
      publishedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      lastPolledAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(), // 7h ago
      isStory: false,
    }
    expect(shouldPollPost(candidate)).toBe(true)
  })

  it('returns false for posts less than 7 days old polled less than 6h ago', () => {
    const candidate: PollCandidate = {
      postId: 'p2',
      publishedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lastPolledAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
      isStory: false,
    }
    expect(shouldPollPost(candidate)).toBe(false)
  })

  it('returns true for stories less than 48h old polled over 2h ago', () => {
    const candidate: PollCandidate = {
      postId: 'p3',
      publishedAt: new Date(now - 20 * 60 * 60 * 1000).toISOString(), // 20h ago
      lastPolledAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
      isStory: true,
    }
    expect(shouldPollPost(candidate)).toBe(true)
  })

  it('returns false for posts older than 7 days', () => {
    const candidate: PollCandidate = {
      postId: 'p4',
      publishedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      lastPolledAt: null,
      isStory: false,
    }
    expect(shouldPollPost(candidate)).toBe(false)
  })

  it('returns true for posts never polled before within the window', () => {
    const candidate: PollCandidate = {
      postId: 'p5',
      publishedAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      lastPolledAt: null,
      isStory: false,
    }
    expect(shouldPollPost(candidate)).toBe(true)
  })
})

describe('fetchFacebookMetrics', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('happy path: parses reactions, impressions, and link clicks', async () => {
    const mockData = [
      { name: 'post_reactions_by_type_total', values: [{ value: { like: 10, wow: 3 } }] },
      { name: 'post_impressions', values: [{ value: 500 }] },
      { name: 'post_clicks', values: [{ value: 42 }] },
    ]
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockData }), { status: 200 }),
    )

    const result = await fetchFacebookMetrics('post-123', 'page-token-abc')

    expect(result.likes).toBe(13) // 10 + 3
    expect(result.impressions).toBe(500)
    expect(result.linkClicks).toBe(42)
    expect(result.comments).toBe(0)
    expect(result.shares).toBe(0)
    expect(result.raw).toEqual({ data: mockData })
  })

  it('throws on non-ok API response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    )

    await expect(fetchFacebookMetrics('post-123', 'bad-token')).rejects.toThrow(
      'Facebook insights (403)',
    )
  })

  it('handles empty data array gracefully', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    )

    const result = await fetchFacebookMetrics('post-123', 'page-token-abc')

    expect(result.likes).toBe(0)
    expect(result.impressions).toBe(0)
    expect(result.linkClicks).toBe(0)
  })
})

describe('fetchBlueskyMetrics', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('happy path: parses like, reply, and repost counts', async () => {
    const mockThread = {
      post: { likeCount: 25, repostCount: 5, replyCount: 8 },
    }
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ thread: mockThread }), { status: 200 }),
    )

    const result = await fetchBlueskyMetrics(
      'at://did:plc:abc/app.bsky.feed.post/123',
      'https://bsky.social',
      'jwt-token',
    )

    expect(result.likes).toBe(25)
    expect(result.shares).toBe(5)
    expect(result.comments).toBe(8)
    expect(result.raw).toEqual({ thread: mockThread })
  })

  it('throws on non-ok API response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    )

    await expect(
      fetchBlueskyMetrics('at://uri', 'https://bsky.social', 'bad-jwt'),
    ).rejects.toThrow('Bluesky getPostThread (401)')
  })

  it('defaults to 0 when post counts are missing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ thread: { post: {} } }), { status: 200 }),
    )

    const result = await fetchBlueskyMetrics('at://uri', 'https://bsky.social', 'jwt')

    expect(result.likes).toBe(0)
    expect(result.shares).toBe(0)
    expect(result.comments).toBe(0)
  })
})

describe('fetchInstagramMetrics', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('happy path: parses impressions, reach, and replies', async () => {
    const mockData = [
      { name: 'impressions', values: [{ value: 1200 }] },
      { name: 'reach', values: [{ value: 800 }] },
      { name: 'replies', values: [{ value: 15 }] },
    ]
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockData }), { status: 200 }),
    )

    const result = await fetchInstagramMetrics('media-id-abc', 'access-token')

    expect(result.impressions).toBe(1200)
    expect(result.reach).toBe(800)
    expect(result.comments).toBe(15)
    expect(result.likes).toBe(0)
    expect(result.shares).toBe(0)
    expect(result.raw).toEqual({ data: mockData })
  })

  it('throws on non-ok API response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    )

    await expect(fetchInstagramMetrics('media-id', 'token')).rejects.toThrow(
      'Instagram insights (500)',
    )
  })

  it('handles empty data array gracefully', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    )

    const result = await fetchInstagramMetrics('media-id', 'token')

    expect(result.impressions).toBe(0)
    expect(result.reach).toBe(0)
    expect(result.comments).toBe(0)
  })
})

describe('pollMetricsForDelivery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null for youtube (not supported in v1)', async () => {
    const result = await pollMetricsForDelivery(
      'delivery-1',
      'youtube',
      'yt-post-id',
      {},
    )
    expect(result).toBeNull()
  })

  it('returns null for unknown provider', async () => {
    const result = await pollMetricsForDelivery(
      'delivery-1',
      'unknown' as 'facebook',
      'post-id',
      {},
    )
    expect(result).toBeNull()
  })

  it('facebook: returns null when page_token_enc is missing', async () => {
    const result = await pollMetricsForDelivery(
      'delivery-1',
      'facebook',
      'post-123',
      {}, // no page_token_enc
    )
    expect(result).toBeNull()
  })

  it('facebook: orchestrates fetch and returns PostMetricRow', async () => {
    const mockData = [
      { name: 'post_reactions_by_type_total', values: [{ value: 7 }] },
      { name: 'post_impressions', values: [{ value: 300 }] },
      { name: 'post_clicks', values: [{ value: 10 }] },
    ]
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockData }), { status: 200 }),
    )

    const row = await pollMetricsForDelivery(
      'delivery-fb',
      'facebook',
      'fb-post-id',
      { page_token_enc: 'encrypted-token' },
    )

    expect(row).not.toBeNull()
    expect(row!.delivery_id).toBe('delivery-fb')
    expect(row!.provider).toBe('facebook')
    expect(row!.likes).toBe(7)
    expect(row!.impressions).toBe(300)
    expect(row!.link_clicks).toBe(10)
    expect(row!.polled_at).toBeDefined()
  })

  it('bluesky: orchestrates fetch and returns PostMetricRow', async () => {
    const mockThread = { post: { likeCount: 12, repostCount: 3, replyCount: 2 } }
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ thread: mockThread }), { status: 200 }),
    )

    const row = await pollMetricsForDelivery(
      'delivery-bsky',
      'bluesky',
      'at://did:plc:abc/app.bsky.feed.post/xyz',
      { access_token_enc: 'encrypted-jwt', metadata: { service: 'https://bsky.social' } },
    )

    expect(row).not.toBeNull()
    expect(row!.delivery_id).toBe('delivery-bsky')
    expect(row!.provider).toBe('bluesky')
    expect(row!.likes).toBe(12)
    expect(row!.shares).toBe(3)
    expect(row!.comments).toBe(2)
    expect(row!.impressions).toBeNull()
  })

  it('instagram: returns null when page_token_enc is missing', async () => {
    const result = await pollMetricsForDelivery(
      'delivery-1',
      'instagram',
      'ig-media-id',
      {},
    )
    expect(result).toBeNull()
  })

  it('instagram: orchestrates fetch and returns PostMetricRow', async () => {
    const mockData = [
      { name: 'impressions', values: [{ value: 900 }] },
      { name: 'reach', values: [{ value: 600 }] },
      { name: 'replies', values: [{ value: 4 }] },
    ]
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockData }), { status: 200 }),
    )

    const row = await pollMetricsForDelivery(
      'delivery-ig',
      'instagram',
      'ig-media-id',
      { page_token_enc: 'ig-token-enc' },
    )

    expect(row).not.toBeNull()
    expect(row!.delivery_id).toBe('delivery-ig')
    expect(row!.provider).toBe('instagram')
    expect(row!.impressions).toBe(900)
    expect(row!.reach).toBe(600)
    expect(row!.comments).toBe(4)
  })

  it('returns null and captures exception when fetch throws', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))
    const { captureException } = await import('@sentry/nextjs')

    const row = await pollMetricsForDelivery(
      'delivery-err',
      'facebook',
      'fb-post-id',
      { page_token_enc: 'token' },
    )

    expect(row).toBeNull()
    expect(captureException).toHaveBeenCalled()
  })
})
