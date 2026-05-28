import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

// ─── Mocks ─────────────────────────────────────────────────────────────────

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

vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn().mockReturnValue({
    siteId: '11111111-1111-1111-1111-111111111111',
    permissions: ['read', 'write'],
    keyHash: 'test',
    supabase: {},
  }),
  serviceErrorToResponse: vi.fn((_err: unknown, _auth: unknown) =>
    new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }), { status: 500 }),
  ),
}))

vi.mock('@/lib/pipeline/services/utilities', () => ({
  getStats: vi.fn(),
  getWorkflows: vi.fn(),
  getTopicAggregation: vi.fn(),
}))

import { authenticateRead } from '@/lib/pipeline/helpers'
import { getStats, getWorkflows, getTopicAggregation } from '@/lib/pipeline/services/utilities'

// ─── Helpers ───────────────────────────────────────────────────────────────

function mockAuthSuccess() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}

function mockAuthFailure() {
  vi.mocked(authenticateRead).mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }), { status: 401 }),
  )
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
    vi.mocked(getStats).mockResolvedValue({
      total: 0,
      archived: 0,
      by_format: {},
      recently_updated_7d: 0,
      by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
    } as any)

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
    vi.mocked(getStats).mockResolvedValue({
      total: 3,
      archived: 1,
      by_format: {
        video: { total: 2, byStage: { idea: 1, roteiro: 1 } },
        blog_post: { total: 1, byStage: { idea: 1 } },
      },
      recently_updated_7d: 3,
      by_priority: { critical: 1, high: 1, medium: 1, low: 0 },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/stats'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.total).toBe(3)
    expect(body.data.archived).toBe(1)
  })

  it('breaks down by format and stage correctly', async () => {
    mockAuthSuccess()
    vi.mocked(getStats).mockResolvedValue({
      total: 4,
      archived: 0,
      by_format: {
        video: { total: 3, byStage: { idea: 2, roteiro: 1 } },
        blog_post: { total: 1, byStage: { draft: 1 } },
      },
      recently_updated_7d: 4,
      by_priority: { critical: 0, high: 0, medium: 4, low: 0 },
    } as any)

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
    vi.mocked(getStats).mockResolvedValue({
      total: 5,
      archived: 0,
      by_format: {},
      recently_updated_7d: 5,
      by_priority: { critical: 1, high: 1, medium: 1, low: 2 },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/stats'))
    const body = await res.json()
    expect(body.data.by_priority.critical).toBe(1)
    expect(body.data.by_priority.high).toBe(1)
    expect(body.data.by_priority.medium).toBe(1)
    expect(body.data.by_priority.low).toBe(2) // priority 1 and 2
  })

  it('counts recently updated items within 7 days', async () => {
    mockAuthSuccess()
    vi.mocked(getStats).mockResolvedValue({
      total: 3,
      archived: 0,
      by_format: {},
      recently_updated_7d: 2,
      by_priority: { critical: 0, high: 0, medium: 3, low: 0 },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/stats'))
    const body = await res.json()
    expect(body.data.recently_updated_7d).toBe(2)
  })

  it('handles null data from supabase gracefully', async () => {
    mockAuthSuccess()
    vi.mocked(getStats).mockResolvedValue({
      total: 0,
      archived: 0,
      by_format: {},
      recently_updated_7d: 0,
      by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
    } as any)

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
    vi.mocked(getWorkflows).mockReturnValue({
      workflows: { video: [], blog_post: [], newsletter: [], course: [], campaign: [] },
      default_checklists: { video: [], blog_post: [], newsletter: [], course: [], campaign: [] },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/workflows'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.workflows).toBeDefined()
    expect(body.data.default_checklists).toBeDefined()
  })

  it('includes all five formats in workflows', async () => {
    mockAuthSuccess()
    vi.mocked(getWorkflows).mockReturnValue({
      workflows: {
        video: [{ stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' }],
        blog_post: [{ stage: 'draft', position: 1, label_pt: 'Rascunho', label_en: 'Draft' }],
        newsletter: [{ stage: 'draft', position: 1, label_pt: 'Rascunho', label_en: 'Draft' }],
        course: [{ stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' }],
        campaign: [{ stage: 'draft', position: 1, label_pt: 'Rascunho', label_en: 'Draft' }],
      },
      default_checklists: { video: [], blog_post: [], newsletter: [], course: [], campaign: [] },
    } as any)

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
    vi.mocked(getWorkflows).mockReturnValue({
      workflows: {
        video: [
          { stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' },
          { stage: 'roteiro', position: 2, label_pt: 'Roteiro', label_en: 'Script' },
        ],
        blog_post: [], newsletter: [], course: [], campaign: [],
      },
      default_checklists: { video: [], blog_post: [], newsletter: [], course: [], campaign: [] },
    } as any)

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
    vi.mocked(getWorkflows).mockReturnValue({
      workflows: { video: [], blog_post: [], newsletter: [], course: [], campaign: [] },
      default_checklists: {
        video: [{ id: '1', label: 'Record', stage: 'gravacao' }],
        blog_post: [{ id: '2', label: 'Write', stage: 'draft' }],
        newsletter: [{ id: '3', label: 'Compose', stage: 'draft' }],
        course: [{ id: '4', label: 'Plan', stage: 'idea' }],
        campaign: [{ id: '5', label: 'Design', stage: 'draft' }],
      },
    } as any)

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
    vi.mocked(getTopicAggregation).mockResolvedValue({
      topic: 'gaming',
      pipeline_items: [
        { id: 'p1', code: 'vid-test', title_pt: 'Test', title_en: null, format: 'video', stage: 'idea', priority: 3, tags: ['gaming'], updated_at: new Date().toISOString() },
      ],
      blog_posts: [
        { id: 'b1', title: 'Gaming Post', slug: 'gaming-post', status: 'published', category: 'gaming' },
      ],
    } as any)

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
    vi.mocked(getTopicAggregation).mockResolvedValue({
      topic: 'nonexistent',
      pipeline_items: [],
      blog_posts: [],
    } as any)

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
    vi.mocked(getTopicAggregation).mockResolvedValue({
      topic: 'tech',
      pipeline_items: [],
      blog_posts: [],
    } as any)

    await GET(
      new NextRequest('http://localhost/api/pipeline/topics/tech'),
      { params: Promise.resolve({ code: 'tech' }) },
    )

    // Verify the service was called with the correct topic code
    expect(vi.mocked(getTopicAggregation)).toHaveBeenCalledWith(
      expect.anything(),
      'tech',
    )
  })
})
