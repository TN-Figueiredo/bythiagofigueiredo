import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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
vi.mock('@/lib/instagram/api-client', () => ({
  refreshAccessToken: vi.fn(),
}))

import { GET } from '@/app/api/cron/instagram-token-refresh/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { refreshAccessToken } from '@/lib/instagram/api-client'

const mockGetClient = vi.mocked(getSupabaseServiceClient)
const mockRefresh = vi.mocked(refreshAccessToken)

function makeRequest(secret = 'test-secret'): NextRequest {
  return new NextRequest('http://localhost/api/cron/instagram-token-refresh', {
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('GET /api/cron/instagram-token-refresh', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'test-secret') })

  it('returns 401 without valid CRON_SECRET', async () => {
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns ok when no tokens need refresh', async () => {
    mockGetClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    } as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('no tokens need refresh')
  })

  it('refreshes expiring tokens and updates DB', async () => {
    const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })
    const insertFn = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }) }) })
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({
                  data: [{ id: 'acc-1', site_id: 'site-1', access_token: 'old-tok', ig_user_id: 'ig-1', locale: 'pt', handle: '@test', token_expires_at: '2026-05-10T00:00:00Z', sync_enabled: true, display_slots: 6, layout_type: 'grid', last_synced_at: null, created_at: '', updated_at: '' }],
                  error: null,
                }),
              }),
            }),
            update: updateFn,
          }
        }
        if (table === 'instagram_sync_log') { return { insert: insertFn, update: updateFn } }
        return {}
      }),
    } as never)
    mockRefresh.mockResolvedValueOnce({ accessToken: 'new-tok', expiresIn: 5184000 })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.refreshed).toBe(1)
    expect(body.failed).toBe(0)
    expect(mockRefresh).toHaveBeenCalledWith('old-tok')
  })

  it('reports failed refreshes without crashing', async () => {
    const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })
    const insertFn = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }) }) })
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({
                  data: [{ id: 'acc-1', site_id: 'site-1', access_token: 'expired-tok', ig_user_id: 'ig-1', locale: 'pt', handle: '@test', token_expires_at: '2026-05-10T00:00:00Z', sync_enabled: true, display_slots: 6, layout_type: 'grid', last_synced_at: null, created_at: '', updated_at: '' }],
                  error: null,
                }),
              }),
            }),
            update: updateFn,
          }
        }
        if (table === 'instagram_sync_log') { return { insert: insertFn, update: updateFn } }
        return {}
      }),
    } as never)
    mockRefresh.mockRejectedValueOnce(new Error('Token revoked'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.refreshed).toBe(0)
    expect(body.failed).toBe(1)
  })
})
