import { describe, it, expect } from 'vitest'
import { computeFanScore, type FanScoreInput } from '@/lib/social/fan-scoring'

describe('computeFanScore', () => {
  it('computes max score for highly active cross-platform fan', () => {
    const input: FanScoreInput = {
      totalInteractions: 50,
      platformCount: 4,
      activeDays: 30,
      lastSeenDaysAgo: 0,
    }
    const score = computeFanScore(input)
    expect(score).toBe(100)
  })

  it('computes minimum score for single-interaction fan', () => {
    const input: FanScoreInput = {
      totalInteractions: 1,
      platformCount: 1,
      activeDays: 1,
      lastSeenDaysAgo: 30,
    }
    const score = computeFanScore(input)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(30)
  })

  it('caps frequency at 50 interactions', () => {
    const input1: FanScoreInput = {
      totalInteractions: 50, platformCount: 1, activeDays: 1, lastSeenDaysAgo: 0,
    }
    const input2: FanScoreInput = {
      totalInteractions: 100, platformCount: 1, activeDays: 1, lastSeenDaysAgo: 0,
    }
    expect(computeFanScore(input1)).toBe(computeFanScore(input2))
  })

  it('recency decays 1 point per day after 7 days', () => {
    const recent: FanScoreInput = {
      totalInteractions: 10, platformCount: 1, activeDays: 5, lastSeenDaysAgo: 0,
    }
    const weekOld: FanScoreInput = { ...recent, lastSeenDaysAgo: 14 }
    const diff = computeFanScore(recent) - computeFanScore(weekOld)
    expect(diff).toBe(14)
  })

  it('recency boundary: exactly 7 days ago starts decaying (matches SQL source of truth)', () => {
    // At 6 days: full 25 points (< 7 is TRUE)
    const sixDays: FanScoreInput = {
      totalInteractions: 10, platformCount: 1, activeDays: 5, lastSeenDaysAgo: 6,
    }
    // At 7 days: decay starts (< 7 is FALSE) → 25 - 7 = 18
    const sevenDays: FanScoreInput = { ...sixDays, lastSeenDaysAgo: 7 }
    const diff = computeFanScore(sixDays) - computeFanScore(sevenDays)
    // 25 - 18 = 7 points difference
    expect(diff).toBe(7)
  })
})
