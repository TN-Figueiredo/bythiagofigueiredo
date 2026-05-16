import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

const mockMaybeSingle = vi.fn()
const mockInsertSingle = vi.fn()

function buildSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'tracked_links') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: mockMaybeSingle,
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: mockInsertSingle,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: [{ id: 'l1' }], error: null }),
              }),
            }),
          }),
        }
      }
      return {}
    }),
  }
}

describe('ensureTrackedLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockInsertSingle.mockResolvedValue({
      data: { id: 'new-link', code: 'AbCdEfG' },
      error: null,
    })
  })

  it('creates a new link when none exists', async () => {
    const { ensureTrackedLink } = await import('@/lib/links/auto-link')
    const result = await ensureTrackedLink(
      buildSupabase() as never, 'site-1', 'post-1', 'blog', 'https://example.com/pt/blog/meu-post', 'meu-post',
    )

    expect(result).not.toBeNull()
    expect(result!.linkId).toBe('new-link')
    expect(result!.isNew).toBe(true)
  })

  it('returns existing link without creating new one', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'existing-link', code: 'XyZ1234', active: true },
      error: null,
    })

    const { ensureTrackedLink } = await import('@/lib/links/auto-link')
    const result = await ensureTrackedLink(
      buildSupabase() as never, 'site-1', 'post-1', 'blog', 'https://example.com/pt/blog/meu-post', 'meu-post',
    )

    expect(result).not.toBeNull()
    expect(result!.linkId).toBe('existing-link')
    expect(result!.isNew).toBe(false)
  })

  it('reactivates inactive existing link', async () => {
    const supabase = buildSupabase()
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'inactive-link', code: 'InAcTvE', active: false },
      error: null,
    })

    const { ensureTrackedLink } = await import('@/lib/links/auto-link')
    const result = await ensureTrackedLink(
      supabase as never, 'site-1', 'post-1', 'blog', 'https://example.com/pt/blog/meu-post', 'meu-post',
    )

    expect(result).not.toBeNull()
    expect(result!.linkId).toBe('inactive-link')
    expect(result!.isNew).toBe(false)
  })

  it('returns null on insert error with no race winner', async () => {
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { message: 'some error' },
    })
    // Re-fetch also returns null (no race winner)
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // initial lookup

    const { ensureTrackedLink } = await import('@/lib/links/auto-link')
    const result = await ensureTrackedLink(
      buildSupabase() as never, 'site-1', 'post-1', 'blog', 'https://example.com/pt/blog/meu-post', 'meu-post',
    )

    expect(result).toBeNull()
  })
})

describe('deactivateSourceLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deactivates all links for a source', async () => {
    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [{ id: 'l1' }, { id: 'l2' }], error: null }),
            }),
          }),
        }),
      })),
    }

    const { deactivateSourceLinks } = await import('@/lib/links/auto-link')
    const count = await deactivateSourceLinks(supabase as never, 'post-1', 'blog')

    expect(count).toBe(2)
  })

  it('returns 0 on error', async () => {
    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
            }),
          }),
        }),
      })),
    }

    const { deactivateSourceLinks } = await import('@/lib/links/auto-link')
    const count = await deactivateSourceLinks(supabase as never, 'post-1', 'blog')

    expect(count).toBe(0)
  })
})

describe('reactivateSourceLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reactivates all links for a source', async () => {
    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [{ id: 'l1' }], error: null }),
            }),
          }),
        }),
      })),
    }

    const { reactivateSourceLinks } = await import('@/lib/links/auto-link')
    const count = await reactivateSourceLinks(supabase as never, 'post-1', 'blog')

    expect(count).toBe(1)
  })

  it('returns 0 on error', async () => {
    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
            }),
          }),
        }),
      })),
    }

    const { reactivateSourceLinks } = await import('@/lib/links/auto-link')
    const count = await reactivateSourceLinks(supabase as never, 'post-1', 'blog')

    expect(count).toBe(0)
  })
})

describe('generateShortCode', () => {
  it('generates a 7-character alphanumeric code', async () => {
    const { generateShortCode } = await import('@/lib/links/auto-link')
    const code = generateShortCode()
    expect(code).toHaveLength(7)
    expect(code).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('generates unique codes', async () => {
    const { generateShortCode } = await import('@/lib/links/auto-link')
    const codes = new Set(Array.from({ length: 100 }, () => generateShortCode()))
    expect(codes.size).toBe(100)
  })
})
