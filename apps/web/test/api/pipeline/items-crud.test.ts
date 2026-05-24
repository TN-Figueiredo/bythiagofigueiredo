import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ITEM_ID = '22222222-2222-2222-2222-222222222222'

// ─── Mocks — must cover ALL transitive @/ imports from the route file ────────

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
  PipelineItemUpdateSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
  },
  FORMAT_METADATA_SCHEMAS: {
    video: { safeParse: vi.fn().mockReturnValue({ success: true }) },
    blog_post: { safeParse: vi.fn().mockReturnValue({ success: true }) },
    newsletter: { safeParse: vi.fn().mockReturnValue({ success: true }) },
    course: { safeParse: vi.fn().mockReturnValue({ success: true }) },
    campaign: { safeParse: vi.fn().mockReturnValue({ success: true }) },
  },
  FORMATS: ['video', 'blog_post', 'newsletter', 'course', 'campaign'],
}))

vi.mock('@/lib/pipeline/workflows', () => ({
  isValidStage: vi.fn().mockReturnValue(true),
  WORKFLOWS: {
    video: [{ stage: 'idea', position: 1 }, { stage: 'roteiro', position: 2 }, { stage: 'published', position: 7 }],
    blog_post: [{ stage: 'idea', position: 1 }, { stage: 'draft', position: 2 }, { stage: 'published', position: 5 }],
    newsletter: [{ stage: 'idea', position: 1 }, { stage: 'published', position: 5 }],
    course: [{ stage: 'idea', position: 1 }, { stage: 'published', position: 5 }],
    campaign: [{ stage: 'idea', position: 1 }, { stage: 'sent', position: 5 }],
  },
}))

vi.mock('@/lib/pipeline/queries', () => ({
  decodeCursor: vi.fn(),
  encodeCursor: vi.fn(),
  parseSortParam: vi.fn().mockReturnValue({ column: 'created_at', ascending: false }),
  applyPipelineFilters: vi.fn().mockImplementation((q: unknown) => q),
}))

vi.mock('@/lib/pipeline/sanitize', () => ({
  sanitizeForFilter: vi.fn().mockImplementation((v: string) => v),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { PipelineItemUpdateSchema } from '@/lib/pipeline/schemas'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockAuthSuccess(mode: 'read' | 'write' = 'write') {
  const result = {
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any
  if (mode === 'read') vi.mocked(authenticateRead).mockResolvedValue(result)
  else vi.mocked(authenticateWrite).mockResolvedValue(result)
}

function mockAuthFailure(mode: 'read' | 'write' = 'write') {
  const resp = new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }), { status: 401 })
  if (mode === 'read') vi.mocked(authenticateRead).mockResolvedValue(resp as any)
  else vi.mocked(authenticateWrite).mockResolvedValue(resp as any)
}

function createMockChain(finalResult: { data?: unknown; error?: unknown }) {
  const chain: Record<string, any> = {}
  const methods = ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'in',
    'order', 'limit', 'single', 'filter', 'maybeSingle', 'not', 'neq', 'or']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: any) => any) => resolve(finalResult)
  return chain
}

function makeReq(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ─── GET /api/pipeline/items/[id] ────────────────────────────────────────────

describe('GET /api/pipeline/items/[id]', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/route')
    GET = mod.GET
  })

  it('rejects invalid UUID', async () => {
    const res = await GET(makeReq('/api/pipeline/items/not-uuid'), makeParams('not-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFailure('read')
    const res = await GET(makeReq('/api/pipeline/items/' + MOCK_ITEM_ID), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when item not found', async () => {
    mockAuthSuccess('read')
    const chain = createMockChain({ data: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)
    const res = await GET(makeReq('/api/pipeline/items/' + MOCK_ITEM_ID), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(404)
  })

  it('returns item with meta on success', async () => {
    mockAuthSuccess('read')
    const itemData = { id: MOCK_ITEM_ID, version: 1, updated_at: '2026-01-01T00:00:00Z' }
    const historyData = [{ id: 'h1', event_type: 'created' }]
    const depsData = [{ blocker_id: 'a', blocked_id: 'b', dependency_type: 'hard' }]

    const itemChain = createMockChain({ data: itemData })
    const historyChain = createMockChain({ data: historyData })
    const depsChain = createMockChain({ data: depsData })

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return itemChain
        if (callCount === 2) return historyChain
        return depsChain
      }),
    } as any)

    const res = await GET(makeReq('/api/pipeline/items/' + MOCK_ITEM_ID), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(MOCK_ITEM_ID)
    expect(body.meta.version).toBe(1)
  })
})

