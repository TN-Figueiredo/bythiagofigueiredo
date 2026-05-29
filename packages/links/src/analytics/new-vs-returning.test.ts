import { describe, it, expect } from 'vitest'
import { computeNewVsReturning, type VisitorRow } from './new-vs-returning.js'

function makeRow(overrides: Partial<VisitorRow> = {}): VisitorRow {
  return {
    is_returning: false,
    clicks: 1,
    ...overrides,
  }
}

describe('computeNewVsReturning', () => {
  it('computes new and returning counts', () => {
    const rows = [
      makeRow({ is_returning: false, clicks: 60 }),
      makeRow({ is_returning: true, clicks: 40 }),
    ]
    const result = computeNewVsReturning(rows)
    expect(result.newClicks).toBe(60)
    expect(result.returningClicks).toBe(40)
  })

  it('computes percentages', () => {
    const rows = [
      makeRow({ is_returning: false, clicks: 75 }),
      makeRow({ is_returning: true, clicks: 25 }),
    ]
    const result = computeNewVsReturning(rows)
    expect(result.newPct).toBe(75)
    expect(result.returningPct).toBe(25)
  })

  it('returns donut data for chart rendering', () => {
    const rows = [
      makeRow({ is_returning: false, clicks: 60 }),
      makeRow({ is_returning: true, clicks: 40 }),
    ]
    const result = computeNewVsReturning(rows)
    expect(result.donut).toHaveLength(2)
    expect(result.donut[0].k).toBe('Novos')
    expect(result.donut[1].k).toBe('Retornantes')
  })

  it('handles all-new visitors', () => {
    const rows = [makeRow({ is_returning: false, clicks: 100 })]
    const result = computeNewVsReturning(rows)
    expect(result.newPct).toBe(100)
    expect(result.returningPct).toBe(0)
  })

  it('handles empty input', () => {
    const result = computeNewVsReturning([])
    expect(result.newClicks).toBe(0)
    expect(result.returningClicks).toBe(0)
    expect(result.newPct).toBe(0)
    expect(result.returningPct).toBe(0)
  })

  it('aggregates multiple rows per category', () => {
    const rows = [
      makeRow({ is_returning: false, clicks: 30 }),
      makeRow({ is_returning: false, clicks: 20 }),
      makeRow({ is_returning: true, clicks: 50 }),
    ]
    const result = computeNewVsReturning(rows)
    expect(result.newClicks).toBe(50)
    expect(result.returningClicks).toBe(50)
    expect(result.newPct).toBe(50)
  })
})
