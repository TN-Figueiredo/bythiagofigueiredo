import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase service mock — fluent builder pattern
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown; error: unknown }

function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'in', 'ilike', 'limit', 'update', 'insert', 'single', 'maybeSingle']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  ;(chain as Record<string, unknown>).single = vi.fn(() => Promise.resolve(result))
  ;(chain as Record<string, unknown>).maybeSingle = vi.fn(() => Promise.resolve(result))
  ;(chain as Record<string, unknown>).insert = vi.fn(() => Promise.resolve(result))
  ;(chain as Record<string, unknown>).update = vi.fn(() => chain)
  return chain
}

// We control results per-table per-call using a queue.
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

import {
  getPipelineItemForPost,
  linkPostToItem,
  unlinkPostFromItem,
} from '@/lib/pipeline/blog-link'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  vi.clearAllMocks()
  for (const key of Object.keys(tableQueues)) {
    delete tableQueues[key]
  }
}

// ---------------------------------------------------------------------------
// getPipelineItemForPost
// ---------------------------------------------------------------------------

describe('getPipelineItemForPost', () => {
  beforeEach(resetMocks)

  it('returns null when no pipeline item is linked to the post', async () => {
    const chain = makeChain({ data: null, error: null })
    enqueue('content_pipeline', chain)

    const result = await getPipelineItemForPost('post-abc')

    expect(result).toBeNull()
    expect(mockSvc.from).toHaveBeenCalledWith('content_pipeline')
  })

  it('returns the linked pipeline item when one exists', async () => {
    const item = {
      id: 'pipe-1',
      code: 'VID-001',
      title_pt: 'Título em PT',
      title_en: 'Title in EN',
      stage: 'ready',
      format: 'video',
      priority: 2,
    }
    const chain = makeChain({ data: item, error: null })
    enqueue('content_pipeline', chain)

    const result = await getPipelineItemForPost('post-abc')

    expect(result).toEqual(item)
  })

  it('passes the postId as the blog_post_id filter', async () => {
    const chain = makeChain({ data: null, error: null })
    enqueue('content_pipeline', chain)

    await getPipelineItemForPost('post-xyz')

    expect(chain.eq as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('blog_post_id', 'post-xyz')
  })
})

// ---------------------------------------------------------------------------
// linkPostToItem
// ---------------------------------------------------------------------------

describe('linkPostToItem', () => {
  beforeEach(resetMocks)

  it('returns NOT_FOUND when pipeline item does not exist', async () => {
    const pipelineChain = makeChain({ data: null, error: { message: 'not found', code: 'PGRST116' } })
    enqueue('content_pipeline', pipelineChain)

    const result = await linkPostToItem('item-1', 'post-1', 'site-1', 'user-1')

    expect(result).toEqual({ ok: false, error: 'Pipeline item not found', code: 'NOT_FOUND' })
  })

  it('returns ALREADY_LINKED when item already has a blog_post_id', async () => {
    const pipelineChain = makeChain({
      data: { id: 'item-1', blog_post_id: 'existing-post', code: 'VID-001' },
      error: null,
    })
    enqueue('content_pipeline', pipelineChain)

    const result = await linkPostToItem('item-1', 'post-1', 'site-1', 'user-1')

    expect(result).toEqual({ ok: false, error: 'Item already linked to a blog post', code: 'ALREADY_LINKED' })
  })

  it('returns NOT_FOUND when blog post does not exist', async () => {
    const pipelineChain = makeChain({
      data: { id: 'item-1', blog_post_id: null, code: 'VID-001' },
      error: null,
    })
    enqueue('content_pipeline', pipelineChain)

    const postChain = makeChain({ data: null, error: { message: 'not found', code: 'PGRST116' } })
    enqueue('blog_posts', postChain)

    const result = await linkPostToItem('item-1', 'post-1', 'site-1', 'user-1')

    expect(result).toEqual({ ok: false, error: 'Blog post not found', code: 'NOT_FOUND' })
  })

  it('returns FORBIDDEN when blog post belongs to a different site', async () => {
    const pipelineChain = makeChain({
      data: { id: 'item-1', blog_post_id: null, code: 'VID-001' },
      error: null,
    })
    enqueue('content_pipeline', pipelineChain)

    const postChain = makeChain({
      data: { id: 'post-1', site_id: 'other-site', status: 'draft' },
      error: null,
    })
    enqueue('blog_posts', postChain)

    const result = await linkPostToItem('item-1', 'post-1', 'site-1', 'user-1')

    expect(result).toEqual({ ok: false, error: 'Blog post belongs to a different site', code: 'FORBIDDEN' })
  })

  it('returns ok:true and inserts history on successful link', async () => {
    const pipelineSelectChain = makeChain({
      data: { id: 'item-1', blog_post_id: null, code: 'VID-001' },
      error: null,
    })
    enqueue('content_pipeline', pipelineSelectChain)

    const postChain = makeChain({
      data: { id: 'post-1', site_id: 'site-1', status: 'draft' },
      error: null,
    })
    enqueue('blog_posts', postChain)

    // pipeline update chain — update().eq() resolves with no error
    const updateEqResult = Promise.resolve({ data: null, error: null })
    const updateEqChain = { eq: vi.fn(() => updateEqResult) }
    const pipelineUpdateChain = makeChain({ data: null, error: null })
    ;(pipelineUpdateChain as Record<string, unknown>).update = vi.fn(() => updateEqChain)
    enqueue('content_pipeline', pipelineUpdateChain)

    // history insert
    const historyChain = makeChain({ data: null, error: null })
    enqueue('content_pipeline_history', historyChain)

    const result = await linkPostToItem('item-1', 'post-1', 'site-1', 'user-1')

    expect(result).toEqual({ ok: true })
    expect(historyChain.insert as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline_id: 'item-1',
        event_type: 'linked',
        to_value: 'post-1',
        changed_by: 'user-1',
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// unlinkPostFromItem
// ---------------------------------------------------------------------------

describe('unlinkPostFromItem', () => {
  beforeEach(resetMocks)

  it('returns error when pipeline item is not found', async () => {
    const pipelineChain = makeChain({ data: null, error: { message: 'not found' } })
    enqueue('content_pipeline', pipelineChain)

    const result = await unlinkPostFromItem('item-1', 'site-1', 'user-1')

    expect(result).toEqual({ ok: false, error: 'Pipeline item not found' })
  })

  it('returns ok:true immediately when item has no blog_post_id', async () => {
    const pipelineChain = makeChain({
      data: { id: 'item-1', blog_post_id: null },
      error: null,
    })
    enqueue('content_pipeline', pipelineChain)

    const result = await unlinkPostFromItem('item-1', 'site-1', 'user-1')

    expect(result).toEqual({ ok: true })
    // No update or history insert should happen
    expect(mockSvc.from).toHaveBeenCalledTimes(1)
  })

  it('clears blog_post_id and inserts history on successful unlink', async () => {
    const pipelineSelectChain = makeChain({
      data: { id: 'item-1', blog_post_id: 'post-old' },
      error: null,
    })
    enqueue('content_pipeline', pipelineSelectChain)

    const updateEqResult = Promise.resolve({ data: null, error: null })
    const updateEqChain = { eq: vi.fn(() => updateEqResult) }
    const pipelineUpdateChain = makeChain({ data: null, error: null })
    ;(pipelineUpdateChain as Record<string, unknown>).update = vi.fn(() => updateEqChain)
    enqueue('content_pipeline', pipelineUpdateChain)

    const historyChain = makeChain({ data: null, error: null })
    enqueue('content_pipeline_history', historyChain)

    const result = await unlinkPostFromItem('item-1', 'site-1', 'user-1')

    expect(result).toEqual({ ok: true })
    expect(
      (pipelineUpdateChain as Record<string, unknown>).update as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledWith({ blog_post_id: null })
    expect(historyChain.insert as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline_id: 'item-1',
        event_type: 'unlinked',
        from_value: 'post-old',
        changed_by: 'user-1',
      }),
    )
  })
})
