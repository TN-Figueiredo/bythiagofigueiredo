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
  chain.single = vi.fn(() => Promise.resolve(result))
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  chain.update = vi.fn(() => chain)
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

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: 'site-1', timezone: 'America/Sao_Paulo' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: () => ({ ok: true }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { advancePipelineItem } from '@/app/cms/(authed)/pipeline/actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  vi.clearAllMocks()
  for (const key of Object.keys(tableQueues)) {
    delete tableQueues[key]
  }
}

/** Build a mock pipeline item for the select query */
function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    format: 'blog_post',
    stage: 'draft',
    version: 1,
    language: 'both',
    sections: null as Record<string, unknown> | null,
    social_config: null,
    social_post_id: null,
    title_pt: 'Título em português',
    title_en: 'Title in English',
    ...overrides,
  }
}

/**
 * Build an update chain that handles the full pattern:
 * .from().update().eq().eq().eq().select().single()
 */
function makeUpdateChain(result: QueryResult) {
  const terminal = { single: vi.fn(() => Promise.resolve(result)) }
  const selectStep = { select: vi.fn(() => terminal) }
  const eq3 = { eq: vi.fn(() => selectStep) }
  const eq2 = { eq: vi.fn(() => eq3) }
  const eq1: Record<string, unknown> = { eq: vi.fn(() => eq2) }
  const chain = makeChain({ data: null, error: null })
  chain.update = vi.fn(() => eq1)
  return { chain, updateFn: chain.update as ReturnType<typeof vi.fn> }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('advancePipelineItem — locale gate', () => {
  beforeEach(resetMocks)

  it('blocks bilingual item advancing to ready without EN content', async () => {
    const item = makeItem({
      stage: 'draft',
      language: 'both',
      title_pt: 'Título PT',
      title_en: 'Title EN',
      sections: { draft_pt: { content: 'conteúdo PT' } },
    })
    enqueue('content_pipeline', makeChain({ data: item, error: null }))

    const result = await advancePipelineItem('item-1', 1)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('EN')
    }
  })

  it('blocks bilingual item advancing to ready without PT content', async () => {
    const item = makeItem({
      stage: 'draft',
      language: 'both',
      title_pt: 'Título PT',
      title_en: 'Title EN',
      sections: { draft_en: { content: 'content EN' } },
    })
    enqueue('content_pipeline', makeChain({ data: item, error: null }))

    const result = await advancePipelineItem('item-1', 1)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('PT')
    }
  })

  it('allows bilingual item advancing to ready with both locales', async () => {
    const item = makeItem({
      stage: 'draft',
      language: 'both',
      title_pt: 'Título PT',
      title_en: 'Title EN',
      sections: {
        draft_pt: { content: 'conteúdo PT' },
        draft_en: { content: 'content EN' },
      },
    })
    enqueue('content_pipeline', makeChain({ data: item, error: null }))

    const updatedItem = { ...item, stage: 'ready', version: 2 }
    const { chain: updateChain } = makeUpdateChain({ data: updatedItem, error: null })
    enqueue('content_pipeline', updateChain)

    const result = await advancePipelineItem('item-1', 1)

    expect(result.ok).toBe(true)
  })

  it('allows single-locale item advancing without the other locale', async () => {
    const item = makeItem({
      stage: 'draft',
      language: 'pt-br',
      title_pt: 'Título PT',
      title_en: null,
      sections: { draft_pt: { content: 'conteúdo PT' } },
    })
    enqueue('content_pipeline', makeChain({ data: item, error: null }))

    const updatedItem = { ...item, stage: 'ready', version: 2 }
    const { chain: updateChain } = makeUpdateChain({ data: updatedItem, error: null })
    enqueue('content_pipeline', updateChain)

    const result = await advancePipelineItem('item-1', 1)

    expect(result.ok).toBe(true)
  })

  it('allows bilingual item advancing from idea to draft without locale check', async () => {
    const item = makeItem({
      stage: 'idea',
      language: 'both',
      title_pt: null,
      title_en: null,
      sections: null,
    })
    enqueue('content_pipeline', makeChain({ data: item, error: null }))

    const updatedItem = { ...item, stage: 'draft', version: 2 }
    const { chain: updateChain } = makeUpdateChain({ data: updatedItem, error: null })
    enqueue('content_pipeline', updateChain)

    const result = await advancePipelineItem('item-1', 1)

    expect(result.ok).toBe(true)
  })

  it('blocks bilingual item without title_en advancing to ready', async () => {
    const item = makeItem({
      stage: 'draft',
      language: 'both',
      title_pt: 'Título PT',
      title_en: null,
      sections: {
        draft_pt: { content: 'conteúdo PT' },
        draft_en: { content: 'content EN' },
      },
    })
    enqueue('content_pipeline', makeChain({ data: item, error: null }))

    const result = await advancePipelineItem('item-1', 1)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('EN')
    }
  })
})
