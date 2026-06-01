import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSupabase = {
  from: vi.fn(),
}

const mockRequireUser = vi.fn()

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  createServerClient: vi.fn(() => mockSupabase),
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  UnauthenticatedError: class UnauthenticatedError extends Error {
    constructor() {
      super('unauthenticated')
      this.name = 'UnauthenticatedError'
    }
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    get: () => undefined,
    set: vi.fn(),
  })),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SITE_ID = '00000000-0000-0000-0000-000000000001'

function createRequest(params: Record<string, string> = {}, opts?: { siteId?: string | null }) {
  const url = new URL('http://localhost:3000/api/blog/check-slug')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const headers = new Headers()
  const siteId = opts?.siteId !== undefined ? opts.siteId : SITE_ID
  if (siteId) headers.set('x-site-id', siteId)
  return new NextRequest(url, { headers })
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
    mockRequireUser.mockResolvedValue({ id: 'user-1', email: 'test@test.com' })
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

  it('returns 401 when user is not authenticated', async () => {
    const { UnauthenticatedError } = await import('@tn-figueiredo/auth-nextjs/server')
    mockRequireUser.mockRejectedValue(new UnauthenticatedError())

    const req = createRequest({ slug: 'test-slug' })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthenticated')
  })

  it('returns 400 when x-site-id header is missing', async () => {
    const req = createRequest({ slug: 'test-slug' }, { siteId: null })
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('missing site context')
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

  it('scopes the query by site_id via blog_posts join', async () => {
    const chain = createMockChain({ data: [] })
    mockSupabase.from.mockReturnValue(chain)

    const req = createRequest({ slug: 'some-slug' })
    await GET(req)

    expect(chain.select).toHaveBeenCalledWith('post_id, blog_posts!inner(id, site_id)')
    expect(chain.eq).toHaveBeenCalledWith('slug', 'some-slug')
    expect(chain.eq).toHaveBeenCalledWith('blog_posts.site_id', SITE_ID)
  })
})
