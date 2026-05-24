import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { authenticateRead } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

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

function createMockChain(finalResult: { data?: unknown; error?: unknown; count?: number | null }) {
  const chain: Record<string, any> = {}
  for (const m of [
    'from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'in',
    'or', 'order', 'limit', 'not', 'neq', 'contains', 'ilike', 'textSearch',
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockResolvedValue({ data: finalResult.data, error: finalResult.error })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: finalResult.data, error: finalResult.error })
  chain.then = (resolve: (v: any) => any) =>
    resolve({ data: finalResult.data, error: finalResult.error, count: finalResult.count ?? null })
  return chain
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
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: tests })),
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-tests'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })

  it('filters by status query param', async () => {
    mockAuthRead()
    const tests = [{ id: MOCK_TEST_ID, name: 'Running Test', status: 'running' }]
    const chain = createMockChain({ data: tests })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(chain),
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-tests?status=running'))
    expect(res.status).toBe(200)
    // The route calls .eq('status', status) when status param is present
    expect(chain.eq).toHaveBeenCalledWith('status', 'running')
  })

  it('returns empty array when no tests exist', async () => {
    mockAuthRead()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: [] })),
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-tests'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('returns 500 on DB error', async () => {
    mockAuthRead()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null, error: { message: 'DB down' } })),
    } as any)

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
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null, error: { code: 'PGRST116' } })),
    } as any)

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
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: test })),
    } as any)

    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_TEST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(MOCK_TEST_ID)
    expect(body.data.variants).toHaveLength(1)
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
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        // First call: ab_tests lookup
        return createMockChain({ data: null })
      }),
    } as any)

    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_TEST_ID))
    expect(res.status).toBe(404)
  })

  it('returns funnel data with per_variant and per_link', async () => {
    mockAuthRead()
    const LINK_ID = '55555555-5555-5555-5555-555555555555'

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // ab_tests lookup
          return createMockChain({ data: { id: MOCK_TEST_ID, site_id: MOCK_SITE_ID } })
        }
        if (callCount === 2) {
          // ab_test_tracked_links
          return createMockChain({
            data: [
              {
                id: 'tl1',
                ab_test_id: MOCK_TEST_ID,
                variant_id: MOCK_VARIANT_ID,
                link_id: LINK_ID,
                template_name: 'pinned_comment',
                short_code: 'abc',
                link: { id: LINK_ID, code: 'abc', destination_url: 'https://example.com' },
              },
            ],
          })
        }
        if (callCount === 3) {
          // ab_test_cycles
          return createMockChain({
            data: [
              { variant_id: MOCK_VARIANT_ID, impressions: 1000, clicks: 50 },
              { variant_id: MOCK_VARIANT_ID, impressions: 800, clicks: 40 },
            ],
          })
        }
        // link_click_aggregates
        return createMockChain({
          data: [{ link_id: LINK_ID, total_clicks: 25 }],
        })
      }),
    } as any)

    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_TEST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.per_variant).toHaveLength(1)
    expect(body.data.per_variant[0].impressions).toBe(1800)
    expect(body.data.per_variant[0].clicks).toBe(90)
    expect(body.data.per_variant[0].link_clicks).toBe(25)
    expect(body.data.per_link).toHaveLength(1)
    expect(body.data.per_link[0].clicks).toBe(25)
  })

  it('returns empty funnel when no cycles or links exist', async () => {
    mockAuthRead()
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return createMockChain({ data: { id: MOCK_TEST_ID, site_id: MOCK_SITE_ID } })
        }
        // tracked_links, cycles — all empty
        return createMockChain({ data: [] })
      }),
    } as any)

    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_TEST_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.per_variant).toEqual([])
    expect(body.data.per_link).toEqual([])
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
    const completedTests = [
      {
        id: MOCK_TEST_ID,
        name: 'Title Test',
        test_type: 'title',
        confidence_at_completion: 0.95,
        result_metadata: {},
        winner: {
          id: MOCK_VARIANT_ID,
          label: 'Variant A',
          title_text: 'Better Title',
          description_text: null,
          metadata: {
            title_pattern: 'question',
            thumbnail_tags: ['face', 'text-overlay'],
          },
        },
      },
    ]
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: completedTests })),
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-performance'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.completed_tests).toBe(1)
    expect(body.data.winning_patterns).toEqual({ question: 1 })
    expect(body.data.winning_tags).toEqual({
      face: { wins: 1, tests: 1 },
      'text-overlay': { wins: 1, tests: 1 },
    })
  })

  it('returns empty stats when no completed tests', async () => {
    mockAuthRead()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: [] })),
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-performance'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.completed_tests).toBe(0)
    expect(body.data.winning_patterns).toEqual({})
    expect(body.data.winning_tags).toEqual({})
  })

  it('handles winner as array (Supabase join format)', async () => {
    mockAuthRead()
    const completedTests = [
      {
        id: MOCK_TEST_ID,
        name: 'Array Winner Test',
        test_type: 'thumbnail',
        confidence_at_completion: 0.9,
        result_metadata: {},
        winner: [
          {
            id: MOCK_VARIANT_ID,
            label: 'B',
            title_text: null,
            description_text: null,
            metadata: { title_pattern: 'listicle' },
          },
        ],
      },
    ]
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: completedTests })),
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-performance'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.winning_patterns).toEqual({ listicle: 1 })
  })

  it('skips tests with null winner', async () => {
    mockAuthRead()
    const completedTests = [
      {
        id: MOCK_TEST_ID,
        name: 'No Winner',
        test_type: 'title',
        confidence_at_completion: null,
        result_metadata: {},
        winner: null,
      },
    ]
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: completedTests })),
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/ab-performance'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.completed_tests).toBe(1)
    expect(body.data.winning_patterns).toEqual({})
  })
})
