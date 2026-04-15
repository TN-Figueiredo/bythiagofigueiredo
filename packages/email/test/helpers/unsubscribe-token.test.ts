import { describe, it, expect, vi } from 'vitest'
import { ensureUnsubscribeToken } from '../../src/helpers/unsubscribe-token'

describe('ensureUnsubscribeToken', () => {
  it('returns URL with new token from upsert', async () => {
    const supabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { token: 'newtoken' } }),
    }
    const url = await ensureUnsubscribeToken(supabase as never, 'site-1', 'user@x.com', 'https://x.com')
    expect(url).toBe('https://x.com/unsubscribe/newtoken')
  })

  it('returns URL with existing token if upsert ignored conflict', async () => {
    let callCount = 0
    const supabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return Promise.resolve({ data: null })
        return Promise.resolve({ data: { token: 'existing' } })
      }),
    }
    const url = await ensureUnsubscribeToken(supabase as never, 'site-1', 'user@x.com', 'https://x.com')
    expect(url).toBe('https://x.com/unsubscribe/existing')
  })

  it('strips trailing slash from baseUrl', async () => {
    const supabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { token: 'tok' } }),
    }
    const url = await ensureUnsubscribeToken(supabase as never, 's', 'e@x.com', 'https://x.com/')
    expect(url).toBe('https://x.com/unsubscribe/tok')
  })

  it('throws when both upsert and lookup return null', async () => {
    const supabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    }
    await expect(ensureUnsubscribeToken(supabase as never, 's', 'e@x.com', 'https://x.com')).rejects.toThrow(/lookup_failed/)
  })
})
