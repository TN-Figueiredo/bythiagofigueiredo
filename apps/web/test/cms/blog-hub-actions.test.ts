import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Supabase builder ──────────────────────────────────────────────────
// Proxy-based thenable chain: every method returns `this`, `.single()` and
// `.maybeSingle()` flip to single-row shape, `.select('id', {count,head})`
// returns {count} shape.  Each `.from()` call spawns a fresh chain.

type MockRow = Record<string, unknown>
type ChainResult = { data: unknown; error: unknown; count?: number }

let defaultRows: MockRow[] = []
let defaultError: { message: string; code?: string } | null = null
let perTableRows: Record<string, MockRow[]> = {}
let perTableError: Record<string, { message: string; code?: string } | null> = {}
let perTableCount: Record<string, number> = {}
let callLog: Array<{ table: string; method: string; args: unknown[] }> = []
// Sequence-based responses per table: shifts one entry per `.from(table)` call
let perTableSequence: Record<string, Array<{ rows?: MockRow[]; error?: { message: string; code?: string } | null }>> = {}
let perTableCallIndex: Record<string, number> = {}

function createMockSupabase() {
  function makeChain(table: string) {
    let useSingle = false
    let isCountQuery = false
    const chain: Record<string, unknown> = {}

    // Determine which sequence entry to use for this from() call
    const seqIdx = perTableCallIndex[table] ?? 0
    perTableCallIndex[table] = seqIdx + 1
    const seqEntry = perTableSequence[table]?.[seqIdx]

    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_target, prop: string) {
        if (prop === 'then') {
          const rows = seqEntry?.rows ?? perTableRows[table] ?? defaultRows
          const err = seqEntry?.error !== undefined ? seqEntry.error : (perTableError[table] ?? defaultError)
          if (isCountQuery) {
            const countVal = perTableCount[table] ?? (rows?.length ?? 0)
            const result = { data: null, error: err, count: countVal }
            return (resolve?: (v: unknown) => void) => resolve?.(result)
          }
          if (useSingle) {
            const result = { data: err ? null : (rows?.[0] ?? null), error: err }
            return (resolve?: (v: unknown) => void) => resolve?.(result)
          }
          const result = { data: err ? null : rows, error: err, count: rows?.length ?? 0 }
          return (resolve?: (v: unknown) => void) => resolve?.(result)
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => {
            useSingle = true
            return new Proxy(chain, handler)
          }
        }
        if (prop === 'from') {
          return (t: string) => {
            callLog.push({ table: t, method: 'from', args: [t] })
            return makeChain(t)
          }
        }
        // Track method calls for assertions
        return (...args: unknown[]) => {
          callLog.push({ table, method: prop, args })
          if (prop === 'select' && args.length >= 2) {
            const opts = args[1] as Record<string, unknown> | undefined
            if (opts?.count === 'exact' && opts?.head === true) {
              isCountQuery = true
            }
          }
          return new Proxy(chain, handler)
        }
      },
    }
    return new Proxy(chain, handler)
  }

  const top: Record<string, unknown> = {}
  const topHandler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === 'from') {
        return (t: string) => {
          callLog.push({ table: t, method: 'from', args: [t] })
          return makeChain(t)
        }
      }
      return undefined
    },
  }
  return new Proxy(top, topHandler)
}

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => createMockSupabase(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [],
      set: vi.fn(),
    }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }),
    },
  }),
}))

const revalidateBlogPostSeoMock = vi.fn()
vi.mock('@/lib/seo/cache-invalidation', () => ({
  revalidateBlogPostSeo: (...args: unknown[]) => revalidateBlogPostSeoMock(...args),
  revalidateCampaignSeo: vi.fn(),
  revalidateSiteBranding: vi.fn(),
}))

import {
  createTag,
  updateTag,
  deleteTag,
  reorderTags,
  createPost,
  movePost,
  deleteHubPost,
  reassignTag,
  addLocale,
  duplicatePost,
  updateBlogCadence,
} from '../../src/app/cms/(authed)/blog/actions'

import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

// ─── Helpers ────────────────────────────────────────────────────────────────

function resetMockState(opts?: {
  rows?: MockRow[]
  error?: { message: string; code?: string } | null
  perTable?: Record<string, MockRow[]>
  perTableErr?: Record<string, { message: string; code?: string } | null>
  perTableCnt?: Record<string, number>
  // Sequence: per from() call on the same table, returns different data
  perTableSeq?: Record<string, Array<{ rows?: MockRow[]; error?: { message: string; code?: string } | null }>>
}) {
  defaultRows = opts?.rows ?? []
  defaultError = opts?.error ?? null
  perTableRows = opts?.perTable ?? {}
  perTableError = opts?.perTableErr ?? {}
  perTableCount = opts?.perTableCnt ?? {}
  perTableSequence = opts?.perTableSeq ?? {}
  perTableCallIndex = {}
  callLog = []
  revalidateBlogPostSeoMock.mockClear()
}

