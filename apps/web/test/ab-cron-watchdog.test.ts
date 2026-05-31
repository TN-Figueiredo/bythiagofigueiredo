import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({
  getCronHealth: vi.fn(),
  recordCronSuccess: vi.fn(),
}))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))

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

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'test-secret')
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            then: (resolve: (v: unknown) => void) => resolve({ data: [{ site_id: 'site-1' }], error: null }),
          })),
        })),
      })),
    })),
  })
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

  it('sends notification when ab-rotate missed today', async () => {
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
      }),
    )
  })
})
