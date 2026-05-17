import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

function createMockChain(finalResult: { data?: unknown; error?: unknown }) {
  const chain: Record<string, any> = {}
  const methods = [
    'from',
    'select',
    'eq',
    'in',
    'not',
    'is',
    'order',
    'limit',
    'single',
    'filter',
    'maybeSingle',
  ]
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  // Terminal awaiting resolves to finalResult
  chain.then = (resolve: (v: any) => any) => resolve(finalResult)
  return chain
}

function mockAuthSuccess() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true,
    auth: { keyId: 'test-key' },
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
    const chain = createMockChain({ data: tests, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: chain.from } as any)
    chain.from.mockReturnValue(chain)

    const req = createRequest('/api/pipeline/youtube/ab-tests')
    const res = await GET(req)

    expect(chain.from).toHaveBeenCalledWith('ab_tests')
    expect(chain.select).toHaveBeenCalled()
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(chain.eq).not.toHaveBeenCalled()
    expect(pipelineSuccess).toHaveBeenCalledWith(tests, 200, { keyId: 'test-key' })
    expect(res.status).toBe(200)
  })

  it('filters by status when ?status=active query param provided', async () => {
    mockAuthSuccess()

    const tests = [{ id: '1', name: 'Test A', status: 'active' }]
    const chain = createMockChain({ data: tests, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: chain.from } as any)
    chain.from.mockReturnValue(chain)

    const req = createRequest('/api/pipeline/youtube/ab-tests?status=active')
    const res = await GET(req)

    expect(chain.eq).toHaveBeenCalledWith('status', 'active')
    expect(pipelineSuccess).toHaveBeenCalledWith(tests, 200, { keyId: 'test-key' })
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

    const chain = createMockChain({ data: null, error: { message: 'not found' } })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: chain.from } as any)
    chain.from.mockReturnValue(chain)

    const req = createRequest('/api/pipeline/youtube/ab-tests/missing-id')
    const res = await GET(req, { params: Promise.resolve({ id: 'missing-id' }) })

    expect(pipelineError).toHaveBeenCalledWith('NOT_FOUND', 'Test not found', 404, { keyId: 'test-key' })
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
    const chain = createMockChain({ data: test, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: chain.from } as any)
    chain.from.mockReturnValue(chain)

    const req = createRequest('/api/pipeline/youtube/ab-tests/test-1')
    const res = await GET(req, { params: Promise.resolve({ id: 'test-1' }) })

    expect(chain.eq).toHaveBeenCalledWith('id', 'test-1')
    expect(chain.single).toHaveBeenCalled()
    expect(pipelineSuccess).toHaveBeenCalledWith(test, 200, { keyId: 'test-key' })
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

    const chain = createMockChain({ data: null, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: chain.from } as any)
    chain.from.mockReturnValue(chain)

    const req = createRequest('/api/pipeline/youtube/ab-tests/missing-id/funnel')
    const res = await GET(req, { params: Promise.resolve({ id: 'missing-id' }) })

    expect(pipelineError).toHaveBeenCalledWith('NOT_FOUND', 'Test not found', 404, { keyId: 'test-key' })
    expect(res.status).toBe(404)
  })

  it('returns per_variant and per_link funnel data correctly aggregated', async () => {
    mockAuthSuccess()

    // We need multiple chained from() calls returning different results
    let fromCallCount = 0
    const testChain = createMockChain({ data: { id: 'test-1', site_id: 'site-1' }, error: null })
    const trackedLinksChain = createMockChain({
      data: [
        { link_id: 'link-1', variant_id: 'v1', template_name: 'cta', short_code: 'abc' },
        { link_id: 'link-2', variant_id: 'v2', template_name: 'cta', short_code: 'def' },
      ],
      error: null,
    })
    const cyclesChain = createMockChain({
      data: [
        { variant_id: 'v1', impressions: 100, clicks: 10 },
        { variant_id: 'v1', impressions: 50, clicks: 5 },
        { variant_id: 'v2', impressions: 200, clicks: 30 },
      ],
      error: null,
    })
    const clickAggsChain = createMockChain({
      data: [
        { link_id: 'link-1', total_clicks: 7 },
        { link_id: 'link-2', total_clicks: 20 },
      ],
      error: null,
    })

    const chains = [testChain, trackedLinksChain, cyclesChain, clickAggsChain]

    const mockFrom = vi.fn().mockImplementation(() => {
      const chain = chains[fromCallCount]
      fromCallCount++
      return chain
    })

    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: mockFrom } as any)

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
      { keyId: 'test-key' },
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

    const completedTests = [
      {
        id: 't1',
        name: 'Test 1',
        test_type: 'thumbnail',
        confidence_at_completion: 0.95,
        result_metadata: {},
        winner: {
          id: 'v1',
          label: 'Bold thumbnail',
          title_text: null,
          description_text: null,
          metadata: { title_pattern: 'question', thumbnail_tags: ['bold', 'face'] },
        },
      },
      {
        id: 't2',
        name: 'Test 2',
        test_type: 'title',
        confidence_at_completion: 0.92,
        result_metadata: {},
        winner: {
          id: 'v2',
          label: 'Question title',
          title_text: 'Is this real?',
          description_text: null,
          metadata: { title_pattern: 'question', thumbnail_tags: ['bold'] },
        },
      },
    ]

    const chain = createMockChain({ data: completedTests, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: chain.from } as any)
    chain.from.mockReturnValue(chain)

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
      { keyId: 'test-key' },
    )
  })
})
