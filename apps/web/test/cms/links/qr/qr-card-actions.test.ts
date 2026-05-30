import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Supabase proxy mock ────────────────────────────────────────────

type MockRow = Record<string, unknown>
type MockError = { message: string; code?: string } | null

let resolvedRows: MockRow[] = []
let resolvedError: MockError = null
let insertedData: unknown = null
let updatedData: unknown = null
let deletedFilter: Record<string, unknown> = {}

function makeChain(table: string) {
  let useSingle = false
  const chain: Record<string, unknown> = {}

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === 'then') {
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
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'u1' } }),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

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

// ─── Tests ──────────────────────────────────────────────────────────

describe('listQrCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolvedRows = []
    resolvedError = null
    insertedData = null
    updatedData = null
    deletedFilter = {}
  })

  it('retorna cards formatados com campos camelCase', async () => {
    resolvedRows = [
      { id: 'c1', name: 'Card A', preview_url: 'https://cdn/a.png', created_at: '2026-05-01T00:00:00Z' },
      { id: 'c2', name: 'Card B', preview_url: null, created_at: '2026-05-02T00:00:00Z' },
    ]
    const { listQrCards } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
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

  it('retorna array vazio quando nao ha cards', async () => {
    resolvedRows = []
    const { listQrCards } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await listQrCards('link-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.cards).toEqual([])
    }
  })

  it('retorna erro quando Supabase falha', async () => {
    resolvedError = { message: 'db_error' }
    const { listQrCards } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await listQrCards('link-1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('db_error')
    }
  })
})

