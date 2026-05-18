import { describe, it, expect } from 'vitest'
import {
  sigmoid,
  prepareAxisInput,
  computeGrowthVelocity,
  computeEvergreenBonus,
  getAxisWeights,
  getChannelTier,
  scoreVideo,
  assignGrade,
  computeOutliers,
  computeTrend,
  computeBaseline,
} from '@/lib/youtube/scoring'
import type { VideoScoreInput, ChannelBaseline, DailyViewPoint } from '@/lib/youtube/scoring-types'

describe('sigmoid', () => {
  it('returns 50 at midpoint', () => {
    expect(sigmoid(5, 1.8, 5)).toBeCloseTo(50, 0)
  })
  it('returns >50 above midpoint', () => {
    expect(sigmoid(7, 1.8, 5)).toBeGreaterThan(50)
  })
  it('returns <50 below midpoint', () => {
    expect(sigmoid(3, 1.8, 5)).toBeLessThan(50)
  })
  it('clamps output to [1, 99]', () => {
    expect(sigmoid(100, 2.0, 5)).toBeLessThanOrEqual(99)
    expect(sigmoid(-100, 2.0, 5)).toBeGreaterThanOrEqual(1)
  })
})

describe('prepareAxisInput', () => {
  it('returns raw value for reach (no log2 transform)', () => {
    expect(prepareAxisInput('reach', 75)).toBe(75)
  })
  it('applies log2 transform for growth', () => {
    expect(prepareAxisInput('growth', 100)).toBeCloseTo(Math.log2(101), 4)
  })
  it('returns raw value for ctr', () => {
    expect(prepareAxisInput('ctr', 5.5)).toBe(5.5)
  })
})

describe('computeGrowthVelocity', () => {
  it('returns 0 for fewer than 7 days', () => {
    const points: DailyViewPoint[] = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      views: 100,
    }))
    expect(computeGrowthVelocity(points, 1.5)).toBe(0)
  })
  it('returns positive for increasing views', () => {
    const points: DailyViewPoint[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      views: 100 + i * 20,
    }))
    expect(computeGrowthVelocity(points, 1.5)).toBeGreaterThan(0)
  })
  it('returns negative for decreasing views', () => {
    const points: DailyViewPoint[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      views: 500 - i * 30,
    }))
    expect(computeGrowthVelocity(points, 1.5)).toBeLessThan(0)
  })
  it('handles date gaps correctly using actual day offsets', () => {
    // 10 data points with 3-day gaps (simulates missing days)
    const points: DailyViewPoint[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-05-${String(1 + i * 3).padStart(2, '0')}`,
      views: 100 + i * 10,
    }))
    const velocity = computeGrowthVelocity(points, 1.0)
    // With 3-day gaps, growth per day should be ~1/3 of growth per index
    // Compare with same data but consecutive dates
    const consecutive: DailyViewPoint[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-05-${String(1 + i).padStart(2, '0')}`,
      views: 100 + i * 10,
    }))
    const consecutiveVelocity = computeGrowthVelocity(consecutive, 1.0)
    // Gaps mean slower growth per day -> velocity should be lower
    expect(velocity).toBeGreaterThan(0)
    expect(velocity).toBeLessThan(consecutiveVelocity)
  })
  it('returns 0 for all-zero daily views', () => {
    const daily = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      views: 0,
    }))
    expect(computeGrowthVelocity(daily, 1.5)).toBe(0)
  })
})

