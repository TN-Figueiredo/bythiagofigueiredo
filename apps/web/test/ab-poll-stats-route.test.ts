import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: 'site-1' }),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-polls', () => ({
  pollVideoStats: vi.fn(),
  shouldSkipPoll: vi.fn(),
  getLastPollTime: vi.fn(),
  insertPollData: vi.fn(),
}))

import { GET } from '@/app/api/youtube/poll-stats/route'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  pollVideoStats,
  shouldSkipPoll,
  getLastPollTime,
  insertPollData,
} from '@/lib/youtube/ab-polls'

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/youtube/poll-stats')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString())
}

function buildSupabaseMock(opts: {
  test?: Record<string, unknown> | null
  video?: { youtube_video_id: string } | null
  openCycle?: { variant_id: string } | null
} = {}) {
  const { test = null, video = null, openCycle = null } = opts

  const fromMock = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: test, error: test ? null : { message: 'not found' } }),
              }),
            }),
          }),
        }),
      }
    }

    if (table === 'youtube_videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: video, error: video ? null : { message: 'not found' } }),
          }),
        }),
      }
    }

    if (table === 'ab_test_cycles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: openCycle, error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    }

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

  const client = { from: fromMock }
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
  return { client, fromMock }
}

beforeEach(() => {
  vi.stubEnv('YOUTUBE_API_KEY', 'test-api-key')
  vi.clearAllMocks()
  ;(requireSiteScope as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
  ;(shouldSkipPoll as ReturnType<typeof vi.fn>).mockReturnValue(false)
  ;(getLastPollTime as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(insertPollData as ReturnType<typeof vi.fn>).mockResolvedValue(true)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/youtube/poll-stats', () => {
  it('returns 400 without testId param', async () => {
    const req = makeRequest({})
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('testId required')
  })

  it('returns 401 when auth fails', async () => {
    ;(requireSiteScope as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false })
    const req = makeRequest({ testId: 'test-1' })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns { skipped: true } when dedup guard fires', async () => {
    const lastPoll = new Date().toISOString()
    ;(getLastPollTime as ReturnType<typeof vi.fn>).mockResolvedValue(lastPoll)
    ;(shouldSkipPoll as ReturnType<typeof vi.fn>).mockReturnValue(true)
    buildSupabaseMock()

    const req = makeRequest({ testId: 'test-1' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.skipped).toBe(true)
    expect(body.lastPoll).toBe(lastPoll)
  })

  it('happy path: returns views + likes + polledAt', async () => {
    buildSupabaseMock({
      test: { id: 'test-1', youtube_video_id: 'db-vid-1', site_id: 'site-1', status: 'active' },
      video: { youtube_video_id: 'YT_VIDEO_123' },
      openCycle: { variant_id: 'v1' },
    })
    ;(pollVideoStats as ReturnType<typeof vi.fn>).mockResolvedValue({ views: 5000, likes: 120 })

    const req = makeRequest({ testId: 'test-1' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.views).toBe(5000)
    expect(body.likes).toBe(120)
    expect(body.polledAt).toBeDefined()
    expect(insertPollData).toHaveBeenCalledWith(
      expect.anything(),
      'test-1',
      'v1',
      5000,
      120,
      'client',
    )
  })

  it('returns 404 when test not found or not active', async () => {
    buildSupabaseMock({ test: null })
    ;(pollVideoStats as ReturnType<typeof vi.fn>).mockResolvedValue({ views: 100, likes: 5 })

    const req = makeRequest({ testId: 'nonexistent' })
    const res = await GET(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('test_not_found_or_inactive')
  })

  it('returns 502 when YouTube API is unavailable', async () => {
    buildSupabaseMock({
      test: { id: 'test-1', youtube_video_id: 'db-vid-1', site_id: 'site-1', status: 'active' },
      video: { youtube_video_id: 'YT_VIDEO_123' },
      openCycle: null,
    })
    ;(pollVideoStats as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const req = makeRequest({ testId: 'test-1' })
    const res = await GET(req)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe('youtube_unavailable')
  })

  it('returns 404 when test is not active (paused)', async () => {
    // The query filters by status='active', so a paused test returns null
    buildSupabaseMock({ test: null })

    const req = makeRequest({ testId: 'paused-test-1' })
    const res = await GET(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('test_not_found_or_inactive')
  })
})
