import { describe, it, expect } from 'vitest'
import { latestRow, latestRowPerVideo, sumLatestPerVideo } from '@/lib/youtube/rolling-window'
import { computeBaseline, scoreVideo, GROWTH_UNAVAILABLE } from '@/lib/youtube/scoring'
import type { BaselineDailyRow, BaselineVideoInput } from '@/lib/youtube/scoring'
import type { ChannelBaseline, VideoScoreInput } from '@/lib/youtube/scoring-types'

/**
 * Regression guard for the "428 views in 28 days" bug.
 *
 * Every row of `youtube_video_analytics` is the TOTAL over the rolling sync
 * window as of its `date`, not that date's count. Six call sites reduced those
 * rows with `(s, d) => s + d.views`, multiplying the same views by the number
 * of syncs. Measured on production channel UCRHtzTwaEpcjspAS2hbqmrA on
 * 2026-09-22: 543 reported where the truth was 32 — a 17x inflation, served by
 * the API that Cowork reads.
 *
 * These tests are written so that reintroducing a sum makes them FAIL, not just
 * so that the correct value passes. Each one asserts the sum explicitly and
 * asserts that the result is NOT it.
 */

/** The exact production shape: N syncs of a video that gained `views` in the window. */
function syncedNTimes(videoId: string, views: number, days: number) {
  return Array.from({ length: days }, (_, i) => ({
    youtube_video_id: videoId,
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    views,
    likes: 2,
    comments: 1,
    shares: 1,
    subscribers_gained: 3,
    impressions: 1000,
  }))
}

describe('latestRowPerVideo', () => {
  it('returns the window total once, not once per sync date', () => {
    // The reviewer's exact scenario: 5 real views, synced 28 days running.
    const rows = syncedNTimes('v1', 5, 28)

    const naiveSum = rows.reduce((s, r) => s + r.views, 0)
    expect(naiveSum).toBe(140) // what the six broken call sites produced

    const total = sumLatestPerVideo(rows, r => r.views)
    expect(total).toBe(5) // the truth: the window total, read off the newest row
    expect(total).not.toBe(naiveSum) // dies if the reduce comes back
  })

  it('picks the newest row even when rows arrive out of order', () => {
    const rows = [
      { youtube_video_id: 'v1', date: '2026-09-10', views: 90 },
      { youtube_video_id: 'v1', date: '2026-09-22', views: 110 },
      { youtube_video_id: 'v1', date: '2026-09-01', views: 70 },
    ]
    expect(latestRowPerVideo(rows).get('v1')?.views).toBe(110)
    expect(sumLatestPerVideo(rows, r => r.views)).toBe(110)
    expect(sumLatestPerVideo(rows, r => r.views)).not.toBe(270)
  })

  it('counts each video exactly once across a multi-video channel', () => {
    const rows = [...syncedNTimes('v1', 10, 17), ...syncedNTimes('v2', 7, 17)]

    expect(rows.reduce((s, r) => s + r.views, 0)).toBe(289) // 17 syncs x 17 views
    expect(sumLatestPerVideo(rows, r => r.views)).toBe(17) // 10 + 7
  })

  it('keeps absence absent: no rows means no entry, not a zero', () => {
    expect(latestRow([])).toBeNull()
    expect(latestRowPerVideo([]).size).toBe(0)
  })
})

describe('computeBaseline reads window totals, never sums of rows', () => {
  const videos: BaselineVideoInput[] = [
    { ctr: 5, avg_view_percentage: 45, traffic_sources: null, view_count: 1000 },
    { ctr: 6, avg_view_percentage: 50, traffic_sources: null, view_count: 2000 },
  ]

  function baselineFor(perVideoViews: number, days: number): ChannelBaseline {
    const byVideo = new Map<string, BaselineDailyRow[]>([
      ['v1', syncedNTimes('v1', perVideoViews, days)],
      ['v2', syncedNTimes('v2', perVideoViews, days)],
    ])
    return computeBaseline(videos, byVideo, 1160)
  }

  it('channelMeanWindowViews is the mean window total per video, not sum/days', () => {
    const baseline = baselineFor(10, 17)

    // The old formula: every row of every video summed (2 x 17 x 10 = 340),
    // divided by the 17 distinct sync dates = 20 — twice the real figure, and
    // growing with the number of videos on the channel.
    expect(baseline.channelMeanWindowViews).toBe(10)
    expect(baseline.channelMeanWindowViews).not.toBe(20)
  })

  it('does not drift as the cron keeps running over unchanged data', () => {
    // Nothing about the channel changed — only the number of syncs. A baseline
    // that moves here is a baseline built from a sum.
    expect(baselineFor(10, 3).channelMeanWindowViews)
      .toBe(baselineFor(10, 30).channelMeanWindowViews)
  })

  it('engagement rate stays per-window, not inflated on both sides', () => {
    // 4 engagements against 10 views in the window = 40%, whatever the sync count.
    expect(baselineFor(10, 17).medianEngagement).toBeCloseTo(40, 5)
    expect(baselineFor(10, 3).medianEngagement).toBeCloseTo(40, 5)
  })
})

