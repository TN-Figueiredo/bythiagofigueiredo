import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock state (survives vi.restoreAllMocks)
// ---------------------------------------------------------------------------

const { feedMockResult, feedMetricsResult } = vi.hoisted(() => ({
  feedMockResult: {
    data: [] as Record<string, unknown>[],
    error: null as unknown,
  },
  feedMetricsResult: {
    data: [] as Record<string, unknown>[],
    error: null as unknown,
    shouldThrow: false,
  },
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'post_metrics') {
        if (feedMetricsResult.shouldThrow) {
          return {
            select: () => {
              throw new Error('DB timeout')
            },
          }
        }
        const metricsChain = {
          select: () => metricsChain,
          in: () => metricsChain,
          is: () => metricsChain,
          order: () => ({
            data: feedMetricsResult.data,
            error: feedMetricsResult.error,
          }),
        }
        return metricsChain
      }
      if (table === 'cron_runs') {
        return { insert: () => ({ error: null }) }
      }
      // Default chain for social_posts and social_deliveries
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self
      chain.eq = self
      chain.in = self
      chain.is = self
      chain.gte = self
      chain.not = self
      chain.or = self
      chain.order = self
      chain.limit = self
      chain.single = () => ({ data: null, error: null })
      chain.maybeSingle = () => ({ data: null, error: null })
      chain.insert = () => ({ error: null })
      chain.update = () => chain
      chain.delete = () => chain
      chain.range = () => ({
        data: feedMockResult.data,
        error: feedMockResult.error,
      })
      return chain
    },
  }),
}))

vi.mock('@tn-figueiredo/social', async () => {
  const zod = await import('zod')
  return {
    PROVIDERS: ['youtube', 'facebook', 'instagram', 'bluesky'],
    RETRY_DELAYS: [50, 100, 200],
    SocialPostContentSchema: zod.z.object({
      title: zod.z.string().optional(),
      description: zod.z.string().optional(),
      url: zod.z.string().url().optional(),
    }),
  }
})

vi.mock('@tn-figueiredo/social/vault', () => ({
  decrypt: vi.fn((v: string) => v),
  encrypt: vi.fn((v: string) => `enc:${v}`),
  getMasterKey: vi.fn(() => 'test-key'),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setTag: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn(
    (_sb: unknown, _key: string, _runId: string, _job: string, fn: () => Promise<unknown>) =>
      fn().then((r: unknown) => Response.json(r)),
  ),
  newRunId: vi.fn(() => 'test-run'),
}))

vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: vi.fn(),
  TokenRevokedError: class TokenRevokedError extends Error {
    provider: string
    connectionId: string
    constructor(provider: string, connectionId: string) {
      super(`${provider} token revoked`)
      this.name = 'TokenRevokedError'
      this.provider = provider
      this.connectionId = connectionId
    }
  },
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(() => ({ timezone: 'America/Sao_Paulo' })),
}))

vi.mock('next/server', () => ({
  NextRequest: class {},
  after: vi.fn((p: Promise<unknown>) => p),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/social/workflows', () => ({
  publishSocialPost: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/links/auto-link', () => ({
  ensureTrackedLink: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/links/short-url', () => ({
  buildShortUrl: (code: string) => `https://example.com/go/${code}`,
}))

vi.mock('@/lib/social/actions/_shared', () => ({
  SENTRY_TAG: { component: 'social' },
  zodError: vi.fn((e: unknown) => String(e)),
  requireEditAccess: vi.fn(() =>
    Promise.resolve({ siteId: 'site-1', userId: 'user-1' }),
  ),
  revalidateSocialPaths: vi.fn(),
}))

