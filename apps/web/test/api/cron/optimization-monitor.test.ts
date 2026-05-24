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

// ── YouTube mocks ────────────────────────────────────────────────────────────
vi.mock('@/lib/youtube/notification-service', () => ({
  buildNotification: vi.fn().mockReturnValue({
    type: 'optimization_resolved',
    priority: 'medium',
    title: 'Optimization resolved',
    message: 'Video improved',
    dedup_key: 'dedup-opt',
    video_id: 'vid-1',
    action_href: null,
  }),
}))

vi.mock('@/lib/youtube/analytics-sync', () => ({
  getIsoWeek: vi.fn().mockReturnValue('2026-W21'),
}))

vi.mock('@/lib/youtube/optimization-loop', () => ({
  OPTIMIZATION_CONFIG: {
    min_consecutive_low_weeks: 2,
    cooldown_days: 60,
    max_cycles_per_video: 5,
    monitoring_check_days: [7, 14, 30],
    ctr_drop_rollback_threshold_percent: -10,
    grade_improvement_target: 'B',
  },
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '@/app/api/cron/optimization-monitor/route'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(authHeader?: string): NextRequest {
  return {
    headers: new Headers(authHeader ? { authorization: authHeader } : {}),
  } as unknown as NextRequest
}

function monitoringQuery(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  }
}

function videoQuery(data: unknown) {
  const eqChain = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  })
  return {
    select: vi.fn().mockReturnValue({
      eq: eqChain,
    }),
  }
}

function gradeHistoryQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data, error: null }),
            }),
          }),
        }),
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
describe('GET /api/cron/optimization-monitor', () => {
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

  it('returns checked: 0 when no monitoring cycles exist', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'optimization_cycles') return monitoringQuery([])
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checked).toBe(0)
  })

  it('happy path: checks cycle at day 7 and updates monitoring result', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString()
    const cycle = {
      id: 'cycle-1',
      youtube_video_id: 'vid-1',
      site_id: 'site-1',
      test_winner_applied_at: eightDaysAgo,
      monitoring_day7_at: null,
      monitoring_day14_at: null,
      monitoring_day30_at: null,
    }
    const video = { title: 'My Video', ctr: 0.06 }
    const grade = { score: 75, grade: 'B' }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'optimization_cycles') {
        return {
          ...monitoringQuery([cycle]),
          ...updateQuery(),
        }
      }
      if (table === 'youtube_videos') return videoQuery(video)
      if (table === 'video_grade_history') return gradeHistoryQuery(grade)
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checked).toBe(1)
  })

  it('resolves cycle at day 30 when grade is A or B', async () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86400000).toISOString()
    const cycle = {
      id: 'cycle-resolved',
      youtube_video_id: 'vid-2',
      site_id: 'site-2',
      test_winner_applied_at: thirtyOneDaysAgo,
      monitoring_day7_at: thirtyOneDaysAgo,
      monitoring_day14_at: thirtyOneDaysAgo,
      monitoring_day30_at: null,
    }
    const video = { title: 'Good Video', ctr: 0.08 }
    const grade = { score: 85, grade: 'A' }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'optimization_cycles') {
        return {
          ...monitoringQuery([cycle]),
          ...updateQuery(),
        }
      }
      if (table === 'youtube_videos') return videoQuery(video)
      if (table === 'video_grade_history') return gradeHistoryQuery(grade)
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Day 30 check should be logged
    expect(body.checked).toBeGreaterThanOrEqual(1)
    // Should have called rpc for notification
    expect(mockRpc).toHaveBeenCalled()
  })

  it('captures Sentry exception on cycle processing error', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString()
    const cycle = {
      id: 'cycle-err',
      youtube_video_id: 'vid-err',
      site_id: 'site-err',
      test_winner_applied_at: eightDaysAgo,
      monitoring_day7_at: null,
      monitoring_day14_at: null,
      monitoring_day30_at: null,
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'optimization_cycles') return monitoringQuery([cycle])
      if (table === 'youtube_videos') {
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

    const Sentry = await import('@sentry/nextjs')
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
