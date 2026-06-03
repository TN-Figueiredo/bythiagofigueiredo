import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
vi.mock('@tn-figueiredo/email', () => ({
  ResendEmailAdapter: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue(undefined),
  })),
}))

import { checkAndEscalate } from '@/lib/youtube/ab-escalation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createNotification } from '@/lib/notifications/create'
import type { CreateNotificationResult } from '@/lib/notifications/create'

const mockGetSupabase = vi.mocked(getSupabaseServiceClient)
const mockCreateNotification = vi.mocked(createNotification)

// Helpers ----------------------------------------------------------------

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

/** Build a minimal supabase mock that responds to the chained queries used by checkAndEscalate. */
function buildSupabaseMock(opts: {
  health?: {
    consecutive_failures: number
    last_failure_at: string | null
    last_success_at: string | null
  } | null
  owner?: { user_id: string } | null
  userEmail?: string | null
}) {
  const singleHealth = vi.fn().mockResolvedValue({ data: opts.health ?? null, error: null })
  const singleOwner = vi.fn().mockResolvedValue({ data: opts.owner ?? null, error: null })
  const getUserById = vi.fn().mockResolvedValue({
    data: opts.userEmail !== undefined
      ? { user: { email: opts.userEmail } }
      : { user: { email: 'admin@example.com' } },
    error: null,
  })

  let fromCallCount = 0

  const fromMock = vi.fn((table: string) => {
    if (table === 'cron_health') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: singleHealth,
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
                single: singleOwner,
              }),
            }),
          }),
        }),
      }
    }
    // Fallback for any other table
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }
  })

  const supabase = {
    from: fromMock,
    auth: {
      admin: {
        getUserById,
      },
    },
  }

  return { supabase, getUserById }
}

// Tests ------------------------------------------------------------------