describe.skip('createQrCard', () => { // TODO: broken by composition schema change
  beforeEach(() => {
    vi.clearAllMocks()
    resolvedRows = []
    resolvedError = null
    insertedData = null
    updatedData = null
    deletedFilter = {}
  })

  it('valida composition com Zod e cria card', async () => {
    resolvedRows = [{ id: 'new-card-id' }]
    const { createQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await createQrCard('link-1', 'Test Card', validComposition())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.cardId).toBe('new-card-id')
    }
  })

  it('rejeita composition invalida', async () => {
    const { createQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const invalid = {
      version: 1 as const,
      canvas: { width: 50, height: 50, aspectRatio: '1:1' }, // width < 200 min
      background: { type: 'solid' as const, color: '#ffffff' },
      elements: [],
    }
    const result = await createQrCard('link-1', 'Bad Card', invalid)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('invalid_composition')
    }
  })

  it('chama revalidateTag apos criacao bem-sucedida', async () => {
    resolvedRows = [{ id: 'card-99' }]
    const { revalidateTag } = await import('next/cache')
    const { createQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    await createQrCard('link-x', 'Tag Test', validComposition())
    expect(revalidateTag).toHaveBeenCalledWith('link:link-x')
  })

  it('sanitiza blob: URLs no background antes de persistir', async () => {
    resolvedRows = [{ id: 'card-blob' }]
    const { createQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const comp = validComposition()
    // Set background to an image with blob: URL
    ;(comp as Record<string, unknown>).background = {
      type: 'image',
      url: 'blob:http://localhost/fake',
      fallbackColor: '#cccccc',
    }
    const result = await createQrCard('link-1', 'Blob Test', comp)
    // Should succeed — blob URL gets sanitized to solid background
    expect(result.ok).toBe(true)
  })

  it('remove elementos image com blob: src', async () => {
    resolvedRows = [{ id: 'card-clean' }]
    const { createQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
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
})

describe('updateQrCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolvedRows = []
    resolvedError = null
    insertedData = null
    updatedData = null
    deletedFilter = {}
  })

  it('atualiza apenas campos fornecidos no patch', async () => {
    const { updateQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await updateQrCard('card-1', 'link-1', { name: 'Renamed' })
    expect(result.ok).toBe(true)
  })

  it('valida composition se fornecida no patch', async () => {
    const { updateQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const badComp = {
      version: 1 as const,
      canvas: { width: 10, height: 10, aspectRatio: '1:1' }, // invalid: < 200
      background: { type: 'solid' as const, color: '#ffffff' },
      elements: [],
    }
    const result = await updateQrCard('card-1', 'link-1', { composition: badComp })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('invalid_composition')
    }
  })

  it('aceita patch com previewUrl', async () => {
    const { updateQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await updateQrCard('card-1', 'link-1', {
      previewUrl: 'https://cdn/new-preview.png',
    })
    expect(result.ok).toBe(true)
  })

  it('aceita patch com composition valida', async () => {
    const { updateQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await updateQrCard('card-1', 'link-1', {
      composition: validComposition(),
    })
    expect(result.ok).toBe(true)
  })

  it('chama revalidateTag apos update', async () => {
    const { revalidateTag } = await import('next/cache')
    const { updateQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    await updateQrCard('card-1', 'link-z', { name: 'X' })
    expect(revalidateTag).toHaveBeenCalledWith('link:link-z')
  })

  it('retorna erro quando Supabase falha', async () => {
    resolvedError = { message: 'update_failed' }
    const { updateQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await updateQrCard('card-1', 'link-1', { name: 'Oops' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('update_failed')
    }
  })
})

describe('deleteQrCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolvedRows = []
    resolvedError = null
    insertedData = null
    updatedData = null
    deletedFilter = {}
  })

  it('remove card por id + site_id', async () => {
    const { deleteQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await deleteQrCard('card-x', 'link-1')
    expect(result.ok).toBe(true)
  })

  it('chama revalidateTag apos delecao', async () => {
    const { revalidateTag } = await import('next/cache')
    const { deleteQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    await deleteQrCard('card-x', 'link-del')
    expect(revalidateTag).toHaveBeenCalledWith('link:link-del')
  })

  it('retorna erro quando Supabase falha', async () => {
    resolvedError = { message: 'delete_failed' }
    const { deleteQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await deleteQrCard('card-x', 'link-1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('delete_failed')
    }
  })
})

describe('loadQrCardById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolvedRows = []
    resolvedError = null
    insertedData = null
    updatedData = null
    deletedFilter = {}
  })

  it('retorna composition valida quando dados estao corretos', async () => {
    const comp = validComposition()
    resolvedRows = [{ composition: comp, name: 'My Card' }]
    const { loadQrCardById } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await loadQrCardById('card-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.name).toBe('My Card')
      expect(result.composition).not.toBeNull()
      expect(result.composition?.version).toBe(1)
    }
  })

  it('retorna composition null para dados armazenados invalidos', async () => {
    resolvedRows = [{
      composition: { version: 1, canvas: 'bad-data', background: null, elements: [] },
      name: 'Corrupted',
    }]
    const { loadQrCardById } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await loadQrCardById('card-bad')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.composition).toBeNull()
      expect(result.name).toBe('Corrupted')
    }
  })

  it('retorna not_found para card inexistente', async () => {
    resolvedError = { message: 'not found' }
    const { loadQrCardById } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await loadQrCardById('card-missing')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('not_found')
    }
  })

  it('retorna not_found quando data eh null', async () => {
    // Simulate: no error but data is null (row not found via .single())
    resolvedRows = []
    resolvedError = { message: 'PGRST116' }
    const { loadQrCardById } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await loadQrCardById('card-gone')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('not_found')
    }
  })

  it('retorna composition null quando composition armazenada nao eh um objeto', async () => {
    resolvedRows = [{ composition: 'not-an-object', name: 'String Comp' }]
    const { loadQrCardById } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await loadQrCardById('card-str')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.composition).toBeNull()
      expect(result.name).toBe('String Comp')
    }
  })

  it('retorna composition null quando composition eh null no banco', async () => {
    resolvedRows = [{ composition: null, name: 'No Comp' }]
    const { loadQrCardById } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    const result = await loadQrCardById('card-null')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.composition).toBeNull()
      expect(result.name).toBe('No Comp')
    }
  })
})

describe('RBAC enforcement (card-actions)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolvedRows = []
    resolvedError = null
  })

  it('createQrCard throws forbidden quando acesso negado', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { createQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    await expect(
      createQrCard('link-1', 'Denied', validComposition()),
    ).rejects.toThrow('forbidden')
  })

  it('updateQrCard throws forbidden quando acesso negado', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { updateQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    await expect(
      updateQrCard('card-1', 'link-1', { name: 'Nope' }),
    ).rejects.toThrow('forbidden')
  })

  it('deleteQrCard throws forbidden quando acesso negado', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { deleteQrCard } = await import(
      '@/app/cms/(authed)/links/[id]/qr/card-actions'
    )
    await expect(
      deleteQrCard('card-1', 'link-1'),
    ).rejects.toThrow('forbidden')
  })
})
