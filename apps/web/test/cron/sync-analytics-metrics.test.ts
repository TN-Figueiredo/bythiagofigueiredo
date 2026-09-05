/**
 * Tests for GET /api/cron/sync-analytics-metrics.
 *
 * Root cause under test (WP-K): youtube_video_analytics had 0 rows in production while the
 * cron reported `errors: 0` every day. Two independent bugs combined:
 *   1. A 2-day query window, which the Analytics API returns empty for on low-volume channels
 *      even though the request itself succeeds.
 *   2. An empty report was counted as a successful sync (`synced++`), so nothing ever showed
 *      up as broken.
 *
 * Coverage:
 *   - auth gate (401 without CRON_SECRET)
 *   - an empty analytics report does NOT count as `synced` — it's tracked separately as
 *     `emptyReports`, and no row is written to youtube_video_analytics
 *   - a report with rows writes to youtube_video_analytics and counts as `synced`
 *   - cron health: all-channels-empty is NOT recorded as success; a real sync is
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: vi.fn(),
}))

vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  fanOutToSiteAdmins: vi.fn(),
}))

vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn(),
  recordCronFailure: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

import { GET } from '../../src/app/api/cron/sync-analytics-metrics/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'

// Published long enough ago that it never lands inside any of the milestone
// snapshot windows (24h/48h/7d/30d) — keeps the milestone-snapshot block a no-op
// so the mock doesn't need to model it.
const OLD_PUBLISHED_AT = new Date(Date.now() - 400 * 86_400_000).toISOString()

interface Channel {
  id: string
  channel_id: string
  site_id: string
  subscriber_count: number
}

interface VideoRow {
  id: string
  youtube_video_id: string
  title: string
  view_count: number
  view_count_yesterday: number
  view_count_delta_today: number
  published_at: string
}

function makeSupabase(opts: {
  channels: Channel[]
  videosByChannelId?: Record<string, VideoRow[]>
}) {
  const analyticsUpserts: Array<Record<string, unknown>> = []
  const videoUpdates: Array<{ id: string; payload: Record<string, unknown> }> = []
  const videosByChannelId = opts.videosByChannelId ?? {}

  function youtubeVideosTable() {
    let filterChannelId: string | undefined
    let filterSiteId: string | undefined
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: string) => {
        if (col === 'channel_id') filterChannelId = val
        if (col === 'site_id') filterSiteId = val
        return chain
      },
      not: () => chain,
      update: (payload: Record<string, unknown>) => ({
        eq: (_col: string, val: string) => {
          videoUpdates.push({ id: val, payload })
          return Promise.resolve({ error: null })
        },
      }),
      then: (resolve: (v: unknown) => void) => {
        if (filterChannelId) return resolve({ data: videosByChannelId[filterChannelId] ?? [] })
        if (filterSiteId) return resolve({ data: [] }) // fatigue loop: no candidates in these tests
        return resolve({ data: [] })
      },
    }
    return chain
  }

  function youtubeChannelsTable() {
    const chain = {
      select: () => chain,
      eq: () => Promise.resolve({ data: opts.channels }),
    }
    return chain
  }

  function youtubeVideoAnalyticsTable() {
    return {
      upsert: (payload: Record<string, unknown>) => {
        analyticsUpserts.push(payload)
        return Promise.resolve({ error: null })
      },
    }
  }

  function abTestsTable() {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => Promise.resolve({ data: [] }),
    }
    return chain
  }

  const from = vi.fn((table: string) => {
    switch (table) {
      case 'youtube_channels':
        return youtubeChannelsTable()
      case 'youtube_videos':
        return youtubeVideosTable()
      case 'youtube_video_analytics':
        return youtubeVideoAnalyticsTable()
      case 'ab_tests':
        return abTestsTable()
      default:
        throw new Error(`unexpected table in test: ${table}`)
    }
  })

  return { from, _analyticsUpserts: analyticsUpserts, _videoUpdates: videoUpdates }
}

function req(secret?: string) {
  return new Request('http://localhost/api/cron/sync-analytics-metrics', {
    method: 'GET',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

function mockReport(rows: (string | number)[][] | undefined) {
  return {
    ok: true,
    json: () => Promise.resolve({ rows }),
    text: () => Promise.resolve(''),
  } as Response
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('GET /api/cron/sync-analytics-metrics — auth gate', () => {
  it('401 without CRON_SECRET', async () => {
    const res = await GET(req() as never)
    expect(res.status).toBe(401)
  })

  it('401 with the wrong secret', async () => {
    const res = await GET(req('nope') as never)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/cron/sync-analytics-metrics — empty report is not a success', () => {
  it('does not count an empty report as synced, and writes nothing to youtube_video_analytics', async () => {
    const channel: Channel = { id: 'ch-db-1', channel_id: 'UC1', site_id: 'site-1', subscriber_count: 1160 }
    const supabase = makeSupabase({ channels: [channel] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockReport(undefined)))

    const res = await GET(req(CRON_SECRET) as never)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.synced).toBe(0)
    expect(body.emptyReports).toBe(1)
    expect(body.errors).toBe(0)
    expect(supabase._analyticsUpserts).toHaveLength(0)
  })

  it('records cron failure (not success) when every channel returns an empty report', async () => {
    const channel: Channel = { id: 'ch-db-1', channel_id: 'UC1', site_id: 'site-1', subscriber_count: 1160 }
    const supabase = makeSupabase({ channels: [channel] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockReport([])))

    await GET(req(CRON_SECRET) as never)

    expect(recordCronSuccess).not.toHaveBeenCalled()
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(vi.mocked(recordCronFailure).mock.calls[0]![0]).toBe('sync-analytics-metrics')
    expect(vi.mocked(recordCronFailure).mock.calls[0]![1]).toMatch(/empty analytics report/)
  })
})

describe('GET /api/cron/sync-analytics-metrics — non-empty report syncs', () => {
  it('writes rows to youtube_video_analytics and counts the channel as synced', async () => {
    const channel: Channel = { id: 'ch-db-1', channel_id: 'UC1', site_id: 'site-1', subscriber_count: 1160 }
    const video: VideoRow = {
      id: 'vid-db-1',
      youtube_video_id: 'yt-vid-1',
      title: 'Test video',
      view_count: 100,
      view_count_yesterday: 0,
      view_count_delta_today: 0,
      published_at: OLD_PUBLISHED_AT,
    }
    const supabase = makeSupabase({
      channels: [channel],
      videosByChannelId: { 'ch-db-1': [video] },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    // row shape: [video_id, views, estimatedMinutesWatched, averageViewDuration, likes, comments, shares, subscribersGained]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockReport([['yt-vid-1', 120, 30, 45, 5, 2, 1, 0]])),
    )

    const res = await GET(req(CRON_SECRET) as never)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.synced).toBe(1)
    expect(body.emptyReports).toBe(0)
    expect(supabase._analyticsUpserts).toHaveLength(1)
    expect(supabase._analyticsUpserts[0]).toMatchObject({
      youtube_video_id: 'vid-db-1',
      site_id: 'site-1',
      views: 120,
      likes: 5,
      comments: 2,
      shares: 1,
    })
  })

  it('requests a wide (90-day default) window instead of the old 2-day window', async () => {
    const channel: Channel = { id: 'ch-db-1', channel_id: 'UC1', site_id: 'site-1', subscriber_count: 1160 }
    const supabase = makeSupabase({ channels: [channel] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    const fetchMock = vi.fn().mockResolvedValue(mockReport(undefined))
    vi.stubGlobal('fetch', fetchMock)

    await GET(req(CRON_SECRET) as never)

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string)
    const start = new Date(calledUrl.searchParams.get('startDate')!)
    const end = new Date(calledUrl.searchParams.get('endDate')!)
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000)
    expect(days).toBeGreaterThanOrEqual(85)
    expect(calledUrl.searchParams.get('maxResults')).toBe('200')
  })

  it('records cron success when at least one channel returns real rows', async () => {
    const channelA: Channel = { id: 'ch-db-1', channel_id: 'UC1', site_id: 'site-1', subscriber_count: 1160 }
    const channelB: Channel = { id: 'ch-db-2', channel_id: 'UC2', site_id: 'site-1', subscriber_count: 3 }
    const video: VideoRow = {
      id: 'vid-db-1',
      youtube_video_id: 'yt-vid-1',
      title: 'Test video',
      view_count: 100,
      view_count_yesterday: 0,
      view_count_delta_today: 0,
      published_at: OLD_PUBLISHED_AT,
    }
    const supabase = makeSupabase({
      channels: [channelA, channelB],
      videosByChannelId: { 'ch-db-1': [video] },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const parsed = new URL(url)
      const isChannelA = parsed.searchParams.get('ids') === 'channel==UC1'
      return Promise.resolve(mockReport(isChannelA ? [['yt-vid-1', 120, 30, 45, 5, 2, 1, 0]] : undefined))
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await GET(req(CRON_SECRET) as never)
    const body = await res.json()

    expect(body.synced).toBe(1)
    expect(body.emptyReports).toBe(1)
    expect(recordCronFailure).not.toHaveBeenCalled()
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
  })
})
