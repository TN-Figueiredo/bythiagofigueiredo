import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ITEM_ID = '22222222-2222-2222-2222-222222222222'

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateWrite: vi.fn(),
  pipelineError: vi.fn((code: string, msg: string, status: number) =>
    new Response(JSON.stringify({ error: { code, message: msg } }), { status })),
  parseBody: vi.fn(),
}))
vi.mock('@/lib/pipeline/auth', () => ({
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))
vi.mock('@/lib/pipeline/schemas', () => ({
  ChecklistToggleSchema: {
    safeParse: vi.fn(),
  },
}))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { ChecklistToggleSchema } from '@/lib/pipeline/schemas'
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

describe('POST /api/pipeline/items/[id]/checklist', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/checklist/route')
    POST = mod.POST
  })

  it('rejects invalid UUID', async () => {
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    vi.mocked(parseBody).mockResolvedValue({ index: 0, done: true })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({})
    vi.mocked(ChecklistToggleSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'required' }] },
    } as any)
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ index: 0, done: true })
    vi.mocked(ChecklistToggleSchema.safeParse).mockReturnValue({ success: true, data: { index: 0, done: true } } as any)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: null })) } as any)
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(404)
  })

  it('returns 400 when index out of bounds', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ index: 5, done: true })
    vi.mocked(ChecklistToggleSchema.safeParse).mockReturnValue({ success: true, data: { index: 5, done: true } } as any)
    const item = { id: MOCK_ITEM_ID, version: 1, production_checklist: [{ label: 'Step 1', done: false }] }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: item })) } as any)
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('out of bounds')
  })

  it('toggles checklist item successfully', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ index: 0, done: true })
    vi.mocked(ChecklistToggleSchema.safeParse).mockReturnValue({ success: true, data: { index: 0, done: true } } as any)
    const item = { id: MOCK_ITEM_ID, version: 1, production_checklist: [{ label: 'Step 1', done: false }, { label: 'Step 2', done: false }] }
    const updated = { id: MOCK_ITEM_ID, version: 2, updated_at: '2026-01-01', production_checklist: [{ label: 'Step 1', done: true }, { label: 'Step 2', done: false }] }

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        return callCount === 1 ? createMockChain({ data: item }) : createMockChain({ data: updated })
      }),
    } as any)
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(200)
  })
})
