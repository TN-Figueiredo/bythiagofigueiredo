import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

// ─── Mocks ─────────────────────────────────────────────────────────────────

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

vi.mock('@/lib/pipeline/services/items', () => ({
  listItems: vi.fn(),
  createItems: vi.fn(),
}))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listItems, createItems } from '@/lib/pipeline/services/items'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

function mockAuthRead() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}
function mockAuthWrite() {
  vi.mocked(authenticateWrite).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}
function mockAuthFail(mode: 'read' | 'write' = 'read') {
  const resp = new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }) as any
  if (mode === 'read') vi.mocked(authenticateRead).mockResolvedValue(resp)
  else vi.mocked(authenticateWrite).mockResolvedValue(resp)
}

describe('GET /api/pipeline/items', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('read')
    const req = new NextRequest('http://localhost/api/pipeline/items')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns items list with pagination metadata', async () => {
    mockAuthRead()
    const items = [
      { id: 'a', format: 'video', stage: 'idea', created_at: '2026-01-01' },
      { id: 'b', format: 'blog_post', stage: 'draft', created_at: '2026-01-02' },
    ]
    vi.mocked(listItems).mockResolvedValue({
      data: items,
      meta: { total: 2, has_next: false, next_cursor: undefined, limit: 50 },
    })
    const req = new NextRequest('http://localhost/api/pipeline/items?limit=50')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/pipeline/items', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    vi.mocked(parseBody).mockResolvedValue({ format: 'video' })
    const req = new NextRequest('http://localhost/api/pipeline/items', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('rejects missing required fields (no title)', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ format: 'video' })
    const error = new PipelineServiceError('VALIDATION_ERROR', 'Title required', 400)
    vi.mocked(createItems).mockRejectedValue(error)
    vi.mocked(serviceErrorToResponse).mockReturnValue(
      new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Title required' } }), { status: 400 }),
    )
    const req = new NextRequest('http://localhost/api/pipeline/items', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates single item successfully', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ format: 'video', title_pt: 'Test Video', language: 'pt-br' })
    const inserted = { id: 'new-id', code: 'vid-test', format: 'video', stage: 'idea' }
    vi.mocked(createItems).mockResolvedValue({ data: inserted })
    const req = new NextRequest('http://localhost/api/pipeline/items', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 409 on duplicate code', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ format: 'video', title_pt: 'Dup', language: 'pt-br' })
    const error = new PipelineServiceError('VALIDATION_ERROR', 'Duplicate code. Please use a unique code.', 409)
    vi.mocked(createItems).mockRejectedValue(error)
    vi.mocked(serviceErrorToResponse).mockReturnValue(
      new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Duplicate code' } }), { status: 409 }),
    )
    const req = new NextRequest('http://localhost/api/pipeline/items', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })

  it('rejects batch exceeding 50 items', async () => {
    mockAuthWrite()
    const items = Array.from({ length: 51 }, (_, i) => ({ format: 'video', title_pt: `Item ${i}`, language: 'pt-br' }))
    vi.mocked(parseBody).mockResolvedValue(items)
    const error = new PipelineServiceError('VALIDATION_ERROR', 'Max 50 items per batch', 400)
    vi.mocked(createItems).mockRejectedValue(error)
    vi.mocked(serviceErrorToResponse).mockReturnValue(
      new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Max 50 items per batch' } }), { status: 400 }),
    )
    const req = new NextRequest('http://localhost/api/pipeline/items', {
      method: 'POST', body: '[]', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
