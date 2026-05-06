import { describe, it, expect } from 'vitest'
import { buildHeatmap } from './time-heatmap.js'

describe('buildHeatmap', () => {
  it('returns 7x24 matrix', () => {
    const heatmap = buildHeatmap([])
    expect(heatmap.matrix).toHaveLength(7)
    for (const row of heatmap.matrix) {
      expect(row).toHaveLength(24)
    }
  })

  it('correctly maps Monday timestamps', () => {
    // 2026-05-04 is a Monday, 14:00 UTC
    const timestamps = [new Date('2026-05-04T14:00:00Z')]
    const heatmap = buildHeatmap(timestamps)
    expect(heatmap.matrix[0]![14]).toBe(1) // Monday=0, hour=14
    expect(heatmap.total).toBe(1)
    expect(heatmap.max).toBe(1)
  })

  it('correctly maps Sunday timestamps', () => {
    // 2026-05-03 is a Sunday, 09:00 UTC
    const timestamps = [new Date('2026-05-03T09:00:00Z')]
    const heatmap = buildHeatmap(timestamps)
    expect(heatmap.matrix[6]![9]).toBe(1) // Sunday=6, hour=9
  })

  it('correctly maps Saturday timestamps', () => {
    // 2026-05-02 is a Saturday, 23:00 UTC
    const timestamps = [new Date('2026-05-02T23:00:00Z')]
    const heatmap = buildHeatmap(timestamps)
    expect(heatmap.matrix[5]![23]).toBe(1) // Saturday=5
  })

  it('accumulates multiple timestamps in the same slot', () => {
    const timestamps = [
      new Date('2026-05-04T14:00:00Z'), // Monday 14h
      new Date('2026-05-04T14:30:00Z'), // Monday 14h again
      new Date('2026-05-04T14:59:00Z'), // Monday 14h again
    ]
    const heatmap = buildHeatmap(timestamps)
    expect(heatmap.matrix[0]![14]).toBe(3)
    expect(heatmap.max).toBe(3)
    expect(heatmap.total).toBe(3)
  })

  it('tracks max correctly across multiple slots', () => {
    const timestamps = [
      new Date('2026-05-04T14:00:00Z'), // Monday 14h
      new Date('2026-05-04T14:30:00Z'), // Monday 14h
      new Date('2026-05-05T10:00:00Z'), // Tuesday 10h
    ]
    const heatmap = buildHeatmap(timestamps)
    expect(heatmap.max).toBe(2)
    expect(heatmap.total).toBe(3)
  })

  it('handles empty timestamps', () => {
    const heatmap = buildHeatmap([])
    expect(heatmap.max).toBe(0)
    expect(heatmap.total).toBe(0)
  })
})