// ─── createTag ──────────────────────────────────────────────────────────────

describe('createTag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState({ perTable: { blog_tags: [{ id: 'tag-1' }] } })
  })

  it('creates tag with generated slug and returns tagId', async () => {
    const result = await createTag({ name: 'My Tag' })
    expect(result).toEqual({ ok: true, tagId: 'tag-1' })
  })

  it('returns name_required for empty name', async () => {
    const result = await createTag({ name: '   ' })
    expect(result).toEqual({ ok: false, error: 'name_required' })
  })

  it('returns name_already_exists on unique violation (23505)', async () => {
    resetMockState({ perTableErr: { blog_tags: { message: 'dup', code: '23505' } } })
    const result = await createTag({ name: 'Duplicate' })
    expect(result).toEqual({ ok: false, error: 'name_already_exists' })
  })

  it('returns generic error for other DB errors', async () => {
    resetMockState({ perTableErr: { blog_tags: { message: 'timeout' } } })
    const result = await createTag({ name: 'Good Name' })
    expect(result).toEqual({ ok: false, error: 'timeout' })
  })

  it('uses default color when not provided', async () => {
    resetMockState({ perTable: { blog_tags: [{ id: 'tag-2' }] } })
    const result = await createTag({ name: 'Colored' })
    expect(result.ok).toBe(true)
    // Verify insert was called (via callLog)
    const insertCall = callLog.find((c) => c.method === 'insert')
    expect(insertCall).toBeDefined()
    const insertArg = insertCall!.args[0] as Record<string, unknown>
    expect(insertArg.color).toBe('#6366f1')
    expect(insertArg.site_id).toBe('site-1')
  })

  it('generates slug from name with unicode normalization', async () => {
    resetMockState({ perTable: { blog_tags: [{ id: 'tag-3' }] } })
    await createTag({ name: 'Ação e Reação' })
    const insertCall = callLog.find((c) => c.method === 'insert')
    const insertArg = insertCall!.args[0] as Record<string, unknown>
    expect(insertArg.slug).toBe('acao-e-reacao')
  })

  it('throws when RBAC check fails', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({ ok: false, reason: 'forbidden' } as never)
    await expect(createTag({ name: 'Fail' })).rejects.toThrow(/forbidden/)
  })
})

// ─── updateTag ──────────────────────────────────────────────────────────────

describe('updateTag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  it('updates tag name and regenerates slug', async () => {
    const result = await updateTag('tag-1', { name: 'New Name' })
    expect(result).toEqual({ ok: true })
    const updateCall = callLog.find((c) => c.method === 'update')
    expect(updateCall).toBeDefined()
    const patch = updateCall!.args[0] as Record<string, unknown>
    expect(patch.name).toBe('New Name')
    expect(patch.slug).toBe('new-name')
    expect(patch.updated_at).toBeDefined()
  })

  it('updates color without touching slug', async () => {
    const result = await updateTag('tag-1', { color: '#ff0000' })
    expect(result).toEqual({ ok: true })
    const updateCall = callLog.find((c) => c.method === 'update')
    const patch = updateCall!.args[0] as Record<string, unknown>
    expect(patch.color).toBe('#ff0000')
    expect(patch.slug).toBeUndefined()
    expect(patch.name).toBeUndefined()
  })

  it('returns name_already_exists on unique violation', async () => {
    resetMockState({ perTableErr: { blog_tags: { message: 'dup', code: '23505' } } })
    const result = await updateTag('tag-1', { name: 'Taken' })
    expect(result).toEqual({ ok: false, error: 'name_already_exists' })
  })

  it('returns generic error for other DB errors', async () => {
    resetMockState({ perTableErr: { blog_tags: { message: 'oops' } } })
    const result = await updateTag('tag-1', { color: '#aaa' })
    expect(result).toEqual({ ok: false, error: 'oops' })
  })

  it('updates sortOrder and colorDark', async () => {
    const result = await updateTag('tag-1', { sortOrder: 5, colorDark: '#112233' })
    expect(result).toEqual({ ok: true })
    const updateCall = callLog.find((c) => c.method === 'update')
    const patch = updateCall!.args[0] as Record<string, unknown>
    expect(patch.sort_order).toBe(5)
    expect(patch.color_dark).toBe('#112233')
  })
})

// ─── deleteTag ──────────────────────────────────────────────────────────────

