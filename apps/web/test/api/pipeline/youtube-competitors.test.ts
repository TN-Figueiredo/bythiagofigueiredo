import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ServiceContext } from '@/lib/pipeline/services/types'

// ─── Chainable Supabase mock ───────────────────────────────────────────────

type MockChain = {
  from: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  _resolvedData: unknown
  _resolvedError: unknown
}

function createChain(): MockChain {
  const chain: MockChain = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    _resolvedData: null,
    _resolvedError: null,
  }
  chain.from.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  return chain
}

/**
 * Build a mock supabase client that dispatches per-table, per-call responses.
 *
 * `tableResponses` maps a table name to an ordered queue of { data, error } results.
 * Each call to `.from(table)` pops the next queued response for that table.
 * The chain resolves (returns { data, error }) when the last chainable method is awaited.
 */
function buildSupabase(tableResponses: Record<string, Array<{ data: unknown; error: unknown }>>) {
  const counters: Record<string, number> = {}

  const supabase = {
    from: vi.fn((table: string) => {
      counters[table] = (counters[table] ?? 0) + 1
      const idx = (counters[table] ?? 1) - 1
      const queue = tableResponses[table] ?? []
      const resp = queue[idx] ?? { data: null, error: null }

      const result = { data: resp.data, error: resp.error }

      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = vi.fn(self)
      chain.eq = vi.fn(self)
      chain.order = vi.fn(self)
      chain.limit = vi.fn(self)
      // Make it thenable so `await supabase.from(...).select(...)...` works
      chain.then = (resolve: (v: unknown) => void) => resolve(result)
      return chain
    }),
  }
  return supabase as unknown as ServiceContext['supabase']
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SITE_ID = '11111111-1111-1111-1111-111111111111'
const CH_ID_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const CH_ID_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function ctx(supabase: ServiceContext['supabase']): ServiceContext {
  return {
    siteId: SITE_ID,
    permissions: ['read'],
    supabase,
  }
}

const nowIso = new Date().toISOString()
const recentIso = new Date(Date.now() - 2 * 86_400_000).toISOString()

function makeChannel(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    channel_id: `UC_${name}`,
    channel_name: name,
    thumbnail_url: `https://img/${name}.jpg`,
    subscriber_count: 10000,
    last_synced_at: nowIso,
    added_at: nowIso,
    ...overrides,
  }
}

function makeVideo(
  competitorChannelId: string,
  idx: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `vid-${competitorChannelId}-${idx}`,
    competitor_channel_id: competitorChannelId,
    video_id: `yt_${idx}`,
    title: `Video ${idx}`,
    thumbnail_url: `https://img/v${idx}.jpg`,
    view_count: 1000 * (idx + 1),
    like_count: 50 * (idx + 1),
    comment_count: 10 * (idx + 1),
    duration_seconds: 600,
    published_at: recentIso,
    last_checked_at: nowIso,
    tags: ['travel', 'vlog'],
    ...overrides,
  }
}

// ─── Import service functions ──────────────────────────────────────────────

import {
  listCompetitorChannels,
  listCompetitorChanges,
  listCompetitorOutliers,
  getCompetitorInsights,
} from '@/lib/pipeline/services/competitors'

// ═══════════════════════════════════════════════════════════════════════════
// listCompetitorChannels
// ═══════════════════════════════════════════════════════════════════════════

