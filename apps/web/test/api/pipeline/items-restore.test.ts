import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ITEM_ID = '22222222-2222-2222-2222-222222222222'

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateWrite: vi.fn(),
  pipelineError: vi.fn((code: string, msg: string, status: number) =>
    new Response(JSON.stringify({ error: { code, message: msg } }), { status })),
}))
vi.mock('@/lib/pipeline/auth', () => ({
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { authenticateWrite } from '@/lib/pipeline/helpers'
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

describe('POST /api/pipeline/items/[id]/restore', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/restore/route')
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

  it('returns 404 when item not found', async () => {
    mockAuth()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: null, error: { message: 'not found' } })) } as any)
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(404)
  })

  it('restores archived item successfully', async () => {
    mockAuth()
    const restored = { id: MOCK_ITEM_ID, version: 3, updated_at: '2026-01-01', is_archived: false }
    const updateChain = createMockChain({ data: restored })
    const insertChain = createMockChain({ data: {} })

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        return callCount === 1 ? updateChain : insertChain
      }),
    } as any)

    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_archived).toBe(false)
  })
})
