import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { pollVideoStats, shouldSkipPoll, getLastPollTime, insertPollData } from '@/lib/youtube/ab-polls'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

describe('shouldSkipPoll', () => {
  it('returns true if last poll was less than 5 minutes ago', () => {
    const lastPoll = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    expect(shouldSkipPoll(lastPoll)).toBe(true)
  })

  it('returns false if last poll was more than 5 minutes ago', () => {
    const lastPoll = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    expect(shouldSkipPoll(lastPoll)).toBe(false)
  })

  it('returns false if no last poll (null)', () => {
    expect(shouldSkipPoll(null)).toBe(false)
  })
})

describe('pollVideoStats', () => {
  it('fetches video stats from YouTube and returns views + likes', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [{ statistics: { viewCount: '12345', likeCount: '678' } }],
      }),
    })

    const result = await pollVideoStats('UC_videoId123', 'api-key-123')
    expect(result).toEqual({ views: 12345, likes: 678 })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('videos?part=statistics&id=UC_videoId123'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('returns null when video not found (empty items)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    })

    const result = await pollVideoStats('invalid', 'key')
    expect(result).toBeNull()
  })

  it('returns null on API error (non-ok response)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 })

    const result = await pollVideoStats('vid', 'key')
    expect(result).toBeNull()
  })

  it('returns null on network timeout', async () => {
    global.fetch = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'))

    const result = await pollVideoStats('vid', 'key')
    expect(result).toBeNull()
  })

  it('pollVideoStats handles missing likeCount field gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [{ statistics: { viewCount: '100' } }],
      }),
    })

    const result = await pollVideoStats('vid-no-likes', 'api-key')
    expect(result).toEqual({ views: 100, likes: 0 })
  })
})

describe('getLastPollTime', () => {
  it('returns latest poll timestamp', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { polled_at: '2026-05-30T12:00:00Z' },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase)

    const result = await getLastPollTime(mockSupabase as never, 'test-1')
    expect(result).toBe('2026-05-30T12:00:00Z')
    expect(mockSupabase.from).toHaveBeenCalledWith('ab_test_polls')
  })

  it('returns null when no polls exist', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase)

    const result = await getLastPollTime(mockSupabase as never, 'test-nonexistent')
    expect(result).toBeNull()
  })
})

describe('insertPollData', () => {
  it('returns true on success', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase)

    const result = await insertPollData(mockSupabase as never, 'test-1', 'v1', 5000, 200, 'cron')
    expect(result).toBe(true)
    expect(mockSupabase.from).toHaveBeenCalledWith('ab_test_polls')
  })
})
