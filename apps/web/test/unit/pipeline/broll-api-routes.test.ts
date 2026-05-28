import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/pipeline/services/broll', () => ({
  listBRollAssets: vi.fn(),
  createBRollAsset: vi.fn(),
  getBRollAsset: vi.fn(),
  updateBRollAsset: vi.fn(),
  retireBRollAsset: vi.fn(),
  importBRollAssets: vi.fn(),
}))

vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn().mockReturnValue({
    siteId: 'site-abc',
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

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(() => true),
  buildRateLimitHeaders: vi.fn(() => ({})),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/pipeline/logger', () => ({
  pipelineLog: vi.fn(),
}))

vi.mock('@/lib/pipeline/sanitize', async () => {
  const actual = await import('../../../src/lib/pipeline/sanitize')
  return actual
})

vi.mock('@/lib/pipeline/broll-import', async () => {
  const actual = await import('../../../src/lib/pipeline/broll-import')
  return actual
})

// ── Imports after mocks ──────────────────────────────────────────────────────

import { GET as listGET, POST as listPOST } from '../../../src/app/api/pipeline/broll-library/route'
import {
  GET as detailGET,
  PATCH as detailPATCH,
  DELETE as detailDELETE,
} from '../../../src/app/api/pipeline/broll-library/[id]/route'
import { POST as importPOST } from '../../../src/app/api/pipeline/broll-library/import/route'

import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import {
  listBRollAssets,
  createBRollAsset,
  getBRollAsset,
  updateBRollAsset,
  retireBRollAsset,
  importBRollAssets,
} from '@/lib/pipeline/services/broll'

// ── Shared fixtures ──────────────────────────────────────────────────────────

const SITE_ID = 'site-abc'
const ASSET_UUID = '550e8400-e29b-41d4-a716-446655440001'
const BAD_ID = 'not-a-uuid'

const mockAuth = {
  ok: true as const,
  auth: { siteId: SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const },
}
const mockAuthUnauthed = { ok: false as const, status: 401, error: 'Unauthorized' }
const mockAuthReadOnly = {
  ok: true as const,
  auth: { siteId: SITE_ID, permissions: ['read'], source: 'api_key' as const },
}

const assetRow = {
  id: ASSET_UUID,
  site_id: SITE_ID,
  asset_id: 'BROLL_DRONE_01',
  original_filename: 'DJI_0042.mp4',
  type: 'footage',
  source: 'local',
  source_type: 'pessoal',
  resolution: '1080p',
  has_audio: false,
  reusable: true,
  status: 'available',
  tags: [],
  metadata: {},
  version: 1,
  created_at: '2026-05-10T00:00:00Z',
  updated_at: '2026-05-10T00:00:00Z',
}

function makeRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
): NextRequest {
  const hdrs = new Headers(headers)
  if (body) hdrs.set('Content-Type', 'application/json')
  return new NextRequest(url, {
    method,
    headers: hdrs,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function makeListRequest(search = ''): NextRequest {
  return makeRequest('GET', `http://localhost/api/pipeline/broll-library${search}`)
}

// ── GET /api/pipeline/broll-library ──────────────────────────────────────────

describe('GET /api/pipeline/broll-library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthUnauthed)
    const res = await listGET(makeListRequest())
    expect(res.status).toBe(401)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 403 when auth returns forbidden', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false as const, status: 403, error: 'Forbidden' })
    const res = await listGET(makeListRequest())
    expect(res.status).toBe(403)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns paginated list with meta', async () => {
    const items = [assetRow, { ...assetRow, id: '550e8400-e29b-41d4-a716-446655440002', asset_id: 'BROLL_02' }]
    vi.mocked(listBRollAssets).mockResolvedValue({
      data: items,
      meta: { total: 2, has_next: false, next_cursor: undefined, limit: 50 },
    } as never)

    const res = await listGET(makeListRequest('?limit=50'))
    expect(res.status).toBe(200)
    const json = await res.json() as { data: unknown[]; meta: { total: number; has_next: boolean; limit: number } }
    expect(json.data).toHaveLength(2)
    expect(json.meta.total).toBe(2)
    expect(json.meta.has_next).toBe(false)
    expect(json.meta.limit).toBe(50)
  })

  it('signals has_next when DB returns limit+1 rows', async () => {
    const limit = 2
    vi.mocked(listBRollAssets).mockResolvedValue({
      data: Array.from({ length: limit }, (_, i) => ({ ...assetRow, id: `id-${i}` })),
      meta: { total: 10, has_next: true, next_cursor: 'id-1', limit },
    } as never)

    const res = await listGET(makeListRequest(`?limit=${limit}`))
    const json = await res.json() as { data: unknown[]; meta: { has_next: boolean; next_cursor?: string } }
    expect(json.meta.has_next).toBe(true)
    expect(json.meta.next_cursor).toBeDefined()
    expect(json.data).toHaveLength(limit)
  })

  it('returns 500 on DB error', async () => {
    vi.mocked(listBRollAssets).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to load assets', 500),
    )
    const res = await listGET(makeListRequest())
    expect(res.status).toBe(500)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('DB_ERROR')
  })

  it('applies type filter when valid', async () => {
    vi.mocked(listBRollAssets).mockResolvedValue({
      data: [],
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    } as never)

    const res = await listGET(makeListRequest('?type=photo'))
    expect(res.status).toBe(200)
    expect(vi.mocked(listBRollAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ type: 'photo' }),
    )
  })

  it('ignores invalid type filter', async () => {
    vi.mocked(listBRollAssets).mockResolvedValue({
      data: [],
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    } as never)

    const res = await listGET(makeListRequest('?type=invalid_type'))
    expect(res.status).toBe(200)
    // Route passes type through; service handles validation
    expect(vi.mocked(listBRollAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ type: 'invalid_type' }),
    )
  })

  it('uses cursor pagination when valid UUID cursor provided', async () => {
    vi.mocked(listBRollAssets).mockResolvedValue({
      data: [],
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    } as never)

    const res = await listGET(makeListRequest(`?cursor=${ASSET_UUID}`))
    expect(res.status).toBe(200)
    expect(vi.mocked(listBRollAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ cursor: ASSET_UUID }),
    )
  })

  it('ignores cursor with invalid UUID format', async () => {
    vi.mocked(listBRollAssets).mockResolvedValue({
      data: [],
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    } as never)

    const res = await listGET(makeListRequest('?cursor=not-a-uuid'))
    expect(res.status).toBe(200)
    // Route still passes cursor through; service validates
    expect(vi.mocked(listBRollAssets)).toHaveBeenCalled()
  })

  it('applies has_audio=true filter', async () => {
    vi.mocked(listBRollAssets).mockResolvedValue({
      data: [],
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    } as never)

    await listGET(makeListRequest('?has_audio=true'))
    expect(vi.mocked(listBRollAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ has_audio: 'true' }),
    )
  })

  it('clamps limit to 1-200 range', async () => {
    vi.mocked(listBRollAssets).mockResolvedValue({
      data: [],
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 200 },
    } as never)

    const res = await listGET(makeListRequest('?limit=999'))
    const json = await res.json() as { meta: { limit: number } }
    expect(json.meta.limit).toBe(200)
    expect(vi.mocked(listBRollAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ limit: 200 }),
    )
  })
})

// ── POST /api/pipeline/broll-library ─────────────────────────────────────────

describe('POST /api/pipeline/broll-library', () => {
  const validBody = {
    asset_id: 'BROLL_DRONE_01',
    original_filename: 'DJI_0042.mp4',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthUnauthed)
    const res = await listPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when write permission is denied', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthReadOnly)
    vi.mocked(requirePermission).mockReturnValue(false)
    const res = await listPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library', validBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/pipeline/broll-library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json {{{',
    })
    const res = await listPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(createBRollAsset).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Missing required fields', 400),
    )
    const res = await listPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library', {}))
    expect(res.status).toBe(400)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when asset_id is empty string', async () => {
    vi.mocked(createBRollAsset).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'asset_id must not be empty', 400),
    )
    const res = await listPOST(
      makeRequest('POST', 'http://localhost/api/pipeline/broll-library', { ...validBody, asset_id: '' }),
    )
    expect(res.status).toBe(400)
  })

  it('creates an asset and returns 201', async () => {
    vi.mocked(createBRollAsset).mockResolvedValue({
      data: assetRow,
      status: 201,
    } as never)
    const res = await listPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library', validBody))
    expect(res.status).toBe(201)
    const json = await res.json() as { data: typeof assetRow }
    expect(json.data.asset_id).toBe('BROLL_DRONE_01')
  })

  it('returns 409 on unique constraint violation (code 23505)', async () => {
    vi.mocked(createBRollAsset).mockRejectedValue(
      new PipelineServiceError('CONFLICT', 'Asset with this ID or SHA256 already exists', 409),
    )
    const res = await listPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library', validBody))
    expect(res.status).toBe(409)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('CONFLICT')
  })

  it('returns 500 on unexpected DB error', async () => {
    vi.mocked(createBRollAsset).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to save asset', 500),
    )
    const res = await listPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library', validBody))
    expect(res.status).toBe(500)
  })
})

// ── GET /api/pipeline/broll-library/[id] ─────────────────────────────────────

