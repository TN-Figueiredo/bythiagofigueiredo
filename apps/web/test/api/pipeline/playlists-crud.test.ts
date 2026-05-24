import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_PLAYLIST_ID = '22222222-2222-2222-2222-222222222222'
const MOCK_ITEM_ID = '33333333-3333-3333-3333-333333333333'
const MOCK_EDGE_ID = '44444444-4444-4444-4444-444444444444'
const MOCK_POST_ID = '55555555-5555-5555-5555-555555555555'
const MOCK_SOURCE_ITEM = '66666666-6666-6666-6666-666666666666'
const MOCK_TARGET_ITEM = '77777777-7777-7777-7777-777777777777'

// ─── Mocks — must cover ALL transitive @/ imports from playlist route files ───

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn(),
  authenticateWrite: vi.fn(),
  pipelineError: vi.fn(
    (code: string, msg: string, status: number) =>
      new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
  ),
  pipelineSuccess: vi.fn(
    (data: unknown, status: number) =>
      new Response(JSON.stringify({ data }), { status }),
  ),
  parseBody: vi.fn(),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/pipeline/schemas', () => ({
  PipelineCreatePlaylistSchema: { safeParse: vi.fn() },
  PipelineUpdatePlaylistSchema: { safeParse: vi.fn() },
  PipelineAddItemSchema: { safeParse: vi.fn() },
  PipelineBulkAddItemsSchema: { safeParse: vi.fn() },
  PipelineCreateEdgeSchema: { safeParse: vi.fn() },
  PipelineBulkCreateEdgesSchema: { safeParse: vi.fn() },
  PipelineReorderSchema: { safeParse: vi.fn() },
}))

vi.mock('@/lib/playlists/queries', () => ({
  listPlaylists: vi.fn(),
  getPlaylistItemCounts: vi.fn(),
  resolveUniqueSlug: vi.fn(),
  getPlaylistGraph: vi.fn(),
  getNextSortOrder: vi.fn(),
}))

vi.mock('@/lib/playlists/canvas/auto-layout', () => ({
  computeAutoLayout: vi.fn(),
}))

vi.mock('@/lib/pipeline/logger', () => ({
  pipelineLog: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import {
  PipelineCreatePlaylistSchema,
  PipelineUpdatePlaylistSchema,
  PipelineAddItemSchema,
  PipelineBulkAddItemsSchema,
  PipelineCreateEdgeSchema,
  PipelineBulkCreateEdgesSchema,
  PipelineReorderSchema,
} from '@/lib/pipeline/schemas'
import { listPlaylists, getPlaylistItemCounts, resolveUniqueSlug, getPlaylistGraph, getNextSortOrder } from '@/lib/playlists/queries'
import { computeAutoLayout } from '@/lib/playlists/canvas/auto-layout'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockAuthRead() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as never)
}
function mockAuthWrite() {
  vi.mocked(authenticateWrite).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as never)
}
function mockAuthFail(mode: 'read' | 'write' = 'read') {
  const resp = new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 })
  if (mode === 'read') vi.mocked(authenticateRead).mockResolvedValue(resp as never)
  else vi.mocked(authenticateWrite).mockResolvedValue(resp as never)
}

function createMockChain(finalResult: { data?: unknown; error?: unknown; count?: number | null }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'in', 'or', 'order', 'limit', 'not', 'neq', 'contains', 'ilike', 'textSearch']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockResolvedValue({ data: finalResult.data, error: finalResult.error })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: finalResult.data, error: finalResult.error })
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: finalResult.data, error: finalResult.error, count: finalResult.count ?? null })
  return chain
}

