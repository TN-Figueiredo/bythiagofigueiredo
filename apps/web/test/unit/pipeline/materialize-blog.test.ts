import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase service client
const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockUpsert = vi.fn()
const mockEq = vi.fn()

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({ from: mockFrom })),
}))

// Mock prepareBlogTranslationPatch
vi.mock('@/lib/pipeline/draft-to-blog', () => ({
  prepareBlogTranslationPatch: vi.fn(),
}))

import { materializeBlogPost } from '@/lib/pipeline/materialize-blog'
import { prepareBlogTranslationPatch } from '@/lib/pipeline/draft-to-blog'

const baseInput = {
  pipelineItemId: '11111111-1111-1111-1111-111111111111',
  targetStage: 'published' as const,
  scheduledFor: null,
  userId: 'user-uuid-1234',
  siteId: 'site-uuid-5678',
  vvsScore: 90,
}

const mockPatch = {
  content_json: null,
  content_html: null,
  content_mdx: '# Hello',
  content_compiled: null,
  content_toc: null,
  reading_time_min: null,
  title: 'My Post',
  slug: 'my-post',
  excerpt: 'An excerpt',
  meta_title: null,
  meta_description: null,
  og_image_url: null,
  key_points: null,
  pull_quote: null,
  notes: null,
  colophon: null,
  tag_id: null,
  cover_image_url: null,
}

function buildChain(finalValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'upsert', 'eq', 'single', 'maybeSingle']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  // terminal: single resolves to finalValue
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(finalValue)
  ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(finalValue)
  return chain
}

