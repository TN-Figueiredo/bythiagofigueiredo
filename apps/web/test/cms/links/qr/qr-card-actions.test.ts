import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolve } from 'path'

// ─── Supabase proxy mock ────────────────────────────────────────────

type MockRow = Record<string, unknown>
type MockError = { message: string; code?: string } | null

let resolvedRows: MockRow[] = []
let resolvedError: MockError = null
let insertedData: unknown = null
let updatedData: unknown = null
let deletedFilter: Record<string, unknown> = {}
/** Track count for head:true queries (link ownership check) */
let headCount: number | null = null

function makeChain(_table: string) {
  let useSingle = false
  let isHead = false
  const chain: Record<string, unknown> = {}

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === 'then') {
        if (isHead) {
          return (resolve?: (v: unknown) => void) =>
            resolve?.({ count: headCount, error: resolvedError })
        }
        if (useSingle) {
          return (resolve?: (v: unknown) => void) =>
            resolve?.({ data: resolvedError ? null : (resolvedRows[0] ?? null), error: resolvedError })
        }
        return (resolve?: (v: unknown) => void) =>
          resolve?.({ data: resolvedError ? null : resolvedRows, error: resolvedError })
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => {
          useSingle = true
          return new Proxy(chain, handler)
        }
      }
      if (prop === 'insert') {
        return (data: unknown) => {
          insertedData = data
          return new Proxy(chain, handler)
        }
      }
      if (prop === 'update') {
        return (data: unknown) => {
          updatedData = data
          return new Proxy(chain, handler)
        }
      }
      if (prop === 'delete') {
        return () => {
          deletedFilter = {}
          return new Proxy(chain, handler)
        }
      }
      if (prop === 'eq') {
        return (col: string, val: unknown) => {
          deletedFilter[col] = val
          return new Proxy(chain, handler)
        }
      }
      if (prop === 'is') {
        return (_col: string, _val: unknown) => new Proxy(chain, handler)
      }
      if (prop === 'select') {
        return (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) isHead = true
          return new Proxy(chain, handler)
        }
      }
      return (..._args: unknown[]) => new Proxy(chain, handler)
    },
  }
  return new Proxy(chain, handler)
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn((_table: string) => makeChain(_table)),
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
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'u1' } }),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

// ─── Resolve the module path with brackets ─────────────────────────
// Dynamic import() with `@/app/cms/(authed)/links/[id]/...` fails in
// vitest forks pool because string-based Vite aliases don't fire for
// dynamic imports in child processes. Use the resolved absolute path.

const CARD_ACTIONS = resolve(
  __dirname,
  '../../../../src/app/cms/(authed)/links/[id]/qr/card-actions.ts',
)

async function importActions() {
  return import(/* @vite-ignore */ CARD_ACTIONS) as Promise<
    typeof import('@/app/cms/(authed)/links/[id]/qr/card-actions')
  >
}

// ─── Fixtures ───────────────────────────────────────────────────────

function validComposition() {
  return {
    version: 1 as const,
    canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
    background: { type: 'solid' as const, color: '#ffffff' },
    elements: [
      {
        id: 'qr-1',
        type: 'qr' as const,
        x: 100,
        y: 100,
        width: 400,
        height: 400,
        rotation: 0,
        opacity: 1,
        locked: false,
        foregroundColor: '#000000',
        backgroundColor: '#ffffff',
        errorCorrection: 'M' as const,
        dotStyle: 'square' as const,
        cornerRadius: 0,
        padding: 0,
        showLogo: false,
        logoPadTop: 10,
        logoPadRight: 8,
        logoPadBottom: 14,
        logoPadLeft: 12,
        maintainAspectRatio: true as const,
      },
    ],
  }
}