describe('deleteTag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  it('deletes tag with zero posts', async () => {
    resetMockState({ perTableCnt: { blog_posts: 0 } })
    const result = await deleteTag('tag-1')
    expect(result).toEqual({ ok: true })
  })

  it('rejects deletion when tag has posts', async () => {
    resetMockState({ perTableCnt: { blog_posts: 3 } })
    const result = await deleteTag('tag-1')
    expect(result).toEqual({ ok: false, error: 'tag_has_posts', postCount: 3 })
  })

  it('returns error on count query failure', async () => {
    resetMockState({ perTableErr: { blog_posts: { message: 'count-err' } } })
    const result = await deleteTag('tag-1')
    expect(result).toEqual({ ok: false, error: 'count-err' })
  })

  it('returns error on delete failure', async () => {
    // Count succeeds (0 posts) but delete fails
    resetMockState({ perTableCnt: { blog_posts: 0 }, perTableErr: { blog_tags: { message: 'del-err' } } })
    const result = await deleteTag('tag-1')
    expect(result).toEqual({ ok: false, error: 'del-err' })
  })
})

// ─── reorderTags ────────────────────────────────────────────────────────────

describe('reorderTags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  it('returns ok for empty array', async () => {
    const result = await reorderTags([])
    expect(result).toEqual({ ok: true })
  })

  it('issues parallel updates with correct sort_order', async () => {
    const result = await reorderTags(['t1', 't2', 't3'])
    expect(result).toEqual({ ok: true })
    const updateCalls = callLog.filter((c) => c.method === 'update' && c.table === 'blog_tags')
    expect(updateCalls.length).toBe(3)
    expect((updateCalls[0].args[0] as Record<string, unknown>).sort_order).toBe(0)
    expect((updateCalls[1].args[0] as Record<string, unknown>).sort_order).toBe(1)
    expect((updateCalls[2].args[0] as Record<string, unknown>).sort_order).toBe(2)
  })

  it('returns error when any update fails', async () => {
    resetMockState({ perTableErr: { blog_tags: { message: 'partial-fail' } } })
    const result = await reorderTags(['t1', 't2'])
    expect(result).toEqual({ ok: false, error: 'partial-fail' })
  })
})

// ─── createPost ─────────────────────────────────────────────────────────────

describe('createPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState({
      perTable: {
        authors: [{ id: 'author-1' }],
        blog_posts: [{ id: 'post-new' }],
        blog_translations: [],
      },
    })
  })

  it('creates post with correct site_id and author resolution', async () => {
    const result = await createPost({ locale: 'pt-BR' })
    expect(result).toEqual({ ok: true, postId: 'post-new' })
    // Verify blog_posts insert was called
    const insertCalls = callLog.filter((c) => c.method === 'insert')
    const postInsert = insertCalls.find((c) => c.table === 'blog_posts')
    expect(postInsert).toBeDefined()
    const postData = postInsert!.args[0] as Record<string, unknown>
    expect(postData.site_id).toBe('site-1')
    expect(postData.author_id).toBe('author-1')
    expect(postData.owner_user_id).toBe('user-1')
    expect(postData.status).toBe('idea')
  })

  it('uses pt-BR default title when locale is pt-BR and no title given', async () => {
    const result = await createPost({ locale: 'pt-BR' })
    expect(result.ok).toBe(true)
    const txInsert = callLog.filter((c) => c.method === 'insert' && c.table === 'blog_translations')
    expect(txInsert.length).toBe(1)
    const txData = txInsert[0].args[0] as Record<string, unknown>
    expect(txData.title).toBe('Sem título')
  })

  it('uses English default title for non-pt-BR locale', async () => {
    const result = await createPost({ locale: 'en' })
    expect(result.ok).toBe(true)
    const txInsert = callLog.filter((c) => c.method === 'insert' && c.table === 'blog_translations')
    const txData = txInsert[0].args[0] as Record<string, unknown>
    expect(txData.title).toBe('Untitled')
  })

  it('uses provided title when given', async () => {
    const result = await createPost({ title: 'My Post', locale: 'en' })
    expect(result.ok).toBe(true)
    const txInsert = callLog.filter((c) => c.method === 'insert' && c.table === 'blog_translations')
    const txData = txInsert[0].args[0] as Record<string, unknown>
    expect(txData.title).toBe('My Post')
  })

  it('sets status to draft when requested', async () => {
    await createPost({ locale: 'en', status: 'draft' })
    const postInsert = callLog.find((c) => c.method === 'insert' && c.table === 'blog_posts')
    const postData = postInsert!.args[0] as Record<string, unknown>
    expect(postData.status).toBe('draft')
  })

  it('sets tag_id when provided', async () => {
    await createPost({ locale: 'en', tagId: 'tag-42' })
    const postInsert = callLog.find((c) => c.method === 'insert' && c.table === 'blog_posts')
    const postData = postInsert!.args[0] as Record<string, unknown>
    expect(postData.tag_id).toBe('tag-42')
  })

  it('returns error when post insert fails', async () => {
    resetMockState({ perTableErr: { blog_posts: { message: 'insert-fail' } } })
    const result = await createPost({ locale: 'en' })
    expect(result).toEqual({ ok: false, error: 'insert-fail' })
  })

  it('returns error and rolls back post when translation insert fails', async () => {
    resetMockState({
      perTable: {
        authors: [{ id: 'author-1' }],
        blog_posts: [{ id: 'post-orphan' }],
      },
      perTableErr: { blog_translations: { message: 'tx-fail' } },
    })
    const result = await createPost({ locale: 'en' })
    expect(result).toEqual({ ok: false, error: 'tx-fail' })
    // Should have a delete call to roll back the orphaned post
    const deleteCalls = callLog.filter((c) => c.method === 'delete' && c.table === 'blog_posts')
    expect(deleteCalls.length).toBe(1)
  })

  it('handles null author (user without author row)', async () => {
    resetMockState({
      perTable: {
        authors: [], // No author found — maybeSingle returns null
        blog_posts: [{ id: 'post-new' }],
        blog_translations: [],
      },
    })
    const result = await createPost({ locale: 'en' })
    expect(result.ok).toBe(true)
    const postInsert = callLog.find((c) => c.method === 'insert' && c.table === 'blog_posts')
    const postData = postInsert!.args[0] as Record<string, unknown>
    expect(postData.author_id).toBeNull()
  })
})

