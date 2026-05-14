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
    const methods = ['select', 'insert', 'delete', 'eq', 'single']
    for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
    return chain
  }
  return { getSupabaseServiceClient: vi.fn(() => ({ from: vi.fn(() => mockChain()) })) }
})

describe('POST /api/pipeline/research/[id]/links', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects invalid research item ID', async () => {
    const { POST } = await import('@/app/api/pipeline/research/[id]/links/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/bad/links', {
      method: 'POST',
      body: JSON.stringify({ pipeline_item_id: '33333333-3333-3333-3333-333333333333' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'bad' }) })
    expect(res.status).toBe(400)
  })

  it('rejects missing pipeline_item_id', async () => {
    const { POST } = await import('@/app/api/pipeline/research/[id]/links/route')
    const id = '22222222-2222-2222-2222-222222222222'
    const req = new NextRequest(`http://localhost/api/pipeline/research/${id}/links`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req, { params: Promise.resolve({ id }) })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/pipeline/research/[id]/links/[linkId]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects invalid link ID', async () => {
    const { DELETE: DEL } = await import('@/app/api/pipeline/research/[id]/links/[linkId]/route')
    const id = '22222222-2222-2222-2222-222222222222'
    const req = new NextRequest(`http://localhost/api/pipeline/research/${id}/links/bad`, { method: 'DELETE' })
    const res = await DEL(req, { params: Promise.resolve({ id, linkId: 'bad' }) })
    expect(res.status).toBe(400)
  })
})
