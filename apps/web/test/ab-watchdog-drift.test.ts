import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({
  getCronHealth: vi.fn(),
  recordCronSuccess: vi.fn(),
  recordCronFailure: vi.fn(),
}))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/youtube/ab-drift', () => ({ checkDrift: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: vi.fn().mockResolvedValue({ accessToken: 'fresh-token' }),
}))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }),
  fetchVariantImageBuffer: vi.fn().mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/jpeg' }),
}))

import { GET } from '@/app/api/cron/ab-watchdog/route'
import { getCronHealth } from '@/lib/cron-health'
import { createNotification } from '@/lib/notifications/create'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { checkDrift } from '@/lib/youtube/ab-drift'

const mockGetHealth = vi.mocked(getCronHealth)
const mockCheckDrift = vi.mocked(checkDrift)
const mockNotify = vi.mocked(createNotification)

function makeRequest(secret = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/ab-watchdog', {
    headers: { authorization: `Bearer ${secret}` },
  })
}

function buildDriftSupabase(opts: {
  activeTests?: { id: string; site_id: string; test_type: string; youtube_video_id: string }[]
  openCycle?: { id: string; variant_id: string; applied_metadata: Record<string, unknown> | null; started_at: string } | null
  video?: { youtube_video_id: string } | null
  originalUrl?: string
}) {
  const {
    activeTests = [],
    openCycle = null,
    video = { youtube_video_id: 'YT_abc123' },
    originalUrl = 'https://xxx.public.blob.vercel-storage.com/ab-originals/uuid/original.jpg',
  } = opts

  const updateCalls: { table: string; data: Record<string, unknown> }[] = []

  const from = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn((col: string, val: string) => {
            if (col === 'status' && val === 'active') {
              return { data: activeTests, error: null }
            }
            if (col === 'id') {
              return {
                single: vi.fn().mockReturnValue({
                  data: { original_thumbnail_url: originalUrl, site_id: activeTests[0]?.site_id ?? 'site-1' },
                  error: null,
                }),
              }
            }
            return { data: null, error: null }
          }),
        }),
        update: vi.fn((data: Record<string, unknown>) => {
          updateCalls.push({ table: 'ab_tests', data })
          return {
            eq: vi.fn().mockReturnValue({ data: null, error: null }),
          }
        }),
      }
    }
    if (table === 'ab_test_cycles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: openCycle, error: null }),
              }),
            }),
          }),
        }),
        update: vi.fn((data: Record<string, unknown>) => {
          updateCalls.push({ table: 'ab_test_cycles', data })
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({ data: null, error: null }),
            }),
          }
        }),
      }
    }
    if (table === 'youtube_videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: video, error: null }),
          }),
        }),
      }
    }
    if (table === 'site_users') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockReturnValue({ data: { user_id: 'user-1' }, error: null }),
              }),
            }),
          }),
        }),
      }
    }
    if (table === 'ab_test_polls' || table === 'competitor_changes' || table === 'competitor_channel_snapshots') {
      return {
        delete: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }
    }
    return { select: vi.fn() }
  })

  return { from, updateCalls }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'test-secret')
  vi.stubEnv('YOUTUBE_API_KEY', 'fake-api-key')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')

  mockGetHealth.mockResolvedValue({
    cron_name: 'ab-rotate',
    last_success_at: new Date().toISOString(),
    last_failure_at: null,
    last_error: null,
    consecutive_failures: 0,
    severity: 'critical',
    updated_at: new Date().toISOString(),
  })
})

