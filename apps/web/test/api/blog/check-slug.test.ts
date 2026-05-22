import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/blog/check-slug')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url)
}

function createMockChain(finalResult: { data?: unknown; error?: unknown }) {
  const chain: Record<string, any> = {}
  const methods = ['from', 'select', 'eq', 'neq', 'is', 'in', 'order', 'limit',
    'single', 'filter', 'maybeSingle', 'not']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: any) => any) => resolve(finalResult)
  return chain
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/blog/check-slug', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/blog/check-slug/route')
    GET = mod.GET
  })

  it('returns { exists: false } when slug param is missing', async () => {
    const req = createRequest({})
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.exists).toBe(false)
  })

  it('returns { exists: false } when slug param is empty', async () => {
    const req = createRequest({ slug: '   ' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.exists).toBe(false)
  })

  it('returns { exists: false } when no translation has the slug', async () => {
    const chain = createMockChain({ data: [] })
    mockSupabase.from.mockReturnValue(chain)

    const req = createRequest({ slug: 'my-unique-slug' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.exists).toBe(false)
  })

  it('returns { exists: true } when a translation with that slug exists', async () => {
    const chain = createMockChain({ data: [{ post_id: 'some-post-id' }] })
    mockSupabase.from.mockReturnValue(chain)

    const req = createRequest({ slug: 'existing-slug' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.exists).toBe(true)
  })

  it('returns { exists: false } on DB error (data is null)', async () => {
    const chain = createMockChain({ data: null, error: { message: 'db error' } })
    mockSupabase.from.mockReturnValue(chain)

    const req = createRequest({ slug: 'test-slug' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.exists).toBe(false)
  })
})
