import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase service mock — fluent builder pattern
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown; error: unknown }

// Each mock call returns itself to support chaining, ending in maybeSingle /
// insert which return the configured result.
function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'eq', 'order', 'limit', 'update', 'insert',
  ]
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  ;(chain as { maybeSingle: () => Promise<QueryResult> }).maybeSingle = vi.fn(
    () => Promise.resolve(result),
  )
  // insert / update resolve from the chain itself when awaited — we achieve
  // this by making the chain thenable when needed. Instead we keep it simpler:
  // override insert/update to return a resolved promise with the result.
  ;(chain as Record<string, unknown>).insert = vi.fn(() => Promise.resolve(result))
  ;(chain as Record<string, unknown>).update = vi.fn(() => chain)
  return chain
}

// We need separate chains per table call so we can assert on each one.
let pipelineSelectChain: ReturnType<typeof makeChain>
let pipelineUpdateChain: ReturnType<typeof makeChain>
let historySelectChain: ReturnType<typeof makeChain>
let historyInsertChain: ReturnType<typeof makeChain>

// Track which table is being accessed and in what order.
let fromCallIndex = 0

const mockSvc = {
  from: vi.fn((table: string) => {
    fromCallIndex++
    if (table === 'content_pipeline') {
      // First call → select, second call → update
      if (fromCallIndex === 1) return pipelineSelectChain
      return pipelineUpdateChain
    }
    if (table === 'content_pipeline_history') {
      // Third call in publish path → insert
      // Third call in unpublish path → select, fourth → insert
      if ((pipelineUpdateChain.update as ReturnType<typeof vi.fn>).mock.calls.length > 0) {
        // update was already called — this is the history insert
        return historyInsertChain
      }
      return historySelectChain
    }
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
  fromCallIndex = 0
  vi.clearAllMocks()

  pipelineSelectChain = makeChain({ data: null, error: null })
  pipelineUpdateChain = makeChain({ data: null, error: null })
  historySelectChain = makeChain({ data: null, error: null })
  historyInsertChain = makeChain({ data: null, error: null })
}

// Make pipelineSelectChain.maybeSingle return a pipeline item
function withLinkedItem(stage = 'ready', version = 1) {
  ;(pipelineSelectChain as Record<string, unknown>).maybeSingle = vi.fn(() =>
    Promise.resolve({ data: { id: 'pipe-1', stage, version }, error: null }),
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncPipelineOnPostStatusChange', () => {
  beforeEach(resetMocks)

  it('does nothing when no pipeline item is linked (only 1 DB call)', async () => {
    // maybeSingle returns null data — no item linked
    await syncPipelineOnPostStatusChange('post-1', 'published', 'draft')

    expect(mockSvc.from).toHaveBeenCalledTimes(1)
    expect(mockSvc.from).toHaveBeenCalledWith('content_pipeline')
  })

  it('advances pipeline item to published when post is published', async () => {
    withLinkedItem('ready', 3)

    // Make update chain's eq chain resolve successfully when awaited
    const eqChain = {
      eq: vi.fn().mockReturnThis(),
    }
    const updateResult = Promise.resolve({ data: null, error: null })
    ;(pipelineUpdateChain as Record<string, unknown>).update = vi.fn(() => eqChain)
    ;(eqChain as unknown as Record<string, unknown>).eq = vi.fn(() => ({
      eq: vi.fn(() => updateResult),
    }))

    // historyInsertChain insert should also resolve
    ;(historyInsertChain as Record<string, unknown>).insert = vi.fn(() =>
      Promise.resolve({ data: null, error: null }),
    )

    await syncPipelineOnPostStatusChange('post-1', 'published', 'draft')

    // Should have called from() for: select pipeline, update pipeline, insert history
    expect(mockSvc.from).toHaveBeenCalledWith('content_pipeline')
    expect(mockSvc.from).toHaveBeenCalledWith('content_pipeline_history')
    // update was called with stage: 'published' and incremented version
    expect(
      (pipelineUpdateChain as Record<string, unknown>).update as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledWith({ stage: 'published', version: 4 })
  })

  it('does not advance if pipeline item is already at published', async () => {
    withLinkedItem('published', 5)

    await syncPipelineOnPostStatusChange('post-1', 'published', 'draft')

    // Only the initial select call — no update, no history insert
    expect(mockSvc.from).toHaveBeenCalledTimes(1)
  })

  it('retreats pipeline item when post is unpublished', async () => {
    withLinkedItem('published', 7)

    // History select returns a previous stage
    ;(historySelectChain as Record<string, unknown>).maybeSingle = vi.fn(() =>
      Promise.resolve({ data: { from_value: 'review' }, error: null }),
    )

    const eqChain = {
      eq: vi.fn().mockReturnThis(),
    }
    const updateResult = Promise.resolve({ data: null, error: null })
    ;(pipelineUpdateChain as Record<string, unknown>).update = vi.fn(() => eqChain)
    ;(eqChain as unknown as Record<string, unknown>).eq = vi.fn(() => ({
      eq: vi.fn(() => updateResult),
    }))

    ;(historyInsertChain as Record<string, unknown>).insert = vi.fn(() =>
      Promise.resolve({ data: null, error: null }),
    )

    await syncPipelineOnPostStatusChange('post-1', 'draft', 'published')

    expect(
      (pipelineUpdateChain as Record<string, unknown>).update as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledWith({ stage: 'review', version: 8 })
  })

  it('retreats to "ready" when no history entry found', async () => {
    withLinkedItem('published', 2)

    // History select returns no data
    ;(historySelectChain as Record<string, unknown>).maybeSingle = vi.fn(() =>
      Promise.resolve({ data: null, error: null }),
    )

    const eqChain = {
      eq: vi.fn().mockReturnThis(),
    }
    const updateResult = Promise.resolve({ data: null, error: null })
    ;(pipelineUpdateChain as Record<string, unknown>).update = vi.fn(() => eqChain)
    ;(eqChain as unknown as Record<string, unknown>).eq = vi.fn(() => ({
      eq: vi.fn(() => updateResult),
    }))

    ;(historyInsertChain as Record<string, unknown>).insert = vi.fn(() =>
      Promise.resolve({ data: null, error: null }),
    )

    await syncPipelineOnPostStatusChange('post-1', 'draft', 'published')

    expect(
      (pipelineUpdateChain as Record<string, unknown>).update as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledWith({ stage: 'ready', version: 3 })
  })
})
