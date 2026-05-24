import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const CRON_SECRET = 'test-cron-secret'
process.env.CRON_SECRET = CRON_SECRET

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '@/app/api/cron/youtube-intelligence-dispatch/route'

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

function existingTaskQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
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
describe('GET /api/cron/youtube-intelligence-dispatch', () => {
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

  it('happy path: creates task for channel with no pending/running tasks', async () => {
    const channel = { id: 'ch-1', site_id: 'site-1' }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([channel])
      if (table === 'youtube_intelligence_tasks') {
        return {
          ...existingTaskQuery(null),
          ...insertQuery(),
        }
      }
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.created).toBe(1)
  })

  it('skips channel that already has a pending/running task', async () => {
    const channel = { id: 'ch-2', site_id: 'site-2' }
    const existingTask = { id: 'task-existing' }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([channel])
      if (table === 'youtube_intelligence_tasks') {
        return {
          ...existingTaskQuery(existingTask),
          ...insertQuery(),
        }
      }
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.created).toBe(0)
  })

  it('captures Sentry exception on channel processing error and continues', async () => {
    const channel1 = { id: 'ch-err', site_id: 'site-err' }
    const channel2 = { id: 'ch-ok', site_id: 'site-ok' }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([channel1, channel2])
      if (table === 'youtube_intelligence_tasks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: string) => {
              // First channel: throw; second: return no existing task
              if (val === 'ch-err') {
                return {
                  in: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      single: vi.fn().mockRejectedValue(new Error('db error')),
                    }),
                  }),
                }
              }
              return {
                in: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return {}
    })

    const Sentry = await import('@sentry/nextjs')
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    // ch-ok should succeed; ch-err should be caught
    expect(body.created).toBe(1)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
