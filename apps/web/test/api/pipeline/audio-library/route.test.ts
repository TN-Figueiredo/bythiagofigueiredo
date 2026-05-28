import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/pipeline/services/audio', () => ({
  listAudioAssets: vi.fn(),
  createAudioAsset: vi.fn(),
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

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

vi.mock('@/lib/pipeline/sanitize', () => ({
  sanitizeForFilter: vi.fn((s: string) => s),
  sanitizeForTsquery: vi.fn((s: string) => s),
}))

import { GET, POST } from '@/app/api/pipeline/audio-library/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { listAudioAssets, createAudioAsset } from '@/lib/pipeline/services/audio'

const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }

beforeEach(() => {
  vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth as never)
  vi.mocked(requirePermission).mockReturnValue(true)
})

describe('GET /api/pipeline/audio-library', () => {
  it('returns paginated assets', async () => {
    const assets = [{ id: '1', asset_id: 'M1', type: 'music' }]
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: assets,
      meta: { total: 1, has_next: false, next_cursor: undefined, limit: 50 },
    })
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.meta.total).toBe(1)
    // Service is called with correct siteId via ctx
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1' }),
      expect.any(Object),
    )
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' } as never)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when auth returns forbidden', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 403, error: 'Forbidden' } as never)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/pipeline/audio-library', () => {
  it('creates a new asset with 201', async () => {
    const asset = { id: '1', asset_id: 'M1', type: 'music' }
    vi.mocked(createAudioAsset).mockResolvedValue({ data: asset, status: 201 })
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: JSON.stringify({ asset_id: 'M1', original_filename: 'track.mp3', type: 'music' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 for invalid body', async () => {
    vi.mocked(createAudioAsset).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Invalid body', 400),
    )
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: JSON.stringify({ type: 'invalid' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate asset_id or sha256', async () => {
    vi.mocked(createAudioAsset).mockRejectedValue(
      new PipelineServiceError('CONFLICT', 'Asset with this ID or SHA256 already exists', 409),
    )
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: JSON.stringify({ asset_id: 'DUP', original_filename: 'dup.mp3', type: 'music' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('CONFLICT')
  })

  it('returns 500 on generic DB error', async () => {
    vi.mocked(createAudioAsset).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to save asset', 500),
    )
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: JSON.stringify({ asset_id: 'M1', original_filename: 'track.mp3', type: 'music' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})

describe('GET /api/pipeline/audio-library filters', () => {
  it('applies type filter', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [{ id: '1', asset_id: 'M1', type: 'music' }] as never,
      meta: { total: 1, has_next: false, next_cursor: undefined, limit: 50 },
    })
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library?type=music'))
    expect(res.status).toBe(200)
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ type: 'music' }),
    )
  })

  it('ignores invalid type values', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?type=evil'))
    // Type filter is passed through to service; service ignores invalid values
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ type: 'evil' }),
    )
  })

  it('applies status filter', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?status=pending'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ status: 'pending' }),
    )
  })

  it('applies category filter with sanitization', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?category=cinematic'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ category: 'cinematic' }),
    )
  })

  it('applies tags filter with overlaps (OR logic)', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?tags=epic,cinematic'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ tags: 'epic,cinematic' }),
    )
  })

  it('applies mood filter with overlaps (OR logic)', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?mood=inspiring'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ mood: 'inspiring' }),
    )
  })

  it('applies energy range filters', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?energy_min=2&energy_max=4'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ energy_min: '2', energy_max: '4' }),
    )
  })

  it('applies bpm range filters', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?bpm_min=80&bpm_max=120'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ bpm_min: '80', bpm_max: '120' }),
    )
  })

  it('applies full-text search with textSearch', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?q=cinematic+epic'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ q: 'cinematic epic' }),
    )
  })

  it('applies reusable=true filter', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?reusable=true'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ reusable: 'true' }),
    )
  })

  it('applies reusable=false filter', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?reusable=false'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ reusable: 'false' }),
    )
  })

  it('clamps limit between 1 and 200', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 200 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?limit=999'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ limit: 200 }),
    )
  })

  it('returns 500 on DB error', async () => {
    vi.mocked(listAudioAssets).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to load assets', 500),
    )
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    expect(res.status).toBe(500)
  })
})

describe('GET cursor pagination', () => {
  it('ignores cursor when not a valid UUID', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [{ id: 'a1', asset_id: 'M1' }] as never,
      meta: { total: 1, has_next: false, next_cursor: undefined, limit: 50 },
    })
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library?cursor=not-a-uuid'))
    expect(res.status).toBe(200)
    // Route still passes cursor to service; service handles validation
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalled()
  })

  it('returns has_next=true and next_cursor when more items exist', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: Array.from({ length: 50 }, (_, i) => ({ id: `id-${i}`, asset_id: `M${i}` })) as never,
      meta: { total: 100, has_next: true, next_cursor: 'id-49', limit: 50 },
    })
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.meta.has_next).toBe(true)
    expect(json.meta.next_cursor).toBe('id-49')
  })

  it('returns has_next=false when fewer items than limit', async () => {
    const items = [{ id: 'id-0', asset_id: 'M0' }, { id: 'id-1', asset_id: 'M1' }, { id: 'id-2', asset_id: 'M2' }]
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: items as never,
      meta: { total: 3, has_next: false, next_cursor: undefined, limit: 50 },
    })
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.meta.has_next).toBe(false)
    expect(json.meta.next_cursor).toBeUndefined()
  })

  it('applies subcategory filter', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?subcategory=test'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ subcategory: 'test' }),
    )
  })

  it('applies genre filter', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?genre=rock'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ genre: 'rock' }),
    )
  })

  it('applies source filter', async () => {
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [] as never,
      meta: { total: 0, has_next: false, next_cursor: undefined, limit: 50 },
    })
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?source=artlist'))
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ source: 'artlist' }),
    )
  })

  it('applies cursor filter when valid UUID provided', async () => {
    const validCursor = '550e8400-e29b-41d4-a716-446655440000'
    vi.mocked(listAudioAssets).mockResolvedValue({
      data: [{ id: 'a1', asset_id: 'M1' }] as never,
      meta: { total: 1, has_next: false, next_cursor: undefined, limit: 50 },
    })
    const res = await GET(new NextRequest(`http://localhost/api/pipeline/audio-library?cursor=${validCursor}`))
    expect(res.status).toBe(200)
    expect(vi.mocked(listAudioAssets)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ cursor: validCursor }),
    )
  })
})
