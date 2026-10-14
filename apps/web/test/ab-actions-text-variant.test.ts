import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — declared before imports so vi.mock hoists correctly
// ---------------------------------------------------------------------------

vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }), requireSiteScope: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-metadata', () => ({ captureOriginalMetadata: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn(), del: vi.fn() }))

// These are imported by the actions file but not exercised in text-variant tests
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }),
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
import { put } from '@vercel/blob'
import { DESCRICAO_FORA_DO_TESTE } from '@/lib/youtube/ab-schemas'
import type { CreateTextVariantInput } from '@/lib/youtube/ab-types'
import { createTextVariant, updateTextVariant, uploadVariant } from '@/app/cms/(authed)/youtube/ab-lab/actions'

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
const chainsCriadas: Array<{ table: string; chain: Record<string, unknown> }> = []

const mockSupabase = {
  from: vi.fn((table: string) => {
    const result = callQueue[callIndex] ?? { data: null, error: null }
    callIndex++
    const chain = buildChain(result)
    chainsCriadas.push({ table, chain })
    return chain
  }),
}

/** Argumento do primeiro `.insert`/`.update` feito em `table`. */
function primeiraEscrita(table: string, metodo: 'insert' | 'update'): Record<string, unknown> | undefined {
  for (const c of chainsCriadas) {
    if (c.table !== table) continue
    const fn = c.chain[metodo] as ReturnType<typeof vi.fn>
    if (fn.mock.calls.length > 0) return fn.mock.calls[0]![0] as Record<string, unknown>
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  callQueue.length = 0
  callIndex = 0
  chainsCriadas.length = 0

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

  it('teste gravado como description: recusa com a mensagem do 422, sem inserir nada', async () => {
    enqueueResult({ data: { id: 'test-1', site_id: 'site-1', status: 'draft', test_type: 'description' } })

    const result = await createTextVariant({ test_id: 'test-1', title_text: 'x' })

    expect(result).toEqual({ ok: false, error: DESCRICAO_FORA_DO_TESTE.message })
    expect(primeiraEscrita('ab_test_variants', 'insert')).toBeUndefined()
  })

  it('description_text vindo por cast: a linha inserida não o leva e nenhum link é criado', async () => {
    enqueueResult({ data: { id: 'test-1', site_id: 'site-1', status: 'draft', test_type: 'title' } })
    enqueueResult({ count: 1 })
    enqueueResult({ data: { id: 'variant-new' } })

    const result = await createTextVariant({
      test_id: 'test-1',
      title_text: 'T',
      description_text: 'Veja {{link:newsletter}}',
    } as unknown as CreateTextVariantInput)

    expect(result).toEqual({ ok: true, id: 'variant-new' })
    const linha = primeiraEscrita('ab_test_variants', 'insert')!
    expect(linha).not.toHaveProperty('description_text')
    expect(linha.title_text).toBe('T')
    expect(primeiraEscrita('ab_test_tracked_links', 'insert')).toBeUndefined()
    expect(vi.mocked(ensureTrackedLink)).not.toHaveBeenCalled()
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

  it('description_text por cast: o update recebe só title_text e metadata', async () => {
    enqueueResult({ data: { id: 'variant-1', test_id: 'test-1' } })
    enqueueResult({ data: { status: 'draft', site_id: 'site-1' } })
    enqueueResult({ data: null, error: null })

    const result = await updateTextVariant('variant-1', {
      title_text: 'New Title',
      description_text: 'x',
    } as unknown as Parameters<typeof updateTextVariant>[1])

    expect(result).toEqual({ ok: true })
    const update = primeiraEscrita('ab_test_variants', 'update')!
    expect(Object.keys(update).sort()).toEqual(['metadata', 'title_text'])
    expect(update).not.toHaveProperty('description_text')
  })

  it('successfully updates title_text', async () => {
    // ab_test_variants select → variant found
    enqueueResult({ data: { id: 'variant-1', test_id: 'test-1' } })
    // ab_tests select → draft test
    enqueueResult({ data: { status: 'draft', site_id: 'site-1' } })
    // update variant → success
    enqueueResult({ data: null, error: null })

    const result = await updateTextVariant('variant-1', {
      title_text: 'New Title',
    })

    expect(result).toEqual({ ok: true })
  })
})

// ---------------------------------------------------------------------------
// uploadVariant — a descrição não entra mais na variante (P3, Tarefa 3)
// ---------------------------------------------------------------------------

describe('uploadVariant', () => {
  it('ignora description_text do FormData: o insert não leva a descrição', async () => {
    vi.mocked(put).mockResolvedValue({ url: 'https://blob/x.png', pathname: 'ab-test/test-1/B.png' } as never)
    enqueueResult({ data: { id: 'test-1', status: 'draft' } }) // ab_tests
    enqueueResult({ data: [] }) // variantes existentes
    enqueueResult({ data: { id: 'var-1' } }) // insert

    const fd = new FormData()
    fd.set('file', new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }))
    fd.set('title_text', 'Meu título')
    fd.set('description_text', 'descrição que não deve gravar')

    const result = await uploadVariant('test-1', fd)

    expect(result).toEqual({ ok: true, variantId: 'var-1' })
    const linha = primeiraEscrita('ab_test_variants', 'insert')
    expect(linha).toBeDefined()
    expect(linha!.title_text).toBe('Meu título')
    expect(linha).not.toHaveProperty('description_text')
  })
})
