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

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

const mockSyncInstagramAccount = vi.fn()
vi.mock('@/lib/instagram/sync', () => ({
  syncInstagramAccount: (...args: unknown[]) => mockSyncInstagramAccount(...args),
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '../../../src/app/api/cron/instagram-sync/route'
import { revalidateTag } from 'next/cache'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(opts: { auth?: string; mode?: string; accountId?: string } = {}): NextRequest {
  const url = new URL('http://localhost/api/cron/instagram-sync')
  if (opts.mode) url.searchParams.set('mode', opts.mode)
  if (opts.accountId) url.searchParams.set('accountId', opts.accountId)
  const headers = new Headers()
  if (opts.auth !== undefined) {
    headers.set('authorization', opts.auth)
  } else {
    headers.set('authorization', `Bearer ${CRON_SECRET}`)
  }
  return { headers, nextUrl: url } as unknown as NextRequest
}

function noAuthRequest(): NextRequest {
  return { headers: new Headers(), nextUrl: new URL('http://localhost/api/cron/instagram-sync') } as unknown as NextRequest
}

/** Chainable query that resolves with { data, error } when awaited */
function accountsQuery(data: unknown[] | null, error: null | object = null) {
  const result = Promise.resolve({ data, error })
  const chain: Record<string, unknown> = {}
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_t, prop) {
      if (prop === 'then') return result.then.bind(result)
      if (prop === 'catch') return result.catch.bind(result)
      if (prop === 'finally') return result.finally.bind(result)
      return vi.fn(() => new Proxy({}, handler))
    },
  }
  return new Proxy(chain, handler)
}

function syncLogInsert(logId = 'log-1') {
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

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/instagram-sync', () => {
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
    const res = await GET(makeRequest({ auth: 'Bearer wrong-secret' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid mode', async () => {
    const res = await GET(makeRequest({ mode: 'invalid' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid mode')
  })

  it('returns ok when no accounts are configured', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'instagram_accounts') return accountsQuery([])
      return {}
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.message).toBe('no accounts configured')
  })

  it('happy path: syncs accounts and revalidates tag', async () => {
    const fakeAccount = {
      id: 'acc-1',
      site_id: 'site-1',
      sync_enabled: true,
      access_token: 'tok',
    }

    mockSyncInstagramAccount.mockResolvedValue({
      postsFound: 10,
      postsInserted: 3,
      postsUpdated: 2,
      mediaCached: 5,
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'instagram_accounts') return accountsQuery([fakeAccount])
      if (table === 'instagram_sync_log') return syncLogInsert()
      return {}
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.inserted).toBe(3)
    expect(body.updated).toBe(2)
    expect(body.cached).toBe(5)
    expect(revalidateTag).toHaveBeenCalledWith('instagram-feed')
  })

  it('captures Sentry exception when sync fails for an account', async () => {
    const fakeAccount = {
      id: 'acc-fail',
      site_id: 'site-1',
      sync_enabled: true,
      access_token: 'tok',
    }

    mockSyncInstagramAccount.mockRejectedValue(new Error('API rate limit'))

    mockFrom.mockImplementation((table: string) => {
      if (table === 'instagram_accounts') return accountsQuery([fakeAccount])
      if (table === 'instagram_sync_log') return syncLogInsert()
      return {}
    })

    const Sentry = await import('@sentry/nextjs')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.inserted).toBe(0)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
