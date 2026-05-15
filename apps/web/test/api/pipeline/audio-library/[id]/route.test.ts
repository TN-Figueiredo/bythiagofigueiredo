import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

import { GET, PATCH, DELETE } from '@/app/api/pipeline/audio-library/[id]/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const VALID_ID = '00000000-0000-0000-0000-000000000001'
const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }
const makeParams = (id: string) => Promise.resolve({ id })

beforeEach(() => {
  vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth as never)
  vi.mocked(requirePermission).mockReturnValue(true)
})

describe('GET /:id', () => {
  it('returns asset with usage data', async () => {
    const asset = { id: VALID_ID, asset_id: 'M1', type: 'music', version: 1 }
    const chain = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: table === 'audio_assets' ? asset : null, error: null }),
      })),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    const res = await GET(new NextRequest('http://localhost'), { params: makeParams(VALID_ID) })
    expect(res.status).toBe(200)
  })

  it('returns 404 for non-existent asset', async () => {
    const chain = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    const res = await GET(new NextRequest('http://localhost'), { params: makeParams(VALID_ID) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid UUID', async () => {
    const res = await GET(new NextRequest('http://localhost'), { params: makeParams('not-uuid') })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /:id', () => {
  it('updates asset with correct version', async () => {
    const updated = { id: VALID_ID, track_name: 'New', version: 2 }
    const chain = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updated, error: null }),
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    const req = new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ version: 1, track_name: 'New' }) })
    const res = await PATCH(req, { params: makeParams(VALID_ID) })
    expect(res.status).toBe(200)
  })

  it('returns 409 on version mismatch', async () => {
    let callCount = 0
    const chain = {
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            update: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: VALID_ID, version: 3 }, error: null }),
        }
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    const req = new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ version: 1, track_name: 'X' }) })
    const res = await PATCH(req, { params: makeParams(VALID_ID) })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('CONFLICT')
    expect(json.error.message).toContain('Version mismatch')
  })
})

describe('DELETE /:id', () => {
  it('soft-deletes by setting status to retired', async () => {
    const chain = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: VALID_ID, status: 'retired' }, error: null }),
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req, { params: makeParams(VALID_ID) })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.status).toBe('retired')
  })
})