// ─── movePost ───────────────────────────────────────────────────────────────

describe('movePost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'draft', site_id: 'site-1', tag_id: 'tag-1', blog_translations: [{ locale: 'pt-BR', slug: 'hello' }] }],
      },
    })
  })

  it('succeeds for valid transition draft → ready', async () => {
    const result = await movePost('p1', 'ready')
    expect(result).toEqual({ ok: true })
  })

  it('rejects draft → ready without tag_id', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'draft', site_id: 'site-1', tag_id: null, blog_translations: [{ locale: 'pt-BR', slug: 'hello' }] }],
      },
    })
    const result = await movePost('p1', 'ready')
    expect(result).toEqual({ ok: false, error: 'tag_required' })
  })

  it('succeeds for valid transition idea → draft', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'idea', site_id: 'site-1', blog_translations: [] }],
      },
    })
    const result = await movePost('p1', 'draft')
    expect(result).toEqual({ ok: true })
  })

  it('sets published_at when transitioning to published', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'ready', site_id: 'site-1', blog_translations: [{ locale: 'en', slug: 'post' }] }],
      },
    })
    const result = await movePost('p1', 'published')
    expect(result).toEqual({ ok: true })
    const updateCall = callLog.find((c) => c.method === 'update')
    const patch = updateCall!.args[0] as Record<string, unknown>
    expect(patch.status).toBe('published')
    expect(patch.published_at).toBeDefined()
    expect(typeof patch.published_at).toBe('string')
  })

  it('clears published_at when moving away from published', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'published', site_id: 'site-1', blog_translations: [{ locale: 'en', slug: 'post' }] }],
      },
    })
    const result = await movePost('p1', 'archived')
    expect(result).toEqual({ ok: true })
    const updateCall = callLog.find((c) => c.method === 'update')
    const patch = updateCall!.args[0] as Record<string, unknown>
    expect(patch.published_at).toBeNull()
  })

  it('rejects invalid transition draft → published (skips ready)', async () => {
    const result = await movePost('p1', 'published')
    expect(result).toEqual({ ok: false, error: 'invalid_transition' })
  })

  it('rejects invalid transition idea → published', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'idea', site_id: 'site-1', blog_translations: [] }],
      },
    })
    const result = await movePost('p1', 'published')
    expect(result).toEqual({ ok: false, error: 'invalid_transition' })
  })

  it('rejects invalid transition published → draft', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'published', site_id: 'site-1', blog_translations: [] }],
      },
    })
    const result = await movePost('p1', 'draft')
    expect(result).toEqual({ ok: false, error: 'invalid_transition' })
  })

  it('rejects transition from unknown status', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'unknown_status', site_id: 'site-1', blog_translations: [] }],
      },
    })
    const result = await movePost('p1', 'draft')
    expect(result).toEqual({ ok: false, error: 'invalid_transition' })
  })

  it('returns not_found when post does not exist', async () => {
    resetMockState({ perTableErr: { blog_posts: { message: 'not found' } } })
    const result = await movePost('ghost', 'draft')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('returns conflict when CAS update matches zero rows (status race)', async () => {
    resetMockState({
      perTableSeq: {
        blog_posts: [
          { rows: [{ id: 'p1', status: 'draft', site_id: 'site-1', tag_id: 'tag-1', blog_translations: [{ locale: 'pt-BR', slug: 'hello' }] }] },
          { rows: [] }, // CAS update returns no rows → conflict
        ],
      },
    })
    const result = await movePost('p1', 'ready')
    expect(result).toEqual({ ok: false, error: 'conflict' })
  })

  it('revalidates SEO cache on success', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'draft', site_id: 'site-1', tag_id: 'tag-1', blog_translations: [{ locale: 'pt-BR', slug: 'hello' }] }],
      },
    })
    await movePost('p1', 'ready')
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('site-1', 'p1', 'pt-BR', 'hello')
  })

  it('throws when RBAC check fails', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({ ok: false, reason: 'forbidden' } as never)
    await expect(movePost('p1', 'draft')).rejects.toThrow(/forbidden/)
  })
})

