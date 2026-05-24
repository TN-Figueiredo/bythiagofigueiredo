import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ITEM_ID = '22222222-2222-2222-2222-222222222222'

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn(),
  authenticateWrite: vi.fn(),
  pipelineError: vi.fn((code: string, msg: string, status: number) =>
    new Response(JSON.stringify({ error: { code, message: msg } }), { status })),
  parseBody: vi.fn(),
}))
vi.mock('@/lib/pipeline/auth', () => ({
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))
vi.mock('@/lib/pipeline/sections', () => ({
  getSectionKey: vi.fn().mockImplementation((section: string, lang: string) => {
    if (['ideia', 'images'].includes(section)) return `${section}_shared`
    const n = lang === 'pt-br' ? 'pt' : lang
    return `${section}_${n}`
  }),
  SectionPatchSchema: {
    safeParse: vi.fn(),
  },
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { SectionPatchSchema } from '@/lib/pipeline/sections'
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
function createMockChain(finalResult: { data?: unknown; error?: unknown }) {
  const chain: Record<string, any> = {}
  for (const m of ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'in', 'order', 'limit', 'single', 'maybeSingle', 'not', 'neq']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: any) => any) => resolve(finalResult)
  return chain
}
function makeParams(id: string, section: string) { return { params: Promise.resolve({ id, section }) } }

describe('GET /api/pipeline/items/[id]/sections/[section]', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string; section: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/sections/[section]/route')
    GET = mod.GET
  })

  it('rejects invalid UUID', async () => {
    const res = await GET(new NextRequest('http://localhost/x'), makeParams('xyz', 'ideia'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('read')
    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_ITEM_ID, 'ideia'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when item not found', async () => {
    mockAuthRead()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: null, error: { code: 'PGRST116' } })) } as any)
    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_ITEM_ID, 'ideia'))
    expect(res.status).toBe(404)
  })

  it('returns section data when found', async () => {
    mockAuthRead()
    const item = {
      id: MOCK_ITEM_ID, format: 'video', language: 'pt-br', version: 1,
      sections: { ideia_shared: { rev: 1, source: 'user', edited: true, content: { text: 'idea' }, updated_at: '2026-01-01', cowork_rev: null, modified_by: null } },
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: item })) } as any)
    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_ITEM_ID, 'ideia'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.content.text).toBe('idea')
    expect(body.meta.exists).toBe(true)
  })

  it('returns null for nonexistent section', async () => {
    mockAuthRead()
    const item = { id: MOCK_ITEM_ID, format: 'video', language: 'pt-br', version: 1, sections: {} }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: item })) } as any)
    const res = await GET(new NextRequest('http://localhost/x?lang=en'), makeParams(MOCK_ITEM_ID, 'roteiro'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeNull()
    expect(body.meta.exists).toBe(false)
  })
})

describe('PATCH /api/pipeline/items/[id]/sections/[section]', () => {
  let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string; section: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/sections/[section]/route')
    PATCH = mod.PATCH
  })

  it('rejects invalid UUID', async () => {
    const req = new NextRequest('http://localhost/x', { method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json', 'X-Expected-Version': '1' } })
    const res = await PATCH(req, makeParams('bad', 'ideia'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when X-Expected-Version missing', async () => {
    mockAuthWrite()
    const req = new NextRequest('http://localhost/x', { method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json' } })
    const res = await PATCH(req, makeParams(MOCK_ITEM_ID, 'ideia'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ rev: 0, content: { text: 'new' } })
    vi.mocked(SectionPatchSchema.safeParse).mockReturnValue({ success: true, data: { rev: 0, content: { text: 'new' } } } as any)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: null, error: { code: 'PGRST116' } })) } as any)
    const req = new NextRequest('http://localhost/x', { method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json', 'X-Expected-Version': '1' } })
    const res = await PATCH(req, makeParams(MOCK_ITEM_ID, 'ideia'))
    expect(res.status).toBe(404)
  })

  it('returns 412 on version mismatch', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ rev: 0, content: { text: 'new' } })
    vi.mocked(SectionPatchSchema.safeParse).mockReturnValue({ success: true, data: { rev: 0, content: { text: 'new' } } } as any)
    const item = { id: MOCK_ITEM_ID, version: 5, sections: {} }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: item })) } as any)
    const req = new NextRequest('http://localhost/x', { method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json', 'X-Expected-Version': '3' } })
    const res = await PATCH(req, makeParams(MOCK_ITEM_ID, 'ideia'))
    expect(res.status).toBe(412)
  })

  it('patches section successfully', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ rev: 0, content: { text: 'hello' }, source: 'user' })
    vi.mocked(SectionPatchSchema.safeParse).mockReturnValue({ success: true, data: { rev: 0, content: { text: 'hello' }, source: 'user' } } as any)
    const item = { id: MOCK_ITEM_ID, version: 1, sections: {} }
    const updated = { version: 2 }

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        return callCount === 1 ? createMockChain({ data: item }) : createMockChain({ data: updated })
      }),
    } as any)

    const req = new NextRequest('http://localhost/x', { method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json', 'X-Expected-Version': '1' } })
    const res = await PATCH(req, makeParams(MOCK_ITEM_ID, 'ideia'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.rev).toBe(1)
    expect(body.data.content.text).toBe('hello')
  })
})