function makeParams(id: string) { return { params: Promise.resolve({ id }) } }
function makeItemParams(id: string, itemId: string) { return { params: Promise.resolve({ id, itemId }) } }
function makeEdgeParams(id: string, edgeId: string) { return { params: Promise.resolve({ id, edgeId }) } }
function postReq() { return new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }) }
function deleteReq() { return new NextRequest('http://localhost/x', { method: 'DELETE' }) }
function patchReq() { return new NextRequest('http://localhost/x', { method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json' } }) }

// ─── GET /api/pipeline/playlists ─────────────────────────────────────────────

describe('GET /api/pipeline/playlists', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('read')
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(401)
  })

  it('returns playlists with item counts', async () => {
    mockAuthRead()
    const playlists = [{ id: MOCK_PLAYLIST_ID, name_pt: 'Lista', name_en: 'List', slug: 'list', status: 'draft', category: null, description_pt: null, description_en: null, cover_image_url: null, created_at: '2026-01-01', updated_at: '2026-01-01' }]
    vi.mocked(listPlaylists).mockResolvedValue(playlists)
    vi.mocked(getPlaylistItemCounts).mockResolvedValue(new Map([[MOCK_PLAYLIST_ID, 3]]))

    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].item_count).toBe(3)
  })

  it('passes filter params from search query', async () => {
    mockAuthRead()
    vi.mocked(listPlaylists).mockResolvedValue([])
    vi.mocked(getPlaylistItemCounts).mockResolvedValue(new Map())

    const url = 'http://localhost/x?status=published&category=series&search=test'
    const res = await GET(new NextRequest(url))
    expect(res.status).toBe(200)
    expect(vi.mocked(listPlaylists)).toHaveBeenCalledWith(MOCK_SITE_ID, {
      status: 'published',
      category: 'series',
      search: 'test',
    })
  })
})

// ─── POST /api/pipeline/playlists ────────────────────────────────────────────

describe('POST /api/pipeline/playlists', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const res = await POST(postReq())
    expect(res.status).toBe(401)
  })

  it('rejects invalid body', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({})
    vi.mocked(PipelineCreatePlaylistSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'name_en required' }] },
    } as never)
    const res = await POST(postReq())
    expect(res.status).toBe(400)
  })

  it('returns 409 when slug exhausted', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ name_en: 'Test' })
    vi.mocked(PipelineCreatePlaylistSchema.safeParse).mockReturnValue({
      success: true, data: { name_en: 'Test', name_pt: '', status: 'draft' },
    } as never)
    vi.mocked(resolveUniqueSlug).mockRejectedValue(new Error('exhausted'))

    const res = await POST(postReq())
    expect(res.status).toBe(409)
  })

  it('creates playlist successfully', async () => {
    mockAuthWrite()
    const data = { name_en: 'Test', name_pt: '', status: 'draft' }
    vi.mocked(parseBody).mockResolvedValue(data)
    vi.mocked(PipelineCreatePlaylistSchema.safeParse).mockReturnValue({
      success: true, data,
    } as never)
    vi.mocked(resolveUniqueSlug).mockResolvedValue('test')

    const created = { id: MOCK_PLAYLIST_ID, name_en: 'Test', name_pt: '', slug: 'test', status: 'draft', category: null, description_en: null, description_pt: null, cover_image_url: null, created_at: '2026-01-01', updated_at: '2026-01-01' }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: created })),
    } as never)

    const res = await POST(postReq())
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe(MOCK_PLAYLIST_ID)
    expect(body.data.slug).toBe('test')
  })

  it('returns 500 on db insert error', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ name_en: 'Test' })
    vi.mocked(PipelineCreatePlaylistSchema.safeParse).mockReturnValue({
      success: true, data: { name_en: 'Test', name_pt: '', status: 'draft' },
    } as never)
    vi.mocked(resolveUniqueSlug).mockResolvedValue('test')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null, error: { message: 'constraint violation' } })),
    } as never)

    const res = await POST(postReq())
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/pipeline/playlists/[id] ────────────────────────────────────────

describe('GET /api/pipeline/playlists/[id]', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/[id]/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('read')
    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when playlist not found', async () => {
    mockAuthRead()
    vi.mocked(getPlaylistGraph).mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(404)
  })

  it('returns playlist graph with items and edges', async () => {
    mockAuthRead()
    const graph = {
      playlist: { id: MOCK_PLAYLIST_ID, name_pt: 'P', name_en: 'P', slug: 'p', status: 'draft', category: null, description_pt: null, description_en: null, cover_image_url: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
      items: [{ id: MOCK_ITEM_ID, title: 'Item 1', content_type: 'blog_post', status: 'active', category: null, metadata: {}, position_x: 0, position_y: 0, sort_order: 1000, is_ghost: false, other_playlist_count: 0 }],
      edges: [{ id: MOCK_EDGE_ID, source_item_id: MOCK_SOURCE_ITEM, target_item_id: MOCK_TARGET_ITEM, edge_type: 'sequence', label: null }],
    }
    vi.mocked(getPlaylistGraph).mockResolvedValue(graph)

    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.playlist.id).toBe(MOCK_PLAYLIST_ID)
    expect(body.data.items).toHaveLength(1)
    expect(body.data.edges).toHaveLength(1)
  })
})

