import { describe, it, expect } from 'vitest'
import { detectFatigue, filterFatigueCandidates } from '@/lib/youtube/ab-fatigue'

describe('detectFatigue', () => {
  const publishedAt = new Date(Date.now() - 90 * 86400000).toISOString()

  function generateDailyMetrics(days: number, baseCtr: number, decay = 0): Array<{ date: string; ctr: number; views: number }> {
    return Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.now() - (days - i) * 86400000).toISOString().slice(0, 10),
      ctr: Math.max(baseCtr - decay * i, 0.001),
      views: 500,
    }))
  }

  it('returns null with fewer than 30 valid data points', () => {
    const metrics = generateDailyMetrics(20, 0.05)
    expect(detectFatigue(metrics, publishedAt)).toBeNull()
  })

  it('returns not fatigued for stable CTR', () => {
    const metrics = generateDailyMetrics(60, 0.05)
    const result = detectFatigue(metrics, publishedAt)
    expect(result).not.toBeNull()
    expect(result!.isFatigued).toBe(false)
  })

  it('detects fatigue when CTR drops sharply in last 7 days', () => {
    const stable = generateDailyMetrics(53, 0.05)
    const dropping = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (7 - i) * 86400000).toISOString().slice(0, 10),
      ctr: 0.02 - i * 0.002, // sharp drop
      views: 500,
    }))
    const metrics = [...stable, ...dropping]
    const result = detectFatigue(metrics, publishedAt)
    expect(result).not.toBeNull()
    expect(result!.isFatigued).toBe(true)
    expect(result!.zScore).toBeLessThan(-1.5)
  })

  it('returns expectedCtr and actualCtr', () => {
    const metrics = generateDailyMetrics(60, 0.05)
    const result = detectFatigue(metrics, publishedAt)
    expect(result).not.toBeNull()
    expect(result!.expectedCtr).toBeGreaterThan(0)
    expect(result!.actualCtr).toBeGreaterThan(0)
  })

  it('filters out days with views < 100', () => {
    const metrics = Array.from({ length: 60 }, (_, i) => ({
      date: new Date(Date.now() - (60 - i) * 86400000).toISOString().slice(0, 10),
      ctr: 0.05,
      views: i < 30 ? 50 : 500, // first 30 days have low views
    }))
    const result = detectFatigue(metrics, publishedAt)
    expect(result).not.toBeNull() // still works with 30 valid days
  })
})

describe('filterFatigueCandidates', () => {
  it('excludes videos younger than 30 days', () => {
    const videos = [
      { id: 'old', published_at: new Date(Date.now() - 60 * 86400000).toISOString(), view_count: 5000 },
      { id: 'new', published_at: new Date(Date.now() - 10 * 86400000).toISOString(), view_count: 5000 },
    ]
    const result = filterFatigueCandidates(videos, new Set())
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('old')
  })

  it('excludes videos with active tests', () => {
    const videos = [
      { id: 'v1', published_at: new Date(Date.now() - 60 * 86400000).toISOString(), view_count: 5000 },
    ]
    const result = filterFatigueCandidates(videos, new Set(['v1']))
    expect(result).toHaveLength(0)
  })
})