// ─── PATCH /api/pipeline/items/[id] ──────────────────────────────────────────

describe('PATCH /api/pipeline/items/[id]', () => {
  let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/route')
    PATCH = mod.PATCH
  })

  it('rejects invalid UUID', async () => {
    const res = await PATCH(makeReq('/api/pipeline/items/bad', { method: 'PATCH', body: '{}' }), makeParams('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFailure()
    vi.mocked(parseBody).mockResolvedValue({})
    const req = makeReq('/api/pipeline/items/' + MOCK_ITEM_ID, {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json', 'X-Expected-Version': '1' },
    })
    const res = await PATCH(req, makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(401)
  })

  it('returns 400 when X-Expected-Version header missing', async () => {
    mockAuthSuccess()
    const req = makeReq('/api/pipeline/items/' + MOCK_ITEM_ID, {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ title_pt: 'Novo' })
    vi.mocked(PipelineItemUpdateSchema.safeParse).mockReturnValue({ success: true, data: { title_pt: 'Novo' } } as any)
    const chain = createMockChain({ data: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const req = makeReq('/api/pipeline/items/' + MOCK_ITEM_ID, {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json', 'X-Expected-Version': '1' },
    })
    const res = await PATCH(req, makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(404)
  })

  it('returns 409 on version mismatch', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ title_pt: 'Novo' })
    vi.mocked(PipelineItemUpdateSchema.safeParse).mockReturnValue({ success: true, data: { title_pt: 'Novo' } } as any)

    const currentChain = createMockChain({ data: { version: 5, format: 'video' } })
    const freshChain = createMockChain({ data: { version: 5 } })

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return currentChain
        return freshChain
      }),
    } as any)

    const req = makeReq('/api/pipeline/items/' + MOCK_ITEM_ID, {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json', 'X-Expected-Version': '3' },
    })
    const res = await PATCH(req, makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(409)
  })

  it('updates item successfully on matching version', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ title_pt: 'Novo' })
    vi.mocked(PipelineItemUpdateSchema.safeParse).mockReturnValue({ success: true, data: { title_pt: 'Novo' } } as any)

    const currentChain = createMockChain({ data: { version: 1, format: 'video' } })
    const updatedData = { id: MOCK_ITEM_ID, version: 2, updated_at: '2026-01-01', title_pt: 'Novo' }
    const updateChain = createMockChain({ data: updatedData })

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return currentChain
        return updateChain
      }),
    } as any)

    const req = makeReq('/api/pipeline/items/' + MOCK_ITEM_ID, {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json', 'X-Expected-Version': '1' },
    })
    const res = await PATCH(req, makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.title_pt).toBe('Novo')
  })
})

// ─── DELETE /api/pipeline/items/[id] ─────────────────────────────────────────

describe('DELETE /api/pipeline/items/[id]', () => {
  let DEL: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/route')
    DEL = mod.DELETE
  })

  it('rejects invalid UUID', async () => {
    const res = await DEL(makeReq('/api/pipeline/items/bad', { method: 'DELETE' }), makeParams('bad'))
    expect(res.status).toBe(400)
  })

  it('soft-deletes (archives) item successfully', async () => {
    mockAuthSuccess()
    const chain = createMockChain({ error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await DEL(makeReq('/api/pipeline/items/' + MOCK_ITEM_ID, { method: 'DELETE' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.archived).toBe(true)
  })

  it('returns error on DB failure', async () => {
    mockAuthSuccess()
    const chain = createMockChain({ error: { message: 'DB error' } })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await DEL(makeReq('/api/pipeline/items/' + MOCK_ITEM_ID, { method: 'DELETE' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(400)
  })
})
