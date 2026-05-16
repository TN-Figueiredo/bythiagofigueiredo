import { describe, it, expect } from 'vitest'
import { computeEngagementScore } from '@/lib/analytics/engagement-score'

describe('computeEngagementScore', () => {
  it('returns 0 for zero views', () => {
    expect(computeEngagementScore({ views: 0, readsComplete: 0, avgDepth: 0, avgTime: 0 })).toBe(0)
  })

  it('returns 100 for perfect engagement', () => {
    expect(computeEngagementScore({
      views: 100,
      readsComplete: 100,
      avgDepth: 100,
      avgTime: 300,
    })).toBe(100)
  })

  it('weights completion at 40%', () => {
    // 50% completion, no depth, no time
    const score = computeEngagementScore({ views: 100, readsComplete: 50, avgDepth: 0, avgTime: 0 })
    expect(score).toBe(20) // 50 * 0.4 = 20
  })

  it('weights depth at 30%', () => {
    // No completion, 100% depth, no time
    const score = computeEngagementScore({ views: 100, readsComplete: 0, avgDepth: 100, avgTime: 0 })
    expect(score).toBe(30) // 100 * 0.3 = 30
  })

  it('weights time at 30% (capped at 300s)', () => {
    // No completion, no depth, 300s time
    const score = computeEngagementScore({ views: 100, readsComplete: 0, avgDepth: 0, avgTime: 300 })
    expect(score).toBe(30) // (300/300)*100 * 0.3 = 30
  })

  it('caps time at 300 seconds', () => {
    const a = computeEngagementScore({ views: 100, readsComplete: 0, avgDepth: 0, avgTime: 300 })
    const b = computeEngagementScore({ views: 100, readsComplete: 0, avgDepth: 0, avgTime: 600 })
    expect(a).toBe(b)
  })

  it('caps completion ratio at 1', () => {
    // More reads than views (duplicate read_complete events)
    const score = computeEngagementScore({ views: 10, readsComplete: 20, avgDepth: 0, avgTime: 0 })
    expect(score).toBe(40) // capped at 100% * 0.4
  })

  it('handles negative values gracefully', () => {
    const score = computeEngagementScore({ views: 100, readsComplete: 0, avgDepth: -10, avgTime: -5 })
    expect(score).toBe(0)
  })

  it('rounds to nearest integer', () => {
    const score = computeEngagementScore({ views: 100, readsComplete: 33, avgDepth: 45, avgTime: 120 })
    // completion: 33/100 * 100 * 0.4 = 13.2
    // depth: 45 * 0.3 = 13.5
    // time: (120/300)*100 * 0.3 = 12
    // total: 38.7 → 39
    expect(score).toBe(39)
  })
})
