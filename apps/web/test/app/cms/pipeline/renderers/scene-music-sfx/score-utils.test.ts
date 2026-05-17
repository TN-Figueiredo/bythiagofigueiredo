import { describe, it, expect } from 'vitest'
import {
  SCORE_HIGH,
  SCORE_MID,
  SCORE_LOW,
  getScoreColor,
  getScoreColorFromPercent,
  getBreakdownColor,
  computeScorePercent,
  getDeltaParts,
  formatDeltaTotal,
} from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-utils'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

describe('score threshold constants', () => {
  it('SCORE_HIGH is 75', () => {
    expect(SCORE_HIGH).toBe(75)
  })

  it('SCORE_MID is 50', () => {
    expect(SCORE_MID).toBe(50)
  })

  it('SCORE_LOW is 25', () => {
    expect(SCORE_LOW).toBe(25)
  })
})

/* ------------------------------------------------------------------ */
/*  computeScorePercent                                                */
/* ------------------------------------------------------------------ */

describe('computeScorePercent', () => {
  it('returns rounded percentage', () => {
    expect(computeScorePercent(26, 34)).toBe(76)
  })

  it('returns 0 for score=0', () => {
    expect(computeScorePercent(0, 34)).toBe(0)
  })

  it('returns 100 for full score', () => {
    expect(computeScorePercent(34, 34)).toBe(100)
  })

  it('returns 0 when max=0 (division guard)', () => {
    expect(computeScorePercent(5, 0)).toBe(0)
  })

  it('rounds correctly — 1/3 → 33 not 33.333', () => {
    expect(computeScorePercent(1, 3)).toBe(33)
  })

  it('rounds correctly — 2/3 → 67 not 66.666', () => {
    expect(computeScorePercent(2, 3)).toBe(67)
  })

  it('returns negative percent when max is negative (unguarded)', () => {
    // max < 0 is not guarded — documents actual behavior: 5 / -10 * 100 = -50
    expect(computeScorePercent(5, -10)).toBe(-50)
  })

  it('returns positive percent for negative score with negative max (unguarded)', () => {
    // -5 / -10 * 100 = 50 — two negatives cancel out
    expect(computeScorePercent(-5, -10)).toBe(50)
  })
})

/* ------------------------------------------------------------------ */
/*  getScoreColor                                                      */
/* ------------------------------------------------------------------ */

describe('getScoreColor', () => {
  it('returns green for 100%', () => {
    expect(getScoreColor(34, 34)).toBe('#10b981')
  })

  it('returns green for exactly 75%', () => {
    expect(getScoreColor(75, 100)).toBe('#10b981')
  })

  it('returns green for >75%', () => {
    expect(getScoreColor(26, 34)).toBe('#10b981')
  })

  it('returns amber for 50–74%', () => {
    expect(getScoreColor(17, 34)).toBe('#f59e0b')
  })

  it('returns amber for exactly 50%', () => {
    expect(getScoreColor(50, 100)).toBe('#f59e0b')
  })

  it('returns orange for 25–49%', () => {
    expect(getScoreColor(10, 34)).toBe('#f97316')
  })

  it('returns orange for exactly 25%', () => {
    expect(getScoreColor(25, 100)).toBe('#f97316')
  })

  it('returns gray for <25%', () => {
    expect(getScoreColor(5, 34)).toBe('#6b7280')
  })

  it('returns gray when max=0', () => {
    expect(getScoreColor(0, 0)).toBe('#6b7280')
  })

  it('returns gray when max=0 even if score > 0', () => {
    expect(getScoreColor(10, 0)).toBe('#6b7280')
  })

  it('returns gray for NaN score (all comparisons fail)', () => {
    // NaN / 34 = NaN; NaN >= threshold is always false → falls to default gray
    expect(getScoreColor(NaN, 34)).toBe('#6b7280')
  })

  it('returns gray for NaN max (all comparisons fail)', () => {
    // NaN === 0 is false, so guard is skipped; 28 / NaN = NaN → falls to gray
    expect(getScoreColor(28, NaN)).toBe('#6b7280')
  })

  it('returns gray for negative max (unguarded — ratio becomes negative)', () => {
    // max !== 0 so guard is skipped; 5 / -10 = -0.5; all >= checks fail → gray
    expect(getScoreColor(5, -10)).toBe('#6b7280')
  })
})

/* ------------------------------------------------------------------ */
/*  getScoreColorFromPercent                                           */
/* ------------------------------------------------------------------ */

