import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

const mockAuth = {
  siteId: MOCK_SITE_ID,
  permissions: ['read', 'write'] as const,
  source: 'api_key' as const,
  keyHash: 'test',
}

// ---------------------------------------------------------------------------
// Mock: helpers (auth + body parsing + response builders)
// ---------------------------------------------------------------------------
vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn().mockResolvedValue({ ok: true, auth: mockAuth }),
  authenticateWrite: vi.fn().mockResolvedValue({ ok: true, auth: mockAuth }),
  parseBody: vi.fn(),
  pipelineError: vi.fn((code: string, message: string, status: number) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ error: { code, message } }, { status })
  }),
  pipelineSuccess: vi.fn((data: unknown, status: number) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ data }, { status })
  }),
}))

// ---------------------------------------------------------------------------
// Mock: http-adapter
// ---------------------------------------------------------------------------
vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn(() => ({
    siteId: MOCK_SITE_ID,
    permissions: ['read', 'write'],
    keyHash: 'test',
    supabase: {},
  })),
  serviceErrorToResponse: vi.fn((_err: unknown) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'error' } }, { status: 500 })
  }),
}))

// ---------------------------------------------------------------------------
// Mock: auth
// ---------------------------------------------------------------------------
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn().mockReturnValue(true),
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

// ---------------------------------------------------------------------------
// Mock: service layer
// ---------------------------------------------------------------------------
const mockListTopics = vi.fn()
const mockCreateTopic = vi.fn()

vi.mock('@/lib/pipeline/services/research', () => ({
  listTopics: (...args: unknown[]) => mockListTopics(...args),
  createTopic: (...args: unknown[]) => mockCreateTopic(...args),
}))

// ---------------------------------------------------------------------------
// Mock: supabase service (transitive dep)
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({})),
}))

describe('GET /api/pipeline/research/topics', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns topics list', async () => {
    const mockTopics = [
      { id: 'aaa', name: 'Gaming History', slug: 'gaming-history', path: 'gaming-history', depth: 0, parent_id: null, color: '#a78bfa', icon: '🎮', sort_order: 0, item_count: 5 },
    ]
    mockListTopics.mockResolvedValue(mockTopics)

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
    const { parseBody } = await import('@/lib/pipeline/helpers')
    ;(parseBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: 'Gaming History',
      slug: 'gaming-history',
    })

    const newTopic = {
      id: 'bbb', name: 'Gaming History', slug: 'gaming-history', path: 'gaming-history',
      depth: 0, parent_id: null, color: '#a78bfa', icon: '📁', sort_order: 0, site_id: MOCK_SITE_ID,
    }
    mockCreateTopic.mockResolvedValue(newTopic)

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
    const { parseBody } = await import('@/lib/pipeline/helpers')
    ;(parseBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: 'Test',
      slug: 'INVALID SLUG',
    })

    const { PipelineServiceError } = await import('@/lib/pipeline/services/types')
    mockCreateTopic.mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Invalid slug format', 400),
    )

    const { serviceErrorToResponse } = await import('@/lib/pipeline/services/http-adapter')
    ;(serviceErrorToResponse as ReturnType<typeof vi.fn>).mockReturnValue(
      NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid slug format' } }, { status: 400 }),
    )

    const { POST } = await import('@/app/api/pipeline/research/topics/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/topics', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', slug: 'INVALID SLUG' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
