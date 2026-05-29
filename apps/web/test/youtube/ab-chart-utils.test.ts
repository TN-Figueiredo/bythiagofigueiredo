import { describe, it, expect } from 'vitest'
import { toX, toY, niceLine, CHART } from '@/app/cms/(authed)/youtube/ab-lab/_components/chart-utils'

describe('CHART constants', () => {
  it('has expected dimensions', () => { expect(CHART.W).toBe(620); expect(CHART.H).toBe(200) })
  it('has font string', () => { expect(CHART.font).toContain('JetBrains') })
})

describe('toX', () => {
  it('returns padL when total is 1', () => { expect(toX(0, 1)).toBe(CHART.padL) })
  it('returns padL for first point', () => { expect(toX(0, 5)).toBe(CHART.padL) })
  it('returns W-padR for last point', () => { expect(toX(4, 5)).toBe(CHART.W - CHART.padR) })
  it('distributes evenly', () => {
    const mid = toX(1, 3)
    expect(mid).toBeGreaterThan(CHART.padL)
    expect(mid).toBeLessThan(CHART.W - CHART.padR)
  })
})

describe('toY', () => {
  it('returns padT for max value', () => { expect(toY(100, 0, 100)).toBe(CHART.padT) })
  it('returns H-padB for min value', () => { expect(toY(0, 0, 100)).toBe(CHART.H - CHART.padB) })
  it('centers when min===max', () => {
    const y = toY(50, 50, 50)
    const center = CHART.padT + (CHART.H - CHART.padT - CHART.padB) / 2
    expect(y).toBe(center)
  })
  it('maps midpoint correctly', () => {
    const y = toY(50, 0, 100)
    const center = CHART.padT + (CHART.H - CHART.padT - CHART.padB) / 2
    expect(y).toBeCloseTo(center, 1)
  })
})

describe('niceLine', () => {
  it('returns empty string for no points', () => { expect(niceLine([])).toBe('') })
  it('returns M for single point', () => { expect(niceLine([{ x: 10, y: 20 }])).toBe('M10,20') })
  it('returns ML for two points', () => { expect(niceLine([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe('M0,0L10,10') })
  it('returns Catmull-Rom curves for 3+ points', () => {
    const d = niceLine([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }])
    expect(d).toMatch(/^M.*C.*C/)
  })
  it('filters NaN/Infinity', () => {
    const d = niceLine([{ x: NaN, y: 0 }, { x: 5, y: 5 }, { x: 10, y: Infinity }])
    expect(d).toBe('M5,5')
  })
})