describe('computeEvergreenBonus', () => {
  it('returns 0 for video younger than or equal to 180 days', () => {
    expect(computeEvergreenBonus(180, [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], 50)).toBe(0)
    expect(computeEvergreenBonus(60, [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], 50)).toBe(0)
  })
  it('returns 0 if below channel mean', () => {
    expect(computeEvergreenBonus(200, [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20], 50)).toBe(0)
  })
  it('returns bonus 3-8 for qualifying evergreen', () => {
    const views = Array.from({ length: 14 }, () => 100)
    const bonus = computeEvergreenBonus(200, views, 50)
    expect(bonus).toBeGreaterThanOrEqual(3)
    expect(bonus).toBeLessThanOrEqual(8)
  })
  it('returns 0 if high variance (CV > 0.8)', () => {
    const views = [10, 200, 5, 300, 8, 250, 3, 180, 15, 220, 7, 190, 4, 210]
    expect(computeEvergreenBonus(200, views, 50)).toBe(0)
  })
  it('returns 0 bonus when channelDailyMean is 0', () => {
    const bonus = computeEvergreenBonus(200, [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], 0)
    expect(bonus).toBe(0)
  })
  it('returns 0 for exactly 14 daily views entries when ageDays <= 180 (boundary)', () => {
    // exactly 14 views but ageDays = 180 → age guard fires first, returns 0
    expect(computeEvergreenBonus(180, [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], 50)).toBe(0)
  })
  it('qualifies evergreen with exactly 14 daily views entries when ageDays > 180', () => {
    // exactly 14 entries — meets the minimum threshold
    const views = Array.from({ length: 14 }, () => 100)
    const bonus = computeEvergreenBonus(181, views, 50)
    expect(bonus).toBeGreaterThanOrEqual(3)
    expect(bonus).toBeLessThanOrEqual(8)
  })
})

describe('getAxisWeights', () => {
  it('returns standard weights for 30-day video', () => {
    const w = getAxisWeights(30)
    expect(w.growth).toBe(0.12)
    expect(w.ctr + w.retention + w.reach + w.engagement + w.growth + w.sub_impact).toBeCloseTo(1.0)
  })
  it('reduces growth weight for fresh video (<7 days)', () => {
    const w = getAxisWeights(3)
    expect(w.growth).toBe(0.04)
    expect(w.ctr).toBe(0.30)
    expect(w.ctr + w.retention + w.reach + w.engagement + w.growth + w.sub_impact).toBeCloseTo(1.0)
  })
  it('uses standard weights at exactly 7 days', () => {
    const w = getAxisWeights(7)
    expect(w.ctr).toBe(0.25)
    expect(w.growth).toBe(0.12)
  })
})

describe('assignGrade', () => {
  it('assigns A for score >= 85', () => expect(assignGrade(90)).toBe('A'))
  it('assigns B for score >= 65', () => expect(assignGrade(72)).toBe('B'))
  it('assigns C for score >= 40', () => expect(assignGrade(50)).toBe('C'))
  it('assigns D for score < 40', () => expect(assignGrade(30)).toBe('D'))
})

describe('getChannelTier', () => {
  it('returns nano for < 1K subs', () => {
    expect(getChannelTier(500)).toBe('nano')
    expect(getChannelTier(0)).toBe('nano')
  })
  it('returns micro for 1K-10K subs', () => {
    expect(getChannelTier(1000)).toBe('micro')
    expect(getChannelTier(9999)).toBe('micro')
  })
  it('returns small for 10K-100K subs', () => {
    expect(getChannelTier(10000)).toBe('small')
    expect(getChannelTier(99999)).toBe('small')
  })
  it('returns medium for 100K-1M subs', () => {
    expect(getChannelTier(100000)).toBe('medium')
    expect(getChannelTier(999999)).toBe('medium')
  })
  it('returns large for > 1M subs', () => {
    expect(getChannelTier(1000000)).toBe('large')
    expect(getChannelTier(5000000)).toBe('large')
  })
})

