import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn(),
  pipelineError: vi.fn(
    (code: string, msg: string, status: number) =>
      new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
  ),
  pipelineSuccess: vi.fn(
    (data: unknown, status: number) =>
      new Response(JSON.stringify({ data }), { status }),
  ),
}))

vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn().mockReturnValue({
    siteId: 'site-1',
    permissions: ['read', 'write'],
    supabase: {},
  }),
  serviceErrorToResponse: vi.fn().mockImplementation((err: unknown) => {
    if (err instanceof PipelineServiceError) {
      return new Response(
        JSON.stringify({ error: { code: err.code, message: err.message } }),
        { status: err.status },
      )
    }
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }),
      { status: 500 },
    )
  }),
}))

vi.mock('@/lib/pipeline/services/youtube', () => ({
  listAbTests: vi.fn(),
  getAbTest: vi.fn(),
  getAbTestFunnel: vi.fn(),
  getAbPerformance: vi.fn(),
}))

import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import {
  listAbTests,
  getAbTest,
  getAbTestFunnel,
  getAbPerformance,
} from '@/lib/pipeline/services/youtube'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

function mockAuthSuccess() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true,
    auth: { keyId: 'test-key', siteId: 'site-1' },
  } as any)
}

function mockAuthFailure() {
  vi.mocked(authenticateRead).mockResolvedValue(
    new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
  )
}

// ─── Route 1: GET /api/pipeline/youtube/ab-tests ──────────────────────────────

describe('GET /api/pipeline/youtube/ab-tests', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import(
      '@/app/api/pipeline/youtube/ab-tests/route'
    )
    GET = mod.GET
  })

  it('returns auth error when authenticateRead returns a Response', async () => {
    mockAuthFailure()
    const req = createRequest('/api/pipeline/youtube/ab-tests')
    const res = await GET(req)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
  })

  it('returns list of tests without status filter', async () => {
    mockAuthSuccess()

    const tests = [
      { id: '1', name: 'Test A', status: 'active' },
      { id: '2', name: 'Test B', status: 'completed' },
    ]
    vi.mocked(listAbTests).mockResolvedValue({ data: tests } as any)

    const req = createRequest('/api/pipeline/youtube/ab-tests')
    const res = await GET(req)

    expect(listAbTests).toHaveBeenCalled()
    expect(pipelineSuccess).toHaveBeenCalledWith(tests, 200, { keyId: 'test-key', siteId: 'site-1' })
    expect(res.status).toBe(200)
  })

  it('filters by status when ?status=active query param provided', async () => {
    mockAuthSuccess()

    const tests = [{ id: '1', name: 'Test A', status: 'active' }]
    vi.mocked(listAbTests).mockResolvedValue({ data: tests } as any)

    const req = createRequest('/api/pipeline/youtube/ab-tests?status=active')
    const res = await GET(req)

    // The route passes the status as AbTestFilters to the service function
    expect(listAbTests).toHaveBeenCalledWith(expect.anything(), { status: 'active' })
    expect(pipelineSuccess).toHaveBeenCalledWith(tests, 200, { keyId: 'test-key', siteId: 'site-1' })
    expect(res.status).toBe(200)
  })
})

// ─── Route 2: GET /api/pipeline/youtube/ab-tests/[id] ─────────────────────────

describe('GET /api/pipeline/youtube/ab-tests/[id]', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import(
      '@/app/api/pipeline/youtube/ab-tests/[id]/route'
    )
    GET = mod.GET
  })

  it('returns 404 when test not found', async () => {
    mockAuthSuccess()

    vi.mocked(getAbTest).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Test not found', 404),
    )

    const req = createRequest('/api/pipeline/youtube/ab-tests/missing-id')
    const res = await GET(req, { params: Promise.resolve({ id: 'missing-id' }) })

    expect(res.status).toBe(404)
  })

  it('returns test with variants, cycles, and tracked_links joined', async () => {
    mockAuthSuccess()

    const test = {
      id: 'test-1',
      name: 'My Test',
      variants: [{ id: 'v1', label: 'Original' }],
      cycles: [{ id: 'c1', variant_id: 'v1' }],
      tracked_links: [{ id: 'tl1', link_id: 'link-1' }],
    }
    vi.mocked(getAbTest).mockResolvedValue({ data: test } as any)

    const req = createRequest('/api/pipeline/youtube/ab-tests/test-1')
    const res = await GET(req, { params: Promise.resolve({ id: 'test-1' }) })

    expect(getAbTest).toHaveBeenCalledWith(expect.anything(), 'test-1')
    expect(pipelineSuccess).toHaveBeenCalledWith(test, 200, { keyId: 'test-key', siteId: 'site-1' })
    expect(res.status).toBe(200)
  })
})