// ─── PATCH /api/pipeline/playlists/[id] ──────────────────────────────────────

describe('PATCH /api/pipeline/playlists/[id]', () => {
  let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/[id]/route')
    PATCH = mod.PATCH
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const res = await PATCH(patchReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(401)
  })

  it('rejects invalid body', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({})
    vi.mocked(PipelineUpdatePlaylistSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'Invalid field' }] },
    } as never)
    const res = await PATCH(patchReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when playlist not found', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ name_en: 'Updated' })
    vi.mocked(PipelineUpdatePlaylistSchema.safeParse).mockReturnValue({
      success: true, data: { name_en: 'Updated' },
    } as never)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null, error: { message: 'not found' } })),
    } as never)

    const res = await PATCH(patchReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(404)
  })

  it('updates playlist successfully', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ name_en: 'Updated' })
    vi.mocked(PipelineUpdatePlaylistSchema.safeParse).mockReturnValue({
      success: true, data: { name_en: 'Updated' },
    } as never)
    const updated = { id: MOCK_PLAYLIST_ID, name_en: 'Updated', name_pt: '', slug: 'test', status: 'draft', category: null, description_en: null, description_pt: null, cover_image_url: null, created_at: '2026-01-01', updated_at: '2026-01-02' }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: updated })),
    } as never)

    const res = await PATCH(patchReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name_en).toBe('Updated')
  })
})

// ─── DELETE /api/pipeline/playlists/[id] ─────────────────────────────────────

describe('DELETE /api/pipeline/playlists/[id]', () => {
  let DELETE: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/[id]/route')
    DELETE = mod.DELETE
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const res = await DELETE(deleteReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when playlist not found', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as never)
    const res = await DELETE(deleteReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(404)
  })

  it('deletes playlist successfully', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: { id: MOCK_PLAYLIST_ID } })),
    } as never)
    const res = await DELETE(deleteReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.deleted).toBe(true)
  })
})

// ─── POST /api/pipeline/playlists/[id]/items ─────────────────────────────────

describe('POST /api/pipeline/playlists/[id]/items', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/[id]/items/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when playlist not found', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as never)
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(404)
  })

  it('rejects invalid body', async () => {
    mockAuthWrite()
    // First chain returns playlist found, then body parse happens
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: { id: MOCK_PLAYLIST_ID } })),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({})
    vi.mocked(PipelineAddItemSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'Exactly one content reference is required' }] },
    } as never)

    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(400)
  })

  it('returns existing item when duplicate detected', async () => {
    mockAuthWrite()
    const existingItem = { id: MOCK_ITEM_ID }
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        // call 1: playlist check => found
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        // call 2: dup check => found
        return createMockChain({ data: existingItem })
      }),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({ blog_post_id: MOCK_POST_ID })
    vi.mocked(PipelineAddItemSchema.safeParse).mockReturnValue({
      success: true, data: { blog_post_id: MOCK_POST_ID },
    } as never)

    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.already_existed).toBe(true)
  })

  it('creates item successfully', async () => {
    mockAuthWrite()
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        // call 1: playlist check => found
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        // call 2: dup check => not found
        if (callCount === 2) return createMockChain({ data: null })
        // call 3: insert => created
        return createMockChain({ data: { id: MOCK_ITEM_ID } })
      }),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({ blog_post_id: MOCK_POST_ID })
    vi.mocked(PipelineAddItemSchema.safeParse).mockReturnValue({
      success: true, data: { blog_post_id: MOCK_POST_ID },
    } as never)
    vi.mocked(getNextSortOrder).mockResolvedValue(1000)

    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe(MOCK_ITEM_ID)
    expect(body.data.already_existed).toBe(false)
  })

  it('returns 400 on FK violation', async () => {
    mockAuthWrite()
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        if (callCount === 2) return createMockChain({ data: null })
        return createMockChain({ data: null, error: { code: '23503', message: 'FK error' } })
      }),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({ blog_post_id: MOCK_POST_ID })
    vi.mocked(PipelineAddItemSchema.safeParse).mockReturnValue({
      success: true, data: { blog_post_id: MOCK_POST_ID },
    } as never)
    vi.mocked(getNextSortOrder).mockResolvedValue(1000)

    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(400)
  })
})

