import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => ({})) }))
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock('@/lib/pipeline/audio-resolver', () => ({
  resolveAudio: vi.fn(),
}))

import { POST } from '@/app/api/pipeline/audio-library/resolve/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { resolveAudio } from '@/lib/pipeline/audio-resolver'

const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read'], source: 'session' as const } }

beforeEach(() => {
  vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth as never)
  vi.mocked(requirePermission).mockReturnValue(true)
})

describe('POST /resolve', () => {
  it('returns matches from resolver', async () => {
    vi.mocked(resolveAudio).mockResolvedValue({ matches: [{ asset: {}, score: 10, breakdown: {}, resolve_status: 'LOCAL' }], query_time_ms: 3 } as never)
    const req = new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ type: 'music' }) })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.matches).toHaveLength(1)
  })

  it('returns 400 for invalid body', async () => {
    const req = new NextRequest('http://localhost', { method: 'POST', body: '{}' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' } as never)
    const req = new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ type: 'music' }) })
    expect((await POST(req)).status).toBe(401)
  })

  it('returns 500 when resolveAudio throws', async () => {
    vi.mocked(resolveAudio).mockRejectedValue(new Error('DB connection failed'))
    const req = new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ type: 'music' }) })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost', { method: 'POST', body: 'not json' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid resolve query', async () => {
    // limit: 50 exceeds max of 20, and type is missing
    const req = new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ limit: 50 }) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
