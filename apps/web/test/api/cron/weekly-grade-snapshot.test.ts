import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const CRON_SECRET = 'test-cron-secret'
process.env.CRON_SECRET = CRON_SECRET

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockFrom = vi.fn()
const mockRpc = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))

// ── YouTube scoring mocks ────────────────────────────────────────────────────
const mockScoreVideo = vi.fn().mockReturnValue({
  grade: 'B',
  overall: 72,
  axes: [
    { axis: 'ctr', normalized: 0.7 },
    { axis: 'retention', normalized: 0.8 },
    { axis: 'reach', normalized: 0.6 },
    { axis: 'engagement', normalized: 0.7 },
    { axis: 'growth', normalized: 0.5 },
    { axis: 'sub_impact', normalized: 0.4 },
  ],
})

const mockComputeBaseline = vi.fn().mockReturnValue({
  medianCtr: 0.05,
  medianRetention: 50,
  medianImpressions: 5000,
})

vi.mock('@/lib/youtube/scoring', () => ({
  scoreVideo: (...args: unknown[]) => mockScoreVideo(...args),
  computeBaseline: (...args: unknown[]) => mockComputeBaseline(...args),
}))

vi.mock('@/lib/youtube/analytics-sync', () => ({
  getIsoWeek: vi.fn().mockReturnValue('2026-W21'),
}))

vi.mock('@/lib/youtube/notification-service', () => ({
  buildNotification: vi.fn().mockReturnValue({
    type: 'grade_drop',
    priority: 'medium',
    title: 'Grade drop',
    message: 'Video dropped',
    dedup_key: 'dedup-grade',
    video_id: 'vid-1',
    action_href: null,
  }),
  buildGroupNotification: vi.fn().mockReturnValue({
    type: 'grade_drop',
    priority: 'medium',
    title: 'Multiple drops',
    message: 'Several videos dropped',
    dedup_key: 'dedup-group',
    action_href: null,
  }),
  shouldAggregate: vi.fn().mockReturnValue(false),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '@/app/api/cron/weekly-grade-snapshot/route'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(authHeader?: string): NextRequest {
  return {
    headers: new Headers(authHeader ? { authorization: authHeader } : {}),
  } as unknown as NextRequest
}

function channelsQuery(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  }
}

function videosQuery(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      }),
    }),
  }
}

function analyticsQuery(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      }),
    }),
  }
}

function historySelectQuery(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      }),
    }),
  }
}

function upsertQuery() {
  return {
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }
}

function optimizationSelectQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      }),
    }),
  }
}

function insertQuery() {
  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/weekly-grade-snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns no_channels when no sync-enabled channels exist', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([])
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('no_channels')
  })

  it('happy path: grades videos and returns counts', async () => {
    const channel = { id: 'ch-1', site_id: 'site-1', subscriber_count: 10000 }
    const video = {
      id: 'vid-1',
      youtube_video_id: 'yt-vid-1',
      title: 'My Video',
      published_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      view_count: 5000,
      ctr: 0.06,
      impressions: 8000,
      avg_view_percentage: 55,
      avg_view_duration_seconds: 300,
      traffic_sources: null,
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([channel])
      if (table === 'youtube_videos') return videosQuery([video])
      if (table === 'youtube_video_analytics') return analyticsQuery([])
      if (table === 'video_grade_history') {
        return {
          ...historySelectQuery([]),
          ...upsertQuery(),
        }
      }
      if (table === 'optimization_cycles') {
        return {
          ...optimizationSelectQuery(null),
          ...insertQuery(),
        }
      }
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.graded).toBe(1)
    expect(body.week).toBe('2026-W21')
    expect(mockScoreVideo).toHaveBeenCalled()
  })

  it('captures Sentry exception on channel processing error', async () => {
    const channel = { id: 'ch-err', site_id: 'site-err', subscriber_count: 100 }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([channel])
      if (table === 'youtube_videos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockRejectedValue(new Error('db error')),
                }),
              }),
            }),
          }),
        }
      }
      return {}
    })

    const Sentry = await import('@sentry/nextjs')
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.errors).toBe(1)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
