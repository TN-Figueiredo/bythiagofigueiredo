import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/social/actions/_shared', async () => {
  const actual = await vi.importActual<typeof import('@/lib/social/actions/_shared')>('@/lib/social/actions/_shared')
  return {
    ...actual,
    requireEditAccess: vi.fn().mockResolvedValue({ siteId: 's1', userId: 'u1' }),
  }
})

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireEditAccess } from '@/lib/social/actions/_shared'
import { getStories, getStoryCounts, searchSourceContent } from '@/lib/social/actions/stories'

// ---------------------------------------------------------------------------
// Fluent query builder factory
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown[] | null; error: { message: string } | null; count?: number | null }

function buildChain(result: QueryResult) {
  const chain: Record<string, unknown> = {}
  const fluent = [
    'select', 'eq', 'neq', 'not', 'is', 'in', 'gt', 'gte', 'lt', 'lte',
    'ilike', 'like', 'order', 'limit',
  ]
  for (const m of fluent) {
    chain[m] = vi.fn(() => chain)
  }
  chain.then = (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve)
  chain.single = vi.fn(() => Promise.resolve(result))
  return chain
}

let mockFrom: ReturnType<typeof vi.fn>

const SITE_ID = 's1'
const OTHER_SITE = '00000000-0000-0000-0000-000000000002'
const VALID_UUID = 's1' // will be replaced below with real UUID

const REAL_SITE_UUID = '11111111-1111-1111-1111-111111111111'
const REAL_OTHER_UUID = '22222222-2222-2222-2222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireEditAccess).mockResolvedValue({ siteId: REAL_SITE_UUID, userId: 'u1' })
  mockFrom = vi.fn()
  vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: mockFrom } as never)
})

// ---------------------------------------------------------------------------
// getStories
// ---------------------------------------------------------------------------

describe('getStories', () => {
  it('returns { ok: false } for invalid siteId (non-UUID)', async () => {
    const result = await getStories('not-a-uuid', 'drafts')
    expect(result).toEqual({ ok: false, error: 'Invalid site ID' })
    expect(requireEditAccess).not.toHaveBeenCalled()
  })

  it('returns forbidden when siteId does not match authorized site', async () => {
    vi.mocked(requireEditAccess).mockResolvedValue({ siteId: REAL_SITE_UUID, userId: 'u1' })
    const result = await getStories(REAL_OTHER_UUID, 'drafts')
    expect(result).toEqual({ ok: false, error: 'forbidden' })
  })

  it('calls requireEditAccess with no args (reads from context)', async () => {
    mockFrom.mockReturnValue(buildChain({ data: [], error: null }))
    await getStories(REAL_SITE_UUID, 'drafts')
    expect(requireEditAccess).toHaveBeenCalledOnce()
  })

  it('filters by status=draft for drafts tab', async () => {
    const chain = buildChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getStories(REAL_SITE_UUID, 'drafts')

    expect(chain.eq).toHaveBeenCalledWith('status', 'draft')
  })

  it('filters by status=completed and published_at > threshold for live tab', async () => {
    const chain = buildChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getStories(REAL_SITE_UUID, 'live')

    expect(chain.eq).toHaveBeenCalledWith('status', 'completed')
    expect(chain.gt).toHaveBeenCalledWith('published_at', expect.any(String))
  })

  it('filters by status=completed and published_at <= threshold for expired tab', async () => {
    const chain = buildChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getStories(REAL_SITE_UUID, 'expired')

    expect(chain.eq).toHaveBeenCalledWith('status', 'completed')
    expect(chain.lte).toHaveBeenCalledWith('published_at', expect.any(String))
  })

  it('filters by status=scheduled for scheduled tab', async () => {
    const chain = buildChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getStories(REAL_SITE_UUID, 'scheduled')

    expect(chain.eq).toHaveBeenCalledWith('status', 'scheduled')
  })

  it('returns mapped story rows on success', async () => {
    const row = {
      id: 'post-1',
      story_slides: [{ version: 1 }],
      status: 'draft',
      scheduled_at: null,
      published_at: null,
      source_content_id: null,
      source_content_type: null,
      source_locale: null,
      template_id: null,
      created_at: '2026-05-01T00:00:00Z',
      site_id: REAL_SITE_UUID,
    }
    mockFrom.mockReturnValue(buildChain({ data: [row], error: null }))

    const result = await getStories(REAL_SITE_UUID, 'drafts')

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'post-1',
          story_slides: [{ version: 1 }],
          status: 'draft',
          scheduled_at: null,
          published_at: null,
          source_content_id: null,
          source_content_type: null,
          source_locale: null,
          template_id: null,
          created_at: '2026-05-01T00:00:00Z',
          site_id: REAL_SITE_UUID,
        },
      ],
    })
  })

  it('returns { ok: false } when DB returns an error', async () => {
    mockFrom.mockReturnValue(buildChain({ data: null, error: { message: 'DB error' } }))

    const result = await getStories(REAL_SITE_UUID, 'drafts')

    expect(result).toEqual({ ok: false, error: 'DB error' })
  })

  it('throws when requireEditAccess throws', async () => {
    vi.mocked(requireEditAccess).mockRejectedValue(new Error('unauthenticated'))

    await expect(getStories(REAL_SITE_UUID, 'drafts')).rejects.toThrow('unauthenticated')
  })
})

// ---------------------------------------------------------------------------
// getStoryCounts
// ---------------------------------------------------------------------------

