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
