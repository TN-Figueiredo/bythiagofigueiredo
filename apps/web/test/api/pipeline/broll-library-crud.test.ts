import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ASSET_ID = '22222222-2222-2222-2222-222222222222'

// ─── Mocks — must cover ALL transitive @/ imports from both route files ──────

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

vi.mock('@/lib/pipeline/broll-schemas', () => ({
  BRollAssetCreateSchema: { safeParse: vi.fn() },
  BRollAssetUpdateSchema: { safeParse: vi.fn() },
}))

vi.mock('@/lib/pipeline/sanitize', () => ({
  sanitizeForFilter: vi.fn((v: string) => v),
  sanitizeForTsquery: vi.fn((v: string) => v),
}))

vi.mock('@/lib/pipeline/logger', () => ({
  pipelineLog: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { BRollAssetCreateSchema, BRollAssetUpdateSchema } from '@/lib/pipeline/broll-schemas'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function mockAuthRead() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}
function mockAuthWrite() {
  vi.mocked(authenticateWrite).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}
function mockAuthFail(mode: 'read' | 'write' = 'read') {
  const resp = new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }) as any
  if (mode === 'read') vi.mocked(authenticateRead).mockResolvedValue(resp)
  else vi.mocked(authenticateWrite).mockResolvedValue(resp)
}

function createMockChain(finalResult: { data?: unknown; error?: unknown; count?: number | null }) {
  const chain: Record<string, any> = {}
  for (const m of ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'in', 'or', 'order', 'limit', 'not', 'neq', 'contains', 'ilike', 'textSearch']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockResolvedValue({ data: finalResult.data, error: finalResult.error })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: finalResult.data, error: finalResult.error })
  chain.then = (resolve: (v: any) => any) => resolve({ data: finalResult.data, error: finalResult.error, count: finalResult.count ?? null })
  return chain
}

function makeParams(id: string) { return { params: Promise.resolve({ id }) } }

// ─── GET /api/pipeline/broll-library/[id] ────────────────────────────────────

describe('GET /api/pipeline/broll-library/[id]', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/broll-library/[id]/route')
    GET = mod.GET
  })

  it('rejects invalid UUID', async () => {
    const res = await GET(new NextRequest('http://localhost/x'), makeParams('xyz'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('read')
    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when asset not found', async () => {
    mockAuthRead()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null, error: { code: 'PGRST116' } })),
    } as any)
    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(404)
  })

  it('returns asset with usage data', async () => {
    mockAuthRead()
    const asset = { id: MOCK_ASSET_ID, original_filename: 'test.mp4', type: 'footage' }
    const usage = [{ id: 'u1', pipeline_item_id: 'p1', usage_type: 'broll' }]

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: asset })
        return createMockChain({ data: usage })
      }),
    } as any)

    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(MOCK_ASSET_ID)
    expect(body.data.usage).toHaveLength(1)
  })
})

// ─── PATCH /api/pipeline/broll-library/[id] ──────────────────────────────────

describe('PATCH /api/pipeline/broll-library/[id]', () => {
  let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/broll-library/[id]/route')
    PATCH = mod.PATCH
  })

  it('rejects invalid UUID', async () => {
    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams('bad'))
    expect(res.status).toBe(400)
  })

  it('rejects invalid body', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ version: 1, description: 'x' })
    vi.mocked(BRollAssetUpdateSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'Invalid field' }] },
    } as any)
    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when asset not found during OCC', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ version: 1, description: 'Updated' })
    vi.mocked(BRollAssetUpdateSchema.safeParse).mockReturnValue({
      success: true, data: { version: 1, description: 'Updated' },
    } as any)

    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as any)

    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(404)
  })

  it('returns 409 on version mismatch', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ version: 1, description: 'Updated' })
    vi.mocked(BRollAssetUpdateSchema.safeParse).mockReturnValue({
      success: true, data: { version: 1, description: 'Updated' },
    } as any)

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount >= 2) return createMockChain({ data: { id: MOCK_ASSET_ID, version: 5 } })
        return createMockChain({ data: null })
      }),
    } as any)

    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(409)
  })

  it('updates asset successfully', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ version: 1, description: 'Updated' })
    vi.mocked(BRollAssetUpdateSchema.safeParse).mockReturnValue({
      success: true, data: { version: 1, description: 'Updated' },
    } as any)

    const updated = { id: MOCK_ASSET_ID, version: 2, description: 'Updated' }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: updated })),
    } as any)

    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.description).toBe('Updated')
  })
})

// ─── DELETE /api/pipeline/broll-library/[id] ─────────────────────────────────

describe('DELETE /api/pipeline/broll-library/[id]', () => {
  let DELETE: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/broll-library/[id]/route')
    DELETE = mod.DELETE
  })

  it('rejects invalid UUID', async () => {
    const req = new NextRequest('http://localhost/x', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const req = new NextRequest('http://localhost/x', { method: 'DELETE' })
    const res = await DELETE(req, makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when asset not found', async () => {
    mockAuthWrite()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null, error: { message: 'not found' } })),
    } as any)
    const req = new NextRequest('http://localhost/x', { method: 'DELETE' })
    const res = await DELETE(req, makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(404)
  })

  it('soft-deletes (retires) asset successfully', async () => {
    mockAuthWrite()
    const data = { id: MOCK_ASSET_ID, status: 'retired' }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data })),
    } as any)
    const req = new NextRequest('http://localhost/x', { method: 'DELETE' })
    const res = await DELETE(req, makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('retired')
  })
})

// ─── POST /api/pipeline/broll-library ────────────────────────────────────────

describe('POST /api/pipeline/broll-library', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/broll-library/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    vi.mocked(parseBody).mockResolvedValue({})
    const req = new NextRequest('http://localhost/x', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('rejects invalid body', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({})
    vi.mocked(BRollAssetCreateSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'Missing required fields' }] },
    } as any)
    const req = new NextRequest('http://localhost/x', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate SHA256', async () => {
    mockAuthWrite()
    const assetData = {
      asset_id: 'broll-001',
      original_filename: 'test.mp4',
      sha256: 'abc123def456',
      file_size_bytes: 1024,
      type: 'footage',
      source: 'camera-a',
      source_type: 'pessoal',
    }
    vi.mocked(parseBody).mockResolvedValue(assetData)
    vi.mocked(BRollAssetCreateSchema.safeParse).mockReturnValue({
      success: true, data: assetData,
    } as any)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null, error: { code: '23505', message: 'duplicate' } })),
    } as any)
    const req = new NextRequest('http://localhost/x', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })

  it('creates asset successfully', async () => {
    mockAuthWrite()
    const assetData = {
      asset_id: 'broll-001',
      original_filename: 'test.mp4',
      sha256: 'abc123def456',
      file_size_bytes: 1024,
      type: 'footage',
      source: 'camera-a',
      source_type: 'pessoal',
    }
    vi.mocked(parseBody).mockResolvedValue(assetData)
    vi.mocked(BRollAssetCreateSchema.safeParse).mockReturnValue({
      success: true, data: assetData,
    } as any)
    const created = { id: MOCK_ASSET_ID, ...assetData, version: 1 }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: created })),
    } as any)
    const req = new NextRequest('http://localhost/x', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe(MOCK_ASSET_ID)
  })
})
