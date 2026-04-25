import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockLimit = vi.fn()
const mockIn = vi.fn()

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.eq = mockEq.mockReturnValue(chain)
  chain.in = mockIn.mockReturnValue(chain)
  chain.limit = mockLimit.mockResolvedValue({ data: [], error: null })
  chain.single = mockSingle.mockResolvedValue({
    data: { slug: 'test-site' },
    error: null,
  })
  chain.select = vi.fn().mockReturnValue(chain)
  chain.update = mockUpdate.mockReturnValue(chain)
  chain.insert = mockInsert.mockResolvedValue({ error: null })
  chain.delete = mockDelete.mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => void) => resolve({ error: null })
  return chain
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => makeChain()),
  })),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: 'site-1',
    orgId: 'org-1',
    defaultLocale: 'pt-BR',
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi
    .fn()
    .mockResolvedValue({ ok: true, user: { id: 'u1' } }),
}))

/* ------------------------------------------------------------------ */
/*  createAuthor                                                      */
/* ------------------------------------------------------------------ */

describe('createAuthor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty display_name', async () => {
    const { createAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await createAuthor({ display_name: '' })
    expect(result.ok).toBe(false)
  })

  it('rejects display_name over 200 chars', async () => {
    const { createAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await createAuthor({ display_name: 'a'.repeat(201) })
    expect(result.ok).toBe(false)
  })

  it('accepts valid input and returns ok', async () => {
    const { createAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await createAuthor({
      display_name: 'John Doe',
      bio: 'A writer',
    })
    expect(result.ok).toBe(true)
  })

  it('auto-generates slug from display_name', async () => {
    const { createAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    await createAuthor({ display_name: 'John Doe' })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'john-doe' }),
    )
  })

  it('accepts valid social_links', async () => {
    const { createAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await createAuthor({
      display_name: 'Author',
      social_links: { twitter: 'https://twitter.com/test' },
    })
    expect(result.ok).toBe(true)
  })

  it('rejects invalid social_links URLs', async () => {
    const { createAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await createAuthor({
      display_name: 'Author',
      social_links: { twitter: 'not-a-url' },
    })
    expect(result.ok).toBe(false)
  })

  it('accepts avatar_color hex', async () => {
    const { createAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await createAuthor({
      display_name: 'Author',
      avatar_color: '#ff6600',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects invalid avatar_color', async () => {
    const { createAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await createAuthor({
      display_name: 'Author',
      avatar_color: 'red',
    })
    expect(result.ok).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  updateAuthor                                                      */
/* ------------------------------------------------------------------ */

describe('updateAuthor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts partial update with display_name', async () => {
    const { updateAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await updateAuthor('author-1', {
      display_name: 'New Name',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects empty display_name on update', async () => {
    const { updateAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await updateAuthor('author-1', { display_name: '' })
    expect(result.ok).toBe(false)
  })

  it('accepts null bio', async () => {
    const { updateAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await updateAuthor('author-1', { bio: null })
    expect(result.ok).toBe(true)
  })

  it('accepts sort_order update', async () => {
    const { updateAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await updateAuthor('author-1', { sort_order: 5 })
    expect(result.ok).toBe(true)
  })

  it('rejects negative sort_order', async () => {
    const { updateAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await updateAuthor('author-1', { sort_order: -1 })
    expect(result.ok).toBe(false)
  })

  it('accepts null avatar_color', async () => {
    const { updateAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await updateAuthor('author-1', { avatar_color: null })
    expect(result.ok).toBe(true)
  })

  it('updates slug when display_name changes', async () => {
    const { updateAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    await updateAuthor('author-1', { display_name: 'Updated Name' })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'updated-name', name: 'Updated Name' }),
    )
  })
})

/* ------------------------------------------------------------------ */
/*  deleteAuthor                                                      */
/* ------------------------------------------------------------------ */

describe('deleteAuthor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok when no posts assigned', async () => {
    const { deleteAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await deleteAuthor('author-1')
    expect(result.ok).toBe(true)
  })

  it('returns error when author has posts', async () => {
    // Override limit to return posts
    mockLimit.mockResolvedValueOnce({
      data: [{ id: 'post-1' }],
      error: null,
    })
    const { deleteAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await deleteAuthor('author-1')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toMatch(
      /reassign/i,
    )
  })
})

/* ------------------------------------------------------------------ */
/*  setDefaultAuthor                                                  */
/* ------------------------------------------------------------------ */

describe('setDefaultAuthor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clears existing default and sets new one', async () => {
    const { setDefaultAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await setDefaultAuthor('author-1')
    expect(result.ok).toBe(true)
    // update called at least twice: clear old default + set new default
    expect(mockUpdate.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})

/* ------------------------------------------------------------------ */
/*  reorderAuthors                                                    */
/* ------------------------------------------------------------------ */

describe('reorderAuthors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates sort_order for each author in sequence', async () => {
    const { reorderAuthors } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await reorderAuthors(['a1', 'a2', 'a3'])
    expect(result.ok).toBe(true)
    // update called 3 times
    expect(mockUpdate.mock.calls.length).toBe(3)
  })
})

/* ------------------------------------------------------------------ */
/*  RBAC enforcement                                                  */
/* ------------------------------------------------------------------ */

describe('RBAC enforcement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws forbidden when requireSiteScope denies access', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { createAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    await expect(
      createAuthor({ display_name: 'Test' }),
    ).rejects.toThrow('forbidden')
  })

  it('throws unauthenticated when no session', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'unauthenticated',
    })
    const { deleteAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    await expect(deleteAuthor('author-1')).rejects.toThrow('unauthenticated')
  })
})
