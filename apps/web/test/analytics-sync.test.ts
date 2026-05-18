import { describe, it, expect } from 'vitest'
import {
  computeViewDeltas,
  detectViral,
  getIsoWeek,
} from '@/lib/youtube/analytics-sync'

describe('computeViewDeltas', () => {
  it('computes delta from previous count', () => {
    const result = computeViewDeltas(1500, 1000, 400)
    expect(result.delta_today).toBe(500)
    expect(result.yesterday).toBe(400)
  })
  it('handles first sync (no previous data)', () => {
    const result = computeViewDeltas(1000, 0, 0)
    expect(result.delta_today).toBe(1000)
    expect(result.yesterday).toBe(0)
  })
  it('handles no change', () => {
    const result = computeViewDeltas(1000, 1000, 200)
    expect(result.delta_today).toBe(0)
    expect(result.yesterday).toBe(200)
  })
})

describe('detectViral', () => {
  it('detects viral when 48h views >= 5x channel avg', () => {
    expect(detectViral(5000, 800, 200)).toBe(true)
  })
  it('does not flag below threshold', () => {
    expect(detectViral(400, 200, 200)).toBe(false)
  })
  it('handles zero channel average', () => {
    expect(detectViral(100, 0, 0)).toBe(false)
  })
})

describe('getIsoWeek', () => {
  it('returns correct ISO week string', () => {
    const result = getIsoWeek(new Date('2026-05-17'))
    expect(result).toMatch(/^2026-W\d{2}$/)
  })
})
