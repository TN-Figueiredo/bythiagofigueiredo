import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { getNextQueueSlot } from '@/lib/social/queue'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const selectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({
            data: overrides.scheduledPosts ?? [],
            error: null,
          }),
        }),
      }),
    }),
  })

  const singleMock = vi.fn().mockResolvedValue({
    data: overrides.siteSettings ?? null,
    error: null,
  })

  return {
    from: vi.fn((table: string) => {
      if (table === 'social_posts') {
        return { select: selectMock }
      }
      if (table === 'sites') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: singleMock,
            }),
          }),
        }
      }
      return { select: selectMock }
    }),
  }
}

describe('getNextQueueSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a slot with the correct shape', async () => {
    const mock = createMockSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mock as never)

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')
    expect(slot).toMatchObject({
      date: expect.any(String),
      hour: expect.any(Number),
      scheduledAt: expect.any(String),
      label: expect.any(String),
    })
  })

  it('uses custom queue_slots from site settings when provided', async () => {
    const customSlots = {
      monday: [10, 14],
      tuesday: [10, 14],
      wednesday: [10, 14],
      thursday: [10, 14],
      friday: [10, 14],
      saturday: [12],
      sunday: [],
    }
    const mock = createMockSupabase({
      siteSettings: { social_defaults: { queue_slots: customSlots } },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mock as never)

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')
    if (slot) {
      expect([10, 12, 14]).toContain(slot.hour)
    }
  })

  it('skips occupied slots', async () => {
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)

    const mock = createMockSupabase({
      scheduledPosts: [{ scheduled_at: nextHour.toISOString() }],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mock as never)

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')
    if (slot) {
      const slotTime = new Date(slot.scheduledAt)
      expect(slotTime.getTime()).not.toBe(nextHour.getTime())
    }
  })

  it('returns null when no slots available in window', async () => {
    // Fill all slots — this test verifies graceful null return
    const mock = createMockSupabase({
      siteSettings: { social_defaults: { queue_slots: {
        monday: [], tuesday: [], wednesday: [], thursday: [],
        friday: [], saturday: [], sunday: [],
      } } },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mock as never)

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')
    expect(slot).toBeNull()
  })
})
