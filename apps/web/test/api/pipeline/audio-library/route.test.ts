import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))
vi.mock('@/lib/pipeline/sanitize', () => ({ sanitizeForFilter: vi.fn((s: string) => s) }))

import { GET, POST } from '@/app/api/pipeline/audio-library/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }

function mockChain(data: unknown[] = [], count = 0) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data, error: null, count }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error: null }),
      contains: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      textSearch: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
    }),
  }
}

beforeEach(() => {
  vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth as any)
  vi.mocked(requirePermission).mockReturnValue(true)
})

describe('GET /api/pipeline/audio-library', () => {
  it('returns paginated assets', async () => {
    const assets = [{ id: '1', asset_id: 'M1', type: 'music' }]
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockChain(assets, 1) as any)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.meta.total).toBe(1)
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' } as any)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when forbidden', async () => {
    vi.mocked(requirePermission).mockReturnValue(false)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/pipeline/audio-library', () => {
  it('creates a new asset with 201', async () => {
    const asset = { id: '1', asset_id: 'M1', type: 'music' }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockChain([asset]) as any)
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: JSON.stringify({ asset_id: 'M1', original_filename: 'track.mp3', type: 'music' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 for invalid body', async () => {
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: JSON.stringify({ type: 'invalid' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
