import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { ensureUnsubscribeToken } from '../../src/helpers/unsubscribe-token'

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

describe('ensureUnsubscribeToken', () => {
  it('returns URL with a raw token when upsert inserted a new row', async () => {
    // Echo back the hash that came in via upsert (simulating successful insert).
    let lastInsertedHash: string | null = null
    const supabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockImplementation((row: { token_hash: string }) => {
        lastInsertedHash = row.token_hash
        return supabase
      }),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: { token_hash: lastInsertedHash } }),
      ),
    }
    const url = await ensureUnsubscribeToken(supabase as never, 'site-1', 'user@x.com', 'https://x.com')
    expect(url).toMatch(/^https:\/\/x\.com\/unsubscribe\/[a-f0-9]{64}$/)
    const rawToken = url.split('/').pop()!
    // DB hash matches sha256 of the emitted raw token.
    expect(lastInsertedHash).toBe(sha256(rawToken))
  })

  it('rotates the stored hash when a row already exists for (site, email)', async () => {
    // First single() → upsert ignored conflict; second single() → lookup finds row.
    let call = 0
    const updateEq1 = vi.fn().mockReturnThis()
    const updateEq2 = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase: Record<string, unknown> = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockImplementation(() => ({
        eq: updateEq1.mockImplementation(() => ({ eq: updateEq2 })),
      })),
      single: vi.fn().mockImplementation(() => {
        call++
        if (call === 1) return Promise.resolve({ data: null })
        return Promise.resolve({ data: { site_id: 'site-1', email: 'user@x.com' } })
      }),
    }
    const url = await ensureUnsubscribeToken(supabase as never, 'site-1', 'user@x.com', 'https://x.com')
    expect(url).toMatch(/^https:\/\/x\.com\/unsubscribe\/[a-f0-9]{64}$/)
  })

  it('strips trailing slash from baseUrl', async () => {
    let lastInsertedHash: string | null = null
    const supabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockImplementation((row: { token_hash: string }) => {
        lastInsertedHash = row.token_hash
        return supabase
      }),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: { token_hash: lastInsertedHash } }),
      ),
    }
    const url = await ensureUnsubscribeToken(supabase as never, 's', 'e@x.com', 'https://x.com/')
    expect(url.startsWith('https://x.com/unsubscribe/')).toBe(true)
    expect(url).not.toMatch(/x\.com\/\/unsubscribe/)
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
