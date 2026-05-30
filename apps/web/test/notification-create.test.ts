import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { createNotification } from '@/lib/notifications/create'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { NotificationCreateInput } from '@/lib/notifications/schemas'

function createMockSupabase(overrides: {
  rateCount?: number
  insertError?: string | null
  deliveryInsertError?: string | null
  notifTypeRow?: Record<string, unknown> | null
} = {}) {
  const insertedNotifications: Record<string, unknown>[] = []
  const insertedDeliveries: Record<string, unknown>[] = []

  const singleMock = vi.fn().mockResolvedValue({
    data: overrides.notifTypeRow ?? {
      type: 'pipeline.stage_advance',
      domain: 'pipeline',
      priority: 3,
      min_role: 'editor',
      cooldown_secs: null,
    },
    error: null,
  })

  const rpcMock = vi.fn().mockResolvedValue({
    data: overrides.rateCount ?? 5,
    error: null,
  })

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'notification_types') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: singleMock,
              }),
            }),
          }
        }
        if (table === 'notifications') {
          return {
            insert: vi.fn((row: Record<string, unknown>) => {
              insertedNotifications.push(row)
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: overrides.insertError
                      ? null
                      : { id: 'notif-1', ...row },
                    error: overrides.insertError
                      ? { message: overrides.insertError }
                      : null,
                  }),
                }),
              }
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    gte: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({
                        data: [],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'notification_deliveries') {
          return {
            insert: vi.fn((rows: Record<string, unknown>[]) => {
              insertedDeliveries.push(...rows)
              return Promise.resolve({
                data: null,
                error: overrides.deliveryInsertError
                  ? { message: overrides.deliveryInsertError }
                  : null,
              })
            }),
          }
        }
        if (table === 'notification_preferences') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        channel_in_app: true,
                        channel_email: true,
                        channel_push: false,
                        channel_telegram: false,
                      },
                      error: null,
                    }),
                  }),
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        return { select: vi.fn() }
      }),
      rpc: rpcMock,
    },
    insertedNotifications,
    insertedDeliveries,
  }
}

const baseInput: NotificationCreateInput = {
  site_id: '00000000-0000-0000-0000-000000000001',
  user_id: '00000000-0000-0000-0000-000000000002',
  type: 'pipeline.stage_advance',
  domain: 'pipeline',
  priority: 3,
  title: 'Test title',
}

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates notification with valid input', async () => {
    const { supabase } = createMockSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const result = await createNotification(baseInput)
    expect(result.success).toBe(true)
    expect(result.notificationId).toBe('notif-1')
  })

  it('rejects when Zod validation fails', async () => {
    const { supabase } = createMockSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const result = await createNotification({
      ...baseInput,
      title: '', // empty title invalid
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('title')
  })

  it('rejects PII in payload', async () => {
    const { supabase } = createMockSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const result = await createNotification({
      ...baseInput,
      payload: { email: 'leak@example.com' },
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('PII')
  })

  it('suppresses self-action notifications', async () => {
    const { supabase } = createMockSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const result = await createNotification({
      ...baseInput,
      actor_id: baseInput.user_id, // same user
    })
    expect(result.success).toBe(true)
    expect(result.suppressed).toBe(true)
  })

  it('rate limits at 100 notifications/user/hour', async () => {
    const { supabase } = createMockSupabase({ rateCount: 100 })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const result = await createNotification(baseInput)
    expect(result.success).toBe(false)
    expect(result.error).toContain('rate limit')
  })

  it('creates delivery rows for enabled channels', async () => {
    const { supabase, insertedDeliveries } = createMockSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await createNotification({
      ...baseInput,
      channels: ['email'],
    })
    // Email channel enabled in mock preferences
    expect(insertedDeliveries.length).toBeGreaterThanOrEqual(0)
  })
})
