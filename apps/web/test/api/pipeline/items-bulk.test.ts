import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ID_1 = '22222222-2222-2222-2222-222222222222'
const MOCK_ID_2 = '33333333-3333-3333-3333-333333333333'

// ─── Mocks — must cover ALL transitive @/ imports from the route file ────────

vi.mock('@/lib/pipeline/helpers', () => ({
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
  BulkOperationSchema: {
    safeParse: vi.fn(),
  },
  FORMATS: ['video', 'blog_post', 'newsletter', 'course', 'campaign'],
}))

vi.mock('@/lib/pipeline/workflows', () => ({
  getNextStage: vi.fn(),
  getPreviousStage: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { BulkOperationSchema } from '@/lib/pipeline/schemas'
import { getNextStage, getPreviousStage } from '@/lib/pipeline/workflows'
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

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/pipeline/items/bulk', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/pipeline/items/bulk', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/items/bulk/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    vi.mocked(parseBody).mockResolvedValue({ operations: [] })
    vi.mocked(BulkOperationSchema.safeParse).mockReturnValue({ success: true, data: { operations: [] } } as any)
    const res = await POST(makeReq({ operations: [] }))
    expect(res.status).toBe(401)
  })

  it('rejects when schema validation fails', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ operations: [] })
    vi.mocked(BulkOperationSchema.safeParse).mockReturnValue({
      success: false, error: { issues: [{ message: 'Operations required' }] },
    } as any)
    const res = await POST(makeReq({ operations: [] }))
    expect(res.status).toBe(400)
  })

  it('rejects when item not found for advance', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ operations: [{ op: 'advance', id: MOCK_ID_1 }] })
    vi.mocked(BulkOperationSchema.safeParse).mockReturnValue({
      success: true, data: { operations: [{ op: 'advance', id: MOCK_ID_1 }] },
    } as any)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as any)
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('rejects advance when already at final stage', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ operations: [{ op: 'advance', id: MOCK_ID_1 }] })
    vi.mocked(BulkOperationSchema.safeParse).mockReturnValue({
      success: true, data: { operations: [{ op: 'advance', id: MOCK_ID_1 }] },
    } as any)
    vi.mocked(getNextStage).mockReturnValue(null)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: { id: MOCK_ID_1, format: 'video', stage: 'published' } })),
    } as any)
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('executes archive operations successfully', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({
      operations: [
        { op: 'archive', id: MOCK_ID_1 },
        { op: 'archive', id: MOCK_ID_2 },
      ],
    })
    vi.mocked(BulkOperationSchema.safeParse).mockReturnValue({
      success: true,
      data: {
        operations: [
          { op: 'archive', id: MOCK_ID_1 },
          { op: 'archive', id: MOCK_ID_2 },
        ],
      },
    } as any)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as any)
    const res = await POST(makeReq({}))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.success_count).toBe(2)
    expect(body.data.failure_count).toBe(0)
  })

  it('executes restore operations successfully', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({ operations: [{ op: 'restore', id: MOCK_ID_1 }] })
    vi.mocked(BulkOperationSchema.safeParse).mockReturnValue({
      success: true, data: { operations: [{ op: 'restore', id: MOCK_ID_1 }] },
    } as any)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as any)
    const res = await POST(makeReq({}))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.success_count).toBe(1)
  })

  it('executes tag operations successfully', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({
      operations: [{ op: 'tag', id: MOCK_ID_1, data: { add: ['new-tag'], remove: [] } }],
    })
    vi.mocked(BulkOperationSchema.safeParse).mockReturnValue({
      success: true,
      data: { operations: [{ op: 'tag', id: MOCK_ID_1, data: { add: ['new-tag'], remove: [] } }] },
    } as any)

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: { tags: ['existing'] } })
        return createMockChain({ data: null })
      }),
    } as any)

    const res = await POST(makeReq({}))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.success_count).toBe(1)
  })

  it('rejects entire batch when any validation fails', async () => {
    mockAuth()
    vi.mocked(parseBody).mockResolvedValue({
      operations: [
        { op: 'advance', id: MOCK_ID_1 },
        { op: 'archive', id: MOCK_ID_2 },
      ],
    })
    vi.mocked(BulkOperationSchema.safeParse).mockReturnValue({
      success: true,
      data: {
        operations: [
          { op: 'advance', id: MOCK_ID_1 },
          { op: 'archive', id: MOCK_ID_2 },
        ],
      },
    } as any)
    // advance item not found
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as any)
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })
})