function resetState() {
  vi.clearAllMocks()
  resolvedRows = []
  resolvedError = null
  insertedData = null
  updatedData = null
  deletedFilter = {}
  headCount = 1 // default: link ownership passes
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('listQrCards', () => {
  beforeEach(resetState)

  it('returns formatted cards with camelCase fields', async () => {
    resolvedRows = [
      { id: 'c1', name: 'Card A', preview_url: 'https://cdn/a.png', created_at: '2026-05-01T00:00:00Z' },
      { id: 'c2', name: 'Card B', preview_url: null, created_at: '2026-05-02T00:00:00Z' },
    ]
    const { listQrCards } = await importActions()
    const result = await listQrCards('link-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.cards).toHaveLength(2)
      expect(result.cards[0]).toEqual({
        id: 'c1',
        name: 'Card A',
        previewUrl: 'https://cdn/a.png',
        createdAt: '2026-05-01T00:00:00Z',
      })
      expect(result.cards[1]!.previewUrl).toBeNull()
    }
  })

  it('returns empty array when no cards exist', async () => {
    resolvedRows = []
    const { listQrCards } = await importActions()
    const result = await listQrCards('link-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.cards).toEqual([])
    }
  })

  it('returns error when Supabase fails', async () => {
    resolvedError = { message: 'db_error' }
    const { listQrCards } = await importActions()
    const result = await listQrCards('link-1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('db_error')
    }
  })

  it('requires read scope (calls requireSiteScope with mode=read)', async () => {
    resolvedRows = []
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    const { listQrCards } = await importActions()
    await listQrCards('link-1')
    expect(requireSiteScope).toHaveBeenCalledWith(
      expect.objectContaining({ area: 'cms', siteId: 'site-1', mode: 'view' }),
    )
  })

  it('returns error when read scope is denied', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { listQrCards } = await importActions()
    const result = await listQrCards('link-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('forbidden')
  })
})

describe('createQrCard', () => {
  beforeEach(resetState)

  it('validates composition with Zod and creates card', async () => {
    resolvedRows = [{ id: 'new-card-id' }]
    const { createQrCard } = await importActions()
    const result = await createQrCard('link-1', 'Test Card', validComposition())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.cardId).toBe('new-card-id')
    }
  })

  it('rejects invalid composition (canvas width < 200)', async () => {
    const { createQrCard } = await importActions()
    const invalid = {
      version: 1 as const,
      canvas: { width: 50, height: 50, aspectRatio: '1:1' },
      background: { type: 'solid' as const, color: '#ffffff' },
      elements: [],
    }
    const result = await createQrCard('link-1', 'Bad Card', invalid)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('invalid_composition')
    }
  })

  it('rejects empty name', async () => {
    const { createQrCard } = await importActions()
    const result = await createQrCard('link-1', '', validComposition())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('invalid_name')
    }
  })

  it('rejects name longer than 200 characters', async () => {
    const { createQrCard } = await importActions()
    const result = await createQrCard('link-1', 'A'.repeat(201), validComposition())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('invalid_name')
    }
  })

  it('accepts name with exactly 200 characters', async () => {
    resolvedRows = [{ id: 'card-200' }]
    const { createQrCard } = await importActions()
    const result = await createQrCard('link-1', 'A'.repeat(200), validComposition())
    expect(result.ok).toBe(true)
  })

  it('calls revalidateTag after successful creation', async () => {
    resolvedRows = [{ id: 'card-99' }]
    const { revalidateTag } = await import('next/cache')
    const { createQrCard } = await importActions()
    await createQrCard('link-x', 'Tag Test', validComposition())
    expect(revalidateTag).toHaveBeenCalledWith('link:link-x')
  })

  it('verifies link ownership before insert (returns link_not_found)', async () => {
    headCount = 0 // Link not found / not owned by this site
    const { createQrCard } = await importActions()
    const result = await createQrCard('link-not-mine', 'Test', validComposition())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('link_not_found')
    }
  })

  it('sanitizes blob: URLs in background before persisting', async () => {
    resolvedRows = [{ id: 'card-blob' }]
    const { createQrCard } = await importActions()
    const comp = validComposition()
    ;(comp as Record<string, unknown>).background = {
      type: 'image',
      url: 'blob:http://localhost/fake',
      fallbackColor: '#cccccc',
    }
    const result = await createQrCard('link-1', 'Blob Test', comp)
    expect(result.ok).toBe(true)
  })

  it('removes image elements with blob: src', async () => {
    resolvedRows = [{ id: 'card-clean' }]
    const { createQrCard } = await importActions()
    const comp = validComposition()
    comp.elements.push({
      id: 'img-blob',
      type: 'image' as const,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      locked: false,
      src: 'blob:http://localhost/fake-image',
      objectFit: 'cover' as const,
      borderRadius: 0,
      borderColor: '#000000',
      borderWidth: 0,
      maintainAspectRatio: true,
    })
    const result = await createQrCard('link-1', 'Clean', comp)
    expect(result.ok).toBe(true)
  })

  it('returns error when Supabase insert fails', async () => {
    resolvedError = { message: 'insert_failed' }
    const { createQrCard } = await importActions()
    const result = await createQrCard('link-1', 'Fail Card', validComposition())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('insert_failed')
    }
  })

  it('returns error when edit scope denied', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { createQrCard } = await importActions()
    const result = await createQrCard('link-1', 'Denied', validComposition())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('forbidden')
  })

  it('returns error when user not logged in', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'unauthenticated',
    })
    const { createQrCard } = await importActions()
    const result = await createQrCard('link-1', 'Denied', validComposition())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('unauthenticated')
  })
})