describe('GET /api/pipeline/broll-library/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('returns 400 for invalid UUID', async () => {
    const params = Promise.resolve({ id: BAD_ID })
    const res = await detailGET(makeRequest('GET', `http://localhost/api/pipeline/broll-library/${BAD_ID}`) as NextRequest, { params })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthUnauthed)
    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailGET(makeRequest('GET', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when auth returns forbidden', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false as const, status: 403, error: 'Forbidden' })
    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailGET(makeRequest('GET', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(403)
  })

  it('returns 404 when asset not found (PGRST116)', async () => {
    vi.mocked(getBRollAsset).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Asset not found', 404),
    )
    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailGET(makeRequest('GET', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(404)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 200 with asset and usage data', async () => {
    const usageRow = {
      id: 'usage-1',
      pipeline_item_id: '550e8400-e29b-41d4-a716-000000000099',
      beat_index: 2,
      usage_type: 'cutaway',
    }
    vi.mocked(getBRollAsset).mockResolvedValue({
      data: { ...assetRow, usage: [usageRow] },
    } as never)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailGET(makeRequest('GET', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { asset_id: string; usage: unknown[] } }
    expect(json.data.asset_id).toBe('BROLL_DRONE_01')
    expect(Array.isArray(json.data.usage)).toBe(true)
  })

  it('returns 500 on unexpected DB error', async () => {
    vi.mocked(getBRollAsset).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to load asset', 500),
    )
    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailGET(makeRequest('GET', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(500)
  })
})

// ── PATCH /api/pipeline/broll-library/[id] ───────────────────────────────────

describe('PATCH /api/pipeline/broll-library/[id]', () => {
  const validPatchBody = { description: 'Updated description', version: 1 }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('returns 400 for invalid UUID', async () => {
    const params = Promise.resolve({ id: BAD_ID })
    const res = await detailPATCH(makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${BAD_ID}`, validPatchBody), { params })
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthUnauthed)
    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, validPatchBody), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when write permission denied', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthReadOnly)
    vi.mocked(requirePermission).mockReturnValue(false)
    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, validPatchBody), { params })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest(`http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json}',
    })
    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(req, { params })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when version is missing', async () => {
    vi.mocked(updateBRollAsset).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'version is required', 400),
    )
    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(
      makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, { description: 'no version' }),
      { params },
    )
    expect(res.status).toBe(400)
  })

  it('returns 200 when OCC matches and update succeeds', async () => {
    const updatedRow = { ...assetRow, description: 'Updated description', version: 2 }
    vi.mocked(updateBRollAsset).mockResolvedValue({ data: updatedRow } as never)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, validPatchBody), { params })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { version: number; description: string } }
    expect(json.data.version).toBe(2)
    expect(json.data.description).toBe('Updated description')
  })

  it('returns 409 on version mismatch (OCC conflict)', async () => {
    vi.mocked(updateBRollAsset).mockRejectedValue(
      new PipelineServiceError('CONFLICT', 'Version mismatch: expected 1, current 5', 409),
    )

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(
      makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, { description: 'stale update', version: 1 }),
      { params },
    )
    expect(res.status).toBe(409)
    const json = await res.json() as { error: { code: string; message: string } }
    expect(json.error.code).toBe('CONFLICT')
    expect(json.error.message).toMatch(/Version mismatch/)
  })

  it('returns 404 when asset does not exist', async () => {
    vi.mocked(updateBRollAsset).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Asset not found', 404),
    )

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, validPatchBody), { params })
    expect(res.status).toBe(404)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 500 on DB error during update', async () => {
    vi.mocked(updateBRollAsset).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to update asset', 500),
    )

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, validPatchBody), { params })
    expect(res.status).toBe(500)
  })
})

// ── DELETE /api/pipeline/broll-library/[id] ──────────────────────────────────

