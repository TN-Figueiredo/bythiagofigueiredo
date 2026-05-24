import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

// ─── Mocks — must cover ALL transitive @/ imports from the route file ────────

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

vi.mock('@/lib/pipeline/schemas', () => ({
  PipelineItemCreateSchema: { safeParse: vi.fn() },
  FORMAT_METADATA_SCHEMAS: {},
}))

vi.mock('@/lib/pipeline/workflows', () => ({
  generateCode: vi.fn().mockReturnValue('vid-test'),
  DEFAULT_CHECKLISTS: {},
  WORKFLOWS: { video: { stages: ['idea', 'draft', 'published'] } },
  isValidStage: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/pipeline/queries', () => ({
  decodeCursor: vi.fn().mockReturnValue(null),
  encodeCursor: vi.fn().mockReturnValue(null),
  parseSortParam: vi.fn().mockReturnValue([{ column: 'created_at', ascending: false }]),
  applyPipelineFilters: vi.fn().mockImplementation((q: unknown) => q),
}))

vi.mock('@/lib/pipeline/sanitize', () => ({
  sanitizeForFilter: vi.fn((v: string) => v),
}))

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { PipelineItemCreateSchema } from '@/lib/pipeline/schemas'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

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

function createMockChain(finalResult: { data?: unknown; error?: unknown; count?: number | null }) {
  const chain: Record<string, any> = {}
  for (const m of ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'in', 'or', 'order', 'limit', 'single', 'maybeSingle', 'not', 'neq', 'filter', 'ilike', 'gte', 'lte', 'contains', 'textSearch']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: any) => any) => resolve({ data: finalResult.data, error: finalResult.error, count: finalResult.count ?? null })
  return chain
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
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: items, count: 2 })),
    } as any)
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
    vi.mocked(PipelineItemCreateSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'Title required' }] },
    } as any)
    const req = new NextRequest('http://localhost/api/pipeline/items', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates single item successfully', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ format: 'video', title_pt: 'Test Video', language: 'pt-br' })
    vi.mocked(PipelineItemCreateSchema.safeParse).mockReturnValue({
      success: true, data: { format: 'video', title_pt: 'Test Video', language: 'pt-br' },
    } as any)
    const inserted = [{ id: 'new-id', code: 'vid-test', format: 'video', stage: 'idea' }]
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: inserted })),
    } as any)
    const req = new NextRequest('http://localhost/api/pipeline/items', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 409 on duplicate code', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ format: 'video', title_pt: 'Dup', language: 'pt-br' })
    vi.mocked(PipelineItemCreateSchema.safeParse).mockReturnValue({
      success: true, data: { format: 'video', title_pt: 'Dup', language: 'pt-br' },
    } as any)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null, error: { code: '23505', message: 'duplicate' } })),
    } as any)
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
    const req = new NextRequest('http://localhost/api/pipeline/items', {
      method: 'POST', body: '[]', headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
