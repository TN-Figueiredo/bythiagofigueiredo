import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const CRON_SECRET = 'test-cron-secret'
process.env.CRON_SECRET = CRON_SECRET
process.env.YOUTUBE_API_KEY = 'test-yt-key'

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))

vi.mock('../../../lib/logger', () => ({
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
  revalidatePath: vi.fn(),
}))

const mockSyncChannel = vi.fn()

vi.mock('@/lib/youtube/sync', () => {
  class YouTubeQuotaError extends Error {
    constructor(msg: string) {
      super(msg)
      this.name = 'YouTubeQuotaError'
    }
  }
  return {
    syncChannel: (...args: unknown[]) => mockSyncChannel(...args),
    YouTubeQuotaError,
  }
})

vi.mock('@/lib/youtube/schedule-window', () => ({
  isInPostingWindow: vi.fn(() => true),
}))

vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn(),
  recordCronFailure: vi.fn(),
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '../../../src/app/api/cron/sync-youtube/route'
import { revalidateTag } from 'next/cache'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(opts: { auth?: string; mode?: string; channelId?: string } = {}): NextRequest {
  const url = new URL('http://localhost/api/cron/sync-youtube')
  if (opts.mode) url.searchParams.set('mode', opts.mode)
  if (opts.channelId) url.searchParams.set('channelId', opts.channelId)
  const headers = new Headers()
  if (opts.auth !== undefined) {
    headers.set('authorization', opts.auth)
  } else {
    headers.set('authorization', `Bearer ${CRON_SECRET}`)
  }
  return { headers, nextUrl: url } as unknown as NextRequest
}

function noAuthRequest(): NextRequest {
  return {
    headers: new Headers(),
    nextUrl: new URL('http://localhost/api/cron/sync-youtube'),
  } as unknown as NextRequest
}

/** Chainable query that resolves with { data, error } when awaited */
function channelsQuery(data: unknown[] | null, error: null | object = null) {
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

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/sync-youtube', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.YOUTUBE_API_KEY = 'test-yt-key'
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(noAuthRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest({ auth: 'Bearer wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid mode', async () => {
    const res = await GET(makeRequest({ mode: 'bogus' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid mode')
  })

  it('returns 500 when YOUTUBE_API_KEY is missing', async () => {
    delete process.env.YOUTUBE_API_KEY
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('external service not configured')
  })

  it('returns ok when no channels are configured', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([])
      return {}
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.message).toBe('no channels configured')
  })

  it('happy path: syncs channels and revalidates tag', async () => {
    const fakeChannel = {
      id: 'ch-1',
      site_id: 'site-1',
      sync_enabled: true,
      sync_schedules: [],
    }

    mockSyncChannel.mockResolvedValue({
      videosFound: 5,
      videosInserted: 2,
      videosUpdated: 1,
      quotaUsed: 10,
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([fakeChannel])
      if (table === 'youtube_sync_log') return syncLogMock()
      return {}
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.inserted).toBe(2)
    expect(body.updated).toBe(1)
    expect(body.quota_used).toBe(10)
    expect(revalidateTag).toHaveBeenCalledWith('youtube')
  })
})
