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
})