describe('scoreVideo', () => {
  const baseline: ChannelBaseline = {
    medianCtr: 5.0,
    medianRetention: 45,
    medianReach: 60,
    medianEngagement: 4.0,
    medianGrowth: 0,
    medianSubImpact: 0.5,
    channelDailyMean: 100,
    subscriberCount: 50000,
  }

  it('scores a high-performing video as A or B', () => {
    const input: VideoScoreInput = {
      videoId: 'test-1',
      publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      ctr: 8.0,
      avgViewPercentage: 55,
      impressions: 10000,
      trafficSources: { browse: 40, search: 25, suggested: 20, external: 10, direct: 3, notifications: 1, playlists: 1 },
      engagementRate: 6.5,
      dailyViews: Array.from({ length: 28 }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, '0')}`, views: 200 + i * 10 })),
      subscribersGained: 50,
      viewCount: 5000,
    }
    const result = scoreVideo(input, baseline)
    expect(result.grade).toMatch(/^[AB]$/)
    expect(result.overall).toBeGreaterThan(60)
    expect(result.axes).toHaveLength(6)
  })

  it('scores a low-performing video as C or D', () => {
    const input: VideoScoreInput = {
      videoId: 'test-2',
      publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      ctr: 2.0,
      avgViewPercentage: 25,
      impressions: 8000,
      trafficSources: { browse: 85, search: 5, suggested: 5, external: 3, direct: 1, notifications: 1, playlists: 0 },
      engagementRate: 1.5,
      dailyViews: Array.from({ length: 28 }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, '0')}`, views: 200 - i * 5 })),
      subscribersGained: 2,
      viewCount: 3000,
    }
    const result = scoreVideo(input, baseline)
    expect(result.grade).toMatch(/^[CD]$/)
    expect(result.overall).toBeLessThan(65)
  })

  it('applies channel tier modifiers — nano channel scores higher than large channel for same CTR', () => {
    const input: VideoScoreInput = {
      videoId: 'tier-test',
      publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      ctr: 5.0,
      avgViewPercentage: 45,
      impressions: 5000,
      trafficSources: { browse: 30, search: 20, suggested: 20, external: 15, direct: 5, notifications: 5, playlists: 5 },
      engagementRate: 4.0,
      dailyViews: Array.from({ length: 14 }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, '0')}`, views: 100 })),
      subscribersGained: 10,
      viewCount: 1400,
    }
    const nanoBaseline: ChannelBaseline = { ...baseline, subscriberCount: 500 }
    const largeBaseline: ChannelBaseline = { ...baseline, subscriberCount: 2000000 }
    const nanoResult = scoreVideo(input, nanoBaseline)
    const largeResult = scoreVideo(input, largeBaseline)
    expect(nanoResult.overall).toBeGreaterThan(largeResult.overall)
  })

  it('retention tier modifier shifts score meaningfully (not a no-op)', () => {
    const input: VideoScoreInput = {
      videoId: 'retention-tier-test',
      publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      ctr: 5.0,
      avgViewPercentage: 45,
      impressions: 5000,
      trafficSources: { browse: 30, search: 20, suggested: 20, external: 15, direct: 5, notifications: 5, playlists: 5 },
      engagementRate: 4.0,
      dailyViews: Array.from({ length: 14 }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, '0')}`, views: 100 })),
      subscribersGained: 10,
      viewCount: 1400,
    }
    // Nano gets +6 retention shift (midpoint lowered), large gets -5 (midpoint raised)
    const nanoBaseline: ChannelBaseline = { ...baseline, subscriberCount: 500 }
    const largeBaseline: ChannelBaseline = { ...baseline, subscriberCount: 2000000 }
    const nanoResult = scoreVideo(input, nanoBaseline)
    const largeResult = scoreVideo(input, largeBaseline)
    const nanoRetention = nanoResult.axes.find(a => a.axis === 'retention')!.normalized
    const largeRetention = largeResult.axes.find(a => a.axis === 'retention')!.normalized
    // The difference should be substantial (>5 points) not negligible (<1 point)
    expect(nanoRetention - largeRetention).toBeGreaterThan(5)
  })

  it('clamps NaN axis scores to 50 instead of propagating', () => {
    const input: VideoScoreInput = {
      videoId: 'nan-test',
      publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      ctr: NaN,
      avgViewPercentage: 45,
      impressions: 5000,
      trafficSources: { browse: 30, search: 20, suggested: 20, external: 15, direct: 5, notifications: 5, playlists: 5 },
      engagementRate: 4.0,
      dailyViews: Array.from({ length: 14 }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, '0')}`, views: 100 })),
      subscribersGained: 10,
      viewCount: 1400,
    }
    const result = scoreVideo(input, baseline)
    expect(Number.isNaN(result.overall)).toBe(false)
    const ctrAxis = result.axes.find(a => a.axis === 'ctr')!
    expect(Number.isNaN(ctrAxis.normalized)).toBe(false)
    expect(ctrAxis.normalized).toBe(50)
  })

  it('produces deterministic output for a known input (golden test)', () => {
    const input: VideoScoreInput = {
      videoId: 'golden-1',
      publishedAt: '2026-01-01T00:00:00Z',
      ctr: 5.0,
      avgViewPercentage: 45,
      impressions: 10000,
      trafficSources: { browse: 40, search: 25, suggested: 20, external: 10, direct: 3, notifications: 1, playlists: 1 },
      engagementRate: 4.0,
      dailyViews: Array.from({ length: 28 }, (_, i) => ({ date: `2026-04-${String(i + 1).padStart(2, '0')}`, views: 500 + i * 10 })),
      subscribersGained: 50,
      viewCount: 15000,
    }
    const goldenBaseline: ChannelBaseline = {
      medianCtr: 5.0,
      medianRetention: 45,
      medianReach: 50,
      medianEngagement: 4.0,
      medianGrowth: 0,
      medianSubImpact: 0.5,
      channelDailyMean: 500,
      subscriberCount: 50000,
    }
    const result = scoreVideo(input, goldenBaseline)
    expect(result.grade).toBe('B')
    expect(result.overall).toBeGreaterThan(60)
    expect(result.overall).toBeLessThan(75)
    expect(result.axes).toHaveLength(6)
    for (const axis of result.axes) {
      expect(axis.normalized).toBeGreaterThanOrEqual(1)
      expect(axis.normalized).toBeLessThanOrEqual(99)
    }
  })
})

describe('computeOutliers', () => {
  it('detects positive outlier when modified z > 2.5', () => {
    const scores = [50, 52, 48, 51, 49, 50, 53, 47, 50, 95]
    const outliers = computeOutliers(
      scores.map((s, i) => ({ videoId: `v${i}`, score: s })),
      'ctr',
    )
    expect(outliers.some(o => o.videoId === 'v9' && o.direction === 'positive')).toBe(true)
  })
  it('detects negative outlier', () => {
    const scores = [50, 52, 48, 51, 49, 50, 53, 47, 50, 5]
    const outliers = computeOutliers(
      scores.map((s, i) => ({ videoId: `v${i}`, score: s })),
      'ctr',
    )
    expect(outliers.some(o => o.videoId === 'v9' && o.direction === 'negative')).toBe(true)
  })
  it('returns empty for uniform distribution', () => {
    const scores = Array.from({ length: 10 }, (_, i) => ({ videoId: `v${i}`, score: 50 + i }))
    const outliers = computeOutliers(scores, 'ctr')
    expect(outliers).toHaveLength(0)
  })
  it('falls back to IQR when MAD=0 and still detects outliers', () => {
    // Majority at 50 (MAD=0), a few at 55 so IQR > 0, one extreme outlier at 99
    const scores = [50, 50, 50, 50, 50, 55, 55, 55, 55, 99]
    const outliers = computeOutliers(
      scores.map((s, i) => ({ videoId: `v${i}`, score: s })),
      'engagement',
    )
    expect(outliers.some(o => o.videoId === 'v9' && o.direction === 'positive')).toBe(true)
  })
  it('returns empty when all scores are truly identical (MAD=0, IQR=0)', () => {
    const scores = Array.from({ length: 10 }, (_, i) => ({ videoId: `v${i}`, score: 50 }))
    const outliers = computeOutliers(scores, 'ctr')
    expect(outliers).toHaveLength(0)
  })
  it('returns empty for fewer than 5 videos', () => {
    const scores = [10, 50, 50, 90].map((s, i) => ({ videoId: `v${i}`, score: s }))
    expect(computeOutliers(scores, 'ctr')).toHaveLength(0)
  })
})

describe('computeTrend', () => {
  it('detects upward trend', () => {
    const weeklyScores = [40, 45, 52, 60]
    const trend = computeTrend(weeklyScores)
    expect(trend.direction).toBe('up')
    expect(trend.velocity).toBeGreaterThan(0)
  })
  it('detects downward trend', () => {
    const weeklyScores = [80, 72, 65, 55]
    const trend = computeTrend(weeklyScores)
    expect(trend.direction).toBe('down')
    expect(trend.velocity).toBeLessThan(0)
  })
  it('returns flat for stable scores', () => {
    const weeklyScores = [50, 50.5, 49.8, 50.2]
    const trend = computeTrend(weeklyScores)
    expect(trend.direction).toBe('flat')
  })
  it('handles fewer than 4 weeks gracefully', () => {
    const trend = computeTrend([50, 52])
    expect(trend.direction).toBe('flat')
    expect(trend.streak).toBe(0)
  })
  it('computes trend with exactly 3 data points', () => {
    const result = computeTrend([60, 65, 70])
    expect(result.direction).toBe('up')
  })
})