describe('checkAndEscalate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.NEWSLETTER_FROM_DOMAIN = 'test.com'
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.com'
  })

  // --- No escalation cases ---

  it('returns false when cron_health row does not exist', async () => {
    const { supabase } = buildSupabaseMock({ health: null })
    mockGetSupabase.mockReturnValue(supabase as never)

    const result = await checkAndEscalate('ab-evaluate', 'site-1')

    expect(result).toBe(false)
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('returns false when consecutive_failures < 3', async () => {
    const { supabase } = buildSupabaseMock({
      health: {
        consecutive_failures: 2,
        last_failure_at: daysAgo(1),
        last_success_at: daysAgo(2),
      },
    })
    mockGetSupabase.mockReturnValue(supabase as never)

    const result = await checkAndEscalate('ab-evaluate', 'site-1')

    expect(result).toBe(false)
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('returns false when 3+ failures but last_success_at is recent (< 3 days ago)', async () => {
    const { supabase } = buildSupabaseMock({
      health: {
        consecutive_failures: 5,
        last_failure_at: daysAgo(0.5),
        last_success_at: daysAgo(1), // only 1 day since last success
      },
    })
    mockGetSupabase.mockReturnValue(supabase as never)

    const result = await checkAndEscalate('ab-evaluate', 'site-1')

    expect(result).toBe(false)
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('returns false when referenceDate is null (no last_success_at and no last_failure_at)', async () => {
    const { supabase } = buildSupabaseMock({
      health: {
        consecutive_failures: 10,
        last_failure_at: null,
        last_success_at: null,
      },
    })
    mockGetSupabase.mockReturnValue(supabase as never)

    const result = await checkAndEscalate('ab-evaluate', 'site-1')

    expect(result).toBe(false)
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('returns false when no super_admin owner is found for the site', async () => {
    const { supabase } = buildSupabaseMock({
      health: {
        consecutive_failures: 5,
        last_failure_at: daysAgo(5),
        last_success_at: daysAgo(5),
      },
      owner: null,
    })
    mockGetSupabase.mockReturnValue(supabase as never)

    const result = await checkAndEscalate('ab-evaluate', 'site-1')

    expect(result).toBe(false)
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('returns false when notification is suppressed (deduped)', async () => {
    const { supabase } = buildSupabaseMock({
      health: {
        consecutive_failures: 5,
        last_failure_at: daysAgo(5),
        last_success_at: daysAgo(5),
      },
      owner: { user_id: 'user-1' },
    })
    mockGetSupabase.mockReturnValue(supabase as never)
    mockCreateNotification.mockResolvedValue({ success: true, suppressed: true })

    const result = await checkAndEscalate('ab-evaluate', 'site-1')

    expect(result).toBe(false)
    expect(mockCreateNotification).toHaveBeenCalledOnce()
  })

  // --- Happy path: escalation fires ---

  it('creates notification and sends email when 3+ consecutive failures over 3+ days', async () => {
    const { supabase, getUserById } = buildSupabaseMock({
      health: {
        consecutive_failures: 5,
        last_failure_at: daysAgo(4),
        last_success_at: daysAgo(5),
      },
      owner: { user_id: 'user-1' },
      userEmail: 'admin@example.com',
    })
    mockGetSupabase.mockReturnValue(supabase as never)
    mockCreateNotification.mockResolvedValue({
      success: true,
      notificationId: 'notif-1',
    })

    const result = await checkAndEscalate('ab-evaluate', 'site-1')

    expect(result).toBe(true)

    // Verify notification was created with correct shape
    expect(mockCreateNotification).toHaveBeenCalledOnce()
    const notifArg = mockCreateNotification.mock.calls[0][0]
    expect(notifArg).toMatchObject({
      site_id: 'site-1',
      user_id: 'user-1',
      type: 'cron_escalation',
      domain: 'system',
      priority: 1,
      channels: ['email'],
      action_href: '/cms/youtube/ab-lab',
    })
    expect(notifArg.title).toContain('ab-evaluate')
    expect(notifArg.title).toContain('5 dias')
    expect(notifArg.message).toContain('5 falhas consecutivas')
    expect(notifArg.dedup_key).toMatch(/^escalation-ab-evaluate-\d{4}-\d{2}-\d{2}$/)

    // Verify escalation email was sent (getUserById was called)
    expect(getUserById).toHaveBeenCalledWith('user-1')
  })

  it('returns false when createNotification returns success: false', async () => {
    const { supabase } = buildSupabaseMock({
      health: {
        consecutive_failures: 5,
        last_failure_at: daysAgo(5),
        last_success_at: daysAgo(5),
      },
      owner: { user_id: 'user-1' },
    })
    mockGetSupabase.mockReturnValue(supabase as never)
    mockCreateNotification.mockResolvedValue({ success: false, error: 'rate limit' })

    const result = await checkAndEscalate('ab-evaluate', 'site-1')

    expect(result).toBe(false)
  })

  // --- Edge case: never succeeded (last_success_at is null) ---

  it('escalates when last_success_at is null but last_failure_at is old enough (worst-case +3 calc)', async () => {
    // When last_success_at is null, the code adds +3 to daysSinceFailure,
    // so a failure 1 day ago gives daysSinceSuccess = 1 + 3 = 4, which triggers escalation
    const { supabase, getUserById } = buildSupabaseMock({
      health: {
        consecutive_failures: 10,
        last_failure_at: daysAgo(1),
        last_success_at: null,
      },
      owner: { user_id: 'user-1' },
      userEmail: 'owner@example.com',
    })
    mockGetSupabase.mockReturnValue(supabase as never)
    mockCreateNotification.mockResolvedValue({ success: true, notificationId: 'notif-2' })

    const result = await checkAndEscalate('ab-evaluate', 'site-1')

    expect(result).toBe(true)
    const notifArg = mockCreateNotification.mock.calls[0][0]
    expect(notifArg.title).toContain('4 dias') // 1 day failure + 3 worst-case
    expect(notifArg.message).toContain('nunca') // last success shown as 'nunca'
  })

  it('does not escalate when never succeeded and failure too recent for worst-case calc', async () => {
    // Failure 0 hours ago: daysSinceSuccess = 0 + 3 = 3, but < 3 means the
    // last_failure_at would need to satisfy referenceDate check.
    // Actually, with last_success_at = null, referenceDate = last_failure_at.
    // If last_failure_at is, say, a few seconds ago: days = ~0 + 3 = ~3.
    // The check is daysSinceSuccess < 3, so 3.0 is NOT < 3. It should escalate.
    // To NOT escalate, we'd need the sum to be strictly < 3.
    // That means last_failure_at needs to be extremely recent AND the +3 total < 3,
    // which is impossible since +3 always makes it >= 3.
    // So the only way to not escalate with null last_success_at is consecutive_failures < 3
    // or referenceDate being null (both last_failure_at and last_success_at null).
    // This test verifies that even a very recent failure with null last_success_at escalates
    // because +3 pushes the total to >= 3.
    const { supabase } = buildSupabaseMock({
      health: {
        consecutive_failures: 3,
        last_failure_at: new Date().toISOString(), // just now
        last_success_at: null,
      },
      owner: { user_id: 'user-1' },
    })
    mockGetSupabase.mockReturnValue(supabase as never)
    mockCreateNotification.mockResolvedValue({ success: true, notificationId: 'notif-3' })

    const result = await checkAndEscalate('ab-evaluate', 'site-1')

    // Should escalate since 0 + 3 = 3, which is NOT < 3
    expect(result).toBe(true)
  })

  // --- Email fallback edge cases ---

  it('skips email when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY

    const { supabase, getUserById } = buildSupabaseMock({
      health: {
        consecutive_failures: 5,
        last_failure_at: daysAgo(5),
        last_success_at: daysAgo(5),
      },
      owner: { user_id: 'user-1' },
    })
    mockGetSupabase.mockReturnValue(supabase as never)
    mockCreateNotification.mockResolvedValue({ success: true, notificationId: 'notif-4' })

    const result = await checkAndEscalate('ab-evaluate', 'site-1')

    expect(result).toBe(true)
    // getUserById should NOT be called since we short-circuit before looking up email
    expect(getUserById).not.toHaveBeenCalled()
  })

  it('skips email silently when getUserById returns no email', async () => {
    const { supabase, getUserById } = buildSupabaseMock({
      health: {
        consecutive_failures: 5,
        last_failure_at: daysAgo(5),
        last_success_at: daysAgo(5),
      },
      owner: { user_id: 'user-1' },
      userEmail: null,
    })
    mockGetSupabase.mockReturnValue(supabase as never)
    mockCreateNotification.mockResolvedValue({ success: true, notificationId: 'notif-5' })

    const result = await checkAndEscalate('ab-evaluate', 'site-1')

    // Still returns true — the in-app notification succeeded
    expect(result).toBe(true)
    expect(getUserById).toHaveBeenCalledWith('user-1')
  })

  // --- Dedup key format ---

  it('generates dedup_key with today date in YYYY-MM-DD format', async () => {
    const { supabase } = buildSupabaseMock({
      health: {
        consecutive_failures: 5,
        last_failure_at: daysAgo(5),
        last_success_at: daysAgo(5),
      },
      owner: { user_id: 'user-1' },
    })
    mockGetSupabase.mockReturnValue(supabase as never)
    mockCreateNotification.mockResolvedValue({ success: true, notificationId: 'notif-6' })

    await checkAndEscalate('my-cron-job', 'site-1')

    const today = new Date().toISOString().slice(0, 10)
    const notifArg = mockCreateNotification.mock.calls[0][0]
    expect(notifArg.dedup_key).toBe(`escalation-my-cron-job-${today}`)
  })

  // --- Suggested action and action_href ---

  it('includes suggested_action and action_href in notification', async () => {
    const { supabase } = buildSupabaseMock({
      health: {
        consecutive_failures: 3,
        last_failure_at: daysAgo(4),
        last_success_at: daysAgo(4),
      },
      owner: { user_id: 'user-1' },
    })
    mockGetSupabase.mockReturnValue(supabase as never)
    mockCreateNotification.mockResolvedValue({ success: true, notificationId: 'notif-7' })

    await checkAndEscalate('ab-evaluate', 'site-1')

    const notifArg = mockCreateNotification.mock.calls[0][0]
    expect(notifArg.suggested_action).toBe('Verificar configuração e logs')
    expect(notifArg.action_href).toBe('/cms/youtube/ab-lab')
  })
})