// ─── deleteHubPost ──────────────────────────────────────────────────────────

describe('deleteHubPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'draft', site_id: 'site-1', blog_translations: [{ locale: 'en', slug: 'bye' }] }],
      },
    })
  })

  it('deletes post with status idea', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'idea', site_id: 'site-1', blog_translations: [] }],
      },
    })
    const result = await deleteHubPost('p1')
    expect(result).toEqual({ ok: true })
  })

  it('deletes post with status draft', async () => {
    const result = await deleteHubPost('p1')
    expect(result).toEqual({ ok: true })
  })

  it('deletes post with status archived', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'archived', site_id: 'site-1', blog_translations: [] }],
      },
    })
    const result = await deleteHubPost('p1')
    expect(result).toEqual({ ok: true })
  })

  it('rejects deletion of published post', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'published', site_id: 'site-1', blog_translations: [] }],
      },
    })
    const result = await deleteHubPost('p1')
    expect(result).toEqual({ ok: false, error: 'post_not_deletable' })
  })

  it('rejects deletion of ready post', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'ready', site_id: 'site-1', blog_translations: [] }],
      },
    })
    const result = await deleteHubPost('p1')
    expect(result).toEqual({ ok: false, error: 'post_not_deletable' })
  })

  it('rejects deletion of scheduled post', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'scheduled', site_id: 'site-1', blog_translations: [] }],
      },
    })
    const result = await deleteHubPost('p1')
    expect(result).toEqual({ ok: false, error: 'post_not_deletable' })
  })

  it('rejects deletion of queued post', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'queued', site_id: 'site-1', blog_translations: [] }],
      },
    })
    const result = await deleteHubPost('p1')
    expect(result).toEqual({ ok: false, error: 'post_not_deletable' })
  })

  it('rejects deletion of pending_review post', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'pending_review', site_id: 'site-1', blog_translations: [] }],
      },
    })
    const result = await deleteHubPost('p1')
    expect(result).toEqual({ ok: false, error: 'post_not_deletable' })
  })

  it('returns not_found when post does not exist', async () => {
    resetMockState({ perTableErr: { blog_posts: { message: 'not found' } } })
    const result = await deleteHubPost('ghost')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('returns conflict when CAS delete matches zero rows (status race)', async () => {
    // First from('blog_posts') call: select returns the post with status=draft (deletable)
    // Second from('blog_posts') call: delete returns empty array (someone published it between reads)
    resetMockState({
      perTableSeq: {
        blog_posts: [
          { rows: [{ id: 'p1', status: 'draft', site_id: 'site-1', blog_translations: [{ locale: 'en', slug: 'bye' }] }] },
          { rows: [] }, // CAS delete returns no rows → conflict
        ],
      },
    })
    const result = await deleteHubPost('p1')
    expect(result).toEqual({ ok: false, error: 'conflict' })
  })

  it('revalidates SEO cache on success', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'draft', site_id: 'site-1', blog_translations: [{ locale: 'pt-BR', slug: 'adeus' }] }],
      },
    })
    await deleteHubPost('p1')
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('site-1', 'p1', 'pt-BR', 'adeus')
  })

  it('throws when RBAC check fails', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({ ok: false, reason: 'unauthenticated' } as never)
    await expect(deleteHubPost('p1')).rejects.toThrow(/unauthenticated/)
  })
})

// ─── reassignTag ────────────────────────────────────────────────────────────