describe('materializeBlogPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when VVS score below threshold', async () => {
    const result = await materializeBlogPost({ ...baseInput, vvsScore: 79 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('VVS_BELOW_THRESHOLD')
      expect(result.message).toContain('79')
    }
  })

  it('returns error when VVS score is exactly at threshold (>=80 passes)', async () => {
    // Setup: item fetch succeeds, no blog_post_id, insert creates post, upsert translation, update pipeline
    const itemChain = buildChain({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        blog_post_id: null,
        language: 'pt-br',
        sections: { draft_pt: { content: '# Hello', rev: 1 } },
        site_id: 'site-uuid-5678',
        cover_image_url: null,
      },
      error: null,
    })
    const insertChain = buildChain({ data: { id: 'new-post-id' }, error: null })
    const upsertChain = buildChain({ data: null, error: null })
    const updateChain = buildChain({ data: null, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return itemChain    // content_pipeline select
      if (callCount === 2) return insertChain  // blog_posts insert
      if (callCount === 3) return upsertChain  // blog_translations upsert
      return updateChain                        // content_pipeline update
    })

    vi.mocked(prepareBlogTranslationPatch).mockResolvedValue(mockPatch)

    const result = await materializeBlogPost({ ...baseInput, vvsScore: 80 })
    // Should not return VVS error at exactly 80
    expect(result.ok).not.toBe(false)
    if (!result.ok) {
      expect(result.code).not.toBe('VVS_BELOW_THRESHOLD')
    }
  })

  it('requires scheduledFor when targetStage is scheduled', async () => {
    const result = await materializeBlogPost({
      ...baseInput,
      targetStage: 'scheduled',
      scheduledFor: null,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('SCHEDULE_DATE_REQUIRED')
    }
  })

  it('succeeds when targetStage is scheduled and scheduledFor is provided', async () => {
    const itemChain = buildChain({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        blog_post_id: null,
        language: 'pt-br',
        sections: { draft_pt: { content: '# Hello', rev: 2 } },
        site_id: 'site-uuid-5678',
        cover_image_url: null,
      },
      error: null,
    })
    const insertChain = buildChain({ data: { id: 'scheduled-post-id' }, error: null })
    const upsertChain = buildChain({ data: null, error: null })
    const updateChain = buildChain({ data: null, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return itemChain
      if (callCount === 2) return insertChain
      if (callCount === 3) return upsertChain
      return updateChain
    })

    vi.mocked(prepareBlogTranslationPatch).mockResolvedValue(mockPatch)

    const result = await materializeBlogPost({
      ...baseInput,
      targetStage: 'scheduled',
      scheduledFor: '2026-07-01T10:00:00Z',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.blogPostId).toBe('scheduled-post-id')
    }
  })

  it('returns NOT_FOUND when pipeline item is missing', async () => {
    const chain = buildChain({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(chain)

    const result = await materializeBlogPost(baseInput)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('NOT_FOUND')
    }
  })

  it('creates a new blog post when blog_post_id is null', async () => {
    const itemChain = buildChain({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        blog_post_id: null,
        language: 'pt-br',
        sections: { draft_pt: { content: '# Hello', rev: 3 } },
        site_id: 'site-uuid-5678',
        cover_image_url: null,
      },
      error: null,
    })
    const insertChain = buildChain({ data: { id: 'brand-new-post-id' }, error: null })
    const upsertChain = buildChain({ data: null, error: null })
    const updateChain = buildChain({ data: null, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return itemChain
      if (callCount === 2) return insertChain
      if (callCount === 3) return upsertChain
      return updateChain
    })

    vi.mocked(prepareBlogTranslationPatch).mockResolvedValue(mockPatch)

    const result = await materializeBlogPost(baseInput)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.blogPostId).toBe('brand-new-post-id')
    }
  })

  it('updates existing blog post when blog_post_id is set', async () => {
    const itemChain = buildChain({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        blog_post_id: 'existing-post-id',
        language: 'pt-br',
        sections: { draft_pt: { content: '# Hello', rev: 5 } },
        site_id: 'site-uuid-5678',
        cover_image_url: null,
      },
      error: null,
    })
    const updatePostChain = buildChain({ data: null, error: null })
    const upsertChain = buildChain({ data: null, error: null })
    const updatePipelineChain = buildChain({ data: null, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return itemChain        // content_pipeline select
      if (callCount === 2) return updatePostChain   // blog_posts update
      if (callCount === 3) return upsertChain       // blog_translations upsert
      return updatePipelineChain                    // content_pipeline update
    })

    vi.mocked(prepareBlogTranslationPatch).mockResolvedValue(mockPatch)

    const result = await materializeBlogPost(baseInput)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.blogPostId).toBe('existing-post-id')
    }
  })

  it('returns NO_CONTENT when prepareBlogTranslationPatch returns null for all locales', async () => {
    const itemChain = buildChain({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        blog_post_id: null,
        language: 'pt-br',
        sections: {},
        site_id: 'site-uuid-5678',
        cover_image_url: null,
      },
      error: null,
    })
    mockFrom.mockReturnValue(itemChain)

    vi.mocked(prepareBlogTranslationPatch).mockResolvedValue(null)

    const result = await materializeBlogPost(baseInput)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('NO_CONTENT')
    }
  })

  it('resolves both locales when language is both', async () => {
    const itemChain = buildChain({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        blog_post_id: null,
        language: 'both',
        sections: {
          draft_pt: { content: '# PT', rev: 1 },
          draft_en: { content: '# EN', rev: 2 },
        },
        site_id: 'site-uuid-5678',
        cover_image_url: null,
      },
      error: null,
    })
    const insertChain = buildChain({ data: { id: 'bilingual-post-id' }, error: null })
    const upsertChain = buildChain({ data: null, error: null })
    const updateChain = buildChain({ data: null, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return itemChain
      if (callCount === 2) return insertChain
      // Two upserts (pt + en) + one pipeline update
      return callCount <= 4 ? upsertChain : updateChain
    })

    vi.mocked(prepareBlogTranslationPatch).mockResolvedValue(mockPatch)

    const result = await materializeBlogPost(baseInput)
    expect(result.ok).toBe(true)

    // prepareBlogTranslationPatch called with both locales
    expect(vi.mocked(prepareBlogTranslationPatch)).toHaveBeenCalledWith(expect.anything(), 'pt')
    expect(vi.mocked(prepareBlogTranslationPatch)).toHaveBeenCalledWith(expect.anything(), 'en')
  })
})
