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
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'single', 'maybeSingle']
    for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
    return chain
  }
  return { getSupabaseServiceClient: vi.fn(() => ({ from: vi.fn(() => mockChain()) })) }
})

describe('GET /api/pipeline/research/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects invalid UUID', async () => {
    const { GET } = await import('@/app/api/pipeline/research/[id]/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/not-a-uuid')
    const res = await GET(req, { params: Promise.resolve({ id: 'not-a-uuid' }) })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/pipeline/research/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requires X-Expected-Version header', async () => {
    const { PATCH } = await import('@/app/api/pipeline/research/[id]/route')
    const id = '33333333-3333-3333-3333-333333333333'
    const req = new NextRequest(`http://localhost/api/pipeline/research/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('X-Expected-Version')
  })
})

describe('DELETE /api/pipeline/research/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects invalid UUID', async () => {
    const { DELETE: DEL } = await import('@/app/api/pipeline/research/[id]/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/bad-id', { method: 'DELETE' })
    const res = await DEL(req, { params: Promise.resolve({ id: 'bad-id' }) })
    expect(res.status).toBe(400)
  })
})
