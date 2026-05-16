import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))
vi.mock('@/lib/pipeline/sanitize', () => ({
  sanitizeForFilter: vi.fn((s: string) => s),
  sanitizeForTsquery: vi.fn((s: string) => s),
}))

import { GET, POST } from '@/app/api/pipeline/audio-library/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }

/**
 * Build a flat, call-recording mock that mimics the Supabase query builder.
 *
 * The Supabase client is lazy: every builder method (.eq, .order, .limit, …)
 * returns `this` so you can keep chaining. The query only executes when you
 * `await` the builder (i.e. the builder is a thenable). We replicate that here
 * so the route can call `.limit()` in the initial chain AND still call `.eq()`
 * on the result before finally awaiting the whole thing.
 *
 * The `calls` array lets tests assert exactly which methods were called with
 * which arguments — catching security bugs like a missing `.eq('site_id', …)`.
 */
function mockChain(data: unknown[] = [], count = 0) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const terminal = Promise.resolve({ data, error: null, count })

  // Build a proxy that records every method call and returns itself,
  // but also behaves as a thenable so `await chain` resolves correctly.
  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      if (prop === 'then') return terminal.then.bind(terminal)
      if (prop === 'catch') return terminal.catch.bind(terminal)
      if (prop === 'finally') return terminal.finally.bind(terminal)
      // Every builder method records the call and returns the same proxy.
      return (...args: unknown[]) => {
        calls.push({ method: prop, args })
        return proxy
      }
    },
  }
  const proxy = new Proxy({}, handler)

  // `from` is the entry point on the client object itself.
  const chain = {
    from: (...args: unknown[]) => {
      calls.push({ method: 'from', args })
      return proxy
    },
  }

  return { chain, calls }
}

beforeEach(() => {
  vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth as never)
  vi.mocked(requirePermission).mockReturnValue(true)
})

describe('GET /api/pipeline/audio-library', () => {
  it('returns paginated assets', async () => {
    const assets = [{ id: '1', asset_id: 'M1', type: 'music' }]
    const { chain, calls } = mockChain(assets, 1)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.meta.total).toBe(1)
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'site_id' && c.args[1] === 'site-1')).toBe(true)
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' } as never)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when forbidden', async () => {
    vi.mocked(requirePermission).mockReturnValue(false)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/pipeline/audio-library', () => {
  it('creates a new asset with 201', async () => {
    const asset = { id: '1', asset_id: 'M1', type: 'music' }
    const { chain } = mockChain([asset])
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: JSON.stringify({ asset_id: 'M1', original_filename: 'track.mp3', type: 'music' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 for invalid body', async () => {
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: JSON.stringify({ type: 'invalid' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate asset_id or sha256', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
      }),
    } as never)
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: JSON.stringify({ asset_id: 'DUP', original_filename: 'dup.mp3', type: 'music' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('CONFLICT')
  })

  it('returns 500 on generic DB error', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: '42000', message: 'unexpected' } }),
      }),
    } as never)
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: JSON.stringify({ asset_id: 'M1', original_filename: 'track.mp3', type: 'music' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})

describe('GET /api/pipeline/audio-library filters', () => {
  it('applies type filter', async () => {
    const { chain, calls } = mockChain([{ id: '1', asset_id: 'M1', type: 'music' }], 1)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library?type=music'))
    expect(res.status).toBe(200)
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'type' && c.args[1] === 'music')).toBe(true)
  })

  it('ignores invalid type values', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?type=evil'))
    expect(calls.every(c => !(c.method === 'eq' && c.args[0] === 'type'))).toBe(true)
  })

  it('applies status filter', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?status=pending'))
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'status' && c.args[1] === 'pending')).toBe(true)
  })

  it('applies category filter with sanitization', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?category=cinematic'))
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'category')).toBe(true)
  })

  it('applies tags filter with contains', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?tags=epic,cinematic'))
    expect(calls.some(c => c.method === 'contains' && c.args[0] === 'tags')).toBe(true)
  })

  it('applies mood filter with contains', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?mood=inspiring'))
    expect(calls.some(c => c.method === 'contains' && c.args[0] === 'mood')).toBe(true)
  })

  it('applies energy range filters', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?energy_min=2&energy_max=4'))
    expect(calls.some(c => c.method === 'gte' && c.args[0] === 'energy' && c.args[1] === 2)).toBe(true)
    expect(calls.some(c => c.method === 'lte' && c.args[0] === 'energy' && c.args[1] === 4)).toBe(true)
  })

  it('applies bpm range filters', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?bpm_min=80&bpm_max=120'))
    expect(calls.some(c => c.method === 'gte' && c.args[0] === 'bpm' && c.args[1] === 80)).toBe(true)
    expect(calls.some(c => c.method === 'lte' && c.args[0] === 'bpm' && c.args[1] === 120)).toBe(true)
  })

  it('applies full-text search with textSearch', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?q=cinematic+epic'))
    expect(calls.some(c => c.method === 'textSearch' && c.args[0] === 'search_vector')).toBe(true)
  })

  it('applies reusable=true filter', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?reusable=true'))
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'reusable' && c.args[1] === true)).toBe(true)
  })

  it('applies reusable=false filter', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?reusable=false'))
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'reusable' && c.args[1] === false)).toBe(true)
  })

  it('clamps limit between 1 and 200', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?limit=999'))
    expect(calls.some(c => c.method === 'limit' && c.args[0] === 201)).toBe(true) // 200 + 1 for has_next
  })

  it('returns 500 on DB error', async () => {
    const terminal = Promise.resolve({ data: null, error: { message: 'connection refused' }, count: null })
    const handler: ProxyHandler<object> = {
      get(_target, prop: string) {
        if (prop === 'then') return terminal.then.bind(terminal)
        if (prop === 'catch') return terminal.catch.bind(terminal)
        if (prop === 'finally') return terminal.finally.bind(terminal)
        return () => errorProxy
      },
    }
    const errorProxy = new Proxy({}, handler)
    const chain = { from: () => errorProxy }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    expect(res.status).toBe(500)
  })
})