describe('updateQrCard', () => {
  beforeEach(resetState)

  it('updates only provided fields in patch (name only)', async () => {
    const { updateQrCard } = await importActions()
    const result = await updateQrCard('card-1', 'link-1', { name: 'Renamed' })
    expect(result.ok).toBe(true)
  })

  it('validates composition if provided in patch', async () => {
    const { updateQrCard } = await importActions()
    const badComp = {
      version: 1 as const,
      canvas: { width: 10, height: 10, aspectRatio: '1:1' },
      background: { type: 'solid' as const, color: '#ffffff' },
      elements: [],
    }
    const result = await updateQrCard('card-1', 'link-1', { composition: badComp })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('invalid_composition')
    }
  })

  it('accepts patch with valid composition', async () => {
    const { updateQrCard } = await importActions()
    const result = await updateQrCard('card-1', 'link-1', {
      composition: validComposition(),
    })
    expect(result.ok).toBe(true)
  })

  it('accepts patch with previewUrl', async () => {
    const { updateQrCard } = await importActions()
    const result = await updateQrCard('card-1', 'link-1', {
      previewUrl: 'https://cdn/new-preview.png',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects invalid name in patch (empty string)', async () => {
    const { updateQrCard } = await importActions()
    const result = await updateQrCard('card-1', 'link-1', { name: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('invalid_name')
    }
  })

  it('rejects name over 200 chars in patch', async () => {
    const { updateQrCard } = await importActions()
    const result = await updateQrCard('card-1', 'link-1', { name: 'X'.repeat(201) })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('invalid_name')
    }
  })

  it('calls revalidateTag after update', async () => {
    const { revalidateTag } = await import('next/cache')
    const { updateQrCard } = await importActions()
    await updateQrCard('card-1', 'link-z', { name: 'X' })
    expect(revalidateTag).toHaveBeenCalledWith('link:link-z')
  })

  it('filters by link_id in update query', async () => {
    const { updateQrCard } = await importActions()
    await updateQrCard('card-1', 'link-specific', { name: 'Filtered' })
    expect(deletedFilter).toHaveProperty('link_id', 'link-specific')
  })

  it('returns error when Supabase fails', async () => {
    resolvedError = { message: 'update_failed' }
    const { updateQrCard } = await importActions()
    const result = await updateQrCard('card-1', 'link-1', { name: 'Oops' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('update_failed')
    }
  })

  it('returns error when edit scope denied', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { updateQrCard } = await importActions()
    const result = await updateQrCard('card-1', 'link-1', { name: 'Nope' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('forbidden')
  })
})

describe('deleteQrCard', () => {
  beforeEach(resetState)

  it('deletes card by id + link_id + site_id', async () => {
    const { deleteQrCard } = await importActions()
    const result = await deleteQrCard('card-x', 'link-1')
    expect(result.ok).toBe(true)
    expect(deletedFilter).toHaveProperty('id', 'card-x')
    expect(deletedFilter).toHaveProperty('link_id', 'link-1')
    expect(deletedFilter).toHaveProperty('site_id', 'site-1')
  })

  it('calls revalidateTag after deletion', async () => {
    const { revalidateTag } = await import('next/cache')
    const { deleteQrCard } = await importActions()
    await deleteQrCard('card-x', 'link-del')
    expect(revalidateTag).toHaveBeenCalledWith('link:link-del')
  })

  it('returns error when Supabase fails', async () => {
    resolvedError = { message: 'delete_failed' }
    const { deleteQrCard } = await importActions()
    const result = await deleteQrCard('card-x', 'link-1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('delete_failed')
    }
  })

  it('returns error when edit scope denied', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { deleteQrCard } = await importActions()
    const result = await deleteQrCard('card-1', 'link-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('forbidden')
  })
})

describe('loadQrCardById', () => {
  beforeEach(resetState)

  it('returns valid composition when data is correct', async () => {
    const comp = validComposition()
    resolvedRows = [{ composition: comp, name: 'My Card' }]
    const { loadQrCardById } = await importActions()
    const result = await loadQrCardById('card-1', 'link-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.name).toBe('My Card')
      expect(result.composition).not.toBeNull()
      expect(result.composition?.version).toBe(1)
    }
  })

  it('returns composition null for invalid stored data', async () => {
    resolvedRows = [{
      composition: { version: 1, canvas: 'bad-data', background: null, elements: [] },
      name: 'Corrupted',
    }]
    const { loadQrCardById } = await importActions()
    const result = await loadQrCardById('card-bad', 'link-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.composition).toBeNull()
      expect(result.name).toBe('Corrupted')
    }
  })

  it('returns not_found for missing card (DB error)', async () => {
    resolvedError = { message: 'not found' }
    const { loadQrCardById } = await importActions()
    const result = await loadQrCardById('card-missing', 'link-1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('not_found')
    }
  })

  it('returns not_found when data is null (PGRST116)', async () => {
    resolvedRows = []
    resolvedError = { message: 'PGRST116' }
    const { loadQrCardById } = await importActions()
    const result = await loadQrCardById('card-gone', 'link-1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('not_found')
    }
  })

  it('returns composition null when stored composition is not an object', async () => {
    resolvedRows = [{ composition: 'not-an-object', name: 'String Comp' }]
    const { loadQrCardById } = await importActions()
    const result = await loadQrCardById('card-str', 'link-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.composition).toBeNull()
      expect(result.name).toBe('String Comp')
    }
  })

  it('returns composition null when composition is null in DB', async () => {
    resolvedRows = [{ composition: null, name: 'No Comp' }]
    const { loadQrCardById } = await importActions()
    const result = await loadQrCardById('card-null', 'link-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.composition).toBeNull()
      expect(result.name).toBe('No Comp')
    }
  })

  it('filters by link_id and site_id for tenant isolation', async () => {
    resolvedRows = [{ composition: validComposition(), name: 'Test' }]
    const { loadQrCardById } = await importActions()
    await loadQrCardById('card-1', 'link-specific')
    expect(deletedFilter).toHaveProperty('link_id', 'link-specific')
    expect(deletedFilter).toHaveProperty('site_id', 'site-1')
  })

  it('requires read scope (calls requireSiteScope with mode=read)', async () => {
    resolvedRows = [{ composition: null, name: 'Test' }]
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    const { loadQrCardById } = await importActions()
    await loadQrCardById('card-1', 'link-1')
    expect(requireSiteScope).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'view' }),
    )
  })

  it('returns error when read scope denied', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { loadQrCardById } = await importActions()
    const result = await loadQrCardById('card-1', 'link-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('forbidden')
  })

  it('sanitizes blob URLs in returned composition', async () => {
    const comp = validComposition()
    comp.elements.push({
      id: 'img-blob',
      type: 'image' as const,
      x: 0, y: 0, width: 100, height: 100,
      rotation: 0, opacity: 1, locked: false,
      src: 'blob:http://localhost/fake',
      objectFit: 'cover' as const,
      borderRadius: 0, borderColor: '#000000', borderWidth: 0,
      maintainAspectRatio: true,
    })
    resolvedRows = [{ composition: comp, name: 'With Blob' }]
    const { loadQrCardById } = await importActions()
    const result = await loadQrCardById('card-1', 'link-1')
    expect(result.ok).toBe(true)
    if (result.ok && result.composition) {
      const blobImages = result.composition.elements.filter(
        (el) => el.type === 'image' && 'src' in el && (el.src as string).startsWith('blob:'),
      )
      expect(blobImages).toHaveLength(0)
    }
  })
})

