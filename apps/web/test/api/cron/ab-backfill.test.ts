import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const CRON_SECRET = 'test-cron-secret'
process.env.CRON_SECRET = CRON_SECRET

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

// ── Token refresh mock ───────────────────────────────────────────────────────
const mockEnsureFreshToken = vi.fn()
vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
}))

// ── YouTube analytics mock ───────────────────────────────────────────────────
const mockFetchAnalyticsForDateRange = vi.fn()
vi.mock('@/lib/youtube/ab-youtube', () => ({
  fetchAnalyticsForDateRange: (...args: unknown[]) =>
    mockFetchAnalyticsForDateRange(...args),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn(),
  recordCronFailure: vi.fn(),
}))

// ── Import after mocks ─���─────────��──────────────────────────────────────────
import { GET } from '@/app/api/cron/ab-backfill/route'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(authHeader?: string): NextRequest {
  return {
    headers: new Headers(authHeader ? { authorization: authHeader } : {}),
  } as unknown as NextRequest
}

function cyclesQuery(data: unknown[], error: null | object = null) {
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  }
}

function singleQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

function updateQuery() {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/ab-backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns backfilled: 0 when no cycles need backfilling', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_test_cycles') return cyclesQuery([])
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.backfilled).toBe(0)
  })

  it('happy path: backfills cycle with analytics data', async () => {
    const cycle = {
      id: 'cycle-1',
      test_id: 'test-1',
      started_at: '2026-05-01T00:00:00Z',
      ended_at: '2026-05-10T00:00:00Z',
      backfill_attempts: 0,
    }
    const test = { id: 'test-1', site_id: 'site-1', youtube_video_id: 'vid-1' }
    const video = { youtube_video_id: 'yt-video-abc' }

    mockEnsureFreshToken.mockResolvedValue({ accessToken: 'tok-123' })
    mockFetchAnalyticsForDateRange.mockResolvedValue([
      { impressions: 1000, ctr: 0.05 },
      { impressions: 2000, ctr: 0.04 },
    ])

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_test_cycles') {
        // First call: select cycles; subsequent: update
        return {
          ...cyclesQuery([cycle]),
          ...updateQuery(),
        }
      }
      if (table === 'ab_tests') return singleQuery(test)
      if (table === 'youtube_videos') return singleQuery(video)
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.backfilled).toBe(1)
    expect(body.errors).toBe(0)
  })

  it('marks partial when analytics returns empty rows', async () => {
    const cycle = {
      id: 'cycle-2',
      test_id: 'test-2',
      started_at: '2026-05-01T00:00:00Z',
      ended_at: '2026-05-10T00:00:00Z',
      backfill_attempts: 1,
    }
    const test = { id: 'test-2', site_id: 'site-2', youtube_video_id: 'vid-2' }
    const video = { youtube_video_id: 'yt-video-def' }

    mockEnsureFreshToken.mockResolvedValue({ accessToken: 'tok-456' })
    mockFetchAnalyticsForDateRange.mockResolvedValue([])

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_test_cycles') {
        return {
          ...cyclesQuery([cycle]),
          ...updateQuery(),
        }
      }
      if (table === 'ab_tests') return singleQuery(test)
      if (table === 'youtube_videos') return singleQuery(video)
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.backfilled).toBe(0)
  })

  it('continues processing when a cycle throws and reports errors', async () => {
    const cycle = {
      id: 'cycle-err',
      test_id: 'test-err',
      started_at: '2026-05-01T00:00:00Z',
      ended_at: '2026-05-10T00:00:00Z',
      backfill_attempts: 0,
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_test_cycles') {
        return {
          ...cyclesQuery([cycle]),
          ...updateQuery(),
        }
      }
      if (table === 'ab_tests') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockRejectedValue(new Error('db error')),
            }),
          }),
        }
      }
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.errors).toBe(1)
  })
})
