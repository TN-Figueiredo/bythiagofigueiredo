import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ITEM_ID = '22222222-2222-2222-2222-222222222222'
const MOCK_BLOG_POST_ID = '33333333-3333-3333-3333-333333333333'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/pipeline/helpers', () => ({
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

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createRequest(body?: unknown) {
  return new NextRequest(
    new URL(`http://localhost:3000/api/pipeline/items/${MOCK_ITEM_ID}/publish`),
    { method: 'POST', body: body ? JSON.stringify(body) : undefined },
  )
}

function mockAuthSuccess() {
  vi.mocked(authenticateWrite).mockResolvedValue({
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}

function mockAuthFailure() {
  vi.mocked(authenticateWrite).mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }), { status: 401 }),
  )
}

function createMockChain(finalResult: { data?: unknown; error?: unknown }) {
  const chain: Record<string, any> = {}
  const methods = ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'in',
    'order', 'limit', 'single', 'filter', 'maybeSingle', 'not', 'neq']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: any) => any) => resolve(finalResult)
  return chain
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/pipeline/items/[id]/publish', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/pipeline/items/[id]/publish/route')
    POST = mod.POST
  })

  it('returns 400 for invalid UUID', async () => {
    const req = createRequest()
    const res = await POST(req, { params: Promise.resolve({ id: 'not-a-uuid' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('Invalid item ID')
  })

  it('returns 401 when authenticateWrite fails', async () => {
    mockAuthFailure()
    vi.mocked(parseBody).mockResolvedValue({})
    const req = createRequest()
    const res = await POST(req, { params: Promise.resolve({ id: MOCK_ITEM_ID }) })
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body (missing targetStage)', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ vvsScore: 90 })
    const req = createRequest()
    const res = await POST(req, { params: Promise.resolve({ id: MOCK_ITEM_ID }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid body (vvsScore out of range)', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ targetStage: 'published', vvsScore: 200 })
    const req = createRequest()
    const res = await POST(req, { params: Promise.resolve({ id: MOCK_ITEM_ID }) })
    expect(res.status).toBe(400)
  })

  it('returns 422 when VVS score < 80', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ targetStage: 'published', vvsScore: 50 })
    const req = createRequest()
    const res = await POST(req, { params: Promise.resolve({ id: MOCK_ITEM_ID }) })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.message).toContain('VVS score must be at least 80')
  })

  it('returns 422 when targetStage is scheduled but no scheduledFor', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ targetStage: 'scheduled', vvsScore: 90 })
    const req = createRequest()
    const res = await POST(req, { params: Promise.resolve({ id: MOCK_ITEM_ID }) })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.message).toContain('scheduledFor is required')
  })

  it('returns 404 when pipeline item not found', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ targetStage: 'published', vvsScore: 90 })

    const chain = createMockChain({ data: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const req = createRequest()
    const res = await POST(req, { params: Promise.resolve({ id: MOCK_ITEM_ID }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.message).toContain('Pipeline item not found')
  })

  it('returns 422 when format is not blog_post', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ targetStage: 'published', vvsScore: 90 })

    const chain = createMockChain({
      data: { id: MOCK_ITEM_ID, format: 'video', blog_post_id: null, site_id: MOCK_SITE_ID, version: 1 },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const req = createRequest()
    const res = await POST(req, { params: Promise.resolve({ id: MOCK_ITEM_ID }) })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.message).toContain('only available for blog_post')
  })

  it('returns 422 when no blog_post_id linked', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ targetStage: 'published', vvsScore: 90 })

    const chain = createMockChain({
      data: { id: MOCK_ITEM_ID, format: 'blog_post', blog_post_id: null, site_id: MOCK_SITE_ID, version: 1 },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const req = createRequest()
    const res = await POST(req, { params: Promise.resolve({ id: MOCK_ITEM_ID }) })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.message).toContain('graduated to a blog post first')
  })

  it('returns 422 for invalid status transition', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ targetStage: 'published', vvsScore: 90 })

    const pipelineChain = createMockChain({
      data: { id: MOCK_ITEM_ID, format: 'blog_post', blog_post_id: MOCK_BLOG_POST_ID, site_id: MOCK_SITE_ID, version: 1 },
    })
    const blogChain = createMockChain({
      data: { id: MOCK_BLOG_POST_ID, status: 'published' },
    })

    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'content_pipeline') return pipelineChain
        return blogChain
      }),
    } as any)

    const req = createRequest()
    const res = await POST(req, { params: Promise.resolve({ id: MOCK_ITEM_ID }) })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.message).toContain('Cannot transition')
  })

  it('returns 200 for valid publish (happy path)', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ targetStage: 'published', vvsScore: 90 })

    const pipelineChain = createMockChain({
      data: { id: MOCK_ITEM_ID, format: 'blog_post', blog_post_id: MOCK_BLOG_POST_ID, site_id: MOCK_SITE_ID, version: 1 },
    })
    const blogChain = createMockChain({
      data: { id: MOCK_BLOG_POST_ID, status: 'draft' },
    })
    const updateChain = createMockChain({ error: null })
    const insertChain = createMockChain({})

    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'content_pipeline') return pipelineChain
        if (table === 'blog_posts') return blogChain
        if (table === 'content_pipeline_history') return insertChain
        return updateChain
      }),
    } as any)

    const req = createRequest()
    const res = await POST(req, { params: Promise.resolve({ id: MOCK_ITEM_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.ok).toBe(true)
    expect(body.data.targetStage).toBe('published')
    expect(body.data.blogPostId).toBe(MOCK_BLOG_POST_ID)
  })

  it('returns 200 for valid schedule (happy path with scheduledFor)', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({
      targetStage: 'scheduled',
      scheduledFor: '2026-06-01T10:00:00Z',
      vvsScore: 95,
    })

    const pipelineChain = createMockChain({
      data: { id: MOCK_ITEM_ID, format: 'blog_post', blog_post_id: MOCK_BLOG_POST_ID, site_id: MOCK_SITE_ID, version: 1 },
    })
    const blogChain = createMockChain({
      data: { id: MOCK_BLOG_POST_ID, status: 'draft' },
    })
    const updateChain = createMockChain({ error: null })
    const insertChain = createMockChain({})

    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'content_pipeline') return pipelineChain
        if (table === 'blog_posts') return blogChain
        if (table === 'content_pipeline_history') return insertChain
        return updateChain
      }),
    } as any)

    const req = createRequest()
    const res = await POST(req, { params: Promise.resolve({ id: MOCK_ITEM_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.ok).toBe(true)
    expect(body.data.targetStage).toBe('scheduled')
  })
})
