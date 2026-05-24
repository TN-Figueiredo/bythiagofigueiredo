import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ITEM_ID = '22222222-2222-2222-2222-222222222222'
const MOCK_POST_ID = '33333333-3333-3333-3333-333333333333'
const MOCK_USER_ID = '55555555-5555-5555-5555-555555555555'
const MOCK_AUTHOR_ID = '44444444-4444-4444-4444-444444444444'

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateWrite: vi.fn(),
  pipelineError: vi.fn((code: string, msg: string, status: number) =>
    new Response(JSON.stringify({ error: { code, message: msg } }), { status })),
  pipelineSuccess: vi.fn((data: unknown, status: number) =>
    new Response(JSON.stringify({ data }), { status })),
  parseBody: vi.fn(),
}))
vi.mock('@/lib/pipeline/auth', () => ({
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))
vi.mock('@/lib/pipeline/schemas', () => ({
  GraduateSchema: {
    safeParse: vi.fn(),
  },
}))
vi.mock('@/lib/pipeline/draft-to-blog', () => ({
  prepareBlogTranslationPatch: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { GraduateSchema } from '@/lib/pipeline/schemas'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function mockAuth() {
  vi.mocked(authenticateWrite).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}
function mockAuthFail() {
  vi.mocked(authenticateWrite).mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }) as any,
  )
}
function createMockChain(finalResult: { data?: unknown; error?: unknown }) {
  const chain: Record<string, any> = {}
  for (const m of ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'in', 'order', 'limit', 'single', 'maybeSingle', 'not', 'neq']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: any) => any) => resolve(finalResult)
  return chain
}
function makeParams(id: string) { return { params: Promise.resolve({ id }) } }

describe('POST /api/pipeline/items/[id]/graduate', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/graduate/route')
    POST = mod.POST
  })

  it('rejects invalid UUID', async () => {
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    vi.mocked(parseBody).mockResolvedValue({ target: 'blog_post' })
    vi.mocked(GraduateSchema.safeParse).mockReturnValue({ success: true, data: { target: 'blog_post' } } as any)
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(401)
  })

  it('rejects invalid target', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ target: 'podcast' })
    vi.mocked(GraduateSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'invalid target' }] },
    } as any)
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ target: 'blog_post' })
    vi.mocked(GraduateSchema.safeParse).mockReturnValue({ success: true, data: { target: 'blog_post' } } as any)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: null })) } as any)
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(404)
  })

  it('returns 422 when item has no title', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ target: 'blog_post' })
    vi.mocked(GraduateSchema.safeParse).mockReturnValue({ success: true, data: { target: 'blog_post' } } as any)
    const item = { id: MOCK_ITEM_ID, title_pt: null, title_en: null, blog_post_id: null, newsletter_edition_id: null, campaign_id: null }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: item })) } as any)
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(422)
  })

  it('returns 409 when already graduated', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ target: 'blog_post' })
    vi.mocked(GraduateSchema.safeParse).mockReturnValue({ success: true, data: { target: 'blog_post' } } as any)
    const item = { id: MOCK_ITEM_ID, title_pt: 'Test', blog_post_id: MOCK_POST_ID, newsletter_edition_id: null, campaign_id: null }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: item })) } as any)
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(409)
  })

  it('graduates to newsletter successfully', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ target: 'newsletter' })
    vi.mocked(GraduateSchema.safeParse).mockReturnValue({ success: true, data: { target: 'newsletter' } } as any)
    const item = { id: MOCK_ITEM_ID, title_pt: 'NL Test', blog_post_id: null, newsletter_edition_id: null, campaign_id: null, body_content: 'x', code: 'nl-test' }
    const editionId = '66666666-6666-6666-6666-666666666666'

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: item })
        if (callCount === 2) return createMockChain({ data: { id: editionId } })
        return createMockChain({ data: null })
      }),
    } as any)

    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.graduated).toBe(true)
    expect(body.data.target).toBe('newsletter')
  })

  it('graduates to blog_post with author', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ target: 'blog_post' })
    vi.mocked(GraduateSchema.safeParse).mockReturnValue({ success: true, data: { target: 'blog_post' } } as any)
    const item = {
      id: MOCK_ITEM_ID, title_pt: 'Blog Test', title_en: null, blog_post_id: null,
      newsletter_edition_id: null, campaign_id: null, created_by: MOCK_USER_ID,
      language: 'pt-br', sections: null, hook: 'Hook', code: 'blog-test',
      category: 'building', cover_image_url: null,
    }

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: item })
        if (callCount === 2) return createMockChain({ data: { id: MOCK_AUTHOR_ID } })
        if (callCount === 3) return createMockChain({ data: { id: MOCK_POST_ID } })
        return createMockChain({ data: null })
      }),
    } as any)

    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.graduated).toBe(true)
    expect(body.data.target).toBe('blog_post')
  })
})
