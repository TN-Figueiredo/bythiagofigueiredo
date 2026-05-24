import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const CRON_SECRET = 'test-cron-secret'
process.env.CRON_SECRET = CRON_SECRET

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '../../../src/app/api/cron/expire-notifications/route'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(auth?: string): NextRequest {
  const headers = new Headers()
  if (auth !== undefined) {
    headers.set('authorization', auth)
  } else {
    headers.set('authorization', `Bearer ${CRON_SECRET}`)
  }
  return { headers } as unknown as NextRequest
}

function noAuthRequest(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest
}

function staleTasksUpdate(data: unknown[] | null = []) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/expire-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(noAuthRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest('Bearer wrong'))
    expect(res.status).toBe(401)
  })

  it('happy path: expires notifications and marks stale tasks', async () => {
    mockRpc.mockResolvedValue({ data: 5, error: null })

    const staleTasks = [{ id: 'task-1' }, { id: 'task-2' }]
    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_intelligence_tasks') return staleTasksUpdate(staleTasks)
      return {}
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.expired_notifications).toBe(5)
    expect(body.stale_tasks).toBe(2)
  })

  it('returns 0 expired when RPC errors (captured by Sentry)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_intelligence_tasks') return staleTasksUpdate([])
      return {}
    })

    const Sentry = await import('@sentry/nextjs')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.expired_notifications).toBe(0)
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('returns 0 stale_tasks when none are pending', async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_intelligence_tasks') return staleTasksUpdate(null)
      return {}
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.expired_notifications).toBe(0)
    expect(body.stale_tasks).toBe(0)
  })
})