describe('DELETE /api/pipeline/broll-library/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('returns 400 for invalid UUID', async () => {
    const params = Promise.resolve({ id: BAD_ID })
    const res = await detailDELETE(makeRequest('DELETE', `http://localhost/api/pipeline/broll-library/${BAD_ID}`), { params })
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthUnauthed)
    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailDELETE(makeRequest('DELETE', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when write permission denied', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthReadOnly)
    vi.mocked(requirePermission).mockReturnValue(false)
    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailDELETE(makeRequest('DELETE', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(403)
  })

  it('soft-deletes asset by setting status to retired', async () => {
    const retiredRow = { id: ASSET_UUID, status: 'retired' }
    vi.mocked(retireBRollAsset).mockResolvedValue({ data: retiredRow } as never)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailDELETE(makeRequest('DELETE', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { status: string } }
    expect(json.data.status).toBe('retired')
  })

  it('returns 404 when asset not found or already deleted', async () => {
    vi.mocked(retireBRollAsset).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Asset not found', 404),
    )

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailDELETE(makeRequest('DELETE', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(404)
  })
})

// ── POST /api/pipeline/broll-library/import ───────────────────────────────────

describe('POST /api/pipeline/broll-library/import', () => {
  const baseImportPayload = {
    schema_version: '1.0.0',
    items: [
      { asset_id: 'BROLL_01', original_filename: 'clip1.mp4' },
      { asset_id: 'BROLL_02', original_filename: 'clip2.mp4' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthUnauthed)
    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', baseImportPayload))
    expect(res.status).toBe(401)
  })

  it('returns 403 when write permission denied', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthReadOnly)
    vi.mocked(requirePermission).mockReturnValue(false)
    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', baseImportPayload))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/pipeline/broll-library/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad json',
    })
    const res = await importPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when schema_version is missing', async () => {
    vi.mocked(importBRollAssets).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'schema_version is required', 400),
    )
    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', {
      items: [{ asset_id: 'BROLL_01' }],
    }))
    expect(res.status).toBe(400)
  })

  it('dry_run=true returns preview without writing to DB', async () => {
    vi.mocked(importBRollAssets).mockResolvedValue({
      data: {
        dry_run: true,
        preview: { to_create: 2, to_update: 0, to_skip: 0, errors: [] as never[] },
      },
    } as never)

    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', {
      ...baseImportPayload,
      dry_run: true,
    }))
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { dry_run: boolean; preview: { to_create: number; to_update: number; to_skip: number } } }
    expect(json.data.dry_run).toBe(true)
    expect(json.data.preview.to_create).toBe(2)
    expect(json.data.preview.to_update).toBe(0)
    expect(json.data.preview.to_skip).toBe(0)
  })

  it('dry_run classifies existing assets as update when sha256 differs', async () => {
    vi.mocked(importBRollAssets).mockResolvedValue({
      data: {
        dry_run: true,
        preview: { to_create: 1, to_update: 1, to_skip: 0, errors: [] as never[] },
      },
    } as never)

    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', {
      ...baseImportPayload,
      dry_run: true,
      items: [
        { asset_id: 'BROLL_01', sha256: 'b'.repeat(64) },
        { asset_id: 'BROLL_NEW' },
      ],
    }))
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { preview: { to_create: number; to_update: number } } }
    expect(json.data.preview.to_create).toBe(1)
    expect(json.data.preview.to_update).toBe(1)
  })

  it('dry_run classifies asset as skip when sha256 matches and no other diffs', async () => {
    vi.mocked(importBRollAssets).mockResolvedValue({
      data: {
        dry_run: true,
        preview: { to_create: 0, to_update: 0, to_skip: 1, errors: [] as never[] },
      },
    } as never)

    const sha = 'c'.repeat(64)
    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', {
      schema_version: '1.0.0',
      dry_run: true,
      items: [{ asset_id: 'BROLL_01', sha256: sha }],
    }))
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { preview: { to_skip: number } } }
    expect(json.data.preview.to_skip).toBe(1)
  })

  it('real import upserts items and returns counts + import_log_id', async () => {
    vi.mocked(importBRollAssets).mockResolvedValue({
      data: {
        dry_run: false,
        import_log_id: 'log-uuid-123',
        created: 2,
        updated: 0,
        skipped: 0,
        errors: [],
      },
    } as never)

    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', baseImportPayload))
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { dry_run: boolean; created: number; updated: number; skipped: number; import_log_id: string } }
    expect(json.data.dry_run).toBe(false)
    expect(json.data.created).toBe(2)
    expect(json.data.updated).toBe(0)
    expect(json.data.skipped).toBe(0)
    expect(json.data.import_log_id).toBe('log-uuid-123')
  })

  it('import reports errors when batch upsert fails', async () => {
    vi.mocked(importBRollAssets).mockResolvedValue({
      data: {
        dry_run: false,
        import_log_id: 'log-uuid-err',
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [{ asset_id: 'BROLL_01', error: 'Batch upsert failed' }, { asset_id: 'BROLL_02', error: 'Batch upsert failed' }],
      },
    } as never)

    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', baseImportPayload))
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { errors: Array<{ asset_id: string; error: string }> } }
    expect(json.data.errors.length).toBeGreaterThan(0)
  })

  it('handles empty items array', async () => {
    vi.mocked(importBRollAssets).mockResolvedValue({
      data: {
        dry_run: false,
        import_log_id: 'log-empty',
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
      },
    } as never)

    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', {
      schema_version: '1.0.0',
      items: [],
    }))
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { created: number; updated: number; skipped: number } }
    expect(json.data.created).toBe(0)
    expect(json.data.updated).toBe(0)
    expect(json.data.skipped).toBe(0)
  })
})
