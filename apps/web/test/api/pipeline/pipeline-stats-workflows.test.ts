import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

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

vi.mock('@/lib/pipeline/auth', () => ({
  buildRateLimitHeaders: vi.fn(() => ({})),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { authenticateRead } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockAuthSuccess() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as never)
}

function mockAuthFailure() {
  vi.mocked(authenticateRead).mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }), { status: 401 }),
  )
}

function createMockChain(finalResult: { data?: unknown; error?: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'in',
    'order', 'limit', 'single', 'filter', 'maybeSingle', 'not', 'neq', 'contains']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: { data?: unknown; error?: unknown }) => unknown) => resolve(finalResult)
  return chain
}

// ─── Stats Route Tests ────────────────────────────────────────────────────────

describe('GET /api/pipeline/stats', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/pipeline/stats/route')
    GET = mod.GET
  })

  it('returns 401 when authentication fails', async () => {
    mockAuthFailure()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/stats'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns stats with correct structure on empty data', async () => {
    mockAuthSuccess()
    const chain = createMockChain({ data: [], error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/stats'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.total).toBe(0)
    expect(body.data.archived).toBe(0)
    expect(body.data.recently_updated_7d).toBe(0)
    expect(body.data.by_format).toBeDefined()
    expect(body.data.by_priority).toBeDefined()
    expect(body.data.by_priority.critical).toBe(0)
    expect(body.data.by_priority.high).toBe(0)
    expect(body.data.by_priority.medium).toBe(0)
    expect(body.data.by_priority.low).toBe(0)
  })

  it('counts active items and excludes archived', async () => {
    mockAuthSuccess()
    const items = [
      { format: 'video', stage: 'idea', priority: 5, is_archived: false, updated_at: new Date().toISOString() },
      { format: 'video', stage: 'roteiro', priority: 3, is_archived: false, updated_at: new Date().toISOString() },
      { format: 'blog_post', stage: 'idea', priority: 4, is_archived: false, updated_at: new Date().toISOString() },
      { format: 'video', stage: 'idea', priority: 2, is_archived: true, updated_at: new Date().toISOString() },
    ]
    const chain = createMockChain({ data: items, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/stats'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.total).toBe(3)
    expect(body.data.archived).toBe(1)
  })

  it('breaks down by format and stage correctly', async () => {
    mockAuthSuccess()
    const items = [
      { format: 'video', stage: 'idea', priority: 3, is_archived: false, updated_at: new Date().toISOString() },
      { format: 'video', stage: 'idea', priority: 3, is_archived: false, updated_at: new Date().toISOString() },
      { format: 'video', stage: 'roteiro', priority: 3, is_archived: false, updated_at: new Date().toISOString() },
      { format: 'blog_post', stage: 'draft', priority: 3, is_archived: false, updated_at: new Date().toISOString() },
    ]
    const chain = createMockChain({ data: items, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/stats'))
    const body = await res.json()
    expect(body.data.by_format.video.total).toBe(3)
    expect(body.data.by_format.video.byStage.idea).toBe(2)
    expect(body.data.by_format.video.byStage.roteiro).toBe(1)
    expect(body.data.by_format.blog_post.total).toBe(1)
    expect(body.data.by_format.blog_post.byStage.draft).toBe(1)
  })

  it('counts priority tiers correctly', async () => {
    mockAuthSuccess()
    const items = [
      { format: 'video', stage: 'idea', priority: 5, is_archived: false, updated_at: new Date().toISOString() },
      { format: 'video', stage: 'idea', priority: 4, is_archived: false, updated_at: new Date().toISOString() },
      { format: 'video', stage: 'idea', priority: 3, is_archived: false, updated_at: new Date().toISOString() },
      { format: 'video', stage: 'idea', priority: 2, is_archived: false, updated_at: new Date().toISOString() },
      { format: 'video', stage: 'idea', priority: 1, is_archived: false, updated_at: new Date().toISOString() },
    ]
    const chain = createMockChain({ data: items, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/stats'))
    const body = await res.json()
    expect(body.data.by_priority.critical).toBe(1)
    expect(body.data.by_priority.high).toBe(1)
    expect(body.data.by_priority.medium).toBe(1)
    expect(body.data.by_priority.low).toBe(2) // priority 1 and 2
  })

  it('counts recently updated items within 7 days', async () => {
    mockAuthSuccess()
    const now = new Date()
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const items = [
      { format: 'video', stage: 'idea', priority: 3, is_archived: false, updated_at: fiveDaysAgo },
      { format: 'video', stage: 'idea', priority: 3, is_archived: false, updated_at: now.toISOString() },
      { format: 'video', stage: 'idea', priority: 3, is_archived: false, updated_at: tenDaysAgo },
    ]
    const chain = createMockChain({ data: items, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/stats'))
    const body = await res.json()
    expect(body.data.recently_updated_7d).toBe(2)
  })

  it('handles null data from supabase gracefully', async () => {
    mockAuthSuccess()
    const chain = createMockChain({ data: null as unknown as undefined, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/stats'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.total).toBe(0)
    expect(body.data.archived).toBe(0)
  })
})

// ─── Workflows Route Tests ───────────────────────────────────────────────────

describe('GET /api/pipeline/workflows', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/pipeline/workflows/route')
    GET = mod.GET
  })

  it('returns 401 when authentication fails', async () => {
    mockAuthFailure()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/workflows'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns workflows and default checklists', async () => {
    mockAuthSuccess()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/workflows'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.workflows).toBeDefined()
    expect(body.data.default_checklists).toBeDefined()
  })

  it('includes all five formats in workflows', async () => {
    mockAuthSuccess()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/workflows'))
    const body = await res.json()
    const formats = Object.keys(body.data.workflows)
    expect(formats).toContain('video')
    expect(formats).toContain('blog_post')
    expect(formats).toContain('newsletter')
    expect(formats).toContain('course')
    expect(formats).toContain('campaign')
  })

  it('each workflow format has stages with position and labels', async () => {
    mockAuthSuccess()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/workflows'))
    const body = await res.json()
    const videoStages = body.data.workflows.video
    expect(Array.isArray(videoStages)).toBe(true)
    expect(videoStages.length).toBeGreaterThan(0)
    const first = videoStages[0]
    expect(first.stage).toBeDefined()
    expect(first.position).toBeDefined()
    expect(first.label_pt).toBeDefined()
    expect(first.label_en).toBeDefined()
  })

  it('default checklists exist for each format', async () => {
    mockAuthSuccess()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/workflows'))
    const body = await res.json()
    const formats = ['video', 'blog_post', 'newsletter', 'course', 'campaign']
    for (const format of formats) {
      expect(Array.isArray(body.data.default_checklists[format])).toBe(true)
      expect(body.data.default_checklists[format].length).toBeGreaterThan(0)
    }
  })
})

// ─── Topics/[code] Route Tests ───────────────────────────────────────────────

describe('GET /api/pipeline/topics/[code]', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ code: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/pipeline/topics/[code]/route')
    GET = mod.GET
  })

  it('returns 401 when authentication fails', async () => {
    mockAuthFailure()
    const res = await GET(
      new NextRequest('http://localhost/api/pipeline/topics/gaming'),
      { params: Promise.resolve({ code: 'gaming' }) },
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns pipeline items and blog posts for a topic code', async () => {
    mockAuthSuccess()

    const mockPipelineItems = [
      { id: 'p1', code: 'vid-test', title_pt: 'Test', title_en: null, format: 'video', stage: 'idea', priority: 3, tags: ['gaming'], updated_at: new Date().toISOString() },
    ]
    const mockBlogPosts = [
      { id: 'b1', title: 'Gaming Post', slug: 'gaming-post', status: 'published', category: 'gaming' },
    ]

    // The route makes two separate queries: content_pipeline and blog_posts.
    // We need the chain to resolve differently for each .from() call.
    let fromCallCount = 0
    const pipelineChain = createMockChain({ data: mockPipelineItems, error: null })
    const blogChain = createMockChain({ data: mockBlogPosts, error: null })

    const mockClient = {
      from: vi.fn((_table: string) => {
        fromCallCount++
        return fromCallCount === 1 ? pipelineChain : blogChain
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient as never)

    const res = await GET(
      new NextRequest('http://localhost/api/pipeline/topics/gaming'),
      { params: Promise.resolve({ code: 'gaming' }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.topic).toBe('gaming')
    expect(body.data.pipeline_items).toHaveLength(1)
    expect(body.data.blog_posts).toHaveLength(1)
  })

  it('returns empty arrays when no items match the topic', async () => {
    mockAuthSuccess()
    const pipelineChain = createMockChain({ data: [], error: null })
    const blogChain = createMockChain({ data: [], error: null })

    let fromCallCount = 0
    const mockClient = {
      from: vi.fn(() => {
        fromCallCount++
        return fromCallCount === 1 ? pipelineChain : blogChain
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient as never)

    const res = await GET(
      new NextRequest('http://localhost/api/pipeline/topics/nonexistent'),
      { params: Promise.resolve({ code: 'nonexistent' }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.topic).toBe('nonexistent')
    expect(body.data.pipeline_items).toHaveLength(0)
    expect(body.data.blog_posts).toHaveLength(0)
  })

  it('queries content_pipeline with correct filters', async () => {
    mockAuthSuccess()
    const chain = createMockChain({ data: [], error: null })
    const fromSpy = vi.fn().mockReturnValue(chain)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: fromSpy } as never)

    await GET(
      new NextRequest('http://localhost/api/pipeline/topics/tech'),
      { params: Promise.resolve({ code: 'tech' }) },
    )

    expect(fromSpy).toHaveBeenCalledWith('content_pipeline')
    expect(fromSpy).toHaveBeenCalledWith('blog_posts')
  })
})
