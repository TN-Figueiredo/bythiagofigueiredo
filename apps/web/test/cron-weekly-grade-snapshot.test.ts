import { describe, it, expect } from 'vitest'
import { computeBaseline, computeReachDiversityFromRecord } from '@/lib/youtube/scoring'
import type { BaselineVideoInput } from '@/lib/youtube/scoring'

// Helper to build a dailyByVideo map matching the shape the cron constructs
function makeDailyByVideo(
  entries: Array<{ id: string; days: Array<{ date: string; views: number }> }>,
): Map<string, Array<{ date: string; views: number }>> {
  const map = new Map<string, Array<{ date: string; views: number }>>()
  for (const { id, days } of entries) {
    map.set(id, days)
  }
  return map
}

describe('computeBaseline (used by weekly-grade-snapshot)', () => {
  it('computes medianReach via Shannon entropy, not raw impressions', () => {
    // A video with perfectly even traffic (max entropy) should score higher reach
    // than a video with all traffic from a single source (zero entropy)
    const evenTraffic: Record<string, number> = {
      browse: 1000,
      search: 1000,
      suggested: 1000,
      external: 1000,
      direct: 1000,
      notifications: 1000,
      playlists: 1000,
    }
    const singleSource: Record<string, number> = {
      browse: 7000,
      search: 0,
      suggested: 0,
      external: 0,
      direct: 0,
      notifications: 0,
      playlists: 0,
    }

    const evenScore = computeReachDiversityFromRecord(evenTraffic)
    const singleScore = computeReachDiversityFromRecord(singleSource)

    // Even distribution → max entropy → score near 100
    expect(evenScore).toBeCloseTo(100, 0)
    // Single source → zero entropy → score = 0
    expect(singleScore).toBe(0)

    // The baseline medianReach should reflect this — a channel where all videos
    // have even distribution has a high medianReach baseline
    const videos: BaselineVideoInput[] = [
      { ctr: 4.0, avg_view_percentage: 45, traffic_sources: evenTraffic },
    ]
    const baseline = computeBaseline(videos, makeDailyByVideo([]), 5000)
    expect(baseline.medianReach).toBeCloseTo(100, 0)
  })

  it('handles even-length arrays correctly in median', () => {
    // With 4 videos, median should be the average of the 2nd and 3rd values
    const videos: BaselineVideoInput[] = [
      { ctr: 2.0, avg_view_percentage: 30, traffic_sources: null },
      { ctr: 4.0, avg_view_percentage: 40, traffic_sources: null },
      { ctr: 6.0, avg_view_percentage: 50, traffic_sources: null },
      { ctr: 8.0, avg_view_percentage: 60, traffic_sources: null },
    ]
    const baseline = computeBaseline(videos, makeDailyByVideo([]), 10000)

    // Sorted CTRs: [2, 4, 6, 8] → median = (4 + 6) / 2 = 5.0
    expect(baseline.medianCtr).toBe(5.0)
    // Sorted retentions: [30, 40, 50, 60] → median = (40 + 50) / 2 = 45.0
    expect(baseline.medianRetention).toBe(45.0)
  })

  it('handles videos with null traffic_sources', () => {
    // The cron casts traffic_sources to null when it's missing — computeBaseline
    // must handle this without throwing
    const videos: BaselineVideoInput[] = [
      { ctr: 3.5, avg_view_percentage: 42, traffic_sources: null },
      { ctr: 5.0, avg_view_percentage: 55, traffic_sources: null },
      { ctr: null, avg_view_percentage: null, traffic_sources: null },
    ]

    expect(() =>
      computeBaseline(videos, makeDailyByVideo([]), 0),
    ).not.toThrow()

    const baseline = computeBaseline(videos, makeDailyByVideo([]), 0)
    // null traffic_sources → reach diversity = 0, filtered out → medianReach = 0
    expect(baseline.medianReach).toBe(0)
    // null ctr/avg_view_percentage treated as 0, filtered out → only [3.5, 5.0] remain
    expect(baseline.medianCtr).toBeCloseTo(4.25, 2)
    expect(baseline.medianRetention).toBeCloseTo(48.5, 2)
  })

  it('produces reasonable baseline with mixed data', () => {
    // Matches a realistic snapshot of what the cron processes:
    // a small channel with 3 videos, each with partial traffic data and 30d daily data
    const trafficA: Record<string, number> = { browse: 600, search: 200, suggested: 100, external: 50, direct: 30, notifications: 10, playlists: 10 }
    const trafficB: Record<string, number> = { browse: 300, search: 400, suggested: 200, external: 60, direct: 20, notifications: 10, playlists: 10 }

    const videos: BaselineVideoInput[] = [
      { ctr: 3.2, avg_view_percentage: 38, traffic_sources: trafficA },
      { ctr: 5.1, avg_view_percentage: 52, traffic_sources: trafficB },
      { ctr: 4.0, avg_view_percentage: 45, traffic_sources: null },
    ]

    const daily30 = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0]!,
      views: 100 + i * 5,
    }))

    const dailyByVideo = makeDailyByVideo([
      { id: 'vid-a', days: daily30 },
      { id: 'vid-b', days: daily30 },
    ])

    const baseline = computeBaseline(videos, dailyByVideo, 8500)

    // Sanity checks — all fields must be numbers and within plausible ranges
    expect(typeof baseline.medianCtr).toBe('number')
    expect(baseline.medianCtr).toBeGreaterThan(0)
    expect(baseline.medianCtr).toBeLessThan(100)

    expect(typeof baseline.medianRetention).toBe('number')
    expect(baseline.medianRetention).toBeGreaterThan(0)
    expect(baseline.medianRetention).toBeLessThan(100)

    // medianReach comes from Shannon entropy of trafficA and trafficB (null excluded)
    // Both have some diversity so reach > 0
    expect(baseline.medianReach).toBeGreaterThan(0)
    expect(baseline.medianReach).toBeLessThanOrEqual(100)

    // channelDailyMean: total views across both videos' daily arrays / unique days
    // 30 days × (100..245 avg ~172.5) × 2 videos = ~10350 total views / 30 days ≈ 345
    expect(baseline.channelDailyMean).toBeGreaterThan(0)

    expect(baseline.subscriberCount).toBe(8500)
  })
})
