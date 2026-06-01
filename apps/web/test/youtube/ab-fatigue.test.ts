import { describe, it, expect } from 'vitest'
import { detectFatigue, filterFatigueCandidates } from '@/lib/youtube/ab-fatigue'

describe('detectFatigue', () => {
  const publishedAt = new Date(Date.now() - 90 * 86400000).toISOString()

  function generateDailyMetrics(days: number, baseViews: number, decay = 0): Array<{ date: string; views: number }> {
    return Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.now() - (days - i) * 86400000).toISOString().slice(0, 10),
      views: Math.max(baseViews - decay * i, 1),
    }))
  }

  it('returns null with fewer than 30 valid data points', () => {
    const metrics = generateDailyMetrics(20, 500)
    expect(detectFatigue(metrics, publishedAt)).toBeNull()
  })

  it('returns not fatigued for stable views', () => {
    const metrics = generateDailyMetrics(60, 500)
    const result = detectFatigue(metrics, publishedAt)
    expect(result).not.toBeNull()
    expect(result!.isFatigued).toBe(false)
  })

  it('detects fatigue when views drop sharply in last 7 days', () => {
    const stable = generateDailyMetrics(53, 500)
    const dropping = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (7 - i) * 86400000).toISOString().slice(0, 10),
      views: 100 - i * 12, // sharp drop
    }))
    const metrics = [...stable, ...dropping]
    const result = detectFatigue(metrics, publishedAt)
    expect(result).not.toBeNull()
    expect(result!.isFatigued).toBe(true)
    expect(result!.zScore).toBeLessThan(-1.5)
  })

  it('returns expectedViews and actualViews', () => {
    const metrics = generateDailyMetrics(60, 500)
    const result = detectFatigue(metrics, publishedAt)
    expect(result).not.toBeNull()
    expect(result!.expectedViews).toBeGreaterThan(0)
    expect(result!.actualViews).toBeGreaterThan(0)
  })

  it('filters out days with views < 50', () => {
    const metrics = Array.from({ length: 60 }, (_, i) => ({
      date: new Date(Date.now() - (60 - i) * 86400000).toISOString().slice(0, 10),
      views: i < 30 ? 20 : 500, // first 30 days have low views
    }))
    const result = detectFatigue(metrics, publishedAt)
    expect(result).not.toBeNull() // still works with 30 valid days
  })

  it('returns null for video with all views below threshold (50)', () => {
    const metrics = Array.from({ length: 60 }, (_, i) => ({
      date: new Date(Date.now() - (60 - i) * 86400000).toISOString().slice(0, 10),
      views: 30, // all below 50 threshold
    }))
    const result = detectFatigue(metrics, publishedAt)
    expect(result).toBeNull()
  })

  it('handles exactly 30 valid days (minimum threshold)', () => {
    // 30 days with views >= 50 (valid) + 10 days below threshold (filtered out)
    const metrics = Array.from({ length: 40 }, (_, i) => ({
      date: new Date(Date.now() - (40 - i) * 86400000).toISOString().slice(0, 10),
      views: i < 10 ? 20 : 500, // first 10 invalid, last 30 valid
    }))
    const result = detectFatigue(metrics, publishedAt)
    expect(result).not.toBeNull()
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
