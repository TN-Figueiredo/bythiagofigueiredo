import { describe, it, expect } from 'vitest'
import {
  checkRateBudget,
  parseAppUsageHeader,
  remainingFromUsage,
  type RateBudget,
} from '@tn-figueiredo/social/providers/meta'

// ---------------------------------------------------------------------------
// checkRateBudget
// ---------------------------------------------------------------------------

describe('checkRateBudget', () => {
  it('requires 2 API calls per slide', () => {
    const result = checkRateBudget(10, 3)
    expect(result.required).toBe(6) // 3 slides × 2
  })

  it('returns sufficient=true when remaining equals required exactly', () => {
    const result = checkRateBudget(4, 2) // 4 remaining, 2×2=4 required
    expect(result.sufficient).toBe(true)
  })

  it('returns sufficient=true when remaining exceeds required', () => {
    const result = checkRateBudget(20, 5) // 20 remaining, 5×2=10 required
    expect(result.sufficient).toBe(true)
    expect(result.remaining).toBe(20)
    expect(result.required).toBe(10)
  })

  it('returns sufficient=false when remaining is less than required', () => {
    const result = checkRateBudget(3, 2) // 3 remaining, 2×2=4 required
    expect(result.sufficient).toBe(false)
  })

  it('returns sufficient=false when remaining is 0', () => {
    const result = checkRateBudget(0, 1)
    expect(result.sufficient).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.required).toBe(2)
  })

  it('returns sufficient=true for 0 slides with any remaining (edge case)', () => {
    const result = checkRateBudget(0, 0) // 0 remaining, 0×2=0 required; 0>=0 is true
    expect(result.sufficient).toBe(true)
    expect(result.required).toBe(0)
  })

  it('reflects correct remaining in result', () => {
    const result = checkRateBudget(42, 10)
    expect(result.remaining).toBe(42)
  })

  it('single slide requires 2 calls', () => {
    const result = checkRateBudget(1, 1) // 1 remaining, 1×2=2 required
    expect(result.sufficient).toBe(false)
    expect(result.required).toBe(2)
  })

  it('10 slides (max) requires 20 calls', () => {
    const result = checkRateBudget(20, 10)
    expect(result.required).toBe(20)
    expect(result.sufficient).toBe(true)
  })

  it('10 slides with 19 remaining is insufficient', () => {
    const result = checkRateBudget(19, 10)
    expect(result.sufficient).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// parseAppUsageHeader
// ---------------------------------------------------------------------------

describe('parseAppUsageHeader', () => {
  it('returns null for null input', () => {
    expect(parseAppUsageHeader(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseAppUsageHeader('')).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseAppUsageHeader('not-json')).toBeNull()
    expect(parseAppUsageHeader('{invalid}')).toBeNull()
  })

  it('parses valid JSON with all fields', () => {
    const header = JSON.stringify({ call_count: 30, total_cputime: 15, total_time: 25 })
    const result = parseAppUsageHeader(header)

    expect(result).toEqual({
      callCount: 30,
      totalCpuTime: 15,
      totalTime: 25,
    })
  })

  it('defaults missing fields to 0', () => {
    const header = JSON.stringify({})
    const result = parseAppUsageHeader(header)

    expect(result).toEqual({
      callCount: 0,
      totalCpuTime: 0,
      totalTime: 0,
    })
  })

  it('handles partial fields — only call_count present', () => {
    const header = JSON.stringify({ call_count: 50 })
    const result = parseAppUsageHeader(header)

    expect(result?.callCount).toBe(50)
    expect(result?.totalCpuTime).toBe(0)
    expect(result?.totalTime).toBe(0)
  })

  it('handles call_count at 0', () => {
    const header = JSON.stringify({ call_count: 0, total_cputime: 0, total_time: 0 })
    const result = parseAppUsageHeader(header)

    expect(result?.callCount).toBe(0)
  })

  it('handles call_count at 100 (full usage)', () => {
    const header = JSON.stringify({ call_count: 100, total_cputime: 100, total_time: 100 })
    const result = parseAppUsageHeader(header)

    expect(result?.callCount).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// remainingFromUsage
// ---------------------------------------------------------------------------

describe('remainingFromUsage', () => {
  const usage = (callCount: number): RateBudget => ({
    callCount,
    totalCpuTime: 0,
    totalTime: 0,
  })

  it('returns 100 when no calls used', () => {
    expect(remainingFromUsage(usage(0))).toBe(100)
  })

  it('returns 0 when all 100 calls used', () => {
    expect(remainingFromUsage(usage(100))).toBe(0)
  })

  it('returns correct remaining for partial usage', () => {
    expect(remainingFromUsage(usage(30))).toBe(70)
    expect(remainingFromUsage(usage(75))).toBe(25)
  })

  it('clamps to 0 when callCount exceeds 100 (never negative)', () => {
    expect(remainingFromUsage(usage(150))).toBe(0)
  })

  it('returns 1 at boundary (99 calls used)', () => {
    expect(remainingFromUsage(usage(99))).toBe(1)
  })
})
