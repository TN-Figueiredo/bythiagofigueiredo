import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ITEM_ID = '22222222-2222-2222-2222-222222222222'
const MOCK_POST_ID = '33333333-3333-3333-3333-333333333333'

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateWrite: vi.fn(),
  pipelineError: vi.fn((code: string, msg: string, status: number) =>
    new Response(JSON.stringify({ error: { code, message: msg } }), { status })),
  pipelineSuccess: vi.fn((data: unknown, status: number) =>
    new Response(JSON.stringify({ data }), { status })),
  parseBody: vi.fn(),
}))
vi.mock('@/lib/pipeline/auth', () => ({
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))
vi.mock('@/lib/pipeline/blog-link', () => ({
  linkPostToItem: vi.fn(),
  unlinkPostFromItem: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { linkPostToItem, unlinkPostFromItem } from '@/lib/pipeline/blog-link'

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
function makeParams(id: string) { return { params: Promise.resolve({ id }) } }

describe('POST /api/pipeline/items/[id]/link', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/link/route')
    POST = mod.POST
  })

  it('rejects invalid UUID', async () => {
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams('xyz'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    vi.mocked(parseBody).mockResolvedValue({ blog_post_id: MOCK_POST_ID })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(401)
  })

  it('rejects invalid body (missing blog_post_id)', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({})
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when NOT_FOUND', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ blog_post_id: MOCK_POST_ID })
    vi.mocked(linkPostToItem).mockResolvedValue({ ok: false, error: 'Not found', code: 'NOT_FOUND' })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(404)
  })

  it('returns 409 when already linked', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ blog_post_id: MOCK_POST_ID })
    vi.mocked(linkPostToItem).mockResolvedValue({ ok: false, error: 'Already linked', code: 'ALREADY_LINKED' })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(409)
  })

  it('links successfully', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ blog_post_id: MOCK_POST_ID })
    vi.mocked(linkPostToItem).mockResolvedValue({ ok: true })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.linked).toBe(true)
  })
})

describe('POST /api/pipeline/items/[id]/unlink', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/unlink/route')
    POST = mod.POST
  })

  it('rejects invalid UUID', async () => {
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams('xyz'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(401)
  })

  it('returns 400 when unlink fails', async () => {
    mockAuth()
    vi.mocked(unlinkPostFromItem).mockResolvedValue({ ok: false, error: 'Item not found' })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(400)
  })

  it('unlinks successfully', async () => {
    mockAuth()
    vi.mocked(unlinkPostFromItem).mockResolvedValue({ ok: true })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.unlinked).toBe(true)
  })
})
