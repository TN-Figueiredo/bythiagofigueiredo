import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ITEM_ID = '22222222-2222-2222-2222-222222222222'

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateWrite: vi.fn(),
  pipelineError: vi.fn(
    (code: string, msg: string, status: number) =>
      new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
  ),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/pipeline/workflows', () => ({
  getPreviousStage: vi.fn(),
}))

vi.mock('@/lib/pipeline/schemas', () => ({
  FORMATS: ['video', 'blog_post', 'newsletter', 'course', 'campaign'],
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { authenticateWrite } from '@/lib/pipeline/helpers'
import { getPreviousStage } from '@/lib/pipeline/workflows'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function mockAuthSuccess() {
  vi.mocked(authenticateWrite).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}
function mockAuthFailure() {
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

describe('POST /api/pipeline/items/[id]/retreat', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/retreat/route')
    POST = mod.POST
  })

  it('rejects invalid UUID', async () => {
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFailure()
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when item not found', async () => {
    mockAuthSuccess()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: null })) } as any)
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(404)
  })

  it('returns 422 when already at first stage', async () => {
    mockAuthSuccess()
    vi.mocked(getPreviousStage).mockReturnValue(null)
    const item = { id: MOCK_ITEM_ID, format: 'video', stage: 'idea', version: 1 }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: item })) } as any)
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.message).toContain('first stage')
  })

  it('retreats successfully from roteiro to idea', async () => {
    mockAuthSuccess()
    vi.mocked(getPreviousStage).mockReturnValue('idea')
    const item = { id: MOCK_ITEM_ID, format: 'video', stage: 'roteiro', version: 1 }
    const updated = { ...item, stage: 'idea', version: 2, updated_at: '2026-01-01' }

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        return callCount === 1 ? createMockChain({ data: item }) : createMockChain({ data: updated })
      }),
    } as any)

    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.stage).toBe('idea')
  })
})
