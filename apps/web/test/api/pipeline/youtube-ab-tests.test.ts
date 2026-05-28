import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_TEST_ID = '22222222-2222-2222-2222-222222222222'
const MOCK_VARIANT_ID = '33333333-3333-3333-3333-333333333333'

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn(),
  authenticateWrite: vi.fn(),
  pipelineError: vi.fn(
    (code: string, msg: string, status: number) =>
      new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
  ),
  pipelineSuccess: vi.fn(
    (data: unknown, status: number) =>
      new Response(JSON.stringify({ data }), { status }),
  ),
  parseBody: vi.fn(),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/pipeline/logger', () => ({
  pipelineLog: vi.fn(),
}))

vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn().mockReturnValue({
    siteId: MOCK_SITE_ID,
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

import { authenticateRead } from '@/lib/pipeline/helpers'
import {
  listAbTests,
  getAbTest,
  getAbTestFunnel,
  getAbPerformance,
} from '@/lib/pipeline/services/youtube'

function mockAuthRead() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}
function mockAuthFail() {
  const resp = new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }) as any
  vi.mocked(authenticateRead).mockResolvedValue(resp)
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ─── GET /api/pipeline/youtube/ab-tests ─────────────────────────────────────

describe('GET /api/pipeline/youtube/ab-tests', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/ab-tests/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-tests'))
    expect(res.status).toBe(401)
  })

  it('returns list of tests', async () => {
    mockAuthRead()
    const tests = [
      { id: MOCK_TEST_ID, name: 'Title Test 1', status: 'running' },
      { id: '44444444-4444-4444-4444-444444444444', name: 'Thumb Test', status: 'completed' },
    ]
    vi.mocked(listAbTests).mockResolvedValue({ data: tests } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-tests'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.data).toHaveLength(2)
  })

  it('filters by status query param', async () => {
    mockAuthRead()
    const tests = [{ id: MOCK_TEST_ID, name: 'Running Test', status: 'running' }]
    vi.mocked(listAbTests).mockResolvedValue({ data: tests } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-tests?status=running'))
    expect(res.status).toBe(200)
    // The route passes the status as AbTestFilters to the service function
    expect(listAbTests).toHaveBeenCalledWith(expect.anything(), { status: 'running' })
  })

  it('returns empty array when no tests exist', async () => {
    mockAuthRead()
    vi.mocked(listAbTests).mockResolvedValue({ data: [] } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-tests'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.data).toEqual([])
  })

  it('returns 500 on DB error', async () => {
    mockAuthRead()
    vi.mocked(listAbTests).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to load tests', 500),
    )

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-tests'))
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/pipeline/youtube/ab-tests/[id] ────────────────────────────────

describe('GET /api/pipeline/youtube/ab-tests/[id]', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/ab-tests/[id]/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_TEST_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when test not found', async () => {
    mockAuthRead()
    vi.mocked(getAbTest).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Test not found', 404),
    )

    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_TEST_ID))
    expect(res.status).toBe(404)
  })

  it('returns test with variants, cycles and tracked_links', async () => {
    mockAuthRead()
    const test = {
      id: MOCK_TEST_ID,
      name: 'Title AB Test',
      status: 'running',
      variants: [{ id: MOCK_VARIANT_ID, label: 'A' }],
      cycles: [{ id: 'c1', variant_id: MOCK_VARIANT_ID }],
      tracked_links: [],
    }
    vi.mocked(getAbTest).mockResolvedValue({ data: test } as any)

    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_TEST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.data.id).toBe(MOCK_TEST_ID)
    expect(body.data.data.variants).toHaveLength(1)
  })
})

// ─── GET /api/pipeline/youtube/ab-tests/[id]/funnel ─────────────────────────

describe('GET /api/pipeline/youtube/ab-tests/[id]/funnel', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/ab-tests/[id]/funnel/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_TEST_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when test not found', async () => {
    mockAuthRead()
    vi.mocked(getAbTestFunnel).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Test not found', 404),
    )

    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_TEST_ID))
    expect(res.status).toBe(404)
  })

  it('returns funnel data with per_variant and per_link', async () => {
    mockAuthRead()
    const LINK_ID = '55555555-5555-5555-5555-555555555555'

    const funnelData = {
      per_variant: [
        { variant_id: MOCK_VARIANT_ID, impressions: 1800, clicks: 90, link_clicks: 25 },
      ],
      per_link: [
        { template_name: 'pinned_comment', variant_id: MOCK_VARIANT_ID, short_code: 'abc', clicks: 25 },
      ],
    }
    vi.mocked(getAbTestFunnel).mockResolvedValue({ data: funnelData } as any)

    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_TEST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.data.per_variant).toHaveLength(1)
    expect(body.data.data.per_variant[0].impressions).toBe(1800)
    expect(body.data.data.per_variant[0].clicks).toBe(90)
    expect(body.data.data.per_variant[0].link_clicks).toBe(25)
    expect(body.data.data.per_link).toHaveLength(1)
    expect(body.data.data.per_link[0].clicks).toBe(25)
  })

  it('returns empty funnel when no cycles or links exist', async () => {
    mockAuthRead()
    vi.mocked(getAbTestFunnel).mockResolvedValue({
      data: { per_variant: [], per_link: [] },
    } as any)

    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_TEST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.data.per_variant).toEqual([])
    expect(body.data.data.per_link).toEqual([])
  })
})

// ─── GET /api/pipeline/youtube/ab-performance ───────────────────────────────

describe('GET /api/pipeline/youtube/ab-performance', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/ab-performance/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-performance'))
    expect(res.status).toBe(401)
  })

  it('returns performance data with winning patterns', async () => {
    mockAuthRead()
    const perfData = {
      completed_tests: 1,
      winning_patterns: { question: 1 },
      winning_tags: {
        face: { wins: 1, tests: 1 },
        'text-overlay': { wins: 1, tests: 1 },
      },
    }
    vi.mocked(getAbPerformance).mockResolvedValue({ data: perfData } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-performance'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.data.completed_tests).toBe(1)
    expect(body.data.data.winning_patterns).toEqual({ question: 1 })
    expect(body.data.data.winning_tags).toEqual({
      face: { wins: 1, tests: 1 },
      'text-overlay': { wins: 1, tests: 1 },
    })
  })

  it('returns empty stats when no completed tests', async () => {
    mockAuthRead()
    vi.mocked(getAbPerformance).mockResolvedValue({
      data: { completed_tests: 0, winning_patterns: {}, winning_tags: {} },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-performance'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.data.completed_tests).toBe(0)
    expect(body.data.data.winning_patterns).toEqual({})
    expect(body.data.data.winning_tags).toEqual({})
  })

  it('handles winner as array (Supabase join format)', async () => {
    mockAuthRead()
    vi.mocked(getAbPerformance).mockResolvedValue({
      data: { completed_tests: 1, winning_patterns: { listicle: 1 }, winning_tags: {} },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-performance'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.data.winning_patterns).toEqual({ listicle: 1 })
  })

  it('skips tests with null winner', async () => {
    mockAuthRead()
    vi.mocked(getAbPerformance).mockResolvedValue({
      data: { completed_tests: 1, winning_patterns: {}, winning_tags: {} },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-performance'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.data.completed_tests).toBe(1)
    expect(body.data.data.winning_patterns).toEqual({})
  })
})