describe('getScoreColorFromPercent', () => {
  it('returns green for 100%', () => {
    expect(getScoreColorFromPercent(100)).toBe('#10b981')
  })

  it('returns green for exactly 75', () => {
    expect(getScoreColorFromPercent(75)).toBe('#10b981')
  })

  it('returns amber for 74', () => {
    expect(getScoreColorFromPercent(74)).toBe('#f59e0b')
  })

  it('returns amber for exactly 50', () => {
    expect(getScoreColorFromPercent(50)).toBe('#f59e0b')
  })

  it('returns orange for 49', () => {
    expect(getScoreColorFromPercent(49)).toBe('#f97316')
  })

  it('returns orange for exactly 25', () => {
    expect(getScoreColorFromPercent(25)).toBe('#f97316')
  })

  it('returns gray for 24', () => {
    expect(getScoreColorFromPercent(24)).toBe('#6b7280')
  })

  it('returns gray for 0', () => {
    expect(getScoreColorFromPercent(0)).toBe('#6b7280')
  })

  it('returns gray for negative values', () => {
    expect(getScoreColorFromPercent(-10)).toBe('#6b7280')
  })

  it('returns gray for NaN input (all comparisons fail)', () => {
    // NaN >= 75 is false, NaN >= 50 is false, NaN >= 25 is false → gray
    expect(getScoreColorFromPercent(NaN)).toBe('#6b7280')
  })
})

/* ------------------------------------------------------------------ */
/*  getBreakdownColor                                                  */
/* ------------------------------------------------------------------ */

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

  it('returns amber for exactly 50% (not greater)', () => {
    expect(getBreakdownColor(4, 8)).toBe('#f59e0b')
  })

  it('returns dim gray for score=0 with positive max', () => {
    expect(getBreakdownColor(0, 8)).toBe('#4b5563')
  })

  it('returns dim gray when max=0', () => {
    expect(getBreakdownColor(0, 0)).toBe('#4b5563')
  })

  it('returns dim gray when max=0 even if score > 0', () => {
    expect(getBreakdownColor(5, 0)).toBe('#4b5563')
  })

  it('returns amber for 1/max (low but non-zero)', () => {
    expect(getBreakdownColor(1, 10)).toBe('#f59e0b')
  })
})

/* ------------------------------------------------------------------ */
/*  getDeltaParts                                                      */
/* ------------------------------------------------------------------ */

describe('getDeltaParts', () => {
  it('returns empty array for undefined input', () => {
    expect(getDeltaParts(undefined)).toEqual([])
  })

  it('returns empty array for empty object', () => {
    expect(getDeltaParts({})).toEqual([])
  })

  it('filters out zero-value entries', () => {
    const result = getDeltaParts({ category: 0, mood: 2 })
    expect(result).toEqual([{ label: 'mood', value: 2 }])
  })

  it('filters out all entries if all are zero', () => {
    expect(getDeltaParts({ category: 0, tags: 0, mood: 0 })).toEqual([])
  })

  it('shortens known category labels', () => {
    const result = getDeltaParts({
      category: 1,
      bpm_in_range: -1,
      duration_in_range: 2,
      reuse_scenarios: 3,
      instruments: -2,
      description: 1,
    })
    expect(result).toEqual([
      { label: 'cat', value: 1 },
      { label: 'bpm', value: -1 },
      { label: 'dur', value: 2 },
      { label: 'reuse', value: 3 },
      { label: 'inst', value: -2 },
      { label: 'desc', value: 1 },
    ])
  })

  it('keeps labels that have a shortening (tags, mood, energy)', () => {
    const result = getDeltaParts({ tags: 1, mood: -1, energy: 2 })
    expect(result).toEqual([
      { label: 'tags', value: 1 },
      { label: 'mood', value: -1 },
      { label: 'energy', value: 2 },
    ])
  })

  it('passes through unknown keys unchanged', () => {
    const result = getDeltaParts({ novelty: 5 })
    expect(result).toEqual([{ label: 'novelty', value: 5 }])
  })

  it('includes negative values (not zero)', () => {
    const result = getDeltaParts({ mood: -3 })
    expect(result).toEqual([{ label: 'mood', value: -3 }])
  })

  it('shortens bpm_in_range, duration_in_range, and reuse_scenarios', () => {
    const parts = getDeltaParts({ bpm_in_range: -3, duration_in_range: 2, reuse_scenarios: 1 })
    expect(parts.map(p => p.label)).toEqual(['bpm', 'dur', 'reuse'])
  })
})

/* ------------------------------------------------------------------ */
/*  formatDeltaTotal                                                   */
/* ------------------------------------------------------------------ */

describe('formatDeltaTotal', () => {
  it('returns 0 for undefined input', () => {
    expect(formatDeltaTotal(undefined)).toBe(0)
  })

  it('returns 0 for empty object', () => {
    expect(formatDeltaTotal({})).toBe(0)
  })

  it('sums positive values', () => {
    expect(formatDeltaTotal({ category: 2, mood: 3, tags: 1 })).toBe(6)
  })

  it('sums mixed positive and negative values', () => {
    expect(formatDeltaTotal({ category: 2, mood: -1, tags: 3 })).toBe(4)
  })

  it('sums all-negative values', () => {
    expect(formatDeltaTotal({ category: -2, mood: -3 })).toBe(-5)
  })

  it('returns 0 when all values are zero', () => {
    expect(formatDeltaTotal({ category: 0, mood: 0 })).toBe(0)
  })

  it('handles single entry', () => {
    expect(formatDeltaTotal({ bpm_in_range: 7 })).toBe(7)
  })
})