// ─── Route 3: GET /api/pipeline/youtube/ab-tests/[id]/funnel ──────────────────

describe('GET /api/pipeline/youtube/ab-tests/[id]/funnel', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import(
      '@/app/api/pipeline/youtube/ab-tests/[id]/funnel/route'
    )
    GET = mod.GET
  })

  it('returns 404 when test not found', async () => {
    mockAuthSuccess()

    vi.mocked(getAbTestFunnel).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Test not found', 404),
    )

    const req = createRequest('/api/pipeline/youtube/ab-tests/missing-id/funnel')
    const res = await GET(req, { params: Promise.resolve({ id: 'missing-id' }) })

    expect(res.status).toBe(404)
  })

  it('returns per_variant and per_link funnel data correctly aggregated', async () => {
    mockAuthSuccess()

    const funnelData = {
      per_variant: [
        { variant_id: 'v1', impressions: 150, clicks: 15, link_clicks: 7 },
        { variant_id: 'v2', impressions: 200, clicks: 30, link_clicks: 20 },
      ],
      per_link: [
        { template_name: 'cta', variant_id: 'v1', short_code: 'abc', clicks: 7 },
        { template_name: 'cta', variant_id: 'v2', short_code: 'def', clicks: 20 },
      ],
    }
    vi.mocked(getAbTestFunnel).mockResolvedValue({ data: funnelData } as any)

    const req = createRequest('/api/pipeline/youtube/ab-tests/test-1/funnel')
    const res = await GET(req, { params: Promise.resolve({ id: 'test-1' }) })

    expect(res.status).toBe(200)
    expect(pipelineSuccess).toHaveBeenCalledWith(
      {
        per_variant: expect.arrayContaining([
          { variant_id: 'v1', impressions: 150, clicks: 15, link_clicks: 7 },
          { variant_id: 'v2', impressions: 200, clicks: 30, link_clicks: 20 },
        ]),
        per_link: expect.arrayContaining([
          { template_name: 'cta', variant_id: 'v1', short_code: 'abc', clicks: 7 },
          { template_name: 'cta', variant_id: 'v2', short_code: 'def', clicks: 20 },
        ]),
      },
      200,
      { keyId: 'test-key', siteId: 'site-1' },
    )
  })
})

// ─── Route 4: GET /api/pipeline/youtube/ab-performance ────────────────────────

describe('GET /api/pipeline/youtube/ab-performance', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import(
      '@/app/api/pipeline/youtube/ab-performance/route'
    )
    GET = mod.GET
  })

  it('returns winning patterns and tags from completed tests', async () => {
    mockAuthSuccess()

    const perfData = {
      completed_tests: 2,
      winning_patterns: { question: 2 },
      winning_tags: {
        bold: { wins: 2, tests: 2 },
        face: { wins: 1, tests: 1 },
      },
    }
    vi.mocked(getAbPerformance).mockResolvedValue({ data: perfData } as any)

    const req = createRequest('/api/pipeline/youtube/ab-performance')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(pipelineSuccess).toHaveBeenCalledWith(
      {
        completed_tests: 2,
        winning_patterns: { question: 2 },
        winning_tags: {
          bold: { wins: 2, tests: 2 },
          face: { wins: 1, tests: 1 },
        },
      },
      200,
      { keyId: 'test-key', siteId: 'site-1' },
    )
  })
})
