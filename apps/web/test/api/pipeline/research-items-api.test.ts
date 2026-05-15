import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_TOPIC_ID = '22222222-2222-2222-2222-222222222222'
const MOCK_ITEM_ID = '33333333-3333-3333-3333-333333333333'

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

const mockSupabase = {
  from: vi.fn(),
}

function buildChain(resolvedData: any = null, resolvedError: any = null) {
  const chain: Record<string, any> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'is', 'in', 'or', 'like', 'ilike',
    'order', 'limit', 'maybeSingle', 'textSearch', 'not', 'neq']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError })
  return chain
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
}))

describe('POST /api/pipeline/research', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('rejects invalid JSON', async () => {
    mockSupabase.from.mockReturnValue(buildChain())
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
    mockSupabase.from.mockReturnValue(buildChain())
    const { POST } = await import('@/app/api/pipeline/research/route')
    const req = new NextRequest('http://localhost/api/pipeline/research', {
      method: 'POST',
      body: JSON.stringify({ title: 'test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects topic_slug deeper than 3 levels', async () => {
    mockSupabase.from.mockReturnValue(buildChain())
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

  it('creates item and returns 201 on success', async () => {
    const topicChain = buildChain({ id: MOCK_TOPIC_ID })
    const upsertChain = buildChain({ id: MOCK_ITEM_ID, title: 'WYD', version: 1 })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'research_topics') return topicChain
      return upsertChain
    })

    const { POST } = await import('@/app/api/pipeline/research/route')
    const req = new NextRequest('http://localhost/api/pipeline/research', {
      method: 'POST',
      body: JSON.stringify({
        title: 'WYD',
        topic_slug: 'gaming',
        content_md: '# WYD Research',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe(MOCK_ITEM_ID)
  })
})

describe('GET /api/pipeline/research', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns 200 with data array and meta', async () => {
    const chain = buildChain()
    const mockItems = [
      { id: MOCK_ITEM_ID, title: 'Test', topic_id: MOCK_TOPIC_ID, status: 'new', word_count: 100, sources: [], version: 1, created_at: '2026-01-01', updated_at: '2026-01-01', research_topics: { path: 'test', name: 'Test', icon: '📁' } },
    ]
    chain.select = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.order = vi.fn().mockReturnValue(chain)
    chain.limit = vi.fn().mockResolvedValue({ data: mockItems, error: null, count: 1 })
    mockSupabase.from.mockReturnValue(chain)

    const { GET } = await import('@/app/api/pipeline/research/route')
    const req = new NextRequest('http://localhost/api/pipeline/research')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.meta).toBeDefined()
    expect(body.meta.total).toBeDefined()
  })
})
