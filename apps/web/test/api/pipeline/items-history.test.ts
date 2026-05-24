import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ITEM_ID = '22222222-2222-2222-2222-222222222222'

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn(),
  pipelineError: vi.fn((code: string, msg: string, status: number) =>
    new Response(JSON.stringify({ error: { code, message: msg } }), { status })),
  pipelineSuccess: vi.fn((data: unknown, status: number) =>
    new Response(JSON.stringify({ data }), { status })),
}))
vi.mock('@/lib/pipeline/auth', () => ({
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { authenticateRead } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function mockAuth() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}
function mockAuthFail() {
  vi.mocked(authenticateRead).mockResolvedValue(
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

describe('GET /api/pipeline/items/[id]/history', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/history/route')
    GET = mod.GET
  })

  it('rejects invalid UUID', async () => {
    const res = await GET(new NextRequest('http://localhost/x'), makeParams('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when item not found', async () => {
    mockAuth()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: null })) } as any)
    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(404)
  })

  it('returns history records successfully', async () => {
    mockAuth()
    const item = { id: MOCK_ITEM_ID }
    const history = [{ id: 'h1', event_type: 'created' }, { id: 'h2', event_type: 'advanced' }]

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        return callCount === 1 ? createMockChain({ data: item }) : createMockChain({ data: history })
      }),
    } as any)

    const res = await GET(new NextRequest('http://localhost/x'), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })
})
