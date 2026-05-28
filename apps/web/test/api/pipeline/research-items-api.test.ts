import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ITEM_ID = '33333333-3333-3333-3333-333333333333'
const MOCK_TOPIC_ID = '22222222-2222-2222-2222-222222222222'

const mockAuth = {
  siteId: MOCK_SITE_ID,
  permissions: ['read', 'write'] as const,
  source: 'api_key' as const,
  keyHash: 'test',
}

// ---------------------------------------------------------------------------
// Mock: helpers (auth + body parsing)
// ---------------------------------------------------------------------------
vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn().mockResolvedValue({ ok: true, auth: mockAuth }),
  authenticateWrite: vi.fn().mockResolvedValue({ ok: true, auth: mockAuth }),
  parseBody: vi.fn(),
  pipelineError: vi.fn((code: string, message: string, status: number) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ error: { code, message } }, { status })
  }),
  pipelineSuccess: vi.fn(),
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
// Mock: auth (for buildRateLimitHeaders used by GET route)
// ---------------------------------------------------------------------------
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn().mockReturnValue(true),
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

// ---------------------------------------------------------------------------
// Mock: service layer — the real target
// ---------------------------------------------------------------------------
const mockListResearchItems = vi.fn()
const mockCreateResearchItem = vi.fn()

vi.mock('@/lib/pipeline/services/research', () => ({
  listResearchItems: (...args: unknown[]) => mockListResearchItems(...args),
  createResearchItem: (...args: unknown[]) => mockCreateResearchItem(...args),
}))

// ---------------------------------------------------------------------------
// Mock: supabase service (transitive dep via http-adapter, needs to exist)
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({})),
}))

describe('POST /api/pipeline/research', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid JSON', async () => {
    const { parseBody } = await import('@/lib/pipeline/helpers')
    const { NextResponse } = await import('next/server')
    ;(parseBody as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 }),
    )

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
    const { parseBody } = await import('@/lib/pipeline/helpers')
    ;(parseBody as ReturnType<typeof vi.fn>).mockResolvedValue({ title: 'test' })

    const { PipelineServiceError } = await import('@/lib/pipeline/services/types')
    mockCreateResearchItem.mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Missing required fields', 400),
    )

    const { serviceErrorToResponse } = await import('@/lib/pipeline/services/http-adapter')
    const { NextResponse } = await import('next/server')
    ;(serviceErrorToResponse as ReturnType<typeof vi.fn>).mockReturnValue(
      NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } }, { status: 400 }),
    )

    const { POST } = await import('@/app/api/pipeline/research/route')
    const req = new NextRequest('http://localhost/api/pipeline/research', {
      method: 'POST',
      body: JSON.stringify({ title: 'test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects topic_slug deeper than 3 levels', async () => {
    const { parseBody } = await import('@/lib/pipeline/helpers')
    ;(parseBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      title: 'Test',
      topic_slug: 'a/b/c/d',
      content_md: 'content',
    })

    const { PipelineServiceError } = await import('@/lib/pipeline/services/types')
    mockCreateResearchItem.mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Max 3 levels', 400),
    )

    const { serviceErrorToResponse } = await import('@/lib/pipeline/services/http-adapter')
    const { NextResponse } = await import('next/server')
    ;(serviceErrorToResponse as ReturnType<typeof vi.fn>).mockReturnValue(
      NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Max 3 levels' } }, { status: 400 }),
    )

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
    const { parseBody } = await import('@/lib/pipeline/helpers')
    ;(parseBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      title: 'WYD',
      topic_slug: 'gaming',
      content_md: '# WYD Research',
    })

    mockCreateResearchItem.mockResolvedValue({
      data: {
        id: MOCK_ITEM_ID,
        title: 'WYD',
        topic_id: MOCK_TOPIC_ID,
        status: 'new',
        word_count: null,
        version: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        upserted: false,
      },
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
  })

  it('returns 200 with data array and meta', async () => {
    mockListResearchItems.mockResolvedValue({
      data: [
        {
          id: MOCK_ITEM_ID,
          title: 'Test',
          topic_id: MOCK_TOPIC_ID,
          topic_path: 'test',
          topic_name: 'Test',
          topic_icon: '📁',
          summary: null,
          status: 'new',
          word_count: 100,
          sources_count: 0,
          version: 1,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
      meta: { total: 1, has_next: false, limit: 50 },
    })

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
