import { describe, it, expect } from 'vitest'
import {
  sigmoid,
  prepareAxisInput,
  computeGrowthVelocity,
  computeEvergreenBonus,
  getAxisWeights,
  scoreVideo,
  assignGrade,
  computeOutliers,
  computeTrend,
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
  it('applies log2 transform for reach', () => {
    expect(prepareAxisInput('reach', 1000)).toBeCloseTo(Math.log2(1001), 4)
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
})

describe('computeEvergreenBonus', () => {
  it('returns 0 for video younger than 90 days', () => {
    expect(computeEvergreenBonus(60, [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], 50)).toBe(0)
  })
  it('returns 0 if below channel mean', () => {
    expect(computeEvergreenBonus(120, [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20], 50)).toBe(0)
  })
  it('returns bonus 3-8 for qualifying evergreen', () => {
    const views = Array.from({ length: 14 }, () => 100)
    const bonus = computeEvergreenBonus(120, views, 50)
    expect(bonus).toBeGreaterThanOrEqual(3)
    expect(bonus).toBeLessThanOrEqual(8)
  })
  it('returns 0 if high variance (CV > 0.8)', () => {
    const views = [10, 200, 5, 300, 8, 250, 3, 180, 15, 220, 7, 190, 4, 210]
    expect(computeEvergreenBonus(120, views, 50)).toBe(0)
  })
})

describe('getAxisWeights', () => {
  it('returns standard weights for 30-day video', () => {
    const w = getAxisWeights(30)
    expect(w.growth).toBe(0.12)
    expect(w.ctr + w.retention + w.reach + w.engagement + w.growth + w.sub_impact).toBeCloseTo(1.0)
  })
  it('reduces growth weight for fresh video (<=14 days)', () => {
    const w = getAxisWeights(7)
    expect(w.growth).toBe(0.04)
    expect(w.ctr).toBe(0.29)
    expect(w.ctr + w.retention + w.reach + w.engagement + w.growth + w.sub_impact).toBeCloseTo(1.0)
  })
})

describe('assignGrade', () => {
  it('assigns A for score >= 85', () => expect(assignGrade(90)).toBe('A'))
  it('assigns B for score >= 65', () => expect(assignGrade(72)).toBe('B'))
  it('assigns C for score >= 40', () => expect(assignGrade(50)).toBe('C'))
  it('assigns D for score < 40', () => expect(assignGrade(30)).toBe('D'))
})

describe('scoreVideo', () => {
  const baseline: ChannelBaseline = {
    medianCtr: 5.0,
    medianRetention: 45,
    medianReach: 5000,
    medianEngagement: 4.0,
    medianGrowth: 0,
    medianSubImpact: 0.5,
    channelDailyMean: 100,
    subscriberCount: 5000,
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
})
