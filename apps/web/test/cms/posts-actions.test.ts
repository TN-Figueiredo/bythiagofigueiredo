import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

const revalidatePathMock = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
  revalidateTag: vi.fn(),
}))

const revalidateBlogPostSeoMock = vi.fn()
vi.mock('@/lib/seo/cache-invalidation', () => ({
  revalidateBlogPostSeo: (...args: unknown[]) => revalidateBlogPostSeoMock(...args),
  revalidateCampaignSeo: vi.fn(),
  revalidateSiteBranding: vi.fn(),
}))

const ensureTrackedLinkMock = vi.fn().mockResolvedValue({ linkId: 'link-1', code: 'abc1234', isNew: true })
const deactivateSourceLinksMock = vi.fn().mockResolvedValue(0)
vi.mock('@/lib/links/auto-link', () => ({
  ensureTrackedLink: (...args: unknown[]) => ensureTrackedLinkMock(...args),
  deactivateSourceLinks: (...args: unknown[]) => deactivateSourceLinksMock(...args),
}))

vi.mock('@/lib/pipeline/blog-sync', () => ({
  syncPipelineOnPostStatusChange: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/social/create-from-content', () => ({
  createSocialPostFromContent: vi.fn().mockResolvedValue({ ok: true }),
}))

// Chainable Supabase mock builder
const updateMock = vi.fn()
const deleteMock = vi.fn()
const selectMock = vi.fn()
const insertMock = vi.fn()
const fromMock = vi.fn()

function makeChainResult(data: unknown, error: unknown = null) {
  return { data, error, count: Array.isArray(data) ? data.length : 0 }
}

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: fromMock }),
}))

import {
  bulkPublish,
  bulkArchive,
  bulkDelete,
  bulkChangeAuthor,
} from '../../src/app/cms/(authed)/blog/actions'

import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

// ── Helpers ──────────────────────────────────────────────────────────

function setupChain(opts: {
  updateResult?: { data: unknown; error: unknown };
  selectResult?: { data: unknown; error: unknown };
  deleteResult?: { data: unknown; error: unknown };
  maybeSingleResult?: { data: unknown; error: unknown };
}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.in = vi.fn().mockReturnThis()
  chain.eq = vi.fn().mockReturnThis()

  // update → returns chain with .in/.eq/.select
  const updateChain: Record<string, ReturnType<typeof vi.fn>> = {}
  updateChain.in = vi.fn().mockReturnThis()
  updateChain.eq = vi.fn().mockReturnThis()
  updateChain.select = vi.fn().mockResolvedValue(
    opts.updateResult ?? makeChainResult([]),
  )
  updateMock.mockReturnValue(updateChain)

  // select → returns chain with .in/.eq/.maybeSingle
  const selectChain: Record<string, ReturnType<typeof vi.fn>> = {}
  selectChain.in = vi.fn().mockReturnThis()
  selectChain.eq = vi.fn().mockReturnThis()
  selectChain.maybeSingle = vi.fn().mockResolvedValue(
    opts.maybeSingleResult ?? makeChainResult(null),
  )
  // Make selectChain itself thenable for awaiting (e.g., bulkDelete select)
  const selectTerminal = opts.selectResult ?? makeChainResult([])
  Object.assign(selectChain, selectTerminal)
  ;(selectChain as unknown as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
  ) => Promise.resolve(selectTerminal).then(resolve)
  selectMock.mockReturnValue(selectChain)

  // delete → returns chain with .in/.eq
  const deleteChain: Record<string, ReturnType<typeof vi.fn>> = {}
  deleteChain.in = vi.fn().mockReturnThis()
  deleteChain.eq = vi.fn().mockResolvedValue(
    opts.deleteResult ?? makeChainResult(null),
  )
  deleteMock.mockReturnValue(deleteChain)

  fromMock.mockReturnValue({
    update: updateMock,
    select: selectMock,
    delete: deleteMock,
    insert: insertMock,
  })
}

