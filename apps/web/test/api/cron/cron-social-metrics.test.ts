import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const CRON_SECRET = 'test-cron-secret'
process.env.CRON_SECRET = CRON_SECRET

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: mockFrom,
  }),
}))

// ── Token refresh mock ───────────────────────────────────────────────────────
const mockEnsureFreshToken = vi.fn().mockResolvedValue({ accessToken: 'tok-fresh' })

vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
  TokenRevokedError: class TokenRevokedError extends Error { constructor(m: string) { super(m); this.name = 'TokenRevokedError' } },
}))

// ── Metrics poller mock ──────────────────────────────────────────────────────
const mockShouldPollPost = vi.fn()
const mockPollMetricsForDelivery = vi.fn()

vi.mock('@/lib/social/metrics-poller', () => ({
  shouldPollPost: (candidate: unknown) => mockShouldPollPost(candidate),
  pollMetricsForDelivery: (...args: unknown[]) =>
    mockPollMetricsForDelivery(...args),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

// ── Import after mocks ───────────────────────────────────────────────────────
import { POST } from '../../../src/app/api/cron/social-metrics/route'

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(authHeader?: string): NextRequest {
  return {
    headers: new Headers(
      authHeader ? { authorization: authHeader } : {},
    ),
  } as unknown as NextRequest
}

/** Build a chainable Supabase query mock that resolves with the given value. */
function chainResolve(value: unknown) {
  const terminal = vi.fn().mockResolvedValue(value)
  const chain: Record<string, unknown> = {}
  const proxy: unknown = new Proxy(chain, {
    get(_t, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return terminal()[prop as 'then']
      }
      return () => proxy
    },
  })
  return proxy
}

/** Build a simple fluent mock that resolves at .limit() */
function deliveriesQuery(data: unknown[], error: null | object = null) {
  const limitFn = vi.fn().mockResolvedValue({ data, error })
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: limitFn,
            }),
          }),
        }),
      }),
    }),
  }
}

/** Build a fluent mock for post_metrics last-poll query. */
function lastPollsQuery(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

/** Build a fluent mock for social_connections single lookup. */
function connectionQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

/** Build a mock for cron_runs insert. */
function cronRunInsert() {
  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
  }
}

/** Build a mock for post_metrics insert. */
function metricsInsert(error: null | object = null) {
  return {
    insert: vi.fn().mockResolvedValue({ error }),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('POST /api/cron/social-metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without Authorization header', async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await POST(makeRequest('Bearer wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with processed: 0 when no deliveries found', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_deliveries') return deliveriesQuery([])
      if (table === 'cron_runs') return cronRunInsert()
      return {}
    })

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
    // Nothing to poll — pollMetricsForDelivery should never be called
    expect(mockPollMetricsForDelivery).not.toHaveBeenCalled()
  })

  it('happy path: queries deliveries, filters by schedule, polls each and upserts metrics', async () => {
    const now = new Date().toISOString()
    const fakeDelivery = {
      id: 'delivery-1',
      post_id: 'post-1',
      provider: 'facebook',
      platform_post_id: 'fb-post-1',
      connection_id: 'conn-1',
      format: 'post',
      published_at: now,
    }
    const fakeConnection = { id: 'conn-1', site_id: 'site-1', account_id: 'acct-1', page_token_enc: 'enc-tok' }
    const fakeMetricRow = {
      post_id: '',
      delivery_id: 'delivery-1',
      provider: 'facebook',
      impressions: 400,
      reach: 250,
      likes: 10,
      comments: 2,
      shares: 1,
      link_clicks: 5,
      polled_at: now,
      raw: {},
    }

    mockShouldPollPost.mockReturnValue(true)
    mockPollMetricsForDelivery.mockResolvedValue(fakeMetricRow)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_deliveries') return deliveriesQuery([fakeDelivery])
      if (table === 'post_metrics') {
        // Called twice: last-polls select + insert
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      if (table === 'social_connections') return connectionQuery(fakeConnection)
      if (table === 'cron_runs') return cronRunInsert()
      return {}
    })

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(1)
    expect(body.errors).toBeUndefined()
    expect(mockPollMetricsForDelivery).toHaveBeenCalledWith(
      'delivery-1',
      'facebook',
      'fb-post-1',
      fakeConnection,
    )
  })

  it('skips deliveries that shouldPollPost returns false for', async () => {
    const now = new Date().toISOString()
    const oldDelivery = {
      id: 'delivery-old',
      post_id: 'post-old',
      provider: 'bluesky',
      platform_post_id: 'bsky-post-old',
      connection_id: 'conn-old',
      format: 'post',
      published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    }

    mockShouldPollPost.mockReturnValue(false)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_deliveries') return deliveriesQuery([oldDelivery])
      if (table === 'post_metrics')
        return lastPollsQuery([{ delivery_id: 'delivery-old', polled_at: now }])
      if (table === 'cron_runs') return cronRunInsert()
      return {}
    })

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
    expect(mockPollMetricsForDelivery).not.toHaveBeenCalled()
  })

  it('returns error summary when some polls fail', async () => {
    const now = new Date().toISOString()
    const delivery = {
      id: 'delivery-fail',
      post_id: 'post-fail',
      provider: 'instagram',
      platform_post_id: 'ig-post-1',
      connection_id: 'conn-fail',
      format: 'post',
      published_at: now,
    }
    const connection = { id: 'conn-fail', page_token_enc: 'enc' }

    mockShouldPollPost.mockReturnValue(true)
    // pollMetricsForDelivery returns a row, but insert fails
    mockPollMetricsForDelivery.mockResolvedValue({
      post_id: '',
      delivery_id: 'delivery-fail',
      provider: 'instagram',
      impressions: null,
      reach: null,
      likes: 0,
      comments: 0,
      shares: 0,
      link_clicks: null,
      polled_at: now,
      raw: {},
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_deliveries') return deliveriesQuery([delivery])
      if (table === 'post_metrics') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({
            error: { message: 'duplicate key value' },
          }),
        }
      }
      if (table === 'social_connections') return connectionQuery(connection)
      if (table === 'cron_runs') return cronRunInsert()
      return {}
    })

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
    expect(body.errors).toBeDefined()
    expect(body.errors!.length).toBeGreaterThan(0)
    expect(body.errors![0]).toContain('delivery-fail')
  })

  it('skips delivery when connection is not found', async () => {
    const now = new Date().toISOString()
    const delivery = {
      id: 'delivery-no-conn',
      post_id: 'post-no-conn',
      provider: 'facebook',
      platform_post_id: 'fb-post-no-conn',
      connection_id: 'missing-conn',
      format: 'post',
      published_at: now,
    }

    mockShouldPollPost.mockReturnValue(true)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_deliveries') return deliveriesQuery([delivery])
      if (table === 'post_metrics') return lastPollsQuery([])
      if (table === 'social_connections') return connectionQuery(null)
      if (table === 'cron_runs') return cronRunInsert()
      return {}
    })

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
    expect(mockPollMetricsForDelivery).not.toHaveBeenCalled()
  })
})
