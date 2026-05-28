import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ASSET_ID = '22222222-2222-2222-2222-222222222222'

// ─── Mocks — mock service layer instead of Supabase ─────────────────────────

vi.mock('@/lib/pipeline/services/broll', () => ({
  listBRollAssets: vi.fn(),
  createBRollAsset: vi.fn(),
  getBRollAsset: vi.fn(),
  updateBRollAsset: vi.fn(),
  retireBRollAsset: vi.fn(),
}))

vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn().mockReturnValue({
    siteId: MOCK_SITE_ID,
    permissions: ['read', 'write'],
    supabase: {},
    source: 'api_key',
  }),
  serviceErrorToResponse: vi.fn().mockImplementation((err: unknown) => {
    if (err instanceof PipelineServiceError) {
      return new Response(JSON.stringify({ error: { code: err.code, message: err.message } }), { status: err.status })
    }
    return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'unexpected' } }), { status: 500 })
  }),
}))

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
import {
  getBRollAsset,
  updateBRollAsset,
  retireBRollAsset,
  createBRollAsset,
} from '@/lib/pipeline/services/broll'

function mockAuthRead() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}
function mockAuthWrite() {
  vi.mocked(authenticateWrite).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}
function mockAuthFail(mode: 'read' | 'write' = 'read') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp = new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }) as any
  if (mode === 'read') vi.mocked(authenticateRead).mockResolvedValue(resp)
  else vi.mocked(authenticateWrite).mockResolvedValue(resp)
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
    vi.mocked(getBRollAsset).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Asset not found', 404),
    )
    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(404)
  })

  it('returns asset with usage data', async () => {
    mockAuthRead()
    const asset = { id: MOCK_ASSET_ID, original_filename: 'test.mp4', type: 'footage' }
    const usage = [{ id: 'u1', pipeline_item_id: 'p1', usage_type: 'broll' }]
    vi.mocked(getBRollAsset).mockResolvedValue({
      data: { ...asset, usage },
    } as never)

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
    vi.mocked(updateBRollAsset).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Invalid field', 400),
    )
    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when asset not found during OCC', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ version: 1, description: 'Updated' })
    vi.mocked(updateBRollAsset).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Asset not found', 404),
    )

    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(404)
  })

  it('returns 409 on version mismatch', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ version: 1, description: 'Updated' })
    vi.mocked(updateBRollAsset).mockRejectedValue(
      new PipelineServiceError('CONFLICT', 'Version mismatch: expected 1, current 5', 409),
    )

    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(409)
  })

  it('updates asset successfully', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ version: 1, description: 'Updated' })
    const updated = { id: MOCK_ASSET_ID, version: 2, description: 'Updated' }
    vi.mocked(updateBRollAsset).mockResolvedValue({ data: updated } as never)

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
    vi.mocked(retireBRollAsset).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Asset not found', 404),
    )
    const req = new NextRequest('http://localhost/x', { method: 'DELETE' })
    const res = await DELETE(req, makeParams(MOCK_ASSET_ID))
    expect(res.status).toBe(404)
  })

  it('soft-deletes (retires) asset successfully', async () => {
    mockAuthWrite()
    const data = { id: MOCK_ASSET_ID, status: 'retired' }
    vi.mocked(retireBRollAsset).mockResolvedValue({ data } as never)
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
    vi.mocked(createBRollAsset).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Missing required fields', 400),
    )
    const req = new NextRequest('http://localhost/x', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate SHA256', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({
      asset_id: 'broll-001',
      original_filename: 'test.mp4',
      sha256: 'abc123def456',
      file_size_bytes: 1024,
      type: 'footage',
      source: 'camera-a',
      source_type: 'pessoal',
    })
    vi.mocked(createBRollAsset).mockRejectedValue(
      new PipelineServiceError('CONFLICT', 'Asset with this ID or SHA256 already exists', 409),
    )
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
    const created = { id: MOCK_ASSET_ID, ...assetData, version: 1 }
    vi.mocked(createBRollAsset).mockResolvedValue({ data: created, status: 201 } as never)
    const req = new NextRequest('http://localhost/x', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe(MOCK_ASSET_ID)
  })
})
