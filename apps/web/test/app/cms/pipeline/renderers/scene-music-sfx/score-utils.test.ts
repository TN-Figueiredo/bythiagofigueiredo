import { describe, it, expect } from 'vitest'
import {
  getScoreColor,
  getBreakdownColor,
  computeGaugeDasharray,
  computeScorePercent,
  formatDeltaNotes,
} from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-utils'

describe('getScoreColor', () => {
  it('returns green for 100%', () => {
    expect(getScoreColor(34, 34)).toBe('#10b981')
  })

  it('returns green for >=75%', () => {
    expect(getScoreColor(26, 34)).toBe('#10b981')
  })

  it('returns amber for 50-74%', () => {
    expect(getScoreColor(17, 34)).toBe('#f59e0b')
  })

  it('returns orange for 25-49%', () => {
    expect(getScoreColor(10, 34)).toBe('#f97316')
  })

  it('returns gray for <25%', () => {
    expect(getScoreColor(5, 34)).toBe('#6b7280')
  })
})

describe('getBreakdownColor', () => {
  it('returns bright green for full score (N/N)', () => {
    expect(getBreakdownColor(8, 8)).toBe('#10b981')
  })

  it('returns light green for >50%', () => {
    expect(getBreakdownColor(5, 8)).toBe('#34d399')
  })

  it('returns amber for <=50% and >0', () => {
    expect(getBreakdownColor(2, 6)).toBe('#f59e0b')
  })

  it('returns dim gray for 0/N', () => {
    expect(getBreakdownColor(0, 8)).toBe('#4b5563')
  })
})

describe('computeGaugeDasharray', () => {
  it('returns correct dasharray for 50%', () => {
    const result = computeGaugeDasharray(17, 34)
    expect(result.filled).toBeCloseTo(47, 0)
    expect(result.empty).toBeCloseTo(47, 0)
  })

  it('returns full arc for 100%', () => {
    const result = computeGaugeDasharray(34, 34)
    expect(result.filled).toBeCloseTo(94, 0)
    expect(result.empty).toBeCloseTo(0, 0)
  })

  it('returns empty arc for 0', () => {
    const result = computeGaugeDasharray(0, 34)
    expect(result.filled).toBe(0)
    expect(result.empty).toBeCloseTo(94, 0)
  })
})

describe('computeScorePercent', () => {
  it('returns rounded percentage', () => {
    expect(computeScorePercent(26, 34)).toBe(76)
  })

  it('returns 0 for 0 score', () => {
    expect(computeScorePercent(0, 34)).toBe(0)
  })

  it('returns 100 for max score', () => {
    expect(computeScorePercent(34, 34)).toBe(100)
  })
})

describe('formatDeltaNotes', () => {
  it('formats negative deltas with category labels', () => {
    const delta = { tags: -2, mood: -2, reuse_scenarios: -4 }
    const result = formatDeltaNotes(delta)
    expect(result).toContain('tags −2')
    expect(result).toContain('mood −2')
    expect(result).toContain('reuse −4')
  })

  it('returns empty string for empty delta', () => {
    expect(formatDeltaNotes({})).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatDeltaNotes(undefined)).toBe('')
  })
})