// ─── DELETE /api/pipeline/playlists/[id]/items/[itemId] ──────────────────────

describe('DELETE /api/pipeline/playlists/[id]/items/[itemId]', () => {
  let DELETE: (req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/[id]/items/[itemId]/route')
    DELETE = mod.DELETE
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const res = await DELETE(deleteReq(), makeItemParams(MOCK_PLAYLIST_ID, MOCK_ITEM_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when playlist not found', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as never)
    const res = await DELETE(deleteReq(), makeItemParams(MOCK_PLAYLIST_ID, MOCK_ITEM_ID))
    expect(res.status).toBe(404)
  })

  it('returns 404 when item not found in playlist', async () => {
    mockAuthWrite()
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        return createMockChain({ data: null })
      }),
    } as never)
    const res = await DELETE(deleteReq(), makeItemParams(MOCK_PLAYLIST_ID, MOCK_ITEM_ID))
    expect(res.status).toBe(404)
  })

  it('deletes item successfully', async () => {
    mockAuthWrite()
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        if (callCount === 2) return createMockChain({ data: { id: MOCK_ITEM_ID } })
        return createMockChain({ data: null, error: null })
      }),
    } as never)
    const res = await DELETE(deleteReq(), makeItemParams(MOCK_PLAYLIST_ID, MOCK_ITEM_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.deleted).toBe(true)
  })
})

// ─── POST /api/pipeline/playlists/[id]/edges ─────────────────────────────────

describe('POST /api/pipeline/playlists/[id]/edges', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/[id]/edges/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when playlist not found', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as never)
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(404)
  })

  it('rejects invalid body', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: { id: MOCK_PLAYLIST_ID } })),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({})
    vi.mocked(PipelineCreateEdgeSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'source_item_id required' }] },
    } as never)
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(400)
  })

  it('rejects self-loop', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: { id: MOCK_PLAYLIST_ID } })),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({ source_item_id: MOCK_SOURCE_ITEM, target_item_id: MOCK_SOURCE_ITEM, edge_type: 'sequence' })
    vi.mocked(PipelineCreateEdgeSchema.safeParse).mockReturnValue({
      success: true, data: { source_item_id: MOCK_SOURCE_ITEM, target_item_id: MOCK_SOURCE_ITEM, edge_type: 'sequence' },
    } as never)
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('Self-loops')
  })

  it('returns existing edge when duplicate', async () => {
    mockAuthWrite()
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        return createMockChain({ data: { id: MOCK_EDGE_ID } })
      }),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({ source_item_id: MOCK_SOURCE_ITEM, target_item_id: MOCK_TARGET_ITEM, edge_type: 'sequence' })
    vi.mocked(PipelineCreateEdgeSchema.safeParse).mockReturnValue({
      success: true, data: { source_item_id: MOCK_SOURCE_ITEM, target_item_id: MOCK_TARGET_ITEM, edge_type: 'sequence' },
    } as never)

    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.already_existed).toBe(true)
  })

  it('creates edge successfully', async () => {
    mockAuthWrite()
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        if (callCount === 2) return createMockChain({ data: null })
        return createMockChain({ data: { id: MOCK_EDGE_ID } })
      }),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({ source_item_id: MOCK_SOURCE_ITEM, target_item_id: MOCK_TARGET_ITEM, edge_type: 'sequence' })
    vi.mocked(PipelineCreateEdgeSchema.safeParse).mockReturnValue({
      success: true, data: { source_item_id: MOCK_SOURCE_ITEM, target_item_id: MOCK_TARGET_ITEM, edge_type: 'sequence' },
    } as never)

    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe(MOCK_EDGE_ID)
    expect(body.data.already_existed).toBe(false)
  })

  it('returns 422 on cycle detection', async () => {
    mockAuthWrite()
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        if (callCount === 2) return createMockChain({ data: null })
        return createMockChain({ data: null, error: { code: 'P0001', message: 'cycle detected' } })
      }),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({ source_item_id: MOCK_SOURCE_ITEM, target_item_id: MOCK_TARGET_ITEM, edge_type: 'sequence' })
    vi.mocked(PipelineCreateEdgeSchema.safeParse).mockReturnValue({
      success: true, data: { source_item_id: MOCK_SOURCE_ITEM, target_item_id: MOCK_TARGET_ITEM, edge_type: 'sequence' },
    } as never)

    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(422)
  })
})

