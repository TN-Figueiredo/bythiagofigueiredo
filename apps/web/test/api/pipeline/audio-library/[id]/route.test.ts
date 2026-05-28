import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/pipeline/services/audio', () => ({
  getAudioAsset: vi.fn(),
  updateAudioAsset: vi.fn(),
  retireAudioAsset: vi.fn(),
}))

vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn().mockReturnValue({
    siteId: 'site-1',
    permissions: ['read', 'write'],
    supabase: {},
  }),
  serviceErrorToResponse: vi.fn().mockImplementation((err: unknown) => {
    if (err instanceof PipelineServiceError) {
      return new Response(JSON.stringify({ error: { code: err.code, message: err.message } }), { status: err.status })
    }
    return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'unexpected' } }), { status: 500 })
  }),
}))

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

import { GET, PATCH, DELETE } from '@/app/api/pipeline/audio-library/[id]/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getAudioAsset, updateAudioAsset, retireAudioAsset } from '@/lib/pipeline/services/audio'

const VALID_ID = '00000000-0000-0000-0000-000000000001'
const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }
const makeParams = (id: string) => Promise.resolve({ id })

beforeEach(() => {
  vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth as never)
  vi.mocked(requirePermission).mockReturnValue(true)
})

describe('GET /:id', () => {
  it('returns asset with usage data', async () => {
    const asset = { id: VALID_ID, asset_id: 'M1', type: 'music', version: 1, usage: [] }
    vi.mocked(getAudioAsset).mockResolvedValue({ data: asset })
    const res = await GET(new NextRequest('http://localhost'), { params: makeParams(VALID_ID) })
    expect(res.status).toBe(200)
  })

  it('returns 404 for non-existent asset', async () => {
    vi.mocked(getAudioAsset).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Asset not found', 404),
    )
    const res = await GET(new NextRequest('http://localhost'), { params: makeParams(VALID_ID) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid UUID', async () => {
    const res = await GET(new NextRequest('http://localhost'), { params: makeParams('not-a-uuid') })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('PATCH /:id', () => {
  it('updates asset with correct version', async () => {
    const updated = { id: VALID_ID, track_name: 'New', version: 2 }
    vi.mocked(updateAudioAsset).mockResolvedValue({ data: updated })
    const req = new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ version: 1, track_name: 'New' }) })
    const res = await PATCH(req, { params: makeParams(VALID_ID) })
    expect(res.status).toBe(200)
  })

  it('returns 409 on version mismatch', async () => {
    vi.mocked(updateAudioAsset).mockRejectedValue(
      new PipelineServiceError('CONFLICT', 'Version mismatch: expected 1, current 3', 409),
    )
    const req = new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ version: 1, track_name: 'X' }) })
    const res = await PATCH(req, { params: makeParams(VALID_ID) })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('CONFLICT')
    expect(json.error.message).toContain('Version mismatch')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost', { method: 'PATCH', body: 'not json' })
    const res = await PATCH(req, { params: makeParams(VALID_ID) })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid update schema', async () => {
    vi.mocked(updateAudioAsset).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'version must be positive', 400),
    )
    // version must be positive integer; -1 is invalid
    const req = new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ version: -1 }) })
    const res = await PATCH(req, { params: makeParams(VALID_ID) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when asset does not exist', async () => {
    vi.mocked(updateAudioAsset).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Asset not found', 404),
    )
    const req = new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ version: 1, track_name: 'X' }) })
    const res = await PATCH(req, { params: makeParams(VALID_ID) })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /:id', () => {
  it('soft-deletes by setting status to retired', async () => {
    vi.mocked(retireAudioAsset).mockResolvedValue({ data: { id: VALID_ID, status: 'retired' } })
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req, { params: makeParams(VALID_ID) })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.status).toBe('retired')
  })

  it('returns 400 for invalid UUID', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req, { params: makeParams('not-a-uuid') })
    expect(res.status).toBe(400)
  })

  it('returns 404 when asset does not exist', async () => {
    vi.mocked(retireAudioAsset).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Asset not found', 404),
    )
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req, { params: makeParams(VALID_ID) })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' } as never)
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req, { params: makeParams(VALID_ID) })
    expect(res.status).toBe(401)
  })
})
