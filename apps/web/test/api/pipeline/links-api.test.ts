import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_LINK_ID = '44444444-4444-4444-4444-444444444444'

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
  serviceErrorToResponse: vi.fn((err: unknown) => {
    const { NextResponse } = require('next/server')
    const e = err as { code?: string; message?: string; status?: number }
    return NextResponse.json(
      { error: { code: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'error' } },
      { status: e.status ?? 500 },
    )
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
const mockListTrackedLinks = vi.fn()
const mockCreateTrackedLink = vi.fn()
const mockGetTrackedLink = vi.fn()
const mockUpdateTrackedLink = vi.fn()
const mockArchiveTrackedLink = vi.fn()

vi.mock('@/lib/pipeline/services/links', () => ({
  listTrackedLinks: (...args: unknown[]) => mockListTrackedLinks(...args),
  createTrackedLink: (...args: unknown[]) => mockCreateTrackedLink(...args),
  getTrackedLink: (...args: unknown[]) => mockGetTrackedLink(...args),
  updateTrackedLink: (...args: unknown[]) => mockUpdateTrackedLink(...args),
  archiveTrackedLink: (...args: unknown[]) => mockArchiveTrackedLink(...args),
}))

// ---------------------------------------------------------------------------
// Mock: supabase service (transitive dep via http-adapter, needs to exist)
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({})),
}))

describe('POST /api/pipeline/links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid JSON', async () => {
    const { parseBody } = await import('@/lib/pipeline/helpers')
    const { NextResponse } = await import('next/server')
    ;(parseBody as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 }),
    )

    const { POST } = await import('@/app/api/pipeline/links/route')
    const req = new NextRequest('http://localhost/api/pipeline/links', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects missing destination_url', async () => {
    const { parseBody } = await import('@/lib/pipeline/helpers')
    ;(parseBody as ReturnType<typeof vi.fn>).mockResolvedValue({ title: 'no url' })

    const { PipelineServiceError } = await import('@/lib/pipeline/services/types')
    mockCreateTrackedLink.mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Invalid destination_url', 400),
    )

    const { POST } = await import('@/app/api/pipeline/links/route')
    const req = new NextRequest('http://localhost/api/pipeline/links', {
      method: 'POST',
      body: JSON.stringify({ title: 'no url' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('destination_url')
  })

  it('returns 409 on duplicate code', async () => {
    const { parseBody } = await import('@/lib/pipeline/helpers')
    ;(parseBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      destination_url: 'https://example.com',
      code: 'taken',
    })

    const { PipelineServiceError } = await import('@/lib/pipeline/services/types')
    mockCreateTrackedLink.mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Code "taken" is already taken for this site', 409),
    )

    const { POST } = await import('@/app/api/pipeline/links/route')
    const req = new NextRequest('http://localhost/api/pipeline/links', {
      method: 'POST',
      body: JSON.stringify({ destination_url: 'https://example.com', code: 'taken' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })

  it('creates link and returns 201 with short_url', async () => {
    const { parseBody } = await import('@/lib/pipeline/helpers')
    ;(parseBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      destination_url: 'https://bythiagofigueiredo.com/blog/x',
      utm_campaign: 'junho-2026',
    })

    mockCreateTrackedLink.mockResolvedValue({
      data: {
        id: MOCK_LINK_ID,
        code: 'abc1234',
        short_url: 'https://bythiagofigueiredo.com/go/abc1234',
        destination_url: 'https://bythiagofigueiredo.com/blog/x',
        source_type: 'manual',
        active: true,
        utm_campaign: 'junho-2026',
      },
      status: 201,
    })

    const { POST } = await import('@/app/api/pipeline/links/route')
    const req = new NextRequest('http://localhost/api/pipeline/links', {
      method: 'POST',
      body: JSON.stringify({ destination_url: 'https://bythiagofigueiredo.com/blog/x', utm_campaign: 'junho-2026' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe(MOCK_LINK_ID)
    expect(body.data.short_url).toContain('/go/abc1234')
    expect(body.data.source_type).toBe('manual')
  })
})

describe('GET /api/pipeline/links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with data array and meta', async () => {
    mockListTrackedLinks.mockResolvedValue({
      data: {
        data: [
          {
            id: MOCK_LINK_ID,
            code: 'abc1234',
            short_url: 'https://bythiagofigueiredo.com/go/abc1234',
            destination_url: 'https://example.com',
            active: true,
            total_clicks: 3,
          },
        ],
        meta: { total: 1, has_next: false, limit: 50 },
      },
    })

    const { GET } = await import('@/app/api/pipeline/links/route')
    const req = new NextRequest('http://localhost/api/pipeline/links?utm_campaign=junho-2026&active=true')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.meta.total).toBe(1)
  })

  it('passes filters through to the service', async () => {
    mockListTrackedLinks.mockResolvedValue({ data: { data: [], meta: { total: 0, has_next: false, limit: 20 } } })

    const { GET } = await import('@/app/api/pipeline/links/route')
    const req = new NextRequest('http://localhost/api/pipeline/links?active=false&search=foo&limit=20')
    await GET(req)
    expect(mockListTrackedLinks).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ active: false, search: 'foo', limit: 20 }),
    )
  })
})

describe('GET /api/pipeline/links/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with the link', async () => {
    mockGetTrackedLink.mockResolvedValue({
      data: { id: MOCK_LINK_ID, code: 'abc1234', short_url: '.../go/abc1234', active: true },
    })

    const { GET } = await import('@/app/api/pipeline/links/[id]/route')
    const req = new NextRequest(`http://localhost/api/pipeline/links/${MOCK_LINK_ID}`)
    const res = await GET(req, { params: Promise.resolve({ id: MOCK_LINK_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(MOCK_LINK_ID)
  })

  it('returns 404 for unknown id', async () => {
    const { PipelineServiceError } = await import('@/lib/pipeline/services/types')
    mockGetTrackedLink.mockRejectedValue(new PipelineServiceError('NOT_FOUND', 'Link not found', 404))

    const { GET } = await import('@/app/api/pipeline/links/[id]/route')
    const req = new NextRequest(`http://localhost/api/pipeline/links/${MOCK_LINK_ID}`)
    const res = await GET(req, { params: Promise.resolve({ id: MOCK_LINK_ID }) })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/pipeline/links/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates and returns 200', async () => {
    const { parseBody } = await import('@/lib/pipeline/helpers')
    ;(parseBody as ReturnType<typeof vi.fn>).mockResolvedValue({ utm_campaign: 'julho-2026' })

    mockUpdateTrackedLink.mockResolvedValue({
      data: { id: MOCK_LINK_ID, code: 'abc1234', short_url: '.../go/abc1234', utm_campaign: 'julho-2026' },
    })

    const { PATCH } = await import('@/app/api/pipeline/links/[id]/route')
    const req = new NextRequest(`http://localhost/api/pipeline/links/${MOCK_LINK_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ utm_campaign: 'julho-2026' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: MOCK_LINK_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.utm_campaign).toBe('julho-2026')
  })
})

describe('DELETE /api/pipeline/links/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('archives (soft) and returns 200 with active false', async () => {
    mockArchiveTrackedLink.mockResolvedValue({ data: { id: MOCK_LINK_ID, active: false } })

    const { DELETE } = await import('@/app/api/pipeline/links/[id]/route')
    const req = new NextRequest(`http://localhost/api/pipeline/links/${MOCK_LINK_ID}`, { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: MOCK_LINK_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.active).toBe(false)
  })
})