describe('growth axis: absence is reported, not scored as zero', () => {
  const baseline: ChannelBaseline = {
    medianCtr: 5,
    medianRetention: 45,
    medianReach: 50,
    medianEngagement: 4,
    medianSubImpact: 0.5,
    channelMeanWindowViews: 500,
    subscriberCount: 1160,
    medianViewCount: 1000,
  }

  const input: VideoScoreInput = {
    videoId: 'v1',
    publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    ctr: 5,
    avgViewPercentage: 45,
    impressions: 1000,
    trafficSources: null,
    engagementRate: 4,
    rollingViews: Array.from({ length: 28 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      windowViews: 500,
    })),
    subscribersGained: 5,
    viewCount: 1000,
  }

  it('omits growth from axes instead of reporting a fabricated score', () => {
    const result = scoreVideo(input, baseline)
    expect(result.axes.find(a => a.axis === 'growth')).toBeUndefined()
    expect(result.axes.map(a => a.axis).sort()).toEqual(
      ['ctr', 'engagement', 'reach', 'retention', 'sub_impact'],
    )
  })

  it('says why, rather than leaving the caller to guess', () => {
    const result = scoreVideo(input, baseline)
    expect(result.unavailableAxes).toEqual([{ axis: 'growth', reason: GROWTH_UNAVAILABLE }])
  })

  it('renormalizes the surviving weights so overall stays on a 0-100 scale', () => {
    const result = scoreVideo(input, baseline)
    const weightSum = result.axes.reduce((s, a) => s + a.weight, 0)
    expect(weightSum).toBeCloseTo(1, 10)
    // Without renormalization the missing 0.12 would silently cap `overall` at 88.
    expect(result.axes.reduce((s, a) => s + a.weighted, 0)).toBeLessThanOrEqual(100)
  })

  it('does not let the sync count move a video score', () => {
    // Same channel, same video, same real views — only more syncs recorded.
    const few = scoreVideo(
      { ...input, rollingViews: input.rollingViews.slice(0, 3) },
      baseline,
    )
    const many = scoreVideo(input, baseline)
    expect(many.overall).toBe(few.overall)
  })
})

// ─── Point 1: getAnalyticsOverview, the API Cowork reads ────────────────────

/** Minimal chainable Supabase stub: every builder method returns the thenable. */
function stubSupabase(tables: Record<string, unknown[]>) {
  const make = (rows: unknown[]) => {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'not']) {
      builder[m] = () => builder
    }
    builder.single = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve)
    return builder
  }
  return { from: (table: string) => make(tables[table] ?? []) }
}

