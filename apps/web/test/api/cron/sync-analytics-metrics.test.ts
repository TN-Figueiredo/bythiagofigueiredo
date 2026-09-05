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
  captureMessage: vi.fn(),
  setTag: vi.fn(),
}))

const mockEnsureFreshToken = vi.fn()
vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
}))

vi.mock('@/lib/youtube/analytics-sync', () => ({
  detectViral: vi.fn(() => false),
  getIsoWeek: vi.fn(() => '2026-W21'),
}))

vi.mock('@/lib/youtube/notification-service', () => ({
  buildNotification: vi.fn(() => ({
    type: 'trending_viral',
    priority: 2,
    title: 'Viral!',
    message: 'Test',
    dedup_key: 'test-key',
    video_id: 'v-1',
    suggested_action: null,
    action_href: null,
  })),
}))

vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  fanOutToSiteAdmins: vi.fn().mockResolvedValue(1),
}))

// Pre-existing gap (unrelated to this file's own coverage focus): this suite
// never mocked @/lib/cron-health, so recordCronSuccess/recordCronFailure hit
// the real module against `mockFrom`, which has no 'cron_health' handler —
// `.from('cron_health').upsert(...)` threw `TypeError: ... is not a
// function`, unhandled (the route calls these bare, without .catch), failing
// every test whose code path reaches a cron_health write.
vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn(),
  recordCronFailure: vi.fn(),
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '../../../src/app/api/cron/sync-analytics-metrics/route'

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

function channelsQuery(data: unknown[] | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  }
}

function videosQuery(data: unknown[] | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/sync-analytics-metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset global fetch mock
    vi.restoreAllMocks()
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

  it('returns 500 and records a failure when the channels query itself errors (Importante 3, 2026-09-02-falhas-silenciosas)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'connection reset' } }),
          }),
        }
      }
      return {}
    })
    const { recordCronFailure, recordCronSuccess } = await import('@/lib/cron-health')

    const res = await GET(makeRequest())

    // A dropped query error used to fall through to `channels === null` ->
    // "no_channels" -> recordCronSuccess + HTTP 200 — asserting health over
    // an error the route never looked at. It must now surface as a failure.
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('channels query failed')
    expect(body.detail).toBe('connection reset')
    expect(recordCronFailure).toHaveBeenCalledWith('sync-analytics-metrics', 'connection reset')
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('returns no_channels when no channels configured', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([])
      return {}
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('no_channels')
  })

  it('happy path: syncs analytics for channels with videos', async () => {
    const fakeChannel = {
      id: 'ch-1',
      channel_id: 'UC123',
      site_id: 'site-1',
      subscriber_count: 1000,
    }
    const fakeVideo = {
      id: 'v-1',
      youtube_video_id: 'vid-abc',
      title: 'Test Video',
      view_count: 100,
      view_count_yesterday: 10,
      view_count_delta_today: 5,
    }

    mockEnsureFreshToken.mockResolvedValue({ accessToken: 'yt-token' })

    // Mock fetch for YouTube Analytics API
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          rows: [['vid-abc', 50, 100, 120, 5, 2, 1, 3]],
        }),
        { status: 200 },
      ),
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([fakeChannel])
      if (table === 'youtube_videos') return videosQuery([fakeVideo])
      if (table === 'youtube_video_analytics') return { upsert: vi.fn().mockResolvedValue({ error: null }) }
      return {}
    })
    mockRpc.mockResolvedValue({ error: null })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.synced).toBe(1)
    expect(body.errors).toBe(0)

    fetchSpy.mockRestore()
  })

  it('increments errors when fetch returns non-ok status', async () => {
    const fakeChannel = {
      id: 'ch-1',
      channel_id: 'UC123',
      site_id: 'site-1',
      subscriber_count: 500,
    }

    mockEnsureFreshToken.mockResolvedValue({ accessToken: 'yt-token' })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('quota exceeded', { status: 403 }),
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([fakeChannel])
      return {}
    })

    const Sentry = await import('@sentry/nextjs')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.synced).toBe(0)
    expect(body.errors).toBe(1)
    expect(body.errorDetails).toBeDefined()
    expect(Sentry.captureMessage).toHaveBeenCalled()

    fetchSpy.mockRestore()
  })
})
