import { describe, it, expect } from 'vitest'
import { computeP90, blendVelocity, buildVelocityMap } from '../../src/lib/pipeline/velocity'
import { EFFORT_DEFAULTS } from '../../src/lib/pipeline/up-next-constants'
import type { VelocityTransitionRow } from '../../src/lib/pipeline/up-next-types'

// ---------------------------------------------------------------------------
// computeP90
// ---------------------------------------------------------------------------

describe('computeP90', () => {
  it('single element returns that value', () => {
    expect(computeP90([42])).toBe(42)
  })

  it('10 elements: P90 index = ceil(0.9*N)-1 after sort', () => {
    // sorted: [1,2,3,4,5,6,7,8,9,10], index = ceil(0.9*10)-1 = 9-1 = 8 → value 9
    const values = [10, 3, 1, 7, 5, 9, 2, 8, 4, 6]
    expect(computeP90(values)).toBe(9)
  })

  it('unsorted input computes correctly', () => {
    // sorted: [1,2,3,4,5], index = ceil(0.9*5)-1 = 5-1 = 4 → value 5
    expect(computeP90([5, 3, 1, 4, 2])).toBe(5)
  })

  it('2 elements returns max', () => {
    // sorted: [3,7], index = ceil(0.9*2)-1 = 2-1 = 1 → value 7
    expect(computeP90([7, 3])).toBe(7)
  })

  it('empty array throws', () => {
    expect(() => computeP90([])).toThrow('computeP90: empty array')
  })

  it('identical values returns that value', () => {
    expect(computeP90([5, 5, 5, 5, 5])).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// blendVelocity
// ---------------------------------------------------------------------------

describe('blendVelocity', () => {
  it('sampleCount=0 returns defaultMinutes', () => {
    expect(blendVelocity(0, 120, 60)).toBe(60)
  })

  it('sampleCount>=10 returns pure historicalMedian', () => {
    expect(blendVelocity(10, 120, 60)).toBe(120)
  })

  it('sampleCount=5 weight=0.5, linear interpolation', () => {
    // weight=0.5 → 0.5*120 + 0.5*60 = 90
    expect(blendVelocity(5, 120, 60)).toBe(90)
  })

  it('sampleCount=3 weight=0.3', () => {
    // weight=0.3 → round(0.3*120 + 0.7*60) = round(36 + 42) = 78
    expect(blendVelocity(3, 120, 60)).toBe(78)
  })

  it('sampleCount=1 weight=0.1', () => {
    // weight=0.1 → round(0.1*120 + 0.9*60) = round(12 + 54) = 66
    expect(blendVelocity(1, 120, 60)).toBe(66)
  })

  it('sampleCount=100 caps at weight=1 (pure historical)', () => {
    expect(blendVelocity(100, 120, 60)).toBe(120)
  })
})

// ---------------------------------------------------------------------------
// buildVelocityMap helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<VelocityTransitionRow> & { pipeline_id: string; from_value: string; to_value: string; changed_at: string }): VelocityTransitionRow {
  return {
    format: 'video',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildVelocityMap
// ---------------------------------------------------------------------------

describe('buildVelocityMap', () => {
  it('empty input returns empty map', () => {
    expect(buildVelocityMap([])).toEqual({})
  })

  it('two consecutive transitions: duration = row[1].changed_at - row[0].changed_at, key = format:from_value of row[1]', () => {
    const rows: VelocityTransitionRow[] = [
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-01-01T00:00:00Z' }),
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-01-01T02:00:00Z' }), // 120 min
    ]
    const map = buildVelocityMap(rows)
    // key is format:from_value of second row → 'video:outline'
    expect(map['video:outline']).toBeDefined()
    expect(map['video:outline']!.medianMinutes).toBe(120)
    expect(map['video:outline']!.sampleCount).toBe(1)
  })

  it('3 pipelines with same stage computes median and P90', () => {
    // Three pipelines each spending different times in 'idea' stage
    const rows: VelocityTransitionRow[] = [
      // pipeline 1: 60 min in idea
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-01-01T00:00:00Z' }),
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-01-01T01:00:00Z' }),
      // pipeline 2: 120 min in idea
      makeRow({ pipeline_id: 'p2', from_value: 'idea', to_value: 'outline', changed_at: '2026-01-01T00:00:00Z' }),
      makeRow({ pipeline_id: 'p2', from_value: 'outline', to_value: 'draft', changed_at: '2026-01-01T02:00:00Z' }),
      // pipeline 3: 180 min in idea
      makeRow({ pipeline_id: 'p3', from_value: 'idea', to_value: 'outline', changed_at: '2026-01-01T00:00:00Z' }),
      makeRow({ pipeline_id: 'p3', from_value: 'outline', to_value: 'draft', changed_at: '2026-01-01T03:00:00Z' }),
    ]
    const map = buildVelocityMap(rows)
    const entry = map['video:idea']
    // durations in 'idea': not present since we need the transition INTO outline to measure idea time
    // Actually: key is format:from_value of the CURRENT row (row[i])
    // row[1] for p1: from_value='outline', duration=60 → key='video:outline'
    // row[1] for p2: from_value='outline', duration=120 → key='video:outline'
    // row[1] for p3: from_value='outline', duration=180 → key='video:outline'
    const outlineEntry = map['video:outline']
    expect(outlineEntry).toBeDefined()
    expect(outlineEntry!.sampleCount).toBe(3)
    // sorted: [60, 120, 180], median=120
    expect(outlineEntry!.medianMinutes).toBe(120)
    // P90: ceil(0.9*3)-1 = 3-1 = 2 → 180
    expect(outlineEntry!.p90Minutes).toBe(180)
  })

  it('cold-start blending uses EFFORT_DEFAULTS when sampleCount < 10', () => {
    // 1 sample for 'video:outline'
    // key = curr.from_value of the second row → need second row to have from_value='outline'
    // duration = row[1].changed_at - row[0].changed_at = 60 min
    const defaultMinutes = EFFORT_DEFAULTS['video:outline']?.minutes ?? 60 // 120
    const rows: VelocityTransitionRow[] = [
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-01-01T00:00:00Z' }),
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-01-01T01:00:00Z' }), // 60 min; key='video:outline'
    ]
    const map = buildVelocityMap(rows)
    const entry = map['video:outline']
    expect(entry).toBeDefined()
    expect(entry!.sampleCount).toBe(1)
    // historicalMedian=60, weight=0.1 → round(0.1*60 + 0.9*defaultMinutes)
    const expected = Math.round(0.1 * 60 + 0.9 * defaultMinutes)
    expect(entry!.effectiveMinutes).toBe(expected)
  })

  it('sampleCount>=10 uses pure historical median as effectiveMinutes', () => {
    // 10 pipelines each spending 60 min transitioning through 'outline'
    // key = curr.from_value of second row → must be 'outline'
    const rows: VelocityTransitionRow[] = []
    for (let i = 0; i < 10; i++) {
      rows.push(makeRow({ pipeline_id: `p${i}`, from_value: 'idea', to_value: 'outline', changed_at: '2026-01-01T00:00:00Z' }))
      rows.push(makeRow({ pipeline_id: `p${i}`, from_value: 'outline', to_value: 'draft', changed_at: '2026-01-01T01:00:00Z' })) // 60 min; key='video:outline'
    }
    const map = buildVelocityMap(rows)
    const entry = map['video:outline']
    expect(entry).toBeDefined()
    expect(entry!.sampleCount).toBe(10)
    expect(entry!.effectiveMinutes).toBe(entry!.medianMinutes)
  })

  it('multiple stages for same pipeline are tracked independently', () => {
    // p1 goes idea→outline (60 min) then outline→draft (120 min)
    const rows: VelocityTransitionRow[] = [
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-01-01T00:00:00Z' }),
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-01-01T01:00:00Z' }), // 60 min in idea
      makeRow({ pipeline_id: 'p1', from_value: 'draft', to_value: 'roteiro', changed_at: '2026-01-01T03:00:00Z' }), // 120 min in outline... wait: key is from_value of curr row
    ]
    // row[1]: from_value='outline', duration=60min → 'video:outline'  (time spent in idea stage measured as transition to outline)
    // actually: key = curr.from_value
    // row[1] from_value='outline', so key='video:outline', duration = row[1]-row[0] = 60 min
    // row[2] from_value='draft', so key='video:draft', duration = row[2]-row[1] = 120 min
    const map = buildVelocityMap(rows)
    expect(map['video:outline']).toBeDefined()
    expect(map['video:outline']!.medianMinutes).toBe(60)
    expect(map['video:draft']).toBeDefined()
    expect(map['video:draft']!.medianMinutes).toBe(120)
  })

  it('negative duration (clock skew) is ignored', () => {
    const rows: VelocityTransitionRow[] = [
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-01-01T02:00:00Z' }),
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-01-01T01:00:00Z' }), // earlier timestamp = negative duration
    ]
    const map = buildVelocityMap(rows)
    expect(map['video:outline']).toBeUndefined()
  })

  it('duration > 30 days is ignored', () => {
    const rows: VelocityTransitionRow[] = [
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-01-01T00:00:00Z' }),
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-02-15T00:00:00Z' }), // ~45 days
    ]
    const map = buildVelocityMap(rows)
    expect(map['video:outline']).toBeUndefined()
  })

  it('separates durations by format (video vs blog_post)', () => {
    const rows: VelocityTransitionRow[] = [
      makeRow({ pipeline_id: 'p1', format: 'video', from_value: 'outline', to_value: 'draft', changed_at: '2026-01-01T00:00:00Z' }),
      makeRow({ pipeline_id: 'p1', format: 'video', from_value: 'draft', to_value: 'roteiro', changed_at: '2026-01-01T01:00:00Z' }), // 60 min as 'video:draft'? No:
      // row[1] from_value='draft', duration=60 → key='video:draft'
      // Separate pipeline for blog_post
      makeRow({ pipeline_id: 'p2', format: 'blog_post', from_value: 'outline', to_value: 'draft', changed_at: '2026-01-01T00:00:00Z' }),
      makeRow({ pipeline_id: 'p2', format: 'blog_post', from_value: 'draft', to_value: 'ready', changed_at: '2026-01-01T03:00:00Z' }), // 180 min as 'blog_post:draft'
    ]
    const map = buildVelocityMap(rows)
    expect(map['video:draft']).toBeDefined()
    expect(map['blog_post:draft']).toBeDefined()
    expect(map['video:draft']!.medianMinutes).toBe(60)
    expect(map['blog_post:draft']!.medianMinutes).toBe(180)
  })
})