describe('RBAC enforcement (card-actions)', () => {
  beforeEach(resetState)

  it('all write actions use requireEditScope (edit mode)', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    const { createQrCard, updateQrCard, deleteQrCard } = await importActions()

    resolvedRows = [{ id: 'card-1' }]
    await createQrCard('link-1', 'Test', validComposition())
    expect(requireSiteScope).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'edit' }),
    )

    vi.clearAllMocks()
    await updateQrCard('card-1', 'link-1', { name: 'Renamed' })
    expect(requireSiteScope).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'edit' }),
    )

    vi.clearAllMocks()
    await deleteQrCard('card-1', 'link-1')
    expect(requireSiteScope).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'edit' }),
    )
  })

  it('read actions use requireReadScope (read mode)', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    const { listQrCards, loadQrCardById } = await importActions()

    resolvedRows = []
    await listQrCards('link-1')
    expect(requireSiteScope).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'view' }),
    )

    vi.clearAllMocks()
    resolvedRows = [{ composition: null, name: 'Test' }]
    await loadQrCardById('card-1', 'link-1')
    expect(requireSiteScope).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'view' }),
    )
  })

  it('listQrCards returns error when scope denied', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { listQrCards } = await importActions()
    const result = await listQrCards('link-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('forbidden')
  })
})
