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

const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

const buildQuery = () => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
})

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => buildQuery()),
  })),
}))

describe('GET /api/pipeline/research/topics', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns topics list', async () => {
    const mockTopics = [
      { id: 'aaa', name: 'Gaming History', slug: 'gaming-history', path: 'gaming-history', depth: 0, parent_id: null, color: '#a78bfa', icon: '🎮', sort_order: 0, item_count: 5 },
    ]
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockTopics, error: null }),
          }),
        }),
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockTopics, error: null }),
        }),
      }),
    })

    const { GET } = await import('@/app/api/pipeline/research/topics/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/topics')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
  })
})

describe('POST /api/pipeline/research/topics', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a topic with valid input', async () => {
    const newTopic = {
      id: 'bbb', name: 'Gaming History', slug: 'gaming-history', path: 'gaming-history',
      depth: 0, parent_id: null, color: '#a78bfa', icon: '📁', sort_order: 0, site_id: MOCK_SITE_ID,
    }
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: newTopic, error: null }),
      }),
    })

    const { POST } = await import('@/app/api/pipeline/research/topics/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/topics', {
      method: 'POST',
      body: JSON.stringify({ name: 'Gaming History', slug: 'gaming-history' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('Gaming History')
  })

  it('rejects invalid slug', async () => {
    const { POST } = await import('@/app/api/pipeline/research/topics/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/topics', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', slug: 'INVALID SLUG' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
