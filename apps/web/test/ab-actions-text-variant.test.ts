import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — declared before imports so vi.mock hoists correctly
// ---------------------------------------------------------------------------

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }), requireSiteScope: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-metadata', () => ({ captureOriginalMetadata: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))

// These are imported by the actions file but not exercised in text-variant tests
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn(),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getVariantForCycle: vi.fn() }))
vi.mock('@/lib/youtube/ab-statistics', () => ({ calculateBayesianConfidence: vi.fn() }))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureTrackedLink } from '@/lib/links/auto-link'
import { createTextVariant, updateTextVariant } from '@/app/cms/(authed)/youtube/ab-lab/actions'

// ---------------------------------------------------------------------------
// Supabase chain mock helper
// ---------------------------------------------------------------------------

type ChainResult = { data?: unknown; error?: unknown; count?: number | null }

/**
 * Queue-based mock for Supabase that can return different results
 * for sequential calls to `.from()`.
 *
 * Each chain is a thenable — it can be awaited directly (returning
 * { data, error, count }) or chained further via fluent methods.
 */
const callQueue: ChainResult[] = []

function enqueueResult(result: ChainResult) {
  callQueue.push(result)
}

function buildChain(result: ChainResult): Record<string, unknown> {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  }

  const chain: Record<string, unknown> = {}

  // Make the chain thenable so `await supabase.from(...).select(...).eq(...)` resolves
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(resolved).then(resolve, reject)

  const fluentMethods = ['from', 'select', 'insert', 'update', 'delete', 'eq', 'in', 'not', 'is', 'limit', 'order']
  for (const m of fluentMethods) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve(resolved))
  chain.maybeSingle = vi.fn(() => Promise.resolve(resolved))

  return chain
}

let callIndex = 0

const mockSupabase = {
  from: vi.fn(() => {
    const result = callQueue[callIndex] ?? { data: null, error: null }
    callIndex++
    return buildChain(result)
  }),
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  callQueue.length = 0
  callIndex = 0

  // Default: auth passes
  vi.mocked(getSiteContext).mockResolvedValue({ siteId: 'site-1' } as never)
  vi.mocked(requireSiteScope).mockResolvedValue({ ok: true } as never)
  vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase as never)
})

// ---------------------------------------------------------------------------
// createTextVariant
// ---------------------------------------------------------------------------