describe('getStoryCounts', () => {
  it('returns { ok: false } for invalid siteId', async () => {
    const result = await getStoryCounts('not-a-uuid')
    expect(result).toEqual({ ok: false, error: 'Invalid site ID' })
  })

  it('returns forbidden when siteId does not match authorized site', async () => {
    const result = await getStoryCounts(REAL_OTHER_UUID)
    expect(result).toEqual({ ok: false, error: 'forbidden' })
  })

  it('returns count object with correct values', async () => {
    // Four parallel queries return different counts via the head: true path
    const makeCounted = (count: number) => {
      const chain: Record<string, unknown> = {}
      const fluent = ['select', 'eq', 'neq', 'not', 'is', 'gt', 'gte', 'lte', 'lt', 'limit']
      for (const m of fluent) {
        chain[m] = vi.fn(() => chain)
      }
      // Supabase head:true queries resolve to { count, data: null, error: null }
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ count, data: null, error: null }).then(resolve)
      return chain
    }

    let callIndex = 0
    mockFrom.mockImplementation(() => {
      // Each call creates a fresh chain returning different counts
      const counts = [3, 5, 2, 8]
      return makeCounted(counts[callIndex++ % counts.length])
    })

    const result = await getStoryCounts(REAL_SITE_UUID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.drafts).toBe(3)
      expect(result.data.live).toBe(5)
      expect(result.data.expired).toBe(2)
      expect(result.data.scheduled).toBe(8)
    }
  })

  it('defaults null counts to 0', async () => {
    const makeNullCounted = () => {
      const chain: Record<string, unknown> = {}
      const fluent = ['select', 'eq', 'not', 'gt', 'lte']
      for (const m of fluent) {
        chain[m] = vi.fn(() => chain)
      }
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ count: null, data: null, error: null }).then(resolve)
      return chain
    }

    mockFrom.mockReturnValue(makeNullCounted())

    const result = await getStoryCounts(REAL_SITE_UUID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.drafts).toBe(0)
      expect(result.data.live).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// searchSourceContent
// ---------------------------------------------------------------------------

describe('searchSourceContent', () => {
  it('returns { ok: false } for invalid siteId', async () => {
    const result = await searchSourceContent('not-a-uuid', 'blog', 'query')
    expect(result).toEqual({ ok: false, error: 'Invalid site ID' })
  })

  it('returns { ok: false } for invalid content type', async () => {
    const result = await searchSourceContent(REAL_SITE_UUID, 'unknown_type', 'query')
    expect(result).toEqual({ ok: false, error: 'Invalid content type' })
  })

  it('returns forbidden when siteId does not match authorized site', async () => {
    const result = await searchSourceContent(REAL_OTHER_UUID, 'blog', 'query')
    expect(result).toEqual({ ok: false, error: 'forbidden' })
  })

  it('escapes % in search query to prevent LIKE injection', async () => {
    const chain = buildChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await searchSourceContent(REAL_SITE_UUID, 'newsletter', '100%')

    expect(chain.ilike).toHaveBeenCalledWith('subject', '%100\\%%')
  })

  it('escapes _ in search query to prevent LIKE wildcard', async () => {
    const chain = buildChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await searchSourceContent(REAL_SITE_UUID, 'newsletter', 'hello_world')

    expect(chain.ilike).toHaveBeenCalledWith('subject', '%hello\\_world%')
  })

  it('searches newsletter by subject with ilike', async () => {
    const chain = buildChain({
      data: [{ id: 'ed-1', subject: 'AI Newsletter' }],
      error: null,
    })
    mockFrom.mockReturnValue(chain)

    const result = await searchSourceContent(REAL_SITE_UUID, 'newsletter', 'AI')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data[0]).toMatchObject({
        id: 'ed-1',
        title: 'AI Newsletter',
        type: 'newsletter',
        url: expect.stringContaining('ed-1'),
      })
    }
  })

  it('searches blog by title with nested translation', async () => {
    const chain = buildChain({
      data: [{ id: 'post-1', blog_translations: [{ title: 'My Post', slug: 'my-post', locale: 'pt-BR' }] }],
      error: null,
    })
    mockFrom.mockReturnValue(chain)

    const result = await searchSourceContent(REAL_SITE_UUID, 'blog', 'My')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data[0]).toMatchObject({
        id: 'post-1',
        title: 'My Post',
        type: 'blog',
        url: expect.stringContaining('my-post'),
      })
    }
  })

  it('skips blog rows with no translations', async () => {
    const chain = buildChain({
      data: [
        { id: 'post-1', blog_translations: null },
        { id: 'post-2', blog_translations: [{ title: 'Post 2', slug: 'post-2', locale: 'en' }] },
      ],
      error: null,
    })
    mockFrom.mockReturnValue(chain)

    const result = await searchSourceContent(REAL_SITE_UUID, 'blog', 'Post')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe('post-2')
    }
  })

  it('searches campaigns by meta_title', async () => {
    const chain = buildChain({
      data: [{ id: 'camp-1', campaign_translations: [{ meta_title: 'Summer Sale', slug: 'summer-sale' }] }],
      error: null,
    })
    mockFrom.mockReturnValue(chain)

    const result = await searchSourceContent(REAL_SITE_UUID, 'campaign', 'Summer')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data[0]).toMatchObject({
        id: 'camp-1',
        title: 'Summer Sale',
        type: 'campaign',
        url: expect.stringContaining('summer-sale'),
      })
    }
  })

  it('returns { ok: false } when DB query returns error', async () => {
    const chain = buildChain({ data: null, error: { message: 'query failed' } })
    mockFrom.mockReturnValue(chain)

    const result = await searchSourceContent(REAL_SITE_UUID, 'newsletter', 'test')

    expect(result).toEqual({ ok: false, error: 'query failed' })
  })

  it('escapes both % and _ in same query', async () => {
    const chain = buildChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await searchSourceContent(REAL_SITE_UUID, 'newsletter', '50%_off')

    expect(chain.ilike).toHaveBeenCalledWith('subject', '%50\\%\\_off%')
  })
})
