import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockSupabase = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

vi.mock('@/lib/links/short-url', () => ({
  buildShortUrl: (code: string) => `https://bythiagofigueiredo.com/go/${code}`,
}))

// ── Import after mocks ─────────────────────────────────────────────────────────
import {
  getLinkinBioEntries,
  addLinkinBioEntry,
} from '@/lib/social/link-in-bio'

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeEntry(i: number) {
  return {
    id: `entry-${i}`,
    position: i,
    created_at: new Date(Date.now() - i * 3_600_000).toISOString(),
    social_posts: { content: { title: `Post ${i}`, media_urls: [`https://cdn.example.com/${i}.jpg`] } },
    tracked_links: { id: `link-${i}`, code: `code${i}`, destination_url: `https://example.com/${i}` },
  }
}

// ── getLinkinBioEntries ────────────────────────────────────────────────────────
describe('getLinkinBioEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns entries ordered by position (ascending)', async () => {
    const entries = [makeEntry(0), makeEntry(1), makeEntry(2)]

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: entries, error: null }),
          }),
        }),
      }),
    })

    const result = await getLinkinBioEntries('site-1')

    expect(result).toHaveLength(3)
    expect(result[0]!.title).toBe('Post 0')
    expect(result[1]!.title).toBe('Post 1')
    expect(result[2]!.title).toBe('Post 2')
  })

  it('returns up to MAX_ENTRIES (20) entries', async () => {
    const entries = Array.from({ length: 20 }, (_, i) => makeEntry(i))

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: entries, error: null }),
          }),
        }),
      }),
    })

    const result = await getLinkinBioEntries('site-1')
    expect(result).toHaveLength(20)
  })

  it('maps shortUrl via buildShortUrl', async () => {
    const entries = [makeEntry(0)]

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: entries, error: null }),
          }),
        }),
      }),
    })

    const result = await getLinkinBioEntries('site-1')
    expect(result[0]!.shortUrl).toBe('https://bythiagofigueiredo.com/go/code0')
  })

  it('maps thumbnailUrl from media_urls[0]', async () => {
    const entries = [makeEntry(0)]

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: entries, error: null }),
          }),
        }),
      }),
    })

    const result = await getLinkinBioEntries('site-1')
    expect(result[0]!.thumbnailUrl).toBe('https://cdn.example.com/0.jpg')
  })

  it('returns null thumbnailUrl when media_urls is absent', async () => {
    const entry = {
      ...makeEntry(0),
      social_posts: { content: { title: 'No media' } },
    }

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [entry], error: null }),
          }),
        }),
      }),
    })

    const result = await getLinkinBioEntries('site-1')
    expect(result[0]!.thumbnailUrl).toBeNull()
  })

  it('returns empty array and captures exception on DB error', async () => {
    const { captureException } = await import('@sentry/nextjs')

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'connection timeout' },
            }),
          }),
        }),
      }),
    })

    const result = await getLinkinBioEntries('site-1')
    expect(result).toEqual([])
    expect(captureException).toHaveBeenCalled()
  })

  it('returns empty array when data is null without error', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    })

    const result = await getLinkinBioEntries('site-1')
    expect(result).toEqual([])
  })

  it('uses Untitled as title fallback when post content has no title', async () => {
    const entry = {
      ...makeEntry(0),
      social_posts: { content: {} },
    }

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [entry], error: null }),
          }),
        }),
      }),
    })

    const result = await getLinkinBioEntries('site-1')
    expect(result[0]!.title).toBe('Untitled')
  })
})

// ── addLinkinBioEntry ──────────────────────────────────────────────────────────
describe('addLinkinBioEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts a new entry at position 0', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'link_in_bio_entries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
              range: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          insert: mockInsert,
          update: mockUpdate,
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      return {}
    })

    await addLinkinBioEntry({ siteId: 'site-1', postId: 'post-new', linkId: 'link-new' })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: 'site-1',
        post_id: 'post-new',
        link_id: 'link-new',
        position: 0,
      }),
    )
  })

  it('shifts existing entries down by 1 before inserting', async () => {
    const existing = [
      { id: 'e1', position: 0 },
      { id: 'e2', position: 1 },
    ]

    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const updateEqMock = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: updateEqMock })

    // Track select calls to distinguish the initial listing from the range query
    let selectCallCount = 0

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'link_in_bio_entries') {
        return {
          select: vi.fn().mockImplementation(() => {
            selectCallCount++
            if (selectCallCount === 1) {
              // First select: list existing entries for position shifting
              return {
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: existing, error: null }),
                }),
              }
            }
            // Second select: range query for overflow pruning
            return {
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }
          }),
          insert: mockInsert,
          update: mockUpdate,
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      return {}
    })

    await addLinkinBioEntry({ siteId: 'site-1', postId: 'post-new', linkId: 'link-new' })

    // update called once per existing entry
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    expect(mockUpdate).toHaveBeenNthCalledWith(1, { position: 1 })
    expect(mockUpdate).toHaveBeenNthCalledWith(2, { position: 2 })
  })

  it('auto-prunes entries beyond MAX_ENTRIES (20)', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockDeleteIn = vi.fn().mockResolvedValue({ error: null })
    let selectCallCount = 0

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'link_in_bio_entries') {
        return {
          select: vi.fn().mockImplementation(() => {
            selectCallCount++
            if (selectCallCount === 1) {
              // Existing entries listing (for position shift)
              return {
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }
            }
            // Range query returns overflow entries
            return {
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: [{ id: 'overflow-1' }, { id: 'overflow-2' }],
                    error: null,
                  }),
                }),
              }),
            }
          }),
          insert: mockInsert,
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            in: mockDeleteIn,
          }),
        }
      }
      return {}
    })

    await addLinkinBioEntry({ siteId: 'site-1', postId: 'post-new', linkId: 'link-new' })

    expect(mockDeleteIn).toHaveBeenCalledWith(
      'id',
      expect.arrayContaining(['overflow-1', 'overflow-2']),
    )
  })

  it('captures exception and does not throw when insert fails', async () => {
    const { captureException } = await import('@sentry/nextjs')

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'link_in_bio_entries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({
            error: { message: 'unique constraint violation' },
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      return {}
    })

    // Should not throw
    await expect(
      addLinkinBioEntry({ siteId: 'site-1', postId: 'post-fail', linkId: 'link-fail' }),
    ).resolves.toBeUndefined()

    expect(captureException).toHaveBeenCalled()
  })
})