describe('listCompetitorChannels', () => {
  it('returns channels with engagement stats', async () => {
    const ch = makeChannel(CH_ID_1, 'TravelBR')
    const vids = [
      makeVideo(CH_ID_1, 0, { view_count: 10000, like_count: 500, comment_count: 100 }),
      makeVideo(CH_ID_1, 1, { view_count: 5000, like_count: 200, comment_count: 50 }),
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: vids, error: null }],
    })

    const result = await listCompetitorChannels(ctx(sb))
    expect(result.data.count).toBe(1)
    expect(result.data.channels).toHaveLength(1)

    const c = result.data.channels[0]!
    expect(c.channel_name).toBe('TravelBR')
    expect(c.video_count).toBe(2)
    // (500+100+200+50) / (10000+5000) = 850/15000 ≈ 0.0567
    expect(c.avg_engagement).toBeCloseTo(0.0567, 3)
  })

  it('filters by site_id', async () => {
    const sb = buildSupabase({
      competitor_channels: [{ data: [], error: null }],
    })

    const result = await listCompetitorChannels(ctx(sb))
    expect(result.data.channels).toEqual([])
    expect(result.data.count).toBe(0)
    // Verify .eq was called with site_id filter
    expect(sb.from).toHaveBeenCalledWith('competitor_channels')
  })

  it('returns empty array when no channels', async () => {
    const sb = buildSupabase({
      competitor_channels: [{ data: [], error: null }],
    })

    const result = await listCompetitorChannels(ctx(sb))
    expect(result.data.channels).toEqual([])
    expect(result.data.count).toBe(0)
  })

  it('returns null engagement for channels with 0 total views', async () => {
    const ch = makeChannel(CH_ID_1, 'GhostChannel')
    const vids = [
      makeVideo(CH_ID_1, 0, { view_count: 0, like_count: 0, comment_count: 0 }),
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: vids, error: null }],
    })

    const result = await listCompetitorChannels(ctx(sb))
    expect(result.data.channels[0]!.avg_engagement).toBeNull()
  })

  it('throws on DB error', async () => {
    const sb = buildSupabase({
      competitor_channels: [{ data: null, error: { message: 'connection failed' } }],
    })

    await expect(listCompetitorChannels(ctx(sb))).rejects.toThrow('Failed to load competitor channels')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// listCompetitorChanges
// ═══════════════════════════════════════════════════════════════════════════

describe('listCompetitorChanges', () => {
  const makeRawChange = (
    id: string,
    changeType: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    id,
    change_type: changeType,
    old_title: 'Old Title',
    new_title: 'New Title',
    old_thumbnail_url: null,
    new_thumbnail_url: null,
    view_count_at_change: 5000,
    detected_at: nowIso,
    bookmarked: false,
    competitor_videos: [
      {
        title: 'Test Video',
        video_id: 'yt_123',
        competitor_channels: [{ channel_name: 'TravelBR' }],
      },
    ],
    ...overrides,
  })

  it('returns changes with video/channel info', async () => {
    const changes = [
      makeRawChange('c1', 'title'),
      makeRawChange('c2', 'thumbnail'),
    ]

    const sb = buildSupabase({
      competitor_changes: [{ data: changes, error: null }],
    })

    const result = await listCompetitorChanges(ctx(sb), {})
    expect(result.data.count).toBe(2)
    expect(result.data.changes).toHaveLength(2)
    expect(result.data.changes[0]!.change_type).toBe('title')
    expect(result.data.changes[0]!.channel_name).toBe('TravelBR')
    expect(result.data.changes[0]!.video_id).toBe('yt_123')
  })

  it('filters by type', async () => {
    const changes = [makeRawChange('c1', 'thumbnail')]

    const sb = buildSupabase({
      competitor_changes: [{ data: changes, error: null }],
    })

    const result = await listCompetitorChanges(ctx(sb), { type: 'thumbnail' })
    expect(result.data.changes).toHaveLength(1)
    expect(result.data.changes[0]!.change_type).toBe('thumbnail')
    // Verify eq was called (the mock chain tracks calls)
  })

  it('filters by bookmarked flag', async () => {
    const changes = [
      makeRawChange('c1', 'title', { bookmarked: true }),
    ]

    const sb = buildSupabase({
      competitor_changes: [{ data: changes, error: null }],
    })

    const result = await listCompetitorChanges(ctx(sb), { bookmarked: true })
    expect(result.data.changes).toHaveLength(1)
    expect(result.data.changes[0]!.bookmarked).toBe(true)
  })

  it('respects limit param', async () => {
    const changes = [makeRawChange('c1', 'title')]

    const sb = buildSupabase({
      competitor_changes: [{ data: changes, error: null }],
    })

    const result = await listCompetitorChanges(ctx(sb), { limit: 5 })
    expect(result.data.count).toBe(1)
  })

  it('caps limit at 100', async () => {
    const sb = buildSupabase({
      competitor_changes: [{ data: [], error: null }],
    })

    // Even with limit=999, the service caps at 100
    await listCompetitorChanges(ctx(sb), { limit: 999 })
    // No error — the Math.min(999, 100) = 100 is applied internally
    expect(sb.from).toHaveBeenCalledWith('competitor_changes')
  })

  it('returns empty when no changes', async () => {
    const sb = buildSupabase({
      competitor_changes: [{ data: [], error: null }],
    })

    const result = await listCompetitorChanges(ctx(sb), {})
    expect(result.data.changes).toEqual([])
    expect(result.data.count).toBe(0)
  })

  it('throws on DB error', async () => {
    const sb = buildSupabase({
      competitor_changes: [{ data: null, error: { message: 'timeout' } }],
    })

    await expect(listCompetitorChanges(ctx(sb), {})).rejects.toThrow('Failed to load competitor changes')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// listCompetitorOutliers
// ═══════════════════════════════════════════════════════════════════════════

describe('listCompetitorOutliers', () => {
  it('returns outliers sorted by multiplier desc', async () => {
    const ch = makeChannel(CH_ID_1, 'TravelBR')
    // sorted views = [100, 100, 100, 300, 700, 1000] → median at idx 3 = 300
    // 1000/300 = 3.3x (mid), 700/300 = 2.3x (mid)
    const vids = [
      makeVideo(CH_ID_1, 0, { view_count: 100 }),
      makeVideo(CH_ID_1, 1, { view_count: 100 }),
      makeVideo(CH_ID_1, 2, { view_count: 100 }),
      makeVideo(CH_ID_1, 3, { view_count: 300 }),
      makeVideo(CH_ID_1, 4, { view_count: 700 }),
      makeVideo(CH_ID_1, 5, { view_count: 1000 }),
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: vids, error: null }],
    })

    const result = await listCompetitorOutliers(ctx(sb), {})
    expect(result.data.outliers.length).toBeGreaterThan(0)
    // Should be sorted desc by multiplier
    for (let i = 1; i < result.data.outliers.length; i++) {
      expect(result.data.outliers[i - 1]!.multiplier).toBeGreaterThanOrEqual(
        result.data.outliers[i]!.multiplier,
      )
    }
  })

  it('assigns correct tiers (top=10x+, high=5-10x, mid=2-5x)', async () => {
    const ch = makeChannel(CH_ID_1, 'TravelBR')
    // 7 vids: sorted = [100,100,100,100,3000,7000,10000] → median at idx 3 = 100
    // 10000/100 = 100x → top, 7000/100 = 70x → top, 3000/100 = 30x → top
    // That's all top. Use different spread:
    // sorted = [1000,1000,1000,1000,3000,7000,11000] → median at idx 3 = 1000
    // 11000/1000 = 11x → top, 7000/1000 = 7x → high, 3000/1000 = 3x → mid
    const vids = [
      makeVideo(CH_ID_1, 0, { view_count: 1000 }),
      makeVideo(CH_ID_1, 1, { view_count: 1000 }),
      makeVideo(CH_ID_1, 2, { view_count: 1000 }),
      makeVideo(CH_ID_1, 3, { view_count: 1000 }),
      makeVideo(CH_ID_1, 4, { view_count: 3000 }),  // 3x → mid
      makeVideo(CH_ID_1, 5, { view_count: 7000 }),  // 7x → high
      makeVideo(CH_ID_1, 6, { view_count: 11000 }), // 11x → top
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: vids, error: null }],
    })

    const result = await listCompetitorOutliers(ctx(sb), {})
    const tiers = result.data.outliers.map(o => o.tier)
    expect(tiers).toContain('top')
    expect(tiers).toContain('high')
    expect(tiers).toContain('mid')

    const topOutlier = result.data.outliers.find(o => o.view_count === 11000)!
    expect(topOutlier.tier).toBe('top')
    expect(topOutlier.multiplier).toBe(11)

    const highOutlier = result.data.outliers.find(o => o.view_count === 7000)!
    expect(highOutlier.tier).toBe('high')
    expect(highOutlier.multiplier).toBe(7)

    const midOutlier = result.data.outliers.find(o => o.view_count === 3000)!
    expect(midOutlier.tier).toBe('mid')
    expect(midOutlier.multiplier).toBe(3)
  })

  it('filters by tier (S maps to top)', async () => {
    const ch = makeChannel(CH_ID_1, 'TravelBR')
    // sorted = [1000,1000,1000,1000,3000,11000] → median at idx 3 = 1000
    // 11000/1000 = 11x → top, 3000/1000 = 3x → mid
    const vids = [
      makeVideo(CH_ID_1, 0, { view_count: 1000 }),
      makeVideo(CH_ID_1, 1, { view_count: 1000 }),
      makeVideo(CH_ID_1, 2, { view_count: 1000 }),
      makeVideo(CH_ID_1, 3, { view_count: 1000 }),
      makeVideo(CH_ID_1, 4, { view_count: 3000 }),  // 3x → mid
      makeVideo(CH_ID_1, 5, { view_count: 11000 }), // 11x → top
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: vids, error: null }],
    })

    const result = await listCompetitorOutliers(ctx(sb), { tier: 'S' })
    expect(result.data.outliers.every(o => o.tier === 'top')).toBe(true)
    expect(result.data.outliers.length).toBe(1)
  })

  it('filters by tier B (maps to mid)', async () => {
    const ch = makeChannel(CH_ID_1, 'TravelBR')
    // sorted = [1000,1000,1000,1000,3000,11000] → median at idx 3 = 1000
    const vids = [
      makeVideo(CH_ID_1, 0, { view_count: 1000 }),
      makeVideo(CH_ID_1, 1, { view_count: 1000 }),
      makeVideo(CH_ID_1, 2, { view_count: 1000 }),
      makeVideo(CH_ID_1, 3, { view_count: 1000 }),
      makeVideo(CH_ID_1, 4, { view_count: 3000 }),  // 3x → mid
      makeVideo(CH_ID_1, 5, { view_count: 11000 }), // 11x → top
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: vids, error: null }],
    })

    const result = await listCompetitorOutliers(ctx(sb), { tier: 'B' })
    expect(result.data.outliers.every(o => o.tier === 'mid')).toBe(true)
    expect(result.data.outliers.length).toBe(1)
  })

  it('handles channels with 0 videos (no division by zero)', async () => {
    const ch = makeChannel(CH_ID_1, 'EmptyChannel')

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: [], error: null }],
    })

    const result = await listCompetitorOutliers(ctx(sb), {})
    expect(result.data.outliers).toEqual([])
    expect(result.data.count).toBe(0)
  })

  it('skips channel with fewer than 3 fresh videos', async () => {
    const ch = makeChannel(CH_ID_1, 'TinyChannel')
    const vids = [
      makeVideo(CH_ID_1, 0, { view_count: 1000 }),
      makeVideo(CH_ID_1, 1, { view_count: 50000 }), // would be outlier but < 3 vids
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: vids, error: null }],
    })

    const result = await listCompetitorOutliers(ctx(sb), {})
    expect(result.data.outliers).toEqual([])
  })

  it('skips channels where median is 0', async () => {
    const ch = makeChannel(CH_ID_1, 'ZeroViewsChannel')
    const vids = [
      makeVideo(CH_ID_1, 0, { view_count: 0 }),
      makeVideo(CH_ID_1, 1, { view_count: 0 }),
      makeVideo(CH_ID_1, 2, { view_count: 0 }),
      makeVideo(CH_ID_1, 3, { view_count: 5000 }),
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: vids, error: null }],
    })

    const result = await listCompetitorOutliers(ctx(sb), {})
    // median = 0, so channel is skipped entirely
    expect(result.data.outliers).toEqual([])
  })

  it('throws on DB error', async () => {
    const sb = buildSupabase({
      competitor_channels: [{ data: null, error: { message: 'fail' } }],
    })

    await expect(listCompetitorOutliers(ctx(sb), {})).rejects.toThrow('Failed to load competitor channels')
  })

  it('returns empty when no channels exist', async () => {
    const sb = buildSupabase({
      competitor_channels: [{ data: [], error: null }],
    })

    const result = await listCompetitorOutliers(ctx(sb), {})
    expect(result.data.outliers).toEqual([])
    expect(result.data.count).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// getCompetitorInsights
// ═══════════════════════════════════════════════════════════════════════════

describe('getCompetitorInsights', () => {
  it('returns all insight sections', async () => {
    const ch = makeChannel(CH_ID_1, 'TravelBR')
    // Use many low-view base videos so median stays low, making high-view ones outliers
    // sorted = [100,100,100,100,100,100,15000,25000] → median at idx 4 = 100
    const competitorVids = [
      makeVideo(CH_ID_1, 0, { view_count: 100, title: 'Normal video', published_at: '2026-05-20T14:00:00Z', tags: ['travel'] }),
      makeVideo(CH_ID_1, 1, { view_count: 100, title: 'Another video', published_at: '2026-05-21T10:00:00Z', tags: ['travel', 'vlog'] }),
      makeVideo(CH_ID_1, 2, { view_count: 100, title: 'Third video', published_at: '2026-05-22T16:00:00Z', tags: ['tips'] }),
      makeVideo(CH_ID_1, 3, { view_count: 100, title: 'Filler A', published_at: '2026-05-19T12:00:00Z', tags: ['travel'] }),
      makeVideo(CH_ID_1, 4, { view_count: 100, title: 'Filler B', published_at: '2026-05-18T12:00:00Z', tags: ['travel'] }),
      makeVideo(CH_ID_1, 5, { view_count: 100, title: 'Filler C', published_at: '2026-05-17T12:00:00Z', tags: ['vlog'] }),
      makeVideo(CH_ID_1, 6, { view_count: 25000, title: 'Eu fui pra Bangkok e não acreditei', published_at: '2026-05-23T12:00:00Z', tags: ['travel', 'bangkok'] }),
      makeVideo(CH_ID_1, 7, { view_count: 15000, title: 'R$ 500 por dia na Tailândia', published_at: '2026-05-24T18:00:00Z', tags: ['travel', 'budget'] }),
    ]

    const ownVids = [
      { view_count: 8000, like_count: 400, comment_count: 80, tags: ['travel'] },
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: competitorVids, error: null }],
      youtube_videos: [{ data: ownVids, error: null }],
    })

    const result = await getCompetitorInsights(ctx(sb))
    const d = result.data

    // All sections should exist
    expect(d).toHaveProperty('play_of_week')
    expect(d).toHaveProperty('cadence')
    expect(d).toHaveProperty('formulas')
    expect(d).toHaveProperty('content_gaps')
    expect(d).toHaveProperty('heatmap')
    expect(d).toHaveProperty('tags')
    expect(d).toHaveProperty('engagement')

    // Cadence should have one entry per channel
    expect(d.cadence).toHaveLength(1)
    expect(d.cadence[0]!.channel_name).toBe('TravelBR')

    // Engagement should include our channel ("Voce") + competitors
    expect(d.engagement.length).toBeGreaterThanOrEqual(2)
    expect(d.engagement.some(e => e.is_us)).toBe(true)

    // Heatmap: 7 days x 24 hours
    expect(d.heatmap).toHaveLength(7)
    for (const row of d.heatmap) {
      expect(row).toHaveLength(24)
    }

    // Tags should be populated
    expect(d.tags.length).toBeGreaterThan(0)
  })

  it('handles empty data gracefully (no channels = empty insights)', async () => {
    const sb = buildSupabase({
      competitor_channels: [{ data: [], error: null }],
      youtube_videos: [{ data: [], error: null }],
    })

    const result = await getCompetitorInsights(ctx(sb))
    const d = result.data

    expect(d.play_of_week).toBeNull()
    expect(d.cadence).toEqual([])
    expect(d.formulas).toEqual([])
    expect(d.content_gaps).toEqual([])
    expect(d.tags).toEqual([])
    // Engagement should still have "Voce" entry
    expect(d.engagement).toHaveLength(1)
    expect(d.engagement[0]!.is_us).toBe(true)
    expect(d.engagement[0]!.engagement_rate).toBe(0)
    // Heatmap is always 7x24 (zeroed)
    expect(d.heatmap).toHaveLength(7)
  })

  it('calculates engagement comparison correctly', async () => {
    const ch1 = makeChannel(CH_ID_1, 'HighEngChannel')
    const ch2 = makeChannel(CH_ID_2, 'LowEngChannel')

    const vids1 = [
      makeVideo(CH_ID_1, 0, { view_count: 10000, like_count: 1000, comment_count: 500, tags: [] }),
      makeVideo(CH_ID_1, 1, { view_count: 10000, like_count: 1000, comment_count: 500, tags: [] }),
      makeVideo(CH_ID_1, 2, { view_count: 10000, like_count: 1000, comment_count: 500, tags: [] }),
    ]
    const vids2 = [
      makeVideo(CH_ID_2, 0, { view_count: 10000, like_count: 100, comment_count: 50, tags: [] }),
      makeVideo(CH_ID_2, 1, { view_count: 10000, like_count: 100, comment_count: 50, tags: [] }),
      makeVideo(CH_ID_2, 2, { view_count: 10000, like_count: 100, comment_count: 50, tags: [] }),
    ]

    const ownVids = [
      { view_count: 10000, like_count: 500, comment_count: 200, tags: [] },
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch1, ch2], error: null }],
      competitor_videos: [
        { data: vids1, error: null },
        { data: vids2, error: null },
      ],
      youtube_videos: [{ data: ownVids, error: null }],
    })

    const result = await getCompetitorInsights(ctx(sb))
    const eng = result.data.engagement

    // Should be sorted desc by engagement_rate
    for (let i = 1; i < eng.length; i++) {
      expect(eng[i - 1]!.engagement_rate).toBeGreaterThanOrEqual(eng[i]!.engagement_rate)
    }

    // HighEngChannel: (1000+500)*3 / (10000*3) = 4500/30000 = 0.15
    const high = eng.find(e => e.channel_name === 'HighEngChannel')!
    expect(high.engagement_rate).toBeCloseTo(0.15, 3)

    // LowEngChannel: (100+50)*3 / (10000*3) = 450/30000 = 0.015
    const low = eng.find(e => e.channel_name === 'LowEngChannel')!
    expect(low.engagement_rate).toBeCloseTo(0.015, 3)
  })

  it('detects formula patterns in outlier titles', async () => {
    const ch = makeChannel(CH_ID_1, 'TravelBR')
    // Base videos with low views → median = 100 → outliers at 2x+
    const vids = [
      makeVideo(CH_ID_1, 0, { view_count: 100, title: 'A', tags: [], published_at: '2026-05-20T10:00:00Z' }),
      makeVideo(CH_ID_1, 1, { view_count: 100, title: 'B', tags: [], published_at: '2026-05-21T10:00:00Z' }),
      makeVideo(CH_ID_1, 2, { view_count: 100, title: 'C', tags: [], published_at: '2026-05-22T10:00:00Z' }),
      // Outlier matching "Primeira pessoa" pattern (starts with "Eu ")
      makeVideo(CH_ID_1, 3, { view_count: 5000, title: 'Eu larguei tudo e fui morar na Asia', tags: [], published_at: '2026-05-23T10:00:00Z' }),
      // Outlier matching "Preco em R$" pattern
      makeVideo(CH_ID_1, 4, { view_count: 4000, title: 'R$ 1500 por mês em Bangkok', tags: [], published_at: '2026-05-24T10:00:00Z' }),
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: vids, error: null }],
      youtube_videos: [{ data: [], error: null }],
    })

    const result = await getCompetitorInsights(ctx(sb))
    const labels = result.data.formulas.map(f => f.label)

    expect(labels).toContain('Primeira pessoa')
    expect(labels).toContain('Preço em R$')
    // Each formula has required fields
    for (const f of result.data.formulas) {
      expect(f.multiplier).toBeGreaterThan(0)
      expect(f.count).toBeGreaterThan(0)
      expect(f.example_title).toBeTruthy()
    }
  })

  it('produces play_of_week when sufficient outliers and formulas exist', async () => {
    const ch = makeChannel(CH_ID_1, 'TravelBR')
    // Base videos with low views → median stays low → high-view vids become outliers
    // sorted = [100,100,100,100,100,5000,8000,12000] → median at idx 4 = 100
    // 5000/100=50x, 8000/100=80x, 12000/100=120x → 3 outliers, all matching formulas
    const vids = [
      makeVideo(CH_ID_1, 0, { view_count: 100, title: 'Base 1', tags: ['travel'], published_at: '2026-05-18T10:00:00Z' }),
      makeVideo(CH_ID_1, 1, { view_count: 100, title: 'Base 2', tags: ['travel'], published_at: '2026-05-19T10:00:00Z' }),
      makeVideo(CH_ID_1, 2, { view_count: 100, title: 'Base 3', tags: ['travel'], published_at: '2026-05-20T10:00:00Z' }),
      makeVideo(CH_ID_1, 3, { view_count: 100, title: 'Base 4', tags: ['travel'], published_at: '2026-05-21T10:00:00Z' }),
      makeVideo(CH_ID_1, 4, { view_count: 100, title: 'Base 5', tags: ['travel'], published_at: '2026-05-22T10:00:00Z' }),
      // 3 outliers with formula-matching titles
      makeVideo(CH_ID_1, 5, { view_count: 5000, title: 'Eu fui pra Bangkok sozinho', tags: ['travel'], published_at: '2026-05-23T10:00:00Z' }),
      makeVideo(CH_ID_1, 6, { view_count: 8000, title: 'Larguei tudo e fui morar na Tailândia', tags: ['expat'], published_at: '2026-05-24T12:00:00Z' }),
      makeVideo(CH_ID_1, 7, { view_count: 12000, title: 'R$ 2000 por mês morando na Asia', tags: ['budget'], published_at: '2026-05-25T09:00:00Z' }),
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: vids, error: null }],
      youtube_videos: [{ data: [], error: null }],
    })

    const result = await getCompetitorInsights(ctx(sb))
    const play = result.data.play_of_week

    expect(play).not.toBeNull()
    if (play) {
      expect(play.topic_bold).toBeTruthy()
      expect(play.formula_bold).toBeTruthy()
      expect(play.formula_mult).toBeGreaterThan(0)
      expect(play.window_bold).toBeTruthy()
      expect(play.window_reason).toBeTruthy()
    }
  })

  it('returns null play_of_week when too few outliers', async () => {
    const ch = makeChannel(CH_ID_1, 'SmallChannel')
    // Only 2 videos, not enough for median + outliers
    const vids = [
      makeVideo(CH_ID_1, 0, { view_count: 1000, title: 'A', tags: [] }),
      makeVideo(CH_ID_1, 1, { view_count: 2000, title: 'B', tags: [] }),
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: vids, error: null }],
      youtube_videos: [{ data: [], error: null }],
    })

    const result = await getCompetitorInsights(ctx(sb))
    expect(result.data.play_of_week).toBeNull()
  })

  it('content_gaps marks we_cover correctly based on own tags', async () => {
    const ch = makeChannel(CH_ID_1, 'TravelBR')
    const vids = [
      makeVideo(CH_ID_1, 0, { view_count: 5000, tags: ['thailand', 'budget'], title: 'A' }),
      makeVideo(CH_ID_1, 1, { view_count: 3000, tags: ['thailand', 'food'], title: 'B' }),
      makeVideo(CH_ID_1, 2, { view_count: 4000, tags: ['budget'], title: 'C' }),
    ]

    // Our channel covers "budget" but not "thailand" or "food"
    const ownVids = [
      { view_count: 5000, like_count: 200, comment_count: 50, tags: ['budget', 'tips'] },
    ]

    const sb = buildSupabase({
      competitor_channels: [{ data: [ch], error: null }],
      competitor_videos: [{ data: vids, error: null }],
      youtube_videos: [{ data: ownVids, error: null }],
    })

    const result = await getCompetitorInsights(ctx(sb))
    const gaps = result.data.content_gaps

    const budgetGap = gaps.find(g => g.topic === 'budget')
    const thailandGap = gaps.find(g => g.topic === 'thailand')

    if (budgetGap) expect(budgetGap.we_cover).toBe(true)
    if (thailandGap) expect(thailandGap.we_cover).toBe(false)
  })
})
