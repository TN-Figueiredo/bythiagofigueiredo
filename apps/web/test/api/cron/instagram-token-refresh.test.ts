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

vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn(
    (_sb: unknown, _key: string, _runId: string, _tag: string, fn: () => Promise<unknown>) =>
      fn().then((r: unknown) => Response.json(r)),
  ),
  newRunId: vi.fn(() => 'test-run-id'),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

const mockRefreshAccessToken = vi.fn()
vi.mock('@/lib/instagram/api-client', () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '../../../src/app/api/cron/instagram-token-refresh/route'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(auth?: string): NextRequest {
  const headers = new Headers()
  if (auth !== undefined) {
    headers.set('authorization', auth)
  } else {
    headers.set('authorization', `Bearer ${CRON_SECRET}`)
  }
  return { headers, nextUrl: new URL('http://localhost/api/cron/instagram-token-refresh') } as unknown as NextRequest
}

function noAuthRequest(): NextRequest {
  return { headers: new Headers(), nextUrl: new URL('http://localhost/api/cron/instagram-token-refresh') } as unknown as NextRequest
}

function accountsQuery(data: unknown[] | null) {
  return {
    select: vi.fn().mockReturnValue({
      not: vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

function syncLogMock(logId = 'log-1') {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: logId }, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }
}

function accountUpdateMock() {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/instagram-token-refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(noAuthRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest('Bearer wrong'))
    expect(res.status).toBe(401)
  })

  it('returns ok when no tokens need refresh', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'instagram_accounts') return accountsQuery([])
      return {}
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.message).toBe('no tokens need refresh')
  })

  it('happy path: refreshes expiring tokens', async () => {
    const fakeAccount = {
      id: 'acc-1',
      site_id: 'site-1',
      access_token: 'old-token',
      token_expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    }

    mockRefreshAccessToken.mockResolvedValue({
      accessToken: 'new-token',
      expiresIn: 5184000, // 60 days in seconds
    })

    const logMock = syncLogMock()
    const updateMock = accountUpdateMock()

    mockFrom.mockImplementation((table: string) => {
      if (table === 'instagram_accounts') {
        // First call is the query, subsequent calls could be updates
        return {
          ...accountsQuery([fakeAccount]),
          ...updateMock,
        }
      }
      if (table === 'instagram_sync_log') return logMock
      return {}
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.refreshed).toBe(1)
    expect(body.failed).toBe(0)
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('old-token')
  })

  it('captures Sentry exception and increments failed count on refresh error', async () => {
    const fakeAccount = {
      id: 'acc-fail',
      site_id: 'site-1',
      access_token: 'bad-token',
      token_expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    }

    mockRefreshAccessToken.mockRejectedValue(new Error('token expired'))

    mockFrom.mockImplementation((table: string) => {
      if (table === 'instagram_accounts') return accountsQuery([fakeAccount])
      if (table === 'instagram_sync_log') return syncLogMock()
      return {}
    })

    const Sentry = await import('@sentry/nextjs')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.refreshed).toBe(0)
    expect(body.failed).toBe(1)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
