import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn().mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['read'], source: 'api_key' } }),
  requirePermission: vi.fn().mockReturnValue(true),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}))

vi.mock('@/lib/supabase/service', () => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  return {
    getSupabaseServiceClient: vi.fn(() => ({
      from: vi.fn(() => mockQuery),
    })),
  }
})

describe('Pipeline search query construction', () => {
  it('parseSortParam defaults to updated_at desc', async () => {
    const { parseSortParam } = await import('@/lib/pipeline/queries')
    expect(parseSortParam(undefined)).toEqual({ column: 'updated_at', ascending: false })
  })

  it('parseSortParam handles priority:desc', async () => {
    const { parseSortParam } = await import('@/lib/pipeline/queries')
    expect(parseSortParam('priority:desc')).toEqual({ column: 'priority', ascending: false })
  })

  it('parseSortParam rejects invalid columns', async () => {
    const { parseSortParam } = await import('@/lib/pipeline/queries')
    expect(parseSortParam('drop_table:asc')).toEqual({ column: 'updated_at', ascending: true })
  })

  it('encodeCursor and decodeCursor are inverses', async () => {
    const { encodeCursor, decodeCursor } = await import('@/lib/pipeline/queries')
    const cursor = encodeCursor('2026-05-09T12:00:00Z', 'abc-123')
    const decoded = decodeCursor(cursor)
    expect(decoded).toEqual({ sort_value: '2026-05-09T12:00:00Z', id: 'abc-123' })
  })

  it('decodeCursor returns null for invalid base64', async () => {
    const { decodeCursor } = await import('@/lib/pipeline/queries')
    expect(decodeCursor('not-valid-base64!!!')).toBeNull()
  })

  it('decodeCursor returns null when pipe separator is missing', async () => {
    const { decodeCursor } = await import('@/lib/pipeline/queries')
    const encoded = Buffer.from('nopipe').toString('base64url')
    expect(decodeCursor(encoded)).toBeNull()
  })

  it('applyPipelineFilters applies stale_days filter', async () => {
    const { applyPipelineFilters } = await import('@/lib/pipeline/queries')
    const calls: Array<{ method: string; args: unknown[] }> = []
    const mockQuery = new Proxy({}, {
      get: (_target, prop: string) => (...args: unknown[]) => {
        calls.push({ method: prop, args })
        return mockQuery
      },
    })
    applyPipelineFilters(mockQuery as any, { stale_days: '7' })
    const ltCall = calls.find((c) => c.method === 'lt')
    expect(ltCall).toBeDefined()
    expect(ltCall!.args[0]).toBe('updated_at')
  })

  it('applyPipelineFilters applies collection filter', async () => {
    const { applyPipelineFilters } = await import('@/lib/pipeline/queries')
    const calls: Array<{ method: string; args: unknown[] }> = []
    const mockQuery = new Proxy({}, {
      get: (_target, prop: string) => (...args: unknown[]) => {
        calls.push({ method: prop, args })
        return mockQuery
      },
    })
    applyPipelineFilters(mockQuery as any, { collection: 'col-123' })
    const filterCall = calls.find((c) => c.method === 'filter')
    expect(filterCall).toBeDefined()
    expect(filterCall!.args[0]).toBe('content_pipeline_memberships.collection_id')
    expect(filterCall!.args[2]).toBe('col-123')
  })

  it('applyPipelineFilters ignores invalid stale_days', async () => {
    const { applyPipelineFilters } = await import('@/lib/pipeline/queries')
    const calls: Array<{ method: string; args: unknown[] }> = []
    const mockQuery = new Proxy({}, {
      get: (_target, prop: string) => (...args: unknown[]) => {
        calls.push({ method: prop, args })
        return mockQuery
      },
    })
    applyPipelineFilters(mockQuery as any, { stale_days: 'abc' })
    const ltCall = calls.find((c) => c.method === 'lt')
    expect(ltCall).toBeUndefined()
  })
})