// ─── POST /api/pipeline/playlists/[id]/edges/bulk ────────────────────────────

describe('POST /api/pipeline/playlists/[id]/edges/bulk', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/[id]/edges/bulk/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when playlist not found', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as never)
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(404)
  })

  it('rejects invalid body', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: { id: MOCK_PLAYLIST_ID } })),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({})
    vi.mocked(PipelineBulkCreateEdgesSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'edges required' }] },
    } as never)
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(400)
  })

  it('processes mixed results: created, skipped, self-loop errors', async () => {
    mockAuthWrite()
    const edges = [
      { source_item_id: MOCK_SOURCE_ITEM, target_item_id: MOCK_TARGET_ITEM, edge_type: 'sequence' },
      { source_item_id: MOCK_SOURCE_ITEM, target_item_id: MOCK_SOURCE_ITEM, edge_type: 'sequence' }, // self-loop
    ]
    vi.mocked(parseBody).mockResolvedValue({ edges })
    vi.mocked(PipelineBulkCreateEdgesSchema.safeParse).mockReturnValue({
      success: true, data: { edges },
    } as never)

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        // dup check for first edge => not found
        if (callCount === 2) return createMockChain({ data: null })
        // insert for first edge => success
        return createMockChain({ data: { id: MOCK_EDGE_ID } })
      }),
    } as never)

    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.created).toBe(1)
    expect(body.data.errors).toHaveLength(1)
    expect(body.data.errors[0].code).toBe('VALIDATION_ERROR')
  })
})

// ─── DELETE /api/pipeline/playlists/[id]/edges/[edgeId] ──────────────────────

describe('DELETE /api/pipeline/playlists/[id]/edges/[edgeId]', () => {
  let DELETE: (req: NextRequest, ctx: { params: Promise<{ id: string; edgeId: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/[id]/edges/[edgeId]/route')
    DELETE = mod.DELETE
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const res = await DELETE(deleteReq(), makeEdgeParams(MOCK_PLAYLIST_ID, MOCK_EDGE_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when playlist not found', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as never)
    const res = await DELETE(deleteReq(), makeEdgeParams(MOCK_PLAYLIST_ID, MOCK_EDGE_ID))
    expect(res.status).toBe(404)
  })

  it('returns 404 when edge not found in playlist', async () => {
    mockAuthWrite()
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        return createMockChain({ data: null })
      }),
    } as never)
    const res = await DELETE(deleteReq(), makeEdgeParams(MOCK_PLAYLIST_ID, MOCK_EDGE_ID))
    expect(res.status).toBe(404)
  })

  it('deletes edge successfully', async () => {
    mockAuthWrite()
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        if (callCount === 2) return createMockChain({ data: { id: MOCK_EDGE_ID } })
        return createMockChain({ data: null, error: null })
      }),
    } as never)
    const res = await DELETE(deleteReq(), makeEdgeParams(MOCK_PLAYLIST_ID, MOCK_EDGE_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.deleted).toBe(true)
  })
})

// ─── POST /api/pipeline/playlists/[id]/reorder ──────────────────────────────

describe('POST /api/pipeline/playlists/[id]/reorder', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/[id]/reorder/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when playlist not found', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as never)
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(404)
  })

  it('rejects invalid body', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: { id: MOCK_PLAYLIST_ID } })),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({})
    vi.mocked(PipelineReorderSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'item_ids required' }] },
    } as never)
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 when items not found in playlist', async () => {
    mockAuthWrite()
    const itemIds = [MOCK_ITEM_ID, MOCK_SOURCE_ITEM]
    vi.mocked(parseBody).mockResolvedValue({ item_ids: itemIds })
    vi.mocked(PipelineReorderSchema.safeParse).mockReturnValue({
      success: true, data: { item_ids: itemIds },
    } as never)

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        // items query returns only one of two
        const chain = createMockChain({ data: [{ id: MOCK_ITEM_ID }] })
        chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [{ id: MOCK_ITEM_ID }], error: null, count: null })
        return chain
      }),
    } as never)

    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('Items not found')
  })

  it('reorders items successfully', async () => {
    mockAuthWrite()
    const itemIds = [MOCK_ITEM_ID, MOCK_SOURCE_ITEM]
    vi.mocked(parseBody).mockResolvedValue({ item_ids: itemIds })
    vi.mocked(PipelineReorderSchema.safeParse).mockReturnValue({
      success: true, data: { item_ids: itemIds },
    } as never)

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        // items found
        if (callCount === 2) {
          const chain = createMockChain({ data: [{ id: MOCK_ITEM_ID }, { id: MOCK_SOURCE_ITEM }] })
          chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [{ id: MOCK_ITEM_ID }, { id: MOCK_SOURCE_ITEM }], error: null, count: null })
          return chain
        }
        // update calls
        return createMockChain({ data: null, error: null })
      }),
    } as never)

    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.reordered).toBe(true)
    expect(body.data.count).toBe(2)
  })
})