describe('createTextVariant', () => {
  it('returns error when auth fails (forbidden)', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'forbidden' } as never)

    const result = await createTextVariant({ test_id: 'test-1', title_text: 'Hello' })

    expect(result).toEqual({ ok: false, error: 'forbidden' })
  })

  it('returns error when test is not found', async () => {
    // ab_tests select returns null
    enqueueResult({ data: null, error: { message: 'not found' } })

    const result = await createTextVariant({ test_id: 'test-missing', title_text: 'Title' })

    expect(result).toEqual({ ok: false, error: 'Test not found' })
  })

  it('returns error when test is not in draft status', async () => {
    // ab_tests select returns active test
    enqueueResult({ data: { id: 'test-1', site_id: 'site-1', status: 'active', test_type: 'title' } })

    const result = await createTextVariant({ test_id: 'test-1', title_text: 'New Title' })

    expect(result).toEqual({ ok: false, error: 'Can only add variants to draft tests' })
  })

  it('returns error when test_type is thumbnail (text not allowed)', async () => {
    enqueueResult({ data: { id: 'test-1', site_id: 'site-1', status: 'draft', test_type: 'thumbnail' } })

    const result = await createTextVariant({ test_id: 'test-1', title_text: 'Some Title' })

    expect(result).toEqual({ ok: false, error: 'Texto não pode ser adicionado a testes de thumbnail' })
  })

  it('returns error when variant count already at maximum (4)', async () => {
    // ab_tests select → draft test
    enqueueResult({ data: { id: 'test-1', site_id: 'site-1', status: 'draft', test_type: 'title' } })
    // count query → 4 existing variants
    enqueueResult({ count: 4 })

    const result = await createTextVariant({ test_id: 'test-1', title_text: 'Another' })

    expect(result).toEqual({ ok: false, error: 'Maximum 4 variants per test' })
  })

  it('successfully creates a text variant with title_text only', async () => {
    // ab_tests select → draft test
    enqueueResult({ data: { id: 'test-1', site_id: 'site-1', status: 'draft', test_type: 'title' } })
    // count query → 1 existing variant (original)
    enqueueResult({ count: 1 })
    // insert variant → success
    enqueueResult({ data: { id: 'variant-new' } })

    const result = await createTextVariant({ test_id: 'test-1', title_text: 'My New Title' })

    expect(result).toEqual({ ok: true, id: 'variant-new' })
    expect(vi.mocked(ensureTrackedLink)).not.toHaveBeenCalled()
  })

  it('creates tracked links for {{link:name}} templates in description', async () => {
    // ab_tests select → draft test
    enqueueResult({ data: { id: 'test-1', site_id: 'site-1', status: 'draft', test_type: 'description' } })
    // count query → 1 existing variant
    enqueueResult({ count: 1 })
    // insert variant → success
    enqueueResult({ data: { id: 'variant-new' } })
    // insert into ab_test_tracked_links (will be called via mockSupabase.from)
    enqueueResult({ data: null, error: null })

    vi.mocked(ensureTrackedLink).mockResolvedValue({
      linkId: 'link-123',
      code: 'AbCd789',
      isNew: true,
    })

    const result = await createTextVariant({
      test_id: 'test-1',
      description_text: 'Check out {{link:newsletter}} for more content',
    })

    expect(result).toEqual({ ok: true, id: 'variant-new' })
    expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledWith(
      mockSupabase,
      'site-1',
      'ab-test-1-variant-new-newsletter',
      'ab_test',
      'https://bythiagofigueiredo.com',
      expect.stringContaining('newsletter'),
    )
  })

  it('uses provided link_destinations map for tracked link URLs', async () => {
    // ab_tests select → draft test
    enqueueResult({ data: { id: 'test-1', site_id: 'site-1', status: 'draft', test_type: 'description' } })
    // count query → 1 existing variant
    enqueueResult({ count: 1 })
    // insert variant → success
    enqueueResult({ data: { id: 'variant-abc' } })
    // insert into ab_test_tracked_links
    enqueueResult({ data: null, error: null })

    vi.mocked(ensureTrackedLink).mockResolvedValue({
      linkId: 'link-456',
      code: 'XyZ123',
      isNew: true,
    })

    const result = await createTextVariant({
      test_id: 'test-1',
      description_text: 'Visit {{link:curso}}',
      link_destinations: { curso: 'https://curso.example.com/signup' },
    })

    expect(result).toEqual({ ok: true, id: 'variant-abc' })
    expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledWith(
      mockSupabase,
      'site-1',
      'ab-test-1-variant-abc-curso',
      'ab_test',
      'https://curso.example.com/signup',
      expect.stringContaining('curso'),
    )
  })
})

// ---------------------------------------------------------------------------
// updateTextVariant
// ---------------------------------------------------------------------------

describe('updateTextVariant', () => {
  it('returns error when variant not found', async () => {
    // ab_test_variants select → null
    enqueueResult({ data: null, error: { message: 'not found' } })

    const result = await updateTextVariant('variant-missing', { title_text: 'Updated' })

    expect(result).toEqual({ ok: false, error: 'Variant not found' })
  })

  it('returns error when parent test is not draft', async () => {
    // ab_test_variants select → variant found
    enqueueResult({ data: { id: 'variant-1', test_id: 'test-1' } })
    // ab_tests select → active test
    enqueueResult({ data: { status: 'active', site_id: 'site-1' } })

    const result = await updateTextVariant('variant-1', { title_text: 'Updated' })

    expect(result).toEqual({ ok: false, error: 'Can only edit variants of draft tests' })
  })

  it('successfully updates title_text and description_text', async () => {
    // ab_test_variants select → variant found
    enqueueResult({ data: { id: 'variant-1', test_id: 'test-1' } })
    // ab_tests select → draft test
    enqueueResult({ data: { status: 'draft', site_id: 'site-1' } })
    // update variant → success
    enqueueResult({ data: null, error: null })

    const result = await updateTextVariant('variant-1', {
      title_text: 'New Title',
      description_text: 'New Description',
    })

    expect(result).toEqual({ ok: true })
  })
})
