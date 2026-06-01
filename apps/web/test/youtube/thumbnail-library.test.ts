import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before imports
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import {
  autoImportWinner,
  checkLongevity,
  checkAndPersistLongevity,
  runLongevityChecks,
} from '@/lib/youtube/thumbnail-library'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// ---------------------------------------------------------------------------
// Helper: chainable Supabase mock
// ---------------------------------------------------------------------------

function makeChain(value: unknown, overrides: Record<string, unknown> = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const self = new Proxy(chain, {
    get(_target, prop: string) {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(value)
      if (overrides[prop]) return overrides[prop]
      if (!chain[prop]) {
        chain[prop] = vi.fn(() => self)
      }
      return chain[prop]
    },
  })
  return self
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// checkLongevity (pure function — 4 existing tests)
// ===========================================================================

describe('checkLongevity', () => {
  it('returns holding for ±20% change', async () => {
    const result = await checkLongevity('lib-1', 7, 1100, 1000)
    expect(result.status).toBe('holding')
    expect(result.changePercent).toBe(10)
  })

  it('returns fading for >20% drop', async () => {
    const result = await checkLongevity('lib-1', 30, 700, 1000)
    expect(result.status).toBe('fading')
    expect(result.changePercent).toBe(-30)
  })

  it('returns growing for >20% gain', async () => {
    const result = await checkLongevity('lib-1', 7, 1500, 1000)
    expect(result.status).toBe('growing')
    expect(result.changePercent).toBe(50)
  })

  it('returns holding when viewsAtWin is 0', async () => {
    const result = await checkLongevity('lib-1', 7, 100, 0)
    expect(result.status).toBe('holding')
    expect(result.changePercent).toBe(0)
  })
})

// ===========================================================================
// autoImportWinner
// ===========================================================================

describe('autoImportWinner', () => {
  it('imports winning variant to library with lift calculation', async () => {
    const insertedData: Record<string, unknown>[] = []

    const fromMock = vi.fn((table: string) => {
      if (table === 'ab_tests') {
        return makeChain({
          data: {
            id: 'test-1',
            winner_variant_id: 'v-win',
            youtube_video_id: 'yt-vid-1',
            confidence_at_completion: 95,
            name: 'CTR Test',
          },
          error: null,
        })
      }
      if (table === 'thumbnail_library') {
        // First call: dedup check (maybeSingle → null)
        // Second call: insert
        let callCount = 0
        return {
          select: vi.fn(() => makeChain({ data: null, error: null })),
          insert: vi.fn((data: Record<string, unknown>) => {
            insertedData.push(data)
            return makeChain({ data: { id: 'lib-new-1' }, error: null })
          }),
        }
      }
      if (table === 'ab_test_variants') {
        return makeChain({
          data: { id: 'v-win', blob_url: 'https://blob/win.jpg', label: 'B' },
          error: null,
        })
      }
      if (table === 'youtube_videos') {
        return makeChain({
          data: { title: 'My Video' },
          error: null,
        })
      }
      if (table === 'ab_test_cycles') {
        return makeChain({
          data: [
            { variant_id: 'v-win', views: 1200 },
            { variant_id: 'v-lose', views: 800 },
          ],
          error: null,
        })
      }
      return makeChain({ data: null, error: null })
    })

    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromMock })

    const result = await autoImportWinner('test-1', 'site-1')

    expect(result).toEqual({ imported: true, libraryId: 'lib-new-1' })
    expect(insertedData).toHaveLength(1)
    expect(insertedData[0]).toMatchObject({
      site_id: 'site-1',
      source_test_id: 'test-1',
      source_variant_id: 'v-win',
      source_type: 'test_winner',
      blob_url: 'https://blob/win.jpg',
      title: 'B — CTR Test',
      video_title: 'My Video',
      youtube_video_id: 'yt-vid-1',
    })
    // Lift: winner avg = 1200, other avg = 800 → (1200-800)/800 = 50%
    expect(insertedData[0]!.lift_at_win).toBe(50)
  })

  it('returns imported: false when test has no winner', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === 'ab_tests') {
        return makeChain({
          data: {
            id: 'test-1',
            winner_variant_id: null,
            youtube_video_id: 'yt-vid-1',
            confidence_at_completion: null,
            name: 'No Winner',
          },
          error: null,
        })
      }
      return makeChain({ data: null, error: null })
    })

    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromMock })

    const result = await autoImportWinner('test-1', 'site-1')
    expect(result).toEqual({ imported: false })
  })

  it('returns imported: false when already imported (dedup)', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === 'ab_tests') {
        return makeChain({
          data: {
            id: 'test-1',
            winner_variant_id: 'v-win',
            youtube_video_id: 'yt-vid-1',
            confidence_at_completion: 95,
            name: 'CTR Test',
          },
          error: null,
        })
      }
      if (table === 'thumbnail_library') {
        // Dedup check returns existing
        return makeChain({ data: { id: 'already-exists' }, error: null })
      }
      return makeChain({ data: null, error: null })
    })

    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromMock })

    const result = await autoImportWinner('test-1', 'site-1')
    expect(result).toEqual({ imported: false })
  })
})

