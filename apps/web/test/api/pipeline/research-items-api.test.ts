import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

const mockAuth = {
  ok: true as const,
  auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
}

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn().mockResolvedValue(mockAuth),
  requirePermission: vi.fn().mockReturnValue(true),
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/supabase/service', () => {
  const mockChain = () => {
    const chain: Record<string, any> = {}
    const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'is', 'in', 'or', 'like', 'ilike',
      'order', 'limit', 'single', 'maybeSingle', 'textSearch', 'not', 'neq']
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain)
    }
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
    return chain
  }
  return {
    getSupabaseServiceClient: vi.fn(() => ({
      from: vi.fn(() => mockChain()),
    })),
  }
})

describe('POST /api/pipeline/research', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects invalid JSON', async () => {
    const { POST } = await import('@/app/api/pipeline/research/route')
    const req = new NextRequest('http://localhost/api/pipeline/research', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects missing required fields', async () => {
    const { POST } = await import('@/app/api/pipeline/research/route')
    const req = new NextRequest('http://localhost/api/pipeline/research', {
      method: 'POST',
      body: JSON.stringify({ title: 'test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects topic_slug deeper than 3 levels', async () => {
    const { POST } = await import('@/app/api/pipeline/research/route')
    const req = new NextRequest('http://localhost/api/pipeline/research', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test',
        topic_slug: 'a/b/c/d',
        content_md: 'content',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('Max 3 levels')
  })
})

describe('GET /api/pipeline/research', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 200 with data array', async () => {
    const { GET } = await import('@/app/api/pipeline/research/route')
    const req = new NextRequest('http://localhost/api/pipeline/research')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.meta).toBeDefined()
  })
})