// ── Tests ────────────────────────────────────────────────────────────

describe('bulkPublish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureTrackedLinkMock.mockClear()
    deactivateSourceLinksMock.mockClear()
  })

  it('returns count 0 for empty postIds', async () => {
    const result = await bulkPublish([])
    expect(result).toEqual({ ok: true, count: 0 })
  })

  it('publishes posts and returns count', async () => {
    setupChain({
      updateResult: makeChainResult([
        { id: 'p1', blog_translations: [{ locale: 'pt-BR', slug: 'hello' }] },
        { id: 'p2', blog_translations: [{ locale: 'en', slug: 'world' }] },
      ]),
    })

    const result = await bulkPublish(['p1', 'p2'])
    expect(result).toEqual({ ok: true, count: 2 })
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p1', 'pt-BR', 'hello')
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p2', 'en', 'world')
    expect(revalidatePathMock).toHaveBeenCalledWith('/cms/blog')
  })

  it('returns error on DB failure', async () => {
    setupChain({
      updateResult: makeChainResult(null, { message: 'db-boom' }),
    })

    const result = await bulkPublish(['p1'])
    expect(result).toEqual({ ok: false, error: 'db-boom' })
  })

  it('throws when RBAC check fails (forbidden)', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({ ok: false, reason: 'forbidden' } as never)
    await expect(bulkPublish(['p1'])).rejects.toThrow(/forbidden/)
  })

  it('throws when user is unauthenticated', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({ ok: false, reason: 'unauthenticated' } as never)
    await expect(bulkPublish(['p1'])).rejects.toThrow(/unauthenticated/)
  })

  it('creates tracked links for each published post', async () => {
    setupChain({
      updateResult: makeChainResult([
        { id: 'p1', blog_translations: [{ locale: 'pt-BR', slug: 'hello' }] },
        { id: 'p2', blog_translations: [{ locale: 'en', slug: 'world' }] },
      ]),
    })

    await bulkPublish(['p1', 'p2'])
    await new Promise((r) => setTimeout(r, 0))

    expect(ensureTrackedLinkMock).toHaveBeenCalledTimes(2)
    expect(ensureTrackedLinkMock).toHaveBeenCalledWith(
      expect.anything(), 's1', 'p1', 'blog',
      expect.stringContaining('/pt-BR/blog/hello'), 'hello',
    )
    expect(ensureTrackedLinkMock).toHaveBeenCalledWith(
      expect.anything(), 's1', 'p2', 'blog',
      expect.stringContaining('/en/blog/world'), 'world',
    )
  })
})

describe('bulkArchive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureTrackedLinkMock.mockClear()
    deactivateSourceLinksMock.mockClear()
  })

  it('returns count 0 for empty postIds', async () => {
    const result = await bulkArchive([])
    expect(result).toEqual({ ok: true, count: 0 })
  })

  it('archives posts and returns count', async () => {
    setupChain({
      updateResult: makeChainResult([
        { id: 'p1', blog_translations: [{ locale: 'pt-BR', slug: 'hi' }] },
      ]),
    })

    const result = await bulkArchive(['p1'])
    expect(result).toEqual({ ok: true, count: 1 })
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p1', 'pt-BR', 'hi')
  })

  it('returns error on DB failure', async () => {
    setupChain({
      updateResult: makeChainResult(null, { message: 'db-fail' }),
    })

    const result = await bulkArchive(['p1'])
    expect(result).toEqual({ ok: false, error: 'db-fail' })
  })

  it('deactivates tracked links for each archived post', async () => {
    setupChain({
      updateResult: makeChainResult([
        { id: 'p1', blog_translations: [{ locale: 'pt-BR', slug: 'hi' }] },
      ]),
    })

    await bulkArchive(['p1'])
    await new Promise((r) => setTimeout(r, 0))

    expect(deactivateSourceLinksMock).toHaveBeenCalledTimes(1)
    expect(deactivateSourceLinksMock).toHaveBeenCalledWith(
      expect.anything(), 'p1', 'blog',
    )
  })
})

