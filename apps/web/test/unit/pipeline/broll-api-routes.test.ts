import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

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

// Real sanitize implementation is pure — import it as-is
vi.mock('@/lib/pipeline/sanitize', async () => {
  const actual = await import('../../../src/lib/pipeline/sanitize')
  return actual
})

// Real broll-import — pure functions, no side effects
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
import { getSupabaseServiceClient } from '@/lib/supabase/service'

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

// ── Helper: build a chainable Supabase mock query ────────────────────────────

function buildChainableMock(terminal: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'order', 'limit', 'in', 'or', 'ilike', 'textSearch', 'contains']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  // Apply terminal overrides (e.g. limit, single, maybeSingle)
  Object.assign(chain, terminal)
  return chain
}

// ── GET /api/pipeline/broll-library ──────────────────────────────────────────

describe('GET /api/pipeline/broll-library', () => {
  beforeEach(() => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthUnauthed)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listGET(makeListRequest())
    expect(res.status).toBe(401)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 403 when read permission is denied', async () => {
    vi.mocked(requirePermission).mockReturnValue(false)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listGET(makeListRequest())
    expect(res.status).toBe(403)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('returns paginated list with meta', async () => {
    const items = [assetRow, { ...assetRow, id: '550e8400-e29b-41d4-a716-446655440002', asset_id: 'BROLL_02' }]
    const chain = buildChainableMock({
      limit: vi.fn().mockResolvedValue({ data: items, error: null, count: 2 }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => chain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listGET(makeListRequest('?limit=50'))
    expect(res.status).toBe(200)
    const json = await res.json() as { data: unknown[]; meta: { total: number; has_next: boolean; limit: number } }
    expect(json.data).toHaveLength(2)
    expect(json.meta.total).toBe(2)
    expect(json.meta.has_next).toBe(false)
    expect(json.meta.limit).toBe(50)
  })

  it('signals has_next when DB returns limit+1 rows', async () => {
    // Route fetches limit+1 to detect next page
    const limit = 2
    const items = Array.from({ length: limit + 1 }, (_, i) => ({ ...assetRow, id: `id-${i}` }))
    const chain = buildChainableMock({
      limit: vi.fn().mockResolvedValue({ data: items, error: null, count: 10 }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => chain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listGET(makeListRequest(`?limit=${limit}`))
    const json = await res.json() as { data: unknown[]; meta: { has_next: boolean; next_cursor?: string } }
    expect(json.meta.has_next).toBe(true)
    expect(json.meta.next_cursor).toBeDefined()
    // Should only return `limit` items, not limit+1
    expect(json.data).toHaveLength(limit)
  })

  it('returns 500 on DB error', async () => {
    const chain = buildChainableMock({
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB down' }, count: null }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => chain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listGET(makeListRequest())
    expect(res.status).toBe(500)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('DB_ERROR')
  })

  it('applies type filter when valid', async () => {
    const chain = buildChainableMock({
      limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => chain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listGET(makeListRequest('?type=photo'))
    expect(res.status).toBe(200)
    // eq should have been called with ('type', 'photo')
    expect(vi.mocked(chain.eq as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([['type', 'photo']]),
    )
  })

  it('ignores invalid type filter', async () => {
    const chain = buildChainableMock({
      limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => chain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listGET(makeListRequest('?type=invalid_type'))
    expect(res.status).toBe(200)
    // eq should NOT have been called with 'type' and 'invalid_type'
    const eqCalls = vi.mocked(chain.eq as ReturnType<typeof vi.fn>).mock.calls
    expect(eqCalls.some(([field, val]: [string, string]) => field === 'type' && val === 'invalid_type')).toBe(false)
  })

  it('uses cursor pagination when valid UUID cursor provided', async () => {
    const cursorItem = { created_at: '2026-05-10T00:00:00Z' }

    // Cursor lookup chain: select → eq → eq → single
    const cursorChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: cursorItem }),
    }

    // Main query chain — must include order and or for cursor filter
    const mainChain = buildChainableMock({
      limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      order: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
    })

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => {
        callCount++
        // The route calls supabase.from('broll_library') for the main query first,
        // then calls it again for the cursor item lookup.
        return callCount === 1 ? mainChain : cursorChain
      }),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listGET(makeListRequest(`?cursor=${ASSET_UUID}`))
    expect(res.status).toBe(200)
  })

  it('ignores cursor with invalid UUID format', async () => {
    const chain = buildChainableMock({
      limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => chain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    // Should not throw even with a non-UUID cursor
    const res = await listGET(makeListRequest('?cursor=not-a-uuid'))
    expect(res.status).toBe(200)
    // or() should not have been called (no cursor filter applied)
    expect(vi.mocked(chain.or as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  it('applies has_audio=true filter', async () => {
    const chain = buildChainableMock({
      limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => chain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    await listGET(makeListRequest('?has_audio=true'))
    expect(vi.mocked(chain.eq as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([['has_audio', true]]),
    )
  })

  it('clamps limit to 1–200 range', async () => {
    const chain = buildChainableMock({
      limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => chain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listGET(makeListRequest('?limit=999'))
    const json = await res.json() as { meta: { limit: number } }
    expect(json.meta.limit).toBe(200)

    const limitCalls = vi.mocked(chain.limit as ReturnType<typeof vi.fn>).mock.calls
    // limit(201) because route fetches limit+1 to detect next page
    expect(limitCalls[0][0]).toBe(201)
  })
})

// ── POST /api/pipeline/broll-library ─────────────────────────────────────────

describe('POST /api/pipeline/broll-library', () => {
  const validBody = {
    asset_id: 'BROLL_DRONE_01',
    original_filename: 'DJI_0042.mp4',
  }

  beforeEach(() => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthUnauthed)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when write permission is denied', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthReadOnly)
    vi.mocked(requirePermission).mockReturnValue(false)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library', validBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid JSON body', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)
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
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)
    const res = await listPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library', {}))
    expect(res.status).toBe(400)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when asset_id is empty string', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)
    const res = await listPOST(
      makeRequest('POST', 'http://localhost/api/pipeline/broll-library', { ...validBody, asset_id: '' }),
    )
    expect(res.status).toBe(400)
  })

  it('creates an asset and returns 201', async () => {
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: assetRow, error: null }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => insertChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library', validBody))
    expect(res.status).toBe(201)
    const json = await res.json() as { data: typeof assetRow }
    expect(json.data.asset_id).toBe('BROLL_DRONE_01')
  })

  it('returns 409 on unique constraint violation (code 23505)', async () => {
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => insertChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library', validBody))
    expect(res.status).toBe(409)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('CONFLICT')
  })

  it('returns 500 on unexpected DB error', async () => {
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'XXXXXX', message: 'unexpected' } }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => insertChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await listPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library', validBody))
    expect(res.status).toBe(500)
  })
})

// ── GET /api/pipeline/broll-library/[id] ─────────────────────────────────────

describe('GET /api/pipeline/broll-library/[id]', () => {
  beforeEach(() => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('returns 400 for invalid UUID', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)
    const params = Promise.resolve({ id: BAD_ID })
    const res = await detailGET(makeRequest('GET', `http://localhost/api/pipeline/broll-library/${BAD_ID}`) as NextRequest, { params })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthUnauthed)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailGET(makeRequest('GET', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when read permission denied', async () => {
    vi.mocked(requirePermission).mockReturnValue(false)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailGET(makeRequest('GET', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(403)
  })

  it('returns 404 when asset not found (PGRST116)', async () => {
    const assetChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => assetChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

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
    let callIndex = 0
    const assetChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: assetRow, error: null }),
    }
    // Usage query: .from('broll_library_usage').select(...).eq(...).eq(...)
    // The second .eq() resolves the promise (no further chaining)
    const usageEq2 = vi.fn().mockResolvedValue({ data: [usageRow], error: null })
    const usageEq1 = vi.fn().mockReturnValue({ eq: usageEq2 })
    const usageChain = {
      select: vi.fn().mockReturnValue({ eq: usageEq1 }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => {
        callIndex++
        return callIndex === 1 ? assetChain : usageChain
      }),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailGET(makeRequest('GET', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { asset_id: string; usage: unknown[] } }
    expect(json.data.asset_id).toBe('BROLL_DRONE_01')
    expect(Array.isArray(json.data.usage)).toBe(true)
  })

  it('returns 500 on unexpected DB error', async () => {
    const assetChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'XXXX', message: 'boom' } }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => assetChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailGET(makeRequest('GET', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(500)
  })
})

// ── PATCH /api/pipeline/broll-library/[id] ───────────────────────────────────

describe('PATCH /api/pipeline/broll-library/[id]', () => {
  const validPatchBody = { description: 'Updated description', version: 1 }

  beforeEach(() => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('returns 400 for invalid UUID', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)
    const params = Promise.resolve({ id: BAD_ID })
    const res = await detailPATCH(makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${BAD_ID}`, validPatchBody), { params })
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthUnauthed)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, validPatchBody), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when write permission denied', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthReadOnly)
    vi.mocked(requirePermission).mockReturnValue(false)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, validPatchBody), { params })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid JSON body', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)
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
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)
    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(
      makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, { description: 'no version' }),
      { params },
    )
    expect(res.status).toBe(400)
  })

  it('returns 200 when OCC matches and update succeeds', async () => {
    const updatedRow = { ...assetRow, description: 'Updated description', version: 2 }
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: updatedRow, error: null }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => updateChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, validPatchBody), { params })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { version: number; description: string } }
    expect(json.data.version).toBe(2)
    expect(json.data.description).toBe('Updated description')
  })

  it('returns 409 on version mismatch (OCC conflict)', async () => {
    // First query (update) returns null — version mismatch or row absent
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    // Second query (existence check) returns the row with its current version
    const existsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: ASSET_UUID, version: 5 }, error: null }),
    }
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => {
        callCount++
        return callCount === 1 ? updateChain : existsChain
      }),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

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
    // First query (update) returns null
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    // Second query (existence check) also returns null — asset genuinely missing
    const existsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => {
        callCount++
        return callCount === 1 ? updateChain : existsChain
      }),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, validPatchBody), { params })
    expect(res.status).toBe(404)
    const json = await res.json() as { error: { code: string } }
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 500 on DB error during update', async () => {
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'connection lost' } }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => updateChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailPATCH(makeRequest('PATCH', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`, validPatchBody), { params })
    expect(res.status).toBe(500)
  })
})

// ── DELETE /api/pipeline/broll-library/[id] ──────────────────────────────────

describe('DELETE /api/pipeline/broll-library/[id]', () => {
  beforeEach(() => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('returns 400 for invalid UUID', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)
    const params = Promise.resolve({ id: BAD_ID })
    const res = await detailDELETE(makeRequest('DELETE', `http://localhost/api/pipeline/broll-library/${BAD_ID}`), { params })
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthUnauthed)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailDELETE(makeRequest('DELETE', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when write permission denied', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthReadOnly)
    vi.mocked(requirePermission).mockReturnValue(false)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailDELETE(makeRequest('DELETE', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(403)
  })

  it('soft-deletes asset by setting status to retired', async () => {
    const retiredRow = { id: ASSET_UUID, status: 'retired' }
    const deleteChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: retiredRow, error: null }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => deleteChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const params = Promise.resolve({ id: ASSET_UUID })
    const res = await detailDELETE(makeRequest('DELETE', `http://localhost/api/pipeline/broll-library/${ASSET_UUID}`), { params })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { status: string } }
    expect(json.data.status).toBe('retired')
    // Confirm update was called with status: 'retired'
    expect(vi.mocked(deleteChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({ status: 'retired' })
  })

  it('returns 404 when asset not found or already deleted', async () => {
    const deleteChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => deleteChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

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
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthUnauthed)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)

    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', baseImportPayload))
    expect(res.status).toBe(401)
  })

  it('returns 403 when write permission denied', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuthReadOnly)
    vi.mocked(requirePermission).mockReturnValue(false)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)

    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', baseImportPayload))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid JSON body', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)
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
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as ReturnType<typeof getSupabaseServiceClient>)
    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', {
      items: [{ asset_id: 'BROLL_01' }],
    }))
    expect(res.status).toBe(400)
  })

  it('dry_run=true returns preview without writing to DB', async () => {
    // The import route queries for existing assets first, then does NOT upsert in dry_run
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => selectChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', {
      ...baseImportPayload,
      dry_run: true,
    }))
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { dry_run: boolean; preview: { to_create: number; to_update: number; to_skip: number } } }
    expect(json.data.dry_run).toBe(true)
    expect(json.data.preview.to_create).toBe(2) // both items are new
    expect(json.data.preview.to_update).toBe(0)
    expect(json.data.preview.to_skip).toBe(0)
    // Upsert should NOT have been called in dry_run mode
    expect(vi.mocked(selectChain.select as ReturnType<typeof vi.fn>)).not.toHaveBeenCalledWith(
      expect.stringContaining('upsert'),
    )
  })

  it('dry_run classifies existing assets as update when sha256 differs', async () => {
    const existing = [{ asset_id: 'BROLL_01', sha256: 'a'.repeat(64), tags: [], version: 1 }]
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: existing, error: null }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => selectChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', {
      ...baseImportPayload,
      dry_run: true,
      items: [
        { asset_id: 'BROLL_01', sha256: 'b'.repeat(64) }, // different sha256 → update
        { asset_id: 'BROLL_NEW' },                         // new → create
      ],
    }))
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { preview: { to_create: number; to_update: number } } }
    expect(json.data.preview.to_create).toBe(1)
    expect(json.data.preview.to_update).toBe(1)
  })

  it('dry_run classifies asset as skip when sha256 matches and no other diffs', async () => {
    const sha = 'c'.repeat(64)
    // mapBRollJsonToDbRow fills in defaults; the existing record must match them
    // to avoid buildBRollDiffLog detecting spurious differences.
    const existing = [{
      asset_id: 'BROLL_01',
      sha256: sha,
      tags: [],
      version: 1,
      // Defaults from mapBRollJsonToDbRow
      type: 'footage',
      source: 'local',
      source_type: 'pessoal',
      resolution: '1080p',
      has_audio: false,
      reusable: true,
      status: 'available',
    }]
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: existing, error: null }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => selectChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', {
      schema_version: '1.0.0',
      dry_run: true,
      items: [{ asset_id: 'BROLL_01', sha256: sha }], // identical sha + same defaults → skip
    }))
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { preview: { to_skip: number } } }
    expect(json.data.preview.to_skip).toBe(1)
  })

  it('real import upserts items and returns counts + import_log_id', async () => {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    const upsertChain = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }
    const logChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'log-uuid-123' }, error: null }),
    }
    let callIndex = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'broll_library') {
          callIndex++
          return callIndex === 1 ? selectChain : upsertChain
        }
        return logChain
      }),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

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
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    const upsertChain = {
      upsert: vi.fn().mockResolvedValue({ error: { message: 'batch failed' } }),
    }
    const logChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'log-uuid-err' }, error: null }),
    }
    let callIndex = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'broll_library') {
          callIndex++
          return callIndex === 1 ? selectChain : upsertChain
        }
        return logChain
      }),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

    const res = await importPOST(makeRequest('POST', 'http://localhost/api/pipeline/broll-library/import', baseImportPayload))
    expect(res.status).toBe(200) // import still returns 200 with error details
    const json = await res.json() as { data: { errors: Array<{ asset_id: string; error: string }> } }
    expect(json.data.errors.length).toBeGreaterThan(0)
  })

  it('handles empty items array', async () => {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    const logChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'log-empty' }, error: null }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn((table: string) => table === 'broll_library' ? selectChain : logChain),
    } as unknown as ReturnType<typeof getSupabaseServiceClient>)

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
