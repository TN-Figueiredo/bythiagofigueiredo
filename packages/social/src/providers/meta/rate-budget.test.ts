import { describe, it, expect } from 'vitest'
import {
  checkRateBudget,
  parseAppUsageHeader,
  remainingFromUsage,
  type RateBudget,
} from './rate-budget.js'

describe('checkRateBudget', () => {
  it('requires 2 calls per slide (create + publish)', () => {
    expect(checkRateBudget(100, 4)).toEqual({
      sufficient: true,
      remaining: 100,
      required: 8,
    })
  })

  it('is sufficient at the exact boundary (remaining === required)', () => {
    expect(checkRateBudget(6, 3).sufficient).toBe(true)
  })

  it('is insufficient one call below the boundary', () => {
    expect(checkRateBudget(5, 3).sufficient).toBe(false)
  })

  it('handles zero slides (required 0, always sufficient)', () => {
    expect(checkRateBudget(0, 0)).toEqual({
      sufficient: true,
      remaining: 0,
      required: 0,
    })
  })
})

describe('parseAppUsageHeader', () => {
  it('returns null for null/empty input', () => {
    expect(parseAppUsageHeader(null)).toBeNull()
    expect(parseAppUsageHeader('')).toBeNull()
  })

  it('parses the Meta x-app-usage JSON shape', () => {
    const header = JSON.stringify({
      call_count: 42,
      total_cputime: 13,
      total_time: 27,
    })
    expect(parseAppUsageHeader(header)).toEqual({
      callCount: 42,
      totalCpuTime: 13,
      totalTime: 27,
    })
  })

  it('defaults missing fields to 0', () => {
    expect(parseAppUsageHeader('{}')).toEqual({
      callCount: 0,
      totalCpuTime: 0,
      totalTime: 0,
    })
  })

  it('returns null on malformed JSON instead of throwing', () => {
    expect(parseAppUsageHeader('not-json{')).toBeNull()
  })
})

describe('remainingFromUsage', () => {
  const usage = (callCount: number): RateBudget => ({
    callCount,
    totalCpuTime: 0,
    totalTime: 0,
  })

  it('subtracts used calls from the 100/day IG limit', () => {
    expect(remainingFromUsage(usage(30))).toBe(70)
  })

  it('never returns a negative remaining (clamped at 0)', () => {
    expect(remainingFromUsage(usage(150))).toBe(0)
  })

  it('returns the full limit when nothing was used', () => {
    expect(remainingFromUsage(usage(0))).toBe(100)
  })
})
