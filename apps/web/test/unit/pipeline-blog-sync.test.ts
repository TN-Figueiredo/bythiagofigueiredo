import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase service mock — queue-based fluent builder
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown; error: unknown }

function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'order', 'limit', 'update', 'insert']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  ;(chain as Record<string, unknown>).maybeSingle = vi.fn(() => Promise.resolve(result))
  ;(chain as Record<string, unknown>).insert = vi.fn(() => Promise.resolve(result))
  ;(chain as Record<string, unknown>).update = vi.fn(() => chain)
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

import { syncPipelineOnPostStatusChange } from '@/lib/pipeline/blog-sync'

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
// Tests
// ---------------------------------------------------------------------------

describe('syncPipelineOnPostStatusChange', () => {
  beforeEach(resetMocks)

  it('does nothing when no pipeline item is linked (only 1 DB call)', async () => {
    enqueue('content_pipeline', makeChain({ data: null, error: null }))

    await syncPipelineOnPostStatusChange('post-1', 'published', 'draft')

    expect(mockSvc.from).toHaveBeenCalledTimes(1)
    expect(mockSvc.from).toHaveBeenCalledWith('content_pipeline')
  })

  it('advances pipeline item to published when post is published', async () => {
    // 1) select pipeline item
    enqueue('content_pipeline', makeChain({
      data: { id: 'pipe-1', stage: 'ready', version: 3, format: 'blog_post' },
      error: null,
    }))

    // 2) update pipeline item — .update().eq().eq() resolves as thenable
    const updateEqResult = Promise.resolve({ data: null, error: null })
    const updateEq2: Record<string, unknown> = {}
    updateEq2.eq = vi.fn(() => updateEqResult)
    const updateEq1: Record<string, unknown> = {}
    updateEq1.eq = vi.fn(() => updateEq2)
    const pipelineUpdateChain = makeChain({ data: null, error: null })
    ;(pipelineUpdateChain as Record<string, unknown>).update = vi.fn(() => updateEq1)
    enqueue('content_pipeline', pipelineUpdateChain)

    // 3) history insert — .insert().then()
    const historyChain = makeChain({ data: null, error: null })
    enqueue('content_pipeline_history', historyChain)

    await syncPipelineOnPostStatusChange('post-1', 'published', 'draft')

    expect(mockSvc.from).toHaveBeenCalledWith('content_pipeline')
    expect(mockSvc.from).toHaveBeenCalledWith('content_pipeline_history')
    expect(
      (pipelineUpdateChain as Record<string, unknown>).update as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledWith({ stage: 'published', version: 4 })
  })

  it('does not advance if pipeline item is already at published', async () => {
    enqueue('content_pipeline', makeChain({
      data: { id: 'pipe-1', stage: 'published', version: 5, format: 'blog_post' },
      error: null,
    }))

    await syncPipelineOnPostStatusChange('post-1', 'published', 'draft')

    expect(mockSvc.from).toHaveBeenCalledTimes(1)
  })

  it('retreats pipeline item when post is unpublished', async () => {
    // 1) select pipeline item
    enqueue('content_pipeline', makeChain({
      data: { id: 'pipe-1', stage: 'published', version: 7, format: 'blog_post' },
      error: null,
    }))

    // 2) history select — returns previous stage
    const historySelectChain = makeChain({ data: { from_value: 'review' }, error: null })
    enqueue('content_pipeline_history', historySelectChain)

    // 3) update pipeline item
    const updateEqResult = Promise.resolve({ data: null, error: null })
    const updateEq2: Record<string, unknown> = {}
    updateEq2.eq = vi.fn(() => updateEqResult)
    const updateEq1: Record<string, unknown> = {}
    updateEq1.eq = vi.fn(() => updateEq2)
    const pipelineUpdateChain = makeChain({ data: null, error: null })
    ;(pipelineUpdateChain as Record<string, unknown>).update = vi.fn(() => updateEq1)
    enqueue('content_pipeline', pipelineUpdateChain)

    // 4) history insert
    const historyInsertChain = makeChain({ data: null, error: null })
    enqueue('content_pipeline_history', historyInsertChain)

    await syncPipelineOnPostStatusChange('post-1', 'draft', 'published')

    expect(
      (pipelineUpdateChain as Record<string, unknown>).update as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledWith({ stage: 'review', version: 8 })
  })

  it('retreats to "ready" when no history entry found', async () => {
    // 1) select pipeline item
    enqueue('content_pipeline', makeChain({
      data: { id: 'pipe-1', stage: 'published', version: 2, format: 'blog_post' },
      error: null,
    }))

    // 2) history select — no data
    enqueue('content_pipeline_history', makeChain({ data: null, error: null }))

    // 3) update pipeline item
    const updateEqResult = Promise.resolve({ data: null, error: null })
    const updateEq2: Record<string, unknown> = {}
    updateEq2.eq = vi.fn(() => updateEqResult)
    const updateEq1: Record<string, unknown> = {}
    updateEq1.eq = vi.fn(() => updateEq2)
    const pipelineUpdateChain = makeChain({ data: null, error: null })
    ;(pipelineUpdateChain as Record<string, unknown>).update = vi.fn(() => updateEq1)
    enqueue('content_pipeline', pipelineUpdateChain)

    // 4) history insert
    enqueue('content_pipeline_history', makeChain({ data: null, error: null }))

    await syncPipelineOnPostStatusChange('post-1', 'draft', 'published')

    expect(
      (pipelineUpdateChain as Record<string, unknown>).update as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledWith({ stage: 'ready', version: 3 })
  })
})
