import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase service mock — fluent builder pattern (same as pipeline-blog-link)
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown; error: unknown }

function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'in', 'ilike', 'limit', 'update', 'insert', 'upsert', 'single', 'maybeSingle']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  ;(chain as Record<string, unknown>).single = vi.fn(() => Promise.resolve(result))
  ;(chain as Record<string, unknown>).maybeSingle = vi.fn(() => Promise.resolve(result))
  ;(chain as Record<string, unknown>).insert = vi.fn(() => Promise.resolve(result))
  ;(chain as Record<string, unknown>).update = vi.fn(() => chain)
  // upsert returns chain so .select().single() chaining works; chain is also awaitable via .then
  ;(chain as Record<string, unknown>).upsert = vi.fn(() => chain)
  ;(chain as Record<string, unknown>).then = (resolve: (v: QueryResult) => unknown) =>
    Promise.resolve(result).then(resolve)
  return chain
}

const tableQueues: Record<string, ReturnType<typeof makeChain>[]> = {}

function enqueue(table: string, chain: ReturnType<typeof makeChain>) {
  if (!tableQueues[table]) tableQueues[table] = []
  tableQueues[table].push(chain)
}

const mockSvc = {
  from: vi.fn((table: string) => {
    const queue = tableQueues[table]
    if (queue && queue.length > 0) return queue.shift()!
    return makeChain({ data: null, error: null })
  }),
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSvc,
}))

vi.mock('@/lib/pipeline/draft-to-blog', () => ({
  prepareBlogTranslationPatch: vi.fn(),
}))

import { materializeBlogPost } from '@/lib/pipeline/materialize-blog'
import { prepareBlogTranslationPatch } from '@/lib/pipeline/draft-to-blog'

const minimalPatch = {
  content_json: null,
  content_html: null,
  content_mdx: null,
  content_compiled: null,
  content_toc: null,
  reading_time_min: null,
}

const baseInput = {
  pipelineItemId: 'item-1',
  targetStage: 'published' as const,
  scheduledFor: null,
  userId: 'user-1',
  siteId: 'site-1',
  vvsScore: 85,
}

function makePipelineItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    site_id: 'site-1',
    sections: { draft_pt: { content: '# hello', rev: 1 } },
    language: 'pt-br',
    category: 'stories',
    blog_post_id: 'post-existing',
    cover_image_url: null,
    ...overrides,
  }
}