describe('ab-watchdog drift detection', () => {
  it('skips drift detection when YOUTUBE_API_KEY is not set', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', '')

    const mock = buildDriftSupabase({
      activeTests: [{ id: 't1', site_id: 's1', test_type: 'thumbnail', youtube_video_id: 'v1' }],
    })
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock)

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(mockCheckDrift).not.toHaveBeenCalled()
  })

  it('skips title-only tests for drift detection', async () => {
    const threeHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const mock = buildDriftSupabase({
      activeTests: [{ id: 't1', site_id: 's1', test_type: 'title', youtube_video_id: 'v1' }],
      openCycle: {
        id: 'c1', variant_id: 'var1', started_at: threeHoursAgo,
        applied_metadata: { youtube_thumbnail_url: 'https://i.ytimg.com/vi/abc/hq.jpg' },
      },
    })
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock)

    await GET(makeRequest())
    expect(mockCheckDrift).not.toHaveBeenCalled()
  })

  it('skips drift detection when cycle started less than 3 hours ago (CDN propagation window)', async () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    const mock = buildDriftSupabase({
      activeTests: [{ id: 't1', site_id: 's1', test_type: 'thumbnail', youtube_video_id: 'v1' }],
      openCycle: {
        id: 'c1', variant_id: 'var1', started_at: oneHourAgo,
        applied_metadata: { youtube_thumbnail_url: 'https://i.ytimg.com/vi/abc/hq.jpg' },
      },
    })
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock)

    await GET(makeRequest())
    expect(mockCheckDrift).not.toHaveBeenCalled()
  })

  it('runs drift detection when cycle is older than 3 hours', async () => {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const mock = buildDriftSupabase({
      activeTests: [{ id: 't1', site_id: 's1', test_type: 'thumbnail', youtube_video_id: 'v1' }],
      openCycle: {
        id: 'c1', variant_id: 'var1', started_at: fourHoursAgo,
        applied_metadata: { youtube_thumbnail_url: 'https://i.ytimg.com/vi/abc/hq.jpg' },
      },
    })
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock)
    mockCheckDrift.mockResolvedValue({ drifted: false })

    await GET(makeRequest())
    expect(mockCheckDrift).toHaveBeenCalledWith(
      't1', 'YT_abc123',
      'https://i.ytimg.com/vi/abc/hq.jpg',
      'fake-api-key',
    )
  })

  it('skips drift detection when no open cycle', async () => {
    const mock = buildDriftSupabase({
      activeTests: [{ id: 't1', site_id: 's1', test_type: 'thumbnail', youtube_video_id: 'v1' }],
      openCycle: null,
    })
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock)

    await GET(makeRequest())
    expect(mockCheckDrift).not.toHaveBeenCalled()
  })

  it('skips drift detection when applied_metadata has no youtube_thumbnail_url', async () => {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const mock = buildDriftSupabase({
      activeTests: [{ id: 't1', site_id: 's1', test_type: 'thumbnail', youtube_video_id: 'v1' }],
      openCycle: {
        id: 'c1', variant_id: 'var1', started_at: fourHoursAgo,
        applied_metadata: { thumbnail_set: true },
      },
    })
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock)

    await GET(makeRequest())
    expect(mockCheckDrift).not.toHaveBeenCalled()
  })

  it('pauses test and notifies when drift is detected', async () => {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const mock = buildDriftSupabase({
      activeTests: [{ id: 't1', site_id: 's1', test_type: 'thumbnail', youtube_video_id: 'v1' }],
      openCycle: {
        id: 'c1', variant_id: 'var1', started_at: fourHoursAgo,
        applied_metadata: { youtube_thumbnail_url: 'https://i.ytimg.com/vi/abc/hq.jpg' },
      },
    })
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock)
    mockCheckDrift.mockResolvedValue({ drifted: true, currentUrl: 'https://i.ytimg.com/vi/abc/different.jpg' })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    // Should close the cycle
    expect(mock.updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_test_cycles',
        data: expect.objectContaining({ ended_at: expect.any(String) }),
      }),
    )

    // Should pause the test
    expect(mock.updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: expect.objectContaining({
          status: 'paused',
          status_note: 'Thumbnail alterado externamente',
        }),
      }),
    )

    // Should notify owner
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'youtube.drift_detected',
        priority: 1,
        site_id: 's1',
        title: 'Thumbnail alterado externamente',
      }),
    )
  })

  it('does not pause when drift is not detected', async () => {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const mock = buildDriftSupabase({
      activeTests: [{ id: 't1', site_id: 's1', test_type: 'thumbnail', youtube_video_id: 'v1' }],
      openCycle: {
        id: 'c1', variant_id: 'var1', started_at: fourHoursAgo,
        applied_metadata: { youtube_thumbnail_url: 'https://i.ytimg.com/vi/abc/hq.jpg' },
      },
    })
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock)
    mockCheckDrift.mockResolvedValue({ drifted: false })

    await GET(makeRequest())

    expect(mock.updateCalls).toHaveLength(0)
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('runs drift detection when cycle started exactly 3 hours ago (boundary)', async () => {
    const exactlyThreeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    const mock = buildDriftSupabase({
      activeTests: [{ id: 't1', site_id: 's1', test_type: 'thumbnail', youtube_video_id: 'v1' }],
      openCycle: {
        id: 'c1', variant_id: 'var1', started_at: exactlyThreeHoursAgo,
        applied_metadata: { youtube_thumbnail_url: 'https://i.ytimg.com/vi/abc/hq.jpg' },
      },
    })
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock)
    mockCheckDrift.mockResolvedValue({ drifted: false })

    await GET(makeRequest())
    expect(mockCheckDrift).toHaveBeenCalled()
  })

  it('checks combo tests for drift', async () => {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const mock = buildDriftSupabase({
      activeTests: [{ id: 't1', site_id: 's1', test_type: 'combo', youtube_video_id: 'v1' }],
      openCycle: {
        id: 'c1', variant_id: 'var1', started_at: fourHoursAgo,
        applied_metadata: { youtube_thumbnail_url: 'https://i.ytimg.com/vi/abc/hq.jpg' },
      },
    })
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock)
    mockCheckDrift.mockResolvedValue({ drifted: false })

    await GET(makeRequest())
    expect(mockCheckDrift).toHaveBeenCalled()
  })
})