// ─── POST /api/pipeline/playlists/[id]/auto-layout ──────────────────────────

describe('POST /api/pipeline/playlists/[id]/auto-layout', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/[id]/auto-layout/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when playlist not found', async () => {
    mockAuthWrite()
    vi.mocked(getPlaylistGraph).mockResolvedValue(null)
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(404)
  })

  it('returns empty positions when no items', async () => {
    mockAuthWrite()
    vi.mocked(getPlaylistGraph).mockResolvedValue({
      playlist: { id: MOCK_PLAYLIST_ID } as never,
      items: [],
      edges: [],
    })
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.positions).toHaveLength(0)
    expect(body.data.layers).toBe(0)
  })

  it('computes and applies layout successfully', async () => {
    mockAuthWrite()
    const items = [{ id: MOCK_ITEM_ID, title: 'A', content_type: 'blog_post', status: 'active', category: null, metadata: {}, position_x: 0, position_y: 0, sort_order: 1000, is_ghost: false, other_playlist_count: 0 }]
    const edges: never[] = []
    vi.mocked(getPlaylistGraph).mockResolvedValue({
      playlist: { id: MOCK_PLAYLIST_ID } as never,
      items,
      edges,
    })
    vi.mocked(computeAutoLayout).mockReturnValue([
      { itemId: MOCK_ITEM_ID, x: 0, y: 100 },
    ])
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null, error: null })),
    } as never)

    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.positions).toHaveLength(1)
    expect(body.data.positions[0].item_id).toBe(MOCK_ITEM_ID)
  })
})

// ─── POST /api/pipeline/playlists/[id]/items/bulk ────────────────────────────

describe('POST /api/pipeline/playlists/[id]/items/bulk', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/playlists/[id]/items/bulk/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when playlist not found', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as never)
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(404)
  })

  it('rejects invalid body', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: { id: MOCK_PLAYLIST_ID } })),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({})
    vi.mocked(PipelineBulkAddItemsSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'items required' }] },
    } as never)
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(400)
  })

  it('rejects items with multiple content references', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: { id: MOCK_PLAYLIST_ID } })),
    } as never)
    vi.mocked(parseBody).mockResolvedValue({ items: [{ blog_post_id: MOCK_POST_ID, pipeline_id: MOCK_SOURCE_ITEM }] })
    vi.mocked(PipelineBulkAddItemsSchema.safeParse).mockReturnValue({
      success: true,
      data: { items: [{ blog_post_id: MOCK_POST_ID, pipeline_id: MOCK_SOURCE_ITEM }] },
    } as never)
    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('exactly one content reference')
  })

  it('processes bulk add with mixed results', async () => {
    mockAuthWrite()
    const items = [
      { blog_post_id: MOCK_POST_ID },
      { blog_post_id: MOCK_SOURCE_ITEM },
    ]
    vi.mocked(parseBody).mockResolvedValue({ items })
    vi.mocked(PipelineBulkAddItemsSchema.safeParse).mockReturnValue({
      success: true, data: { items },
    } as never)
    vi.mocked(getNextSortOrder).mockResolvedValue(1000)

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        // call 1: playlist check
        if (callCount === 1) return createMockChain({ data: { id: MOCK_PLAYLIST_ID } })
        // call 2: dup check item 1 => not found
        if (callCount === 2) return createMockChain({ data: null })
        // call 3: insert item 1 => ok
        if (callCount === 3) return createMockChain({ data: { id: MOCK_ITEM_ID } })
        // call 4: dup check item 2 => already exists
        return createMockChain({ data: { id: MOCK_EDGE_ID } })
      }),
    } as never)

    const res = await POST(postReq(), makeParams(MOCK_PLAYLIST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.added).toBe(1)
    expect(body.data.skipped).toBe(1)
    expect(body.data.items).toHaveLength(2)
  })
})