describe('GET cursor pagination', () => {
  it('ignores cursor when not a valid UUID', async () => {
    const { chain, calls } = mockChain([{ id: 'a1', asset_id: 'M1' }], 1)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library?cursor=not-a-uuid'))
    expect(res.status).toBe(200)
    expect(calls.some(c => c.method === 'or')).toBe(false)
  })

  it('returns has_next=true and next_cursor when more items exist', async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ id: `id-${i}`, asset_id: `M${i}` }))
    const { chain } = mockChain(items, 100)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.meta.has_next).toBe(true)
    expect(json.meta.next_cursor).toBe('id-49')
  })

  it('returns has_next=false when fewer items than limit', async () => {
    const items = [{ id: 'id-0', asset_id: 'M0' }, { id: 'id-1', asset_id: 'M1' }, { id: 'id-2', asset_id: 'M2' }]
    const { chain } = mockChain(items, 3)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.meta.has_next).toBe(false)
    expect(json.meta.next_cursor).toBeUndefined()
  })

  it('applies subcategory filter', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?subcategory=test'))
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'subcategory' && c.args[1] === 'test')).toBe(true)
  })

  it('applies genre filter', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?genre=rock'))
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'genre' && c.args[1] === 'rock')).toBe(true)
  })

  it('applies source filter', async () => {
    const { chain, calls } = mockChain([], 0)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never)
    await GET(new NextRequest('http://localhost/api/pipeline/audio-library?source=artlist'))
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'source' && c.args[1] === 'artlist')).toBe(true)
  })

  it('applies cursor filter when valid UUID provided', async () => {
    const validCursor = '550e8400-e29b-41d4-a716-446655440000'
    const cursorCreatedAt = '2024-01-01T00:00:00Z'
    const allCalls: Array<{ method: string; args: unknown[] }> = []
    let fromCount = 0

    // Cursor lookup proxy: supports .select().eq().eq().single() chain
    function makeSingleProxy(data: unknown): object {
      return new Proxy({}, {
        get(_t, prop: string) {
          if (prop === 'single') return () => Promise.resolve({ data, error: null })
          return (...args: unknown[]) => {
            allCalls.push({ method: prop, args })
            return makeSingleProxy(data)
          }
        },
      })
    }

    // Main query proxy: records .or() and other calls, resolves as thenable
    const mainData = [{ id: 'a1', asset_id: 'M1' }]
    const terminal = Promise.resolve({ data: mainData, error: null, count: 1 })
    const mainProxy: object = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === 'then') return terminal.then.bind(terminal)
        if (prop === 'catch') return terminal.catch.bind(terminal)
        if (prop === 'finally') return terminal.finally.bind(terminal)
        return (...args: unknown[]) => {
          allCalls.push({ method: prop, args })
          return mainProxy
        }
      },
    })

    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: (...args: unknown[]) => {
        allCalls.push({ method: 'from', args })
        fromCount++
        // First from() → main query (built first in route, line 19)
        // Second from() → cursor lookup (line 73, inside cursor block)
        return fromCount === 1 ? mainProxy : makeSingleProxy({ created_at: cursorCreatedAt })
      },
    } as never)

    const res = await GET(new NextRequest(`http://localhost/api/pipeline/audio-library?cursor=${validCursor}`))
    expect(res.status).toBe(200)
    const orCall = allCalls.find(c => c.method === 'or' && typeof c.args[0] === 'string' && (c.args[0] as string).includes('created_at.lt.'))
    expect(orCall).toBeDefined()
  })
})
