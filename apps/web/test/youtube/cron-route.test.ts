import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn((_sb: unknown, _key: unknown, _runId: unknown, _job: unknown, fn: () => Promise<{ status: string; [k: string]: unknown }>) =>
    fn().then((r) => {
      const { status, ...extra } = r
      if (status === 'error') return Response.json(extra, { status: 500 })
      return Response.json(extra, { status: 200 })
    }),
  ),
  newRunId: vi.fn(() => 'run-1'),
}))

vi.mock('@/lib/youtube/sync', () => ({
  syncChannel: vi.fn(),
  YouTubeQuotaError: class YouTubeQuotaError extends Error {
    constructor() { super('quotaExceeded') }
  },
}))

vi.mock('@/lib/youtube/schedule-window', () => ({
  isInPostingWindow: vi.fn(() => true),
}))

import { GET } from '@/app/api/cron/sync-youtube/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { syncChannel, YouTubeQuotaError } from '@/lib/youtube/sync'
import { revalidateTag } from 'next/cache'
import { isInPostingWindow } from '@/lib/youtube/schedule-window'

const mockSync = vi.mocked(syncChannel)
const mockGetClient = vi.mocked(getSupabaseServiceClient)
const mockRevalidate = vi.mocked(revalidateTag)
const mockIsInWindow = vi.mocked(isInPostingWindow)

function makeRequest(mode = 'catchall', secret = 'test-secret'): NextRequest {
  return new NextRequest(`http://localhost/api/cron/sync-youtube?mode=${mode}`, {
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('GET /api/cron/sync-youtube', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')

    const insertSingle = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
      }),
    })
    const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'youtube_channels') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{
                  id: 'ch-1', site_id: 'site-1', channel_id: 'UC_x',
                  sync_enabled: true, sync_schedules: [],
                  uploads_playlist_id: 'UU_x',
                }],
                error: null,
              }),
            }),
          }
        }
        if (table === 'youtube_sync_log') {
          return {
            insert: insertSingle,
            update: vi.fn().mockReturnValue({ eq: updateEq }),
          }
        }
        return {}
      }),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)
  })

  it('rejects unauthorized requests', async () => {
    const res = await GET(makeRequest('catchall', 'wrong'))
    expect(res.status).toBe(401)
  })

  it('rejects invalid mode', async () => {
    const res = await GET(makeRequest('invalid'))
    expect(res.status).toBe(400)
  })

  it('returns 500 when YOUTUBE_API_KEY is missing', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', '')
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })

  it('revalidates cache when videos are inserted', async () => {
    mockSync.mockResolvedValue({
      videosFound: 3, videosInserted: 2, videosUpdated: 0, quotaUsed: 3,
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.inserted).toBe(2)
    expect(mockRevalidate).toHaveBeenCalledWith('youtube')
  })

  it('revalidates cache even when no new videos', async () => {
    mockSync.mockResolvedValue({
      videosFound: 3, videosInserted: 0, videosUpdated: 0, quotaUsed: 1,
    })

    await GET(makeRequest())
    expect(mockRevalidate).toHaveBeenCalledWith('youtube')
  })

  it('skips channels outside posting window in schedule mode', async () => {
    mockIsInWindow.mockReturnValue(false)

    const res = await GET(makeRequest('schedule'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.inserted).toBe(0)
    expect(mockSync).not.toHaveBeenCalled()
  })

  it('handles quota error and returns error response', async () => {
    const QuotaErr = YouTubeQuotaError as unknown as new () => Error
    mockSync.mockRejectedValue(new QuotaErr())

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('quotaExceeded')
  })
})