describe('bulkDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureTrackedLinkMock.mockClear()
    deactivateSourceLinksMock.mockClear()
  })

  it('returns count 0 for empty postIds', async () => {
    const result = await bulkDelete([])
    expect(result).toEqual({ ok: true, count: 0 })
  })

  it('deletes draft posts and returns count', async () => {
    setupChain({
      selectResult: makeChainResult([
        { id: 'p1', blog_translations: [{ locale: 'pt-BR', slug: 'bye' }] },
      ]),
      deleteResult: makeChainResult(null),
    })

    const result = await bulkDelete(['p1'])
    expect(result).toEqual({ ok: true, count: 1 })
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p1', 'pt-BR', 'bye')
  })

  it('returns count 0 when no posts match CAS filter', async () => {
    setupChain({
      selectResult: makeChainResult([]),
    })

    const result = await bulkDelete(['p1'])
    expect(result).toEqual({ ok: true, count: 0 })
  })

  it('returns error on fetch failure', async () => {
    setupChain({
      selectResult: makeChainResult(null, { message: 'fetch-err' }),
    })

    const result = await bulkDelete(['p1'])
    expect(result).toEqual({ ok: false, error: 'fetch-err' })
  })

  it('deactivates tracked links for each deleted post', async () => {
    setupChain({
      selectResult: makeChainResult([
        { id: 'p1', blog_translations: [{ locale: 'pt-BR', slug: 'bye' }] },
      ]),
      deleteResult: makeChainResult(null),
    })

    await bulkDelete(['p1'])
    await new Promise((r) => setTimeout(r, 0))

    expect(deactivateSourceLinksMock).toHaveBeenCalledTimes(1)
    expect(deactivateSourceLinksMock).toHaveBeenCalledWith(
      expect.anything(), 'p1', 'blog',
    )
  })
})

describe('bulkChangeAuthor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureTrackedLinkMock.mockClear()
    deactivateSourceLinksMock.mockClear()
  })

  it('returns count 0 for empty postIds', async () => {
    const result = await bulkChangeAuthor([], 'a1')
    expect(result).toEqual({ ok: true, count: 0 })
  })

  it('returns error when author_id is empty', async () => {
    const result = await bulkChangeAuthor(['p1'], '')
    expect(result).toEqual({ ok: false, error: 'author_id_required' })
  })

  it('returns error when author not found', async () => {
    setupChain({
      maybeSingleResult: makeChainResult(null, null),
    })

    const result = await bulkChangeAuthor(['p1'], 'bad-author')
    expect(result).toEqual({ ok: false, error: 'author_not_found' })
  })

  it('changes author and returns count', async () => {
    // Author lookup returns a valid author
    const authorLookup: Record<string, ReturnType<typeof vi.fn>> = {}
    authorLookup.eq = vi.fn().mockReturnThis()
    authorLookup.maybeSingle = vi.fn().mockResolvedValue(makeChainResult({ id: 'a1' }))

    // Update query returns the updated rows
    const updateChain: Record<string, ReturnType<typeof vi.fn>> = {}
    updateChain.in = vi.fn().mockReturnThis()
    updateChain.eq = vi.fn().mockReturnThis()
    updateChain.select = vi.fn().mockResolvedValue(makeChainResult([{ id: 'p1' }, { id: 'p2' }]))
    updateMock.mockReturnValue(updateChain)

    let callCount = 0
    fromMock.mockImplementation((table: string) => {
      if (table === 'authors') {
        return { select: vi.fn().mockReturnValue(authorLookup) }
      }
      callCount++
      return { update: updateMock }
    })

    const result = await bulkChangeAuthor(['p1', 'p2'], 'a1')
    expect(result).toEqual({ ok: true, count: 2 })
    expect(revalidatePathMock).toHaveBeenCalledWith('/cms/blog')
  })
})