// ===========================================================================
// checkAndPersistLongevity
// ===========================================================================

describe('checkAndPersistLongevity', () => {
  it('upserts longevity checkpoint with correct status', async () => {
    const upsertedData: unknown[] = []
    const upsertOpts: unknown[] = []

    const fromMock = vi.fn((table: string) => {
      if (table === 'thumbnail_longevity') {
        return {
          upsert: vi.fn((data: unknown, opts: unknown) => {
            upsertedData.push(data)
            upsertOpts.push(opts)
            return Promise.resolve({ data: null, error: null })
          }),
        }
      }
      return makeChain({ data: null, error: null })
    })

    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromMock })

    await checkAndPersistLongevity('lib-1', 30, 1100, 1000)

    expect(upsertedData).toHaveLength(1)
    expect(upsertedData[0]).toMatchObject({
      library_id: 'lib-1',
      checkpoint_days: 30,
      ctr_at_checkpoint: 1100,
      ctr_at_win: 1000,
      change_percent: 10,
      status: 'holding',
    })
    expect(upsertOpts[0]).toEqual({ onConflict: 'library_id,checkpoint_days' })
  })

  it('triggers fatigue alert when status is fading', async () => {
    const upsertedData: unknown[] = []

    const fromMock = vi.fn((table: string) => {
      if (table === 'thumbnail_longevity') {
        return {
          upsert: vi.fn((data: unknown) => {
            upsertedData.push(data)
            return Promise.resolve({ data: null, error: null })
          }),
        }
      }
      return makeChain({ data: null, error: null })
    })

    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromMock })

    // 700 views vs 1000 at win → -30% → fading
    await checkAndPersistLongevity('lib-1', 60, 700, 1000)

    expect(upsertedData).toHaveLength(1)
    expect(upsertedData[0]).toMatchObject({
      library_id: 'lib-1',
      checkpoint_days: 60,
      status: 'fading',
      change_percent: -30,
    })
  })
})

// ===========================================================================
// runLongevityChecks
// ===========================================================================

describe('runLongevityChecks', () => {
  it('checks longevity for entries old enough for checkpoint', async () => {
    const upsertedData: unknown[] = []
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString()

    const fromMock = vi.fn((table: string) => {
      if (table === 'thumbnail_library') {
        return makeChain({
          data: [
            {
              id: 'lib-1',
              youtube_video_id: 'yt-1',
              created_at: eightDaysAgo,
              source_test_id: 'test-1',
            },
          ],
          error: null,
        })
      }
      if (table === 'thumbnail_longevity') {
        // First call from runLongevityChecks: check if already recorded → null
        // Second call from checkAndPersistLongevity: upsert
        return {
          select: vi.fn(() => makeChain({ data: null, error: null })),
          upsert: vi.fn((data: unknown) => {
            upsertedData.push(data)
            return Promise.resolve({ data: null, error: null })
          }),
        }
      }
      if (table === 'youtube_videos') {
        return makeChain({
          data: { view_count: 5000 },
          error: null,
        })
      }
      if (table === 'ab_test_cycles') {
        return makeChain({
          data: { views: 3000 },
          error: null,
        })
      }
      return makeChain({ data: null, error: null })
    })

    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromMock })

    const count = await runLongevityChecks('site-1')

    // 8 days old → only the 7-day checkpoint qualifies
    expect(count).toBe(1)
    expect(upsertedData).toHaveLength(1)
    expect(upsertedData[0]).toMatchObject({
      library_id: 'lib-1',
      checkpoint_days: 7,
      ctr_at_checkpoint: 5000,
      ctr_at_win: 3000,
    })
  })

  it('skips entries that already have checkpoint recorded', async () => {
    const upsertedData: unknown[] = []
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString()

    const fromMock = vi.fn((table: string) => {
      if (table === 'thumbnail_library') {
        return makeChain({
          data: [
            {
              id: 'lib-1',
              youtube_video_id: 'yt-1',
              created_at: eightDaysAgo,
              source_test_id: 'test-1',
            },
          ],
          error: null,
        })
      }
      if (table === 'thumbnail_longevity') {
        // Already recorded → return existing
        return {
          select: vi.fn(() => makeChain({ data: { id: 'existing-check' }, error: null })),
          upsert: vi.fn((data: unknown) => {
            upsertedData.push(data)
            return Promise.resolve({ data: null, error: null })
          }),
        }
      }
      return makeChain({ data: null, error: null })
    })

    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromMock })

    const count = await runLongevityChecks('site-1')

    expect(count).toBe(0)
    expect(upsertedData).toHaveLength(0)
  })
})
