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
  pipelineSuccess: vi.fn((data: unknown, status: number) =>
    new Response(JSON.stringify({ data }), { status }),
  ),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/pipeline/workflows', () => ({
  getNextStage: vi.fn(),
  isFinalStage: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/pipeline/validation', () => ({
  computeValidationScore: vi.fn().mockReturnValue(85),
  VVS_PUBLISH_THRESHOLD: 80,
}))

vi.mock('@/lib/pipeline/schemas', () => ({
  FORMATS: ['video', 'blog_post', 'newsletter', 'course', 'campaign'],
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { authenticateWrite } from '@/lib/pipeline/helpers'
import { getNextStage } from '@/lib/pipeline/workflows'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function mockAuthSuccess() {
  vi.mocked(authenticateWrite).mockResolvedValue({
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}

function mockAuthFailure() {
  vi.mocked(authenticateWrite).mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }) as any,
  )
}

function createMockChain(finalResult: { data?: unknown; error?: unknown }) {
  const chain: Record<string, any> = {}
  const methods = ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'in',
    'order', 'limit', 'single', 'filter', 'maybeSingle', 'not', 'neq']
  for (const m of methods) { chain[m] = vi.fn().mockReturnValue(chain) }
  chain.then = (resolve: (v: any) => any) => resolve(finalResult)
  return chain
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/pipeline/items/[id]/advance', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/[id]/advance/route')
    POST = mod.POST
  })

  it('rejects invalid UUID', async () => {
    const req = new NextRequest('http://localhost/api/pipeline/items/bad/advance', { method: 'POST' })
    const res = await POST(req, makeParams('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFailure()
    const req = new NextRequest('http://localhost/api/pipeline/items/' + MOCK_ITEM_ID + '/advance', { method: 'POST' })
    const res = await POST(req, makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when item not found', async () => {
    mockAuthSuccess()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: null })) } as any)
    const req = new NextRequest('http://localhost/api/pipeline/items/' + MOCK_ITEM_ID + '/advance', { method: 'POST' })
    const res = await POST(req, makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(404)
  })

  it('returns 422 when already at final stage', async () => {
    mockAuthSuccess()
    vi.mocked(getNextStage).mockReturnValue(null)
    const item = { id: MOCK_ITEM_ID, format: 'video', stage: 'published', version: 1, validation_score: 90 }
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(createMockChain({ data: item })) } as any)
    const req = new NextRequest('http://localhost/api/pipeline/items/' + MOCK_ITEM_ID + '/advance', { method: 'POST' })
    const res = await POST(req, makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_OPERATION')
  })

  it('advances successfully from idea to roteiro', async () => {
    mockAuthSuccess()
    vi.mocked(getNextStage).mockReturnValue('roteiro')
    const item = {
      id: MOCK_ITEM_ID, format: 'video', stage: 'idea', version: 1, validation_score: 90,
      title_pt: 'Test', title_en: null, hook: null, synopsis: null,
      body_content: null, tags: [], production_checklist: [], format_metadata: {},
    }
    const updated = { ...item, stage: 'roteiro', version: 2, updated_at: '2026-01-01' }

    const itemChain = createMockChain({ data: item })
    const depsChain = createMockChain({ data: [] })
    const softDepsChain = createMockChain({ data: [] })
    const updateChain = createMockChain({ data: updated })
    const scoreChain = createMockChain({ data: null })

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return itemChain
        if (callCount === 2) return depsChain
        if (callCount === 3) return softDepsChain
        if (callCount === 4) return updateChain
        return scoreChain
      }),
    } as any)

    const req = new NextRequest('http://localhost/api/pipeline/items/' + MOCK_ITEM_ID + '/advance', { method: 'POST' })
    const res = await POST(req, makeParams(MOCK_ITEM_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.stage).toBe('roteiro')
  })
})
