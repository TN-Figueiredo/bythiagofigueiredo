import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn().mockResolvedValue({
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  }),
  requirePermission: vi.fn().mockReturnValue(true),
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/supabase/service', () => {
  const mockChain = () => {
    const chain: Record<string, any> = {}
    const methods = ['select', 'insert', 'upsert', 'eq', 'single', 'maybeSingle']
    for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
    return chain
  }
  return { getSupabaseServiceClient: vi.fn(() => ({ from: vi.fn(() => mockChain()) })) }
})

describe('POST /api/pipeline/research/import', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects empty items array', async () => {
    const { POST } = await import('@/app/api/pipeline/research/import/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/import', {
      method: 'POST',
      body: JSON.stringify({ items: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects more than 50 items', async () => {
    const { POST } = await import('@/app/api/pipeline/research/import/route')
    const items = Array.from({ length: 51 }, (_, i) => ({
      title: `Item ${i}`, topic_slug: 'test', content_md: 'content',
    }))
    const req = new NextRequest('http://localhost/api/pipeline/research/import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
