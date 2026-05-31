import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { pollVideoStats, shouldSkipPoll } from '@/lib/youtube/ab-polls'

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
})
