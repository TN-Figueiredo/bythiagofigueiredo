import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))
vi.mock('@/lib/cms/site-context', () => ({
  tryGetSiteContext: vi.fn(),
}))

import { GET } from '../../src/app/api/health/media/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { tryGetSiteContext } from '@/lib/cms/site-context'

describe('GET /api/health/media', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    vi.mocked(tryGetSiteContext).mockResolvedValue({
      siteId: 'site-1',
      siteSlug: 'bythiagofigueiredo',
    } as any)
  })

  it('returns 401 without valid auth', async () => {
    const req = new Request('http://localhost/api/health/media')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns health payload with ok: true', async () => {
    const chain: Record<string, any> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.is = vi.fn(() => Promise.resolve({ count: 10, error: null }))
    chain.not = vi.fn(() => Promise.resolve({ count: 1, error: null }))

    const mockSupabase = {
      from: vi.fn().mockReturnValue(chain),
      rpc: vi.fn().mockResolvedValue({ data: 2, error: null }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase as any)

    const req = new Request('http://localhost/api/health/media', {
      headers: { Authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.siteId).toBe('site-1')
    expect(body).toHaveProperty('totalAssets')
    expect(body).toHaveProperty('orphanCount')
    expect(body).toHaveProperty('softDeletedCount')
    expect(body).toHaveProperty('flags')
  })

  it('returns 503 when site resolution fails', async () => {
    vi.mocked(tryGetSiteContext).mockResolvedValue(null)

    const req = new Request('http://localhost/api/health/media', {
      headers: { Authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(503)
  })
})