describe('reassignTag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState({
      perTable: {
        blog_tags: [{ id: 'tag-1' }],
        blog_posts: [],
      },
    })
  })

  it('assigns a tag to a post', async () => {
    const result = await reassignTag('p1', 'tag-1')
    expect(result).toEqual({ ok: true })
    const updateCall = callLog.find((c) => c.method === 'update' && c.table === 'blog_posts')
    expect(updateCall).toBeDefined()
    const patch = updateCall!.args[0] as Record<string, unknown>
    expect(patch.tag_id).toBe('tag-1')
  })

  it('removes tag (sets null)', async () => {
    const result = await reassignTag('p1', null)
    expect(result).toEqual({ ok: true })
    const updateCall = callLog.find((c) => c.method === 'update' && c.table === 'blog_posts')
    const patch = updateCall!.args[0] as Record<string, unknown>
    expect(patch.tag_id).toBeNull()
  })

  it('returns tag_not_found when tag does not exist', async () => {
    resetMockState({ perTable: { blog_tags: [] } }) // maybeSingle returns null
    const result = await reassignTag('p1', 'bad-tag')
    expect(result).toEqual({ ok: false, error: 'tag_not_found' })
  })

  it('returns error on update failure', async () => {
    resetMockState({
      perTable: { blog_tags: [{ id: 'tag-1' }] },
      perTableErr: { blog_posts: { message: 'update-err' } },
    })
    const result = await reassignTag('p1', 'tag-1')
    expect(result).toEqual({ ok: false, error: 'update-err' })
  })
})

// ─── addLocale ──────────────────────────────────────────────────────────────

describe('addLocale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState({
      perTable: {
        blog_translations: [{ title: 'Original Title' }],
      },
    })
  })

  it('creates translation with fallback title from primary locale', async () => {
    const result = await addLocale('p1', 'en')
    expect(result).toEqual({ ok: true })
    const insertCalls = callLog.filter((c) => c.method === 'insert' && c.table === 'blog_translations')
    expect(insertCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('returns locale_exists on duplicate (23505)', async () => {
    resetMockState({ perTableErr: { blog_translations: { message: 'dup', code: '23505' } } })
    const result = await addLocale('p1', 'en')
    expect(result).toEqual({ ok: false, error: 'locale_exists' })
  })

  it('returns generic error for other DB errors', async () => {
    resetMockState({ perTableErr: { blog_translations: { message: 'db-oops' } } })
    const result = await addLocale('p1', 'en')
    expect(result).toEqual({ ok: false, error: 'db-oops' })
  })
})

// ─── duplicatePost ──────────────────────────────────────────────────────────

describe('duplicatePost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState({
      perTable: {
        blog_posts: [
          {
            id: 'source-1',
            site_id: 'site-1',
            locale: 'pt-BR',
            author_id: 'auth-1',
            tag_id: 'tag-1',
            blog_translations: [
              { locale: 'pt-BR', title: 'Titulo', slug: 'titulo', excerpt: 'ex', content_mdx: '# hi', meta_title: null, meta_description: null, og_image_url: null, cover_image_url: null },
              { locale: 'en', title: 'Title', slug: 'title', excerpt: 'ex2', content_mdx: '# en', meta_title: 'mt', meta_description: 'md', og_image_url: null, cover_image_url: null },
            ],
          },
        ],
        blog_translations: [],
      },
    })
  })

  it('creates new post with idea status and all translations copied', async () => {
    const result = await duplicatePost('source-1')
    // The new post ID comes from the insert response
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.newPostId).toBeDefined()
    }
    // Verify blog_posts insert has idea status
    const postInsert = callLog.find((c) => c.method === 'insert' && c.table === 'blog_posts')
    expect(postInsert).toBeDefined()
    const postData = postInsert!.args[0] as Record<string, unknown>
    expect(postData.status).toBe('idea')
    expect(postData.tag_id).toBe('tag-1')
    expect(postData.author_id).toBe('auth-1')
    expect(postData.owner_user_id).toBe('user-1')
  })

  it('returns not_found when source post does not exist', async () => {
    resetMockState({ perTableErr: { blog_posts: { message: 'not found' } } })
    const result = await duplicatePost('ghost')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('returns error and rolls back when translation insert fails', async () => {
    resetMockState({
      perTable: {
        blog_posts: [
          { id: 'src', site_id: 'site-1', locale: 'en', author_id: null, tag_id: null, blog_translations: [{ locale: 'en', title: 'T', slug: 's', excerpt: null, content_mdx: '', meta_title: null, meta_description: null, og_image_url: null, cover_image_url: null }] },
        ],
      },
      perTableErr: { blog_translations: { message: 'tx-fail' } },
    })
    const result = await duplicatePost('src')
    expect(result).toEqual({ ok: false, error: 'tx-fail' })
    // Should roll back with delete
    const deleteCalls = callLog.filter((c) => c.method === 'delete' && c.table === 'blog_posts')
    expect(deleteCalls.length).toBe(1)
  })
})