describe('getAnalyticsOverview (served to Cowork) reports window totals', () => {
  const SITE = '11111111-1111-1111-1111-111111111111'
  const CHANNEL = '22222222-2222-2222-2222-222222222222'

  it('does not multiply views by the number of syncs', async () => {
    const { getAnalyticsOverview } = await import('@/lib/pipeline/services/youtube')

    // Two videos, 5 and 3 views in the window, each synced 28 days running —
    // the reviewer's scenario, which produced "kpis.views = 140 in 28 days".
    const analytics = [...syncedNTimes('vid-a', 5, 28), ...syncedNTimes('vid-b', 3, 28)]
    const naiveSum = analytics.reduce((s, r) => s + r.views, 0)
    expect(naiveSum).toBe(224)

    const supabase = stubSupabase({
      youtube_channels: [{ id: CHANNEL, channel_id: 'UCtest', subscriber_count: 1160 }],
      youtube_videos: [
        { id: 'vid-a', youtube_video_id: 'a', title: 'A', published_at: '2026-01-01T00:00:00Z', view_count: 500, ctr: 5, impressions: 1000, avg_view_percentage: 45, avg_view_duration_seconds: 100, retention_curve: null, traffic_sources: null },
        { id: 'vid-b', youtube_video_id: 'b', title: 'B', published_at: '2026-02-01T00:00:00Z', view_count: 300, ctr: 4, impressions: 800, avg_view_percentage: 40, avg_view_duration_seconds: 90, retention_curve: null, traffic_sources: null },
      ],
      youtube_video_analytics: analytics,
    })

    const result = await getAnalyticsOverview(
      { supabase, siteId: SITE } as never,
      CHANNEL,
      28,
    )

    expect(result.data).toBeDefined()
    const kpis = result.data!.kpis
    expect(kpis.views).toBe(8) // 5 + 3, each counted once
    expect(kpis.views).not.toBe(naiveSum) // dies if the reduce comes back
    expect(kpis.subscribers).toBe(6) // 3 + 3, each counted once
    expect(kpis.subscribers).not.toBe(analytics.reduce((s, r) => s + r.subscribers_gained, 0))
  })

  it('reports the same views however many times the cron has run', async () => {
    const { getAnalyticsOverview } = await import('@/lib/pipeline/services/youtube')

    const run = async (days: number) => {
      const supabase = stubSupabase({
        youtube_channels: [{ id: CHANNEL, channel_id: 'UCtest', subscriber_count: 1160 }],
        youtube_videos: [
          { id: 'vid-a', youtube_video_id: 'a', title: 'A', published_at: '2026-01-01T00:00:00Z', view_count: 500, ctr: 5, impressions: 1000, avg_view_percentage: 45, avg_view_duration_seconds: 100, retention_curve: null, traffic_sources: null },
        ],
        youtube_video_analytics: syncedNTimes('vid-a', 5, days),
      })
      const r = await getAnalyticsOverview({ supabase, siteId: SITE } as never, CHANNEL, 28)
      return r.data!.kpis.views
    }

    expect(await run(1)).toBe(5)
    expect(await run(28)).toBe(5)
  })
})

// ─── Structural guard across all six original call sites ────────────────────

describe('no call site sums youtube_video_analytics rows again', () => {
  /**
   * The six places that held this bug. A behavioural test guards each result,
   * but the shape of the mistake is what keeps coming back: a `reduce` over
   * rows that are already totals. This fails the moment one reappears, in any
   * of them, whatever the surrounding logic then does with it.
   */
  const CALL_SITES = [
    'src/lib/pipeline/services/youtube.ts',
    'src/app/cms/(authed)/youtube/analytics/actions.ts',
    'src/lib/youtube/scoring.ts',
    'src/app/cms/(authed)/youtube/ab-lab/queries.ts',
    'src/app/api/cron/weekly-grade-snapshot/route.ts',
    'src/app/cms/(authed)/youtube/_actions/youtube-prompt-actions.ts',
  ]

  /** `reduce((acc, row) => acc + row.<metric>, …)` over per-date analytics rows. */
  const SUMMING_REDUCE =
    /reduce\(\s*\(\s*\w+\s*,\s*\w+\s*\)\s*=>\s*\w+\s*\+[^)]*\b(views|subscribers_gained)\b/

  /** `map.set(id, (map.get(id) ?? 0) + row.views)` — the same sum, spelled out. */
  const ACCUMULATING_SET = /\?\?\s*0\s*\)\s*\+\s*\(?\s*\w+\.views/

  it.each(CALL_SITES)('%s', async site => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const source = readFileSync(join(process.cwd(), site), 'utf8')

    expect(
      SUMMING_REDUCE.test(source),
      `${site} reduces analytics rows into a sum. Each row of ` +
        'youtube_video_analytics is the TOTAL over the rolling sync window, so ' +
        'summing them multiplies the same views by the number of syncs ' +
        '(17x on production, 2026-09-22). Use latestRow/latestRowPerVideo from ' +
        '@/lib/youtube/rolling-window instead.',
    ).toBe(false)

    expect(
      ACCUMULATING_SET.test(source),
      `${site} accumulates row.views into a per-video map, which is the same ` +
        'sum written as a loop. Use latestRowPerVideo instead.',
    ).toBe(false)
  })
})