describe('materializeBlogPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset queues
    for (const key of Object.keys(tableQueues)) delete tableQueues[key]
  })

  it('returns error when VVS score below threshold', async () => {
    const result = await materializeBlogPost({ ...baseInput, vvsScore: 60 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('VVS_BELOW_THRESHOLD')
  })

  it('returns error when VVS score at 79 (just below threshold)', async () => {
    const result = await materializeBlogPost({ ...baseInput, vvsScore: 79 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('VVS_BELOW_THRESHOLD')
  })

  it('does not fail with VVS error at exactly threshold (80)', async () => {
    enqueue('content_pipeline', makeChain({ data: null, error: { message: 'not found' } }))
    const result = await materializeBlogPost({ ...baseInput, vvsScore: 80 })
    if (!result.ok) expect(result.code).not.toBe('VVS_BELOW_THRESHOLD')
  })

  it('returns error when scheduled without date', async () => {
    const result = await materializeBlogPost({
      ...baseInput,
      targetStage: 'scheduled',
      scheduledFor: null,
      vvsScore: 85,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('SCHEDULE_DATE_REQUIRED')
  })

  it('returns error when pipeline item not found', async () => {
    enqueue('content_pipeline', makeChain({ data: null, error: { message: 'not found' } }))
    const result = await materializeBlogPost(baseInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ITEM_NOT_FOUND')
  })

  it('returns SITE_MISMATCH when pipeline item belongs to a different site', async () => {
    enqueue('content_pipeline', makeChain({ data: makePipelineItem({ site_id: 'other-site' }), error: null }))
    const result = await materializeBlogPost(baseInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('SITE_MISMATCH')
  })

  it('returns error when prepareBlogTranslationPatch returns null', async () => {
    enqueue('content_pipeline', makeChain({ data: makePipelineItem(), error: null }))
    vi.mocked(prepareBlogTranslationPatch).mockResolvedValueOnce(null)
    const result = await materializeBlogPost(baseInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('PATCH_FAILED')
  })

  it('allows publish without scheduledFor — existing blog_post_id path', async () => {
    enqueue('content_pipeline', makeChain({ data: makePipelineItem(), error: null }))
    vi.mocked(prepareBlogTranslationPatch).mockResolvedValueOnce(minimalPatch)

    // blog_posts update (existing post)
    enqueue('blog_posts', makeChain({ data: null, error: null }))
    // blog_translations upsert
    enqueue('blog_translations', makeChain({ data: null, error: null }))
    // content_pipeline stamp update
    enqueue('content_pipeline', makeChain({ data: null, error: null }))

    const result = await materializeBlogPost(baseInput)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.blogPostId).toBe('post-existing')
  })

  it('creates new blog post when blog_post_id is null', async () => {
    enqueue('content_pipeline', makeChain({ data: makePipelineItem({ blog_post_id: null }), error: null }))
    vi.mocked(prepareBlogTranslationPatch).mockResolvedValueOnce(minimalPatch)

    // blog_posts upsert → insert new → returns new id
    enqueue('blog_posts', makeChain({ data: { id: 'post-new' }, error: null }))
    // blog_translations upsert
    enqueue('blog_translations', makeChain({ data: null, error: null }))
    // content_pipeline stamp
    enqueue('content_pipeline', makeChain({ data: null, error: null }))

    const result = await materializeBlogPost(baseInput)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.blogPostId).toBe('post-new')
  })

  it('handles "both" language — produces two locales', async () => {
    enqueue(
      'content_pipeline',
      makeChain({
        data: makePipelineItem({
          language: 'both',
          sections: {
            draft_pt: { content: '# PT', rev: 1 },
            draft_en: { content: '# EN', rev: 1 },
          },
        }),
        error: null,
      }),
    )
    vi.mocked(prepareBlogTranslationPatch)
      .mockResolvedValueOnce(minimalPatch) // pt
      .mockResolvedValueOnce(minimalPatch) // en

    enqueue('blog_posts', makeChain({ data: null, error: null }))
    enqueue('blog_translations', makeChain({ data: null, error: null }))
    enqueue('blog_translations', makeChain({ data: null, error: null }))
    enqueue('content_pipeline', makeChain({ data: null, error: null }))

    const result = await materializeBlogPost(baseInput)
    expect(result.ok).toBe(true)
    expect(vi.mocked(prepareBlogTranslationPatch)).toHaveBeenCalledTimes(2)
  })

  it('returns error when final pipeline stamp update fails', async () => {
    enqueue('content_pipeline', makeChain({ data: makePipelineItem(), error: null }))
    vi.mocked(prepareBlogTranslationPatch).mockResolvedValueOnce(minimalPatch)

    // blog_posts update (existing post)
    enqueue('blog_posts', makeChain({ data: null, error: null }))
    // blog_translations upsert
    enqueue('blog_translations', makeChain({ data: null, error: null }))
    // content_pipeline stamp update — fails
    enqueue('content_pipeline', makeChain({ data: null, error: { message: 'DB connection lost' } }))

    const result = await materializeBlogPost(baseInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('PIPELINE_STAMP_FAILED')
  })

  it('handles scheduled stage with scheduledFor date', async () => {
    const scheduledFor = '2026-06-01T10:00:00.000Z'
    enqueue(
      'content_pipeline',
      makeChain({
        data: makePipelineItem({ language: 'en', sections: { draft_en: { content: '# EN', rev: 1 } } }),
        error: null,
      }),
    )
    vi.mocked(prepareBlogTranslationPatch).mockResolvedValueOnce(minimalPatch)
    enqueue('blog_posts', makeChain({ data: null, error: null }))
    enqueue('blog_translations', makeChain({ data: null, error: null }))
    enqueue('content_pipeline', makeChain({ data: null, error: null }))

    const result = await materializeBlogPost({
      ...baseInput,
      targetStage: 'scheduled',
      scheduledFor,
      locales: ['en'],
    })
    expect(result.ok).toBe(true)
  })
})