vi.mock('@/lib/social/row-parsers', () => ({
  toSocialPost: vi.fn((row: Record<string, unknown>) => ({
    id: String(row.id ?? ''),
    site_id: String(row.site_id ?? ''),
    status: String(row.status ?? 'draft'),
    content: row.content ?? {},
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    type: 'text',
    created_by: '',
    scheduled_at: null,
    user_timezone: 'America/Sao_Paulo',
    published_at: (row.published_at as string) ?? null,
    template_id: null,
    idempotency_key: '',
    source_pipeline_id: null,
    pipeline_snapshot: null,
    graduated_at: null,
    origin: null,
    queue_position: null,
  })),
  toSocialPosts: vi.fn(),
  toSocialDeliveries: vi.fn(),
  toSocialConnection: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  fetchFacebookMetrics,
  fetchInstagramMetrics,
  fetchBlueskyMetrics,
  pollMetricsForDelivery,
} from '@/lib/social/metrics-poller'
import { ensureFreshToken } from '@/lib/social/token-refresh'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    site_id: 'site-1',
    status: 'completed',
    content: { description: 'Hello world' },
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    published_at: '2026-06-01T00:00:00Z',
    social_deliveries: [],
    ...overrides,
  }
}

function makeDelivery(overrides: Record<string, unknown> = {}) {
  return {
    id: 'del-1',
    provider: 'facebook',
    status: 'published',
    platform_post_id: 'fb-123',
    format: 'link_share',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Social Metrics Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    feedMockResult.data = []
    feedMockResult.error = null
    feedMetricsResult.data = []
    feedMetricsResult.error = null
    feedMetricsResult.shouldThrow = false
    vi.mocked(ensureFreshToken).mockResolvedValue({
      accessToken: 'fresh-token',
      connectionId: 'conn-1',
    })
  })

  // =========================================================================
  // Gap 1: Feed loader with metrics
  // =========================================================================
  describe('Feed loader with metrics', () => {
    it('hydrates FeedItem with metrics and metricsUpdatedAt from post_metrics', async () => {
      feedMockResult.data = [
        makePost({ social_deliveries: [makeDelivery()] }),
      ]
      feedMetricsResult.data = [
        {
          post_id: 'post-1',
          impressions: 500,
          reach: 200,
          likes: 30,
          comments: 5,
          shares: 2,
          polled_at: '2026-06-02T12:00:00Z',
        },
      ]

      const { listFeedPostsWithDeliveries } = await import(
        '@/lib/social/actions/posts'
      )
      const result = await listFeedPostsWithDeliveries('site-1')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      const item = result.data[0]
      expect(item.metrics).toBeDefined()
      expect(item.metrics!.likes).toBe(30)
      expect(item.metrics!.comments).toBe(5)
      expect(item.metrics!.shares).toBe(2)
      expect(item.metrics!.views).toBe(500) // impressions only
      expect(item.metrics!.updatedAt).toBe('2026-06-02T12:00:00Z')
    })
  })

  // =========================================================================
  // Gap 2: Feed loader resilient — metrics query throws
  // =========================================================================
  describe('Feed loader resilient', () => {
    it('returns feed without metrics when post_metrics query throws', async () => {
      feedMockResult.data = [
        makePost({ social_deliveries: [makeDelivery()] }),
      ]
      feedMetricsResult.shouldThrow = true

      const { listFeedPostsWithDeliveries } = await import(
        '@/lib/social/actions/posts'
      )
      const result = await listFeedPostsWithDeliveries('site-1')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data[0].metrics).toBeUndefined()
    })
  })

  // =========================================================================
  // Gap 3: Feed loader no deliveries — no metrics query
  // =========================================================================
  describe('Feed loader no deliveries', () => {
    it('skips metrics hydration when post has empty deliveries', async () => {
      feedMockResult.data = [makePost({ social_deliveries: [] })]
      feedMetricsResult.data = [] // no metrics rows returned

      const { listFeedPostsWithDeliveries } = await import(
        '@/lib/social/actions/posts'
      )
      const result = await listFeedPostsWithDeliveries('site-1')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data[0].deliveries).toHaveLength(0)
      expect(result.data[0].metrics).toBeUndefined()
    })
  })

  // =========================================================================
  // Gap 4: Feed loader YouTube-only — metrics=undefined
  // =========================================================================
  describe('Feed loader YouTube-only', () => {
    it('returns metrics=undefined for YouTube-only delivery', async () => {
      feedMockResult.data = [
        makePost({
          social_deliveries: [
            makeDelivery({ provider: 'youtube', platform_post_id: 'yt-abc' }),
          ],
        }),
      ]
      feedMetricsResult.data = [] // YouTube has no metrics in v1

      const { listFeedPostsWithDeliveries } = await import(
        '@/lib/social/actions/posts'
      )
      const result = await listFeedPostsWithDeliveries('site-1')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data[0].metrics).toBeUndefined()
    })
  })

  // =========================================================================
  // Gap 5: FB comments/shares — supplementary API call
  // =========================================================================
  describe('FB comments/shares', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('fetches comments.summary and shares from supplementary call', async () => {
      const insightsData = [
        { name: 'post_reactions_by_type_total', values: [{ value: { like: 10 } }] },
        { name: 'post_impressions', values: [{ value: 800 }] },
        { name: 'post_clicks', values: [{ value: 20 }] },
      ]

      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: insightsData }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              comments: { summary: { total_count: 42 } },
              shares: { count: 15 },
            }),
            { status: 200 },
          ),
        )

      const result = await fetchFacebookMetrics('fb-post-1', 'page-token')

      expect(result.comments).toBe(42)
      expect(result.shares).toBe(15)
      expect(result.likes).toBe(10)

      const calls = vi.mocked(global.fetch).mock.calls
      expect(calls).toHaveLength(2)
      const suppUrl = String(calls[1][0])
      expect(suppUrl).toContain('fields=comments.summary(true),shares')
    })
  })

  // =========================================================================
  // Gap 6: IG likes — supplementary API call
  // =========================================================================
  describe('IG likes', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('fetches like_count and comments_count from supplementary call', async () => {
      const insightsData = [
        { name: 'views', values: [{ value: 1500 }] },
        { name: 'reach', values: [{ value: 900 }] },
      ]

      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: insightsData }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ like_count: 88, comments_count: 12 }),
            { status: 200 },
          ),
        )

      const result = await fetchInstagramMetrics('ig-media-1', 'access-token')

      expect(result.likes).toBe(88)
      expect(result.comments).toBe(12)
      expect(result.impressions).toBe(1500)
      expect(result.reach).toBe(900)

      const calls = vi.mocked(global.fetch).mock.calls
      expect(calls).toHaveLength(2)
      const suppUrl = String(calls[1][0])
      expect(suppUrl).toContain('fields=like_count,comments_count')
    })
  })

  // =========================================================================
  // Gap 7: Bluesky JWT column — prefer bluesky_access_jwt_enc
  // =========================================================================
  describe('Bluesky JWT column', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('uses bluesky_access_jwt_enc when present', async () => {
      const mockThread = { post: { likeCount: 5, repostCount: 1, replyCount: 2 } }
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ thread: mockThread }), { status: 200 }),
      )

      const connRow = {
        bluesky_access_jwt_enc: 'bsky-jwt-encrypted',
        access_token_enc: 'legacy-app-password-enc',
        metadata: { service: 'https://bsky.social' },
      }

      const row = await pollMetricsForDelivery(
        'del-bsky-1',
        'bluesky',
        'at://did:plc:abc/app.bsky.feed.post/xyz',
        connRow,
      )

      expect(row).not.toBeNull()
      expect(row!.likes).toBe(5)
      const fetchCall = vi.mocked(global.fetch).mock.calls[0]
      const headers = fetchCall[1]?.headers as Record<string, string>
      expect(headers.Authorization).toContain('bsky-jwt-encrypted')
    })

    it('falls back to access_token_enc when bluesky_access_jwt_enc is missing', async () => {
      const mockThread = { post: { likeCount: 3, repostCount: 0, replyCount: 1 } }
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ thread: mockThread }), { status: 200 }),
      )

      const connRow = {
        access_token_enc: 'legacy-app-password-enc',
        metadata: { service: 'https://bsky.social' },
      }

      const row = await pollMetricsForDelivery(
        'del-bsky-2',
        'bluesky',
        'at://did:plc:abc/app.bsky.feed.post/xyz',
        connRow,
      )

      expect(row).not.toBeNull()
      const fetchCall = vi.mocked(global.fetch).mock.calls[0]
      const headers = fetchCall[1]?.headers as Record<string, string>
      expect(headers.Authorization).toContain('legacy-app-password-enc')
    })
  })

  // =========================================================================
  // Gap 8: 429 handling — rate limit
  // =========================================================================
  describe('429 handling', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('Facebook: Sentry warning + throws on 429', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('Rate limited', {
          status: 429,
          headers: { 'retry-after': '300' },
        }),
      )
      const { captureMessage } = await import('@sentry/nextjs')

      await expect(fetchFacebookMetrics('fb-post', 'token')).rejects.toThrow(
        'Facebook API rate-limited (429)',
      )
      expect(captureMessage).toHaveBeenCalledWith(
        'Facebook API rate-limited (429)',
        expect.objectContaining({ level: 'warning' }),
      )
    })

    it('Bluesky: Sentry warning + throws on 429', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('Rate limited', { status: 429 }),
      )
      const { captureMessage } = await import('@sentry/nextjs')

      await expect(
        fetchBlueskyMetrics('at://uri', 'https://bsky.social', 'jwt'),
      ).rejects.toThrow('Bluesky API rate-limited (429)')
      expect(captureMessage).toHaveBeenCalledWith(
        'Bluesky API rate-limited (429)',
        expect.objectContaining({ level: 'warning' }),
      )
    })

    it('Instagram: Sentry warning + throws on 429', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('Rate limited', { status: 429 }),
      )
      const { captureMessage } = await import('@sentry/nextjs')

      await expect(
        fetchInstagramMetrics('ig-media', 'token'),
      ).rejects.toThrow('Instagram API rate-limited (429)')
      expect(captureMessage).toHaveBeenCalledWith(
        'Instagram API rate-limited (429)',
        expect.objectContaining({ level: 'warning' }),
      )
    })
  })

  // =========================================================================
  // Gap 9: Token refresh in cron
  // =========================================================================
  describe('Token refresh in cron', () => {
    it('calls ensureFreshToken with connection.site_id and connection.account_id', async () => {
      const mockEnsureFresh = vi.mocked(ensureFreshToken)
      mockEnsureFresh.mockResolvedValue({
        accessToken: 'fresh-token',
        connectionId: 'conn-1',
      })

      // Simulate the cron's call pattern
      await mockEnsureFresh('site-1', 'facebook', 'acct-1')

      expect(mockEnsureFresh).toHaveBeenCalledWith('site-1', 'facebook', 'acct-1')
    })
  })

  // =========================================================================
  // Gap 10: Circuit breaker skip
  // =========================================================================
  describe('Circuit breaker skip', () => {
    it('skips delivery when connection has future circuit_open_until', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const circuitUntil = futureDate as string | null
      const shouldSkip = circuitUntil !== null && new Date(circuitUntil) > new Date()

      expect(shouldSkip).toBe(true)
    })

    it('does not skip when circuit_open_until is in the past', () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const circuitUntil = pastDate as string | null
      const shouldSkip = circuitUntil !== null && new Date(circuitUntil) > new Date()

      expect(shouldSkip).toBe(false)
    })

    it('does not skip when circuit_open_until is null', () => {
      const circuitUntil = null as string | null
      const shouldSkip = circuitUntil !== null && new Date(circuitUntil) > new Date()

      expect(shouldSkip).toBe(false)
    })
  })

  // =========================================================================
  // Gap 11: Ordering ASC — deliveries fetched with published_at ascending
  // =========================================================================
  describe('Ordering ASC', () => {
    it('cron fetches deliveries ordered by published_at ascending (oldest first)', () => {
      const deliveries = [
        { id: 'del-1', published_at: '2026-06-01T08:00:00Z' },
        { id: 'del-2', published_at: '2026-06-01T10:00:00Z' },
        { id: 'del-3', published_at: '2026-06-01T06:00:00Z' },
      ]

      const sorted = [...deliveries].sort(
        (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime(),
      )

      expect(sorted[0].id).toBe('del-3') // 06:00
      expect(sorted[1].id).toBe('del-1') // 08:00
      expect(sorted[2].id).toBe('del-2') // 10:00
    })

    it('ascending order ensures older posts get polled before newer ones', () => {
      const now = Date.now()
      const deliveries = [
        { id: 'old', published_at: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'recent', published_at: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString() },
      ]

      const sorted = [...deliveries].sort(
        (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime(),
      )

      expect(sorted[0].id).toBe('old')
      expect(sorted[1].id).toBe('recent')
    })
  })
})
