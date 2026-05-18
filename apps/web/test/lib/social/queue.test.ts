import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSelect = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'sites') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }
      }
      // social_posts
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({
                lte: mockSelect,
              }),
            }),
          }),
        }),
      }
    },
  }),
}))

import { getNextQueueSlot } from '@/lib/social/queue'

describe('getNextQueueSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the next available 2h slot between 9h-21h', async () => {
    vi.setSystemTime(new Date('2026-05-14T13:30:00Z'))
    mockSelect.mockResolvedValue({ data: [], error: null })

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')

    expect(slot).not.toBeNull()
    expect(slot!.hour).toBe(11)
  })

  it('skips occupied slots and finds next free one', async () => {
    vi.setSystemTime(new Date('2026-05-14T11:00:00Z'))

    mockSelect.mockResolvedValue({
      data: [
        { scheduled_at: '2026-05-14T12:00:00Z' },
        { scheduled_at: '2026-05-14T14:00:00Z' },
      ],
      error: null,
    })

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')

    expect(slot).not.toBeNull()
    expect(slot!.hour).toBe(13)
  })

  it('moves to next day when all slots for today are past or taken', async () => {
    vi.setSystemTime(new Date('2026-05-15T00:30:00Z'))
    mockSelect.mockResolvedValue({ data: [], error: null })

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')

    expect(slot).not.toBeNull()
    expect(slot!.hour).toBe(9)
    expect(slot!.date).toBe('2026-05-15')
  })

  it('returns null when all slots in 7-day window are taken', async () => {
    const occupiedSlots = []
    for (let d = 0; d < 7; d++) {
      for (let h = 9; h <= 21; h += 2) {
        const date = new Date('2026-05-14T12:00:00Z')
        date.setDate(date.getDate() + d)
        date.setUTCHours(h + 3)
        occupiedSlots.push({ scheduled_at: date.toISOString() })
      }
    }
    mockSelect.mockResolvedValue({ data: occupiedSlots, error: null })

    vi.setSystemTime(new Date('2026-05-14T11:00:00Z'))

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')
    expect(slot).toBeNull()
  })

  it('generates valid ISO 8601 scheduledAt', async () => {
    vi.setSystemTime(new Date('2026-05-14T13:00:00Z'))
    mockSelect.mockResolvedValue({ data: [], error: null })

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')

    expect(slot).not.toBeNull()
    expect(new Date(slot!.scheduledAt).toISOString()).toBe(slot!.scheduledAt)
  })
})