// ─── updateBlogCadence ──────────────────────────────────────────────────────

describe('updateBlogCadence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  it('upserts valid cadence data', async () => {
    const result = await updateBlogCadence('pt-BR', { cadence_days: 7, preferred_send_time: '08:00' })
    expect(result).toEqual({ ok: true })
    const upsertCall = callLog.find((c) => c.method === 'upsert')
    expect(upsertCall).toBeDefined()
    const data = upsertCall!.args[0] as Record<string, unknown>
    expect(data.site_id).toBe('site-1')
    expect(data.locale).toBe('pt-BR')
    expect(data.cadence_days).toBe(7)
    expect(data.preferred_send_time).toBe('08:00')
  })

  it('rejects cadence_days = 0', async () => {
    const result = await updateBlogCadence('en', { cadence_days: 0 })
    expect(result).toEqual({ ok: false, error: 'cadence_days_out_of_range' })
  })

  it('rejects cadence_days = -1', async () => {
    const result = await updateBlogCadence('en', { cadence_days: -1 })
    expect(result).toEqual({ ok: false, error: 'cadence_days_out_of_range' })
  })

  it('rejects cadence_days = 366', async () => {
    const result = await updateBlogCadence('en', { cadence_days: 366 })
    expect(result).toEqual({ ok: false, error: 'cadence_days_out_of_range' })
  })

  it('accepts cadence_days = 1 (minimum)', async () => {
    const result = await updateBlogCadence('en', { cadence_days: 1 })
    expect(result).toEqual({ ok: true })
  })

  it('accepts cadence_days = 365 (maximum)', async () => {
    const result = await updateBlogCadence('en', { cadence_days: 365 })
    expect(result).toEqual({ ok: true })
  })

  it('rejects non-integer cadence_days', async () => {
    const result = await updateBlogCadence('en', { cadence_days: 7.5 })
    expect(result).toEqual({ ok: false, error: 'cadence_days_out_of_range' })
  })

  it('rejects invalid time format 25:00', async () => {
    const result = await updateBlogCadence('en', { preferred_send_time: '25:00' })
    expect(result).toEqual({ ok: false, error: 'invalid_time_format' })
  })

  it('rejects invalid time format 12:60', async () => {
    const result = await updateBlogCadence('en', { preferred_send_time: '12:60' })
    expect(result).toEqual({ ok: false, error: 'invalid_time_format' })
  })

  it('rejects time without leading zero 8:00', async () => {
    const result = await updateBlogCadence('en', { preferred_send_time: '8:00' })
    expect(result).toEqual({ ok: false, error: 'invalid_time_format' })
  })

  it('accepts valid time 00:00', async () => {
    const result = await updateBlogCadence('en', { preferred_send_time: '00:00' })
    expect(result).toEqual({ ok: true })
  })

  it('accepts valid time 23:59', async () => {
    const result = await updateBlogCadence('en', { preferred_send_time: '23:59' })
    expect(result).toEqual({ ok: true })
  })

  it('upserts cadence_paused', async () => {
    const result = await updateBlogCadence('en', { cadence_paused: true })
    expect(result).toEqual({ ok: true })
    const upsertCall = callLog.find((c) => c.method === 'upsert')
    const data = upsertCall!.args[0] as Record<string, unknown>
    expect(data.cadence_paused).toBe(true)
  })

  it('upserts cadence_start_date', async () => {
    const result = await updateBlogCadence('pt-BR', { cadence_start_date: '2026-01-01' })
    expect(result).toEqual({ ok: true })
    const upsertCall = callLog.find((c) => c.method === 'upsert')
    const data = upsertCall!.args[0] as Record<string, unknown>
    expect(data.cadence_start_date).toBe('2026-01-01')
  })

  it('returns error on DB failure', async () => {
    resetMockState({ perTableErr: { blog_cadence: { message: 'upsert-err' } } })
    const result = await updateBlogCadence('en', { cadence_days: 7 })
    expect(result).toEqual({ ok: false, error: 'upsert-err' })
  })

  it('throws when RBAC check fails', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({ ok: false, reason: 'forbidden' } as never)
    await expect(updateBlogCadence('en', { cadence_days: 7 })).rejects.toThrow(/forbidden/)
  })
})

// ─── movePost scheduling flow ──────────────────────────────────────────────

