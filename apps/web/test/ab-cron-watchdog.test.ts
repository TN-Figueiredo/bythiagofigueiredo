import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({
  getCronHealth: vi.fn(),
  recordCronSuccess: vi.fn(),
  recordCronFailure: vi.fn(),
}))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))

import { GET } from '@/app/api/cron/ab-watchdog/route'
import { getCronHealth } from '@/lib/cron-health'
import { createNotification } from '@/lib/notifications/create'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockGetHealth = vi.mocked(getCronHealth)
const mockNotify = vi.mocked(createNotification)

function makeRequest(secret = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/ab-watchdog', {
    headers: { authorization: `Bearer ${secret}` },
  })
}

function buildMockSupabase(activeTests: { site_id: string }[] | null) {
  // Mock for ab_tests query: .from('ab_tests').select('site_id').eq('status', 'active')
  const abTestsEq = vi.fn().mockReturnValue({ data: activeTests, error: null })
  const abTestsSelect = vi.fn().mockReturnValue({ eq: abTestsEq })

  // Mock for site_users query: .from('site_users').select('user_id').eq('site_id', x).eq('role', 'super_admin').limit(1).single()
  const siteUsersSingle = vi.fn().mockReturnValue({ data: { user_id: 'user-1' }, error: null })
  const siteUsersLimit = vi.fn().mockReturnValue({ single: siteUsersSingle })
  const siteUsersEqRole = vi.fn().mockReturnValue({ limit: siteUsersLimit })
  const siteUsersEqSite = vi.fn().mockReturnValue({ eq: siteUsersEqRole })
  const siteUsersSelect = vi.fn().mockReturnValue({ eq: siteUsersEqSite })

  const from = vi.fn((table: string) => {
    if (table === 'ab_tests') return { select: abTestsSelect }
    if (table === 'site_users') return { select: siteUsersSelect }
    if (table === 'ab_test_polls') {
      return {
        delete: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }
    }
    if (table === 'competitor_changes') {
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

  return { from }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'test-secret')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  // Mock global fetch for catch-up rotation call
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'ok' })))
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
    buildMockSupabase([{ site_id: 'site-1' }])
  )
})

describe('ab-watchdog', () => {
  it('rejects unauthorized requests', async () => {
    const res = await GET(makeRequest('wrong'))
    expect(res.status).toBe(401)
  })

  it('reports healthy when ab-rotate ran today', async () => {
    mockGetHealth.mockResolvedValue({
      cron_name: 'ab-rotate',
      last_success_at: new Date().toISOString(),
      last_failure_at: null,
      last_error: null,
      consecutive_failures: 0,
      severity: 'critical',
      updated_at: new Date().toISOString(),
    })

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.rotate_healthy).toBe(true)
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('sends notification per site when ab-rotate missed today', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    mockGetHealth.mockResolvedValue({
      cron_name: 'ab-rotate',
      last_success_at: yesterday,
      last_failure_at: null,
      last_error: null,
      consecutive_failures: 0,
      severity: 'critical',
      updated_at: yesterday,
    })

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.rotate_healthy).toBe(false)
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'youtube.rotation_missed',
        priority: 1,
        site_id: 'site-1',
        dedup_key: expect.stringContaining('site-1'),
      }),
    )
  })

  it('notifies multiple sites independently', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    mockGetHealth.mockResolvedValue({
      cron_name: 'ab-rotate',
      last_success_at: yesterday,
      last_failure_at: null,
      last_error: null,
      consecutive_failures: 0,
      severity: 'critical',
      updated_at: yesterday,
    })

    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
      buildMockSupabase([{ site_id: 'site-1' }, { site_id: 'site-2' }, { site_id: 'site-1' }])
    )

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.rotate_healthy).toBe(false)
    // Should deduplicate: site-1 appears twice but only notifies once per unique site
    expect(mockNotify).toHaveBeenCalledTimes(2)
  })

  it('triggers catch-up rotation after notifications', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    mockGetHealth.mockResolvedValue({
      cron_name: 'ab-rotate',
      last_success_at: yesterday,
      last_failure_at: null,
      last_error: null,
      consecutive_failures: 0,
      severity: 'critical',
      updated_at: yesterday,
    })

    await GET(makeRequest())

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cron/ab-rotate',
      expect.objectContaining({
        headers: { authorization: 'Bearer test-secret' },
      }),
    )
  })

  it('handles catch-up fetch failure gracefully', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    mockGetHealth.mockResolvedValue({
      cron_name: 'ab-rotate',
      last_success_at: yesterday,
      last_failure_at: null,
      last_error: null,
      consecutive_failures: 0,
      severity: 'critical',
      updated_at: yesterday,
    })

    // Make fetch reject (simulating network failure or timeout)
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch failed: ECONNREFUSED'))

    const res = await GET(makeRequest())
    const body = await res.json()

    // Watchdog still returns 200 OK — catch-up failure is non-fatal
    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.rotate_healthy).toBe(false)

    // Notifications were still sent (they happen before catch-up)
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'youtube.rotation_missed',
        site_id: 'site-1',
      }),
    )
  })

  it('does not send notification when no active tests exist', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    mockGetHealth.mockResolvedValue({
      cron_name: 'ab-rotate',
      last_success_at: yesterday,
      last_failure_at: null,
      last_error: null,
      consecutive_failures: 0,
      severity: 'critical',
      updated_at: yesterday,
    })

    // Active tests query returns empty array
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
      buildMockSupabase([])
    )

    const res = await GET(makeRequest())
    const body = await res.json()

    // Rotation missed but no active tests — no notification needed, no catch-up
    expect(body.rotate_healthy).toBe(false)
    expect(mockNotify).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('handles first-ever run when cron_health has no row (null)', async () => {
    // getCronHealth returns null — no row exists yet (first deployment)
    mockGetHealth.mockResolvedValue(null)

    const res = await GET(makeRequest())
    const body = await res.json()

    // With no health record, rotation never ran = missed
    expect(body.rotate_healthy).toBe(false)

    // Should send notification because rotation has never run
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'youtube.rotation_missed',
        priority: 1,
        site_id: 'site-1',
      }),
    )

    // Should trigger catch-up rotation
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cron/ab-rotate',
      expect.objectContaining({
        headers: { authorization: 'Bearer test-secret' },
      }),
    )
  })
})
