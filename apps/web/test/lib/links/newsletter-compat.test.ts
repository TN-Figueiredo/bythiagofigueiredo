import { describe, it, expect, vi, afterEach } from 'vitest'
import { getNewsletterClickRows } from '../../../src/lib/links/newsletter-compat'

afterEach(() => {
  vi.unstubAllEnvs()
})

function makeSupabaseMock(opts: {
  unifiedData?: { url: string }[] | null
  unifiedError?: { message: string } | null
  legacyData?: { url: string }[] | null
}) {
  return {
    from: vi.fn((table: string) => {
      const data =
        table === 'newsletter_click_events_unified'
          ? opts.unifiedError
            ? null
            : (opts.unifiedData ?? [])
          : (opts.legacyData ?? [])
      const error =
        table === 'newsletter_click_events_unified' ? (opts.unifiedError ?? null) : null

      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data, error }),
        })),
      }
    }),
  }
}

describe('getNewsletterClickRows', () => {
  it('returns empty array when sendIds is empty', async () => {
    const supabase = makeSupabaseMock({})
    const result = await getNewsletterClickRows({
      supabase: supabase as never,
      sendIds: [],
    })
    expect(result).toEqual([])
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('flag off: reads newsletter_click_events', async () => {
    const supabase = makeSupabaseMock({
      legacyData: [
        { url: 'https://a.com' },
        { url: 'https://a.com' },
        { url: 'https://b.com' },
      ],
    })
    const result = await getNewsletterClickRows({
      supabase: supabase as never,
      sendIds: ['s1'],
      rewriteEnabled: false,
    })
    expect(supabase.from).toHaveBeenCalledWith('newsletter_click_events')
    expect(result).toEqual(
      expect.arrayContaining([
        { url: 'https://a.com', count: 2 },
        { url: 'https://b.com', count: 1 },
      ]),
    )
  })

  it('flag on: reads newsletter_click_events_unified view', async () => {
    const supabase = makeSupabaseMock({
      unifiedData: [
        { url: 'https://unified.com' },
        { url: 'https://unified.com' },
      ],
    })
    const result = await getNewsletterClickRows({
      supabase: supabase as never,
      sendIds: ['s1'],
      rewriteEnabled: true,
    })
    expect(supabase.from).toHaveBeenCalledWith('newsletter_click_events_unified')
    expect(result).toEqual([{ url: 'https://unified.com', count: 2 }])
  })

  it('flag on: falls back to legacy table when view returns an error', async () => {
    const supabase = makeSupabaseMock({
      unifiedError: { message: 'relation does not exist' },
      legacyData: [{ url: 'https://fallback.com' }],
    })
    const result = await getNewsletterClickRows({
      supabase: supabase as never,
      sendIds: ['s1'],
      rewriteEnabled: true,
    })
    // Should have tried unified first, then fallen back to legacy
    expect(supabase.from).toHaveBeenCalledWith('newsletter_click_events_unified')
    expect(supabase.from).toHaveBeenCalledWith('newsletter_click_events')
    expect(result).toEqual([{ url: 'https://fallback.com', count: 1 }])
  })

  it('aggregates multiple URLs correctly', async () => {
    const supabase = makeSupabaseMock({
      legacyData: [
        { url: 'https://x.com' },
        { url: 'https://y.com' },
        { url: 'https://x.com' },
        { url: 'https://x.com' },
      ],
    })
    const result = await getNewsletterClickRows({
      supabase: supabase as never,
      sendIds: ['s1', 's2'],
      rewriteEnabled: false,
    })
    const x = result.find((r) => r.url === 'https://x.com')
    const y = result.find((r) => r.url === 'https://y.com')
    expect(x?.count).toBe(3)
    expect(y?.count).toBe(1)
  })

  it('reads from env flag when rewriteEnabled is not passed', async () => {
    vi.stubEnv('LINKS_NEWSLETTER_REWRITE_ENABLED', 'true')
    const supabase = makeSupabaseMock({ unifiedData: [] })
    await getNewsletterClickRows({
      supabase: supabase as never,
      sendIds: ['s1'],
    })
    expect(supabase.from).toHaveBeenCalledWith('newsletter_click_events_unified')
  })
})