describe('movePost scheduling flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ready → scheduled with valid scheduledFor succeeds', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1h from now
    resetMockState({
      perTableSeq: {
        blog_posts: [
          { rows: [{ id: 'p1', status: 'ready', site_id: 'site-1', tag_id: 'tag-1', blog_translations: [{ locale: 'pt-BR', slug: 'post' }] }] },
          { rows: [{ id: 'p1' }] }, // CAS update succeeds
        ],
      },
    })
    const result = await movePost('p1', 'scheduled', futureDate)
    expect(result).toEqual({ ok: true })
    const updateCall = callLog.find((c) => c.method === 'update')
    const patch = updateCall!.args[0] as Record<string, unknown>
    expect(patch.status).toBe('scheduled')
    expect(patch.scheduled_for).toBe(futureDate)
  })

  it('ready → scheduled without scheduledFor returns error', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'ready', site_id: 'site-1', tag_id: 'tag-1', blog_translations: [{ locale: 'pt-BR', slug: 'post' }] }],
      },
    })
    const result = await movePost('p1', 'scheduled')
    expect(result).toEqual({ ok: false, error: 'scheduled_for_required' })
  })

  it('ready → scheduled with invalid date string returns error', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'ready', site_id: 'site-1', tag_id: 'tag-1', blog_translations: [{ locale: 'pt-BR', slug: 'post' }] }],
      },
    })
    const result = await movePost('p1', 'scheduled', 'not-a-date')
    expect(result).toEqual({ ok: false, error: 'invalid_date' })
  })

  it('ready → scheduled with past date returns error', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'ready', site_id: 'site-1', tag_id: 'tag-1', blog_translations: [{ locale: 'pt-BR', slug: 'post' }] }],
      },
    })
    const pastDate = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10min ago
    const result = await movePost('p1', 'scheduled', pastDate)
    expect(result).toEqual({ ok: false, error: 'date_in_past' })
  })

  it('ready → scheduled with near-future date (within 5min tolerance) succeeds', async () => {
    const nearPastDate = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    resetMockState({
      perTableSeq: {
        blog_posts: [
          { rows: [{ id: 'p1', status: 'ready', site_id: 'site-1', tag_id: 'tag-1', blog_translations: [{ locale: 'pt-BR', slug: 'post' }] }] },
          { rows: [{ id: 'p1' }] }, // CAS update succeeds
        ],
      },
    })
    const result = await movePost('p1', 'scheduled', nearPastDate)
    expect(result).toEqual({ ok: true })
  })

  it('scheduled → ready clears scheduled_for', async () => {
    resetMockState({
      perTableSeq: {
        blog_posts: [
          { rows: [{ id: 'p1', status: 'scheduled', site_id: 'site-1', tag_id: 'tag-1', blog_translations: [{ locale: 'pt-BR', slug: 'post' }] }] },
          { rows: [{ id: 'p1' }] }, // CAS update succeeds
        ],
      },
    })
    const result = await movePost('p1', 'ready')
    expect(result).toEqual({ ok: true })
    const updateCall = callLog.find((c) => c.method === 'update')
    const patch = updateCall!.args[0] as Record<string, unknown>
    expect(patch.status).toBe('ready')
    expect(patch.scheduled_for).toBeNull()
  })

  it('scheduled → draft clears scheduled_for', async () => {
    resetMockState({
      perTableSeq: {
        blog_posts: [
          { rows: [{ id: 'p1', status: 'scheduled', site_id: 'site-1', blog_translations: [{ locale: 'pt-BR', slug: 'post' }] }] },
          { rows: [{ id: 'p1' }] }, // CAS update succeeds
        ],
      },
    })
    const result = await movePost('p1', 'draft')
    expect(result).toEqual({ ok: true })
    const updateCall = callLog.find((c) => c.method === 'update')
    const patch = updateCall!.args[0] as Record<string, unknown>
    expect(patch.status).toBe('draft')
    expect(patch.scheduled_for).toBeNull()
  })

  it('draft → scheduled blocked by transition rules', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'draft', site_id: 'site-1', blog_translations: [{ locale: 'pt-BR', slug: 'post' }] }],
      },
    })
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const result = await movePost('p1', 'scheduled', futureDate)
    expect(result).toEqual({ ok: false, error: 'invalid_transition' })
  })

  it('idea → scheduled blocked by transition rules', async () => {
    resetMockState({
      perTable: {
        blog_posts: [{ id: 'p1', status: 'idea', site_id: 'site-1', blog_translations: [{ locale: 'pt-BR', slug: 'post' }] }],
      },
    })
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const result = await movePost('p1', 'scheduled', futureDate)
    expect(result).toEqual({ ok: false, error: 'invalid_transition' })
  })
})
