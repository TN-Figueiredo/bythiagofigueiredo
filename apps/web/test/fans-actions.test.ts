import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/social/actions/_shared', () => ({
  requireEditAccess: vi.fn().mockResolvedValue({ siteId: '11111111-1111-1111-1111-111111111111', userId: 'u1' }),
  SENTRY_TAG: { component: 'social-actions' },
}))

const REAL_SITE_UUID = '11111111-1111-1111-1111-111111111111'
const REAL_OTHER_UUID = '22222222-2222-2222-2222-222222222222'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireEditAccess } from '@/lib/social/actions/_shared'
import { getTopFans, recordFanInteraction, refreshFanScores } from '@/lib/social/actions/fans'

// ---------------------------------------------------------------------------
// Chain builders
// ---------------------------------------------------------------------------

type ChainResult<T> = { data: T; error: { message: string } | null }

function buildSelectChain<T>(result: ChainResult<T>) {
  const chain: Record<string, unknown> = {}
  const fluent = ['select', 'eq', 'order', 'limit']
  for (const m of fluent) {
    chain[m] = vi.fn(() => chain)
  }
  chain.then = (resolve: (v: ChainResult<T>) => unknown) =>
    Promise.resolve(result).then(resolve)
  return chain
}

function buildInsertChain(error: { message: string } | null = null) {
  const chain: Record<string, unknown> = {}
  chain.insert = vi.fn(() => Promise.resolve({ data: null, error }))
  return chain
}

function buildRpcChain(error: { message: string } | null = null) {
  return {
    rpc: vi.fn(() => Promise.resolve({ data: null, error })),
  }
}

let mockFrom: ReturnType<typeof vi.fn>
let mockRpc: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireEditAccess).mockResolvedValue({ siteId: REAL_SITE_UUID, userId: 'u1' })
  mockFrom = vi.fn()
  mockRpc = vi.fn().mockResolvedValue({ data: null, error: null })
  vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: mockFrom, rpc: mockRpc } as never)
})

// ---------------------------------------------------------------------------
// getTopFans
// ---------------------------------------------------------------------------

describe('getTopFans', () => {
  it('calls requireEditAccess before querying', async () => {
    const chain = buildSelectChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getTopFans(REAL_SITE_UUID)

    expect(requireEditAccess).toHaveBeenCalledOnce()
  })

  it('throws "forbidden" when siteId does not match authorized site', async () => {
    await expect(getTopFans(REAL_OTHER_UUID)).rejects.toThrow('forbidden')
  })

  it('returns fan score rows on success', async () => {
    const fanRow = {
      site_id: REAL_SITE_UUID,
      visitor_hash: 'abc123',
      total_interactions: 10,
      platform_count: 2,
      active_days: 5,
      last_seen: '2026-05-17T00:00:00Z',
      first_seen: '2026-05-01T00:00:00Z',
      score: 75,
    }
    const chain = buildSelectChain({ data: [fanRow], error: null })
    mockFrom.mockReturnValue(chain)

    const result = await getTopFans(REAL_SITE_UUID)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ visitor_hash: 'abc123', score: 75 })
  })

  it('returns empty array when no fans found', async () => {
    const chain = buildSelectChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    const result = await getTopFans(REAL_SITE_UUID)

    expect(result).toEqual([])
  })

  it('throws DB error when query fails', async () => {
    const chain = buildSelectChain({ data: null, error: { message: 'query failed' } })
    mockFrom.mockReturnValue(chain)

    await expect(getTopFans(REAL_SITE_UUID)).rejects.toMatchObject({ message: 'query failed' })
  })

  it('queries fan_scores table ordered by score desc', async () => {
    const chain = buildSelectChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getTopFans(REAL_SITE_UUID)

    expect(mockFrom).toHaveBeenCalledWith('fan_scores')
    expect(chain.order).toHaveBeenCalledWith('score', { ascending: false })
  })

  it('respects custom limit parameter', async () => {
    const chain = buildSelectChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getTopFans(REAL_SITE_UUID, 5)

    expect(chain.limit).toHaveBeenCalledWith(5)
  })

  it('defaults limit to 20', async () => {
    const chain = buildSelectChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getTopFans(REAL_SITE_UUID)

    expect(chain.limit).toHaveBeenCalledWith(20)
  })

  it('throws when requireEditAccess throws', async () => {
    vi.mocked(requireEditAccess).mockRejectedValue(new Error('unauthenticated'))

    await expect(getTopFans(REAL_SITE_UUID)).rejects.toThrow('unauthenticated')
  })
})

// ---------------------------------------------------------------------------
// recordFanInteraction
// ---------------------------------------------------------------------------

describe('recordFanInteraction', () => {
  const validInteraction = {
    visitor_hash: 'hash-abc',
    platform: 'instagram' as const,
    interaction_type: 'story_view' as const,
  }

  it('calls requireEditAccess before inserting', async () => {
    mockFrom.mockReturnValue(buildInsertChain())

    await recordFanInteraction(REAL_SITE_UUID, validInteraction)

    expect(requireEditAccess).toHaveBeenCalledOnce()
  })

  it('throws "forbidden" when siteId does not match authorized site', async () => {
    await expect(recordFanInteraction(REAL_OTHER_UUID, validInteraction)).rejects.toThrow('forbidden')
  })

  it('inserts into fan_interactions with site_id', async () => {
    const chain = buildInsertChain()
    mockFrom.mockReturnValue(chain)

    await recordFanInteraction(REAL_SITE_UUID, validInteraction)

    expect(mockFrom).toHaveBeenCalledWith('fan_interactions')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: REAL_SITE_UUID,
        visitor_hash: 'hash-abc',
        platform: 'instagram',
        interaction_type: 'story_view',
      }),
    )
  })

  it('includes optional post_id when provided', async () => {
    const chain = buildInsertChain()
    mockFrom.mockReturnValue(chain)

    await recordFanInteraction(REAL_SITE_UUID, {
      ...validInteraction,
      post_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    })

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ post_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }),
    )
  })

  it('throws DB error when insert fails', async () => {
    mockFrom.mockReturnValue(buildInsertChain({ message: 'insert error' }))

    await expect(recordFanInteraction(REAL_SITE_UUID, validInteraction)).rejects.toMatchObject({
      message: 'insert error',
    })
  })
})

// ---------------------------------------------------------------------------
// refreshFanScores
// ---------------------------------------------------------------------------

describe('refreshFanScores', () => {
  it('calls requireEditAccess', async () => {
    await refreshFanScores()

    expect(requireEditAccess).toHaveBeenCalledOnce()
  })

  it('calls rpc refresh_fan_scores', async () => {
    await refreshFanScores()

    expect(mockRpc).toHaveBeenCalledWith('refresh_fan_scores')
  })

  it('falls back gracefully when rpc errors (queries fan_scores instead)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc error' } })

    const chain = buildSelectChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    // Should not throw — falls back to a no-op select
    await expect(refreshFanScores()).resolves.toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith('fan_scores')
  })

  it('throws when requireEditAccess throws', async () => {
    vi.mocked(requireEditAccess).mockRejectedValue(new Error('forbidden'))

    await expect(refreshFanScores()).rejects.toThrow('forbidden')
  })
})
