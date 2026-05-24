import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { createSnapshot, withSnapshot } from '@/lib/playlists/snapshot-middleware'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockFrom = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    from: mockFrom,
  } as never)
})

function setupMockDb(items: unknown[] = [], edges: unknown[] = [], insertResult = { data: { id: 'snap-1' }, error: null }) {
  const deleteChain = { in: vi.fn().mockResolvedValue({ data: null, error: null }) }
  mockDelete.mockReturnValue(deleteChain)

  mockFrom.mockImplementation((table: string) => {
    if (table === 'playlist_items') {
      return { select: () => ({ eq: () => ({ data: items, error: null }) }) }
    }
    if (table === 'playlist_edges') {
      return { select: () => ({ eq: () => ({ data: edges, error: null }) }) }
    }
    if (table === 'playlist_snapshots') {
      return {
        insert: () => ({ select: () => ({ maybeSingle: () => Promise.resolve(insertResult) }) }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
        delete: () => deleteChain,
      }
    }
    return { select: () => ({ eq: () => ({ data: null, error: null }) }) }
  })
}

describe('createSnapshot', () => {
  it('returns id when insert succeeds', async () => {
    setupMockDb(
      [{ id: 'i1', blog_post_id: 'bp1', newsletter_edition_id: null, pipeline_id: null, sort_order: 1000, position_x: 10, position_y: 20 }],
      [{ id: 'e1', source_item_id: 'i1', target_item_id: 'i1', edge_type: 'sequence', label: null }],
    )
    const result = await createSnapshot('pl-1', 'site-1', 'user-1', 'manual', 'Test')
    expect(result.id).toBe('snap-1')
    expect(result.deduplicated).toBe(false)
  })

  it('returns deduplicated=true on unique constraint violation (23505)', async () => {
    setupMockDb([], [], { data: null, error: { code: '23505', message: 'duplicate' } } as never)
    const result = await createSnapshot('pl-1', 'site-1', 'user-1', 'auto', 'Test')
    expect(result.id).toBeNull()
    expect(result.deduplicated).toBe(true)
  })

  it('handles empty items and edges gracefully', async () => {
    setupMockDb([], [])
    const result = await createSnapshot('pl-1', 'site-1', null, 'session_start', 'Session')
    expect(result.id).toBe('snap-1')
  })

  it('batch-deletes excess auto-snapshots when cap exceeded', async () => {
    const excess = Array.from({ length: 105 }, (_, i) => ({ id: `s-${i}` }))
    const deleteChain = { in: vi.fn().mockResolvedValue({ data: null, error: null }) }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'playlist_items') return { select: () => ({ eq: () => ({ data: [], error: null }) }) }
      if (table === 'playlist_edges') return { select: () => ({ eq: () => ({ data: [], error: null }) }) }
      if (table === 'playlist_snapshots') {
        return {
          insert: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'new' }, error: null }) }) }),
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: excess, error: null }),
                }),
              }),
            }),
          }),
          delete: () => deleteChain,
        }
      }
      return {}
    })

    await createSnapshot('pl-1', 'site-1', 'user-1', 'auto', 'Auto')
    expect(deleteChain.in).toHaveBeenCalledWith('id', excess.slice(0, 5).map(r => r.id))
  })
})

describe('withSnapshot', () => {
  it('executes mutation and returns its result', async () => {
    setupMockDb()
    const fn = vi.fn().mockResolvedValue({ ok: true })
    const result = await withSnapshot('pl-1', 'site-1', 'user-1', 'pre_destructive', 'Before', fn)
    expect(fn).toHaveBeenCalledOnce()
    expect(result).toEqual({ ok: true })
  })

  it('still executes mutation if snapshot creation fails', async () => {
    setupMockDb([], [], { data: null, error: { code: 'PGRST', message: 'db error' } } as never)
    const fn = vi.fn().mockResolvedValue('done')
    const result = await withSnapshot('pl-1', 'site-1', null, 'pre_destructive', 'Before', fn)
    expect(result).toBe('done')
  })

  it('throttles repeated calls for same playlist+type within 5s', async () => {
    setupMockDb()
    const fn = vi.fn().mockResolvedValue('ok')

    await withSnapshot('pl-1', 'site-1', 'u1', 'pre_destructive', 'L1', fn)
    const callsAfterFirst = mockFrom.mock.calls.length

    await withSnapshot('pl-1', 'site-1', 'u1', 'pre_destructive', 'L2', fn)
    const callsAfterSecond = mockFrom.mock.calls.length

    // Second call should not have triggered createSnapshot (no new from() calls)
    expect(callsAfterSecond).toBe(callsAfterFirst)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not throttle different playlist IDs', async () => {
    setupMockDb()
    const fn = vi.fn().mockResolvedValue('ok')

    await withSnapshot('pl-1', 'site-1', 'u1', 'pre_destructive', 'L1', fn)
    const callsAfterFirst = mockFrom.mock.calls.length

    await withSnapshot('pl-2', 'site-1', 'u1', 'pre_destructive', 'L2', fn)
    const callsAfterSecond = mockFrom.mock.calls.length

    // Different playlist = not throttled, should have new from() calls
    expect(callsAfterSecond).toBeGreaterThan(callsAfterFirst)
  })
})
