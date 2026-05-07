import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn(
    (_sb: unknown, _key: unknown, _runId: unknown, _job: unknown, fn: () => Promise<{ status: string; [k: string]: unknown }>) =>
      fn().then((r) => {
        const { status, ...extra } = r
        if (status === 'error') return Response.json(extra, { status: 500 })
        return Response.json(extra, { status: 200 })
      }),
  ),
  newRunId: vi.fn(() => 'run-1'),
}))
vi.mock('@/lib/instagram/sync', () => ({ syncInstagramAccount: vi.fn() }))

import { GET } from '@/app/api/cron/instagram-sync/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { syncInstagramAccount } from '@/lib/instagram/sync'
import { revalidateTag } from 'next/cache'

const mockSync = vi.mocked(syncInstagramAccount)
const mockGetClient = vi.mocked(getSupabaseServiceClient)
const mockRevalidate = vi.mocked(revalidateTag)

function makeRequest(mode = 'daily', secret = 'test-secret'): NextRequest {
  return new NextRequest(`http://localhost/api/cron/instagram-sync?mode=${mode}`, {
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('GET /api/cron/instagram-sync', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'test-secret') })

  it('returns 401 without valid CRON_SECRET', async () => {
    const res = await GET(makeRequest('daily', 'wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns ok when no accounts configured', async () => {
    mockGetClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      }),
    } as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('no accounts configured')
  })

  it('syncs accounts and revalidates cache', async () => {
    const insertFn = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }) }) })
    const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({
            data: [{ id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: '@test', ig_user_id: 'ig-1', access_token: 'tok', token_expires_at: null, sync_enabled: true, display_slots: 6, layout_type: 'grid', last_synced_at: null, created_at: '', updated_at: '' }],
            error: null,
          }) }) }
        }
        if (table === 'instagram_sync_log') { return { insert: insertFn, update: updateFn } }
        return {}
      }),
    } as never)
    mockSync.mockResolvedValueOnce({ postsFound: 10, postsInserted: 3, postsUpdated: 7, mediaCached: 3 })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(mockSync).toHaveBeenCalledTimes(1)
    expect(mockRevalidate).toHaveBeenCalledWith('instagram-feed')
  })
})
