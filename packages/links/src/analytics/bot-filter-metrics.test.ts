import { describe, it, expect } from 'vitest'
import { recalcWithoutBots, type ClickRow } from './bot-filter-metrics.js'

function makeRow(overrides: Partial<ClickRow> = {}): ClickRow {
  return {
    clicks: 100,
    unique_visitors: 50,
    is_bot: false,
    ...overrides,
  }
}

describe('recalcWithoutBots', () => {
  it('returns same totals when no bots', () => {
    const rows = [makeRow({ clicks: 100 }), makeRow({ clicks: 200 })]
    const result = recalcWithoutBots(rows)
    expect(result.totalClicks).toBe(300)
    expect(result.totalUnique).toBe(100)
    expect(result.botClicks).toBe(0)
    expect(result.botPct).toBe(0)
  })

  it('excludes bot rows from totals', () => {
    const rows = [
      makeRow({ clicks: 100, unique_visitors: 50, is_bot: false }),
      makeRow({ clicks: 30, unique_visitors: 10, is_bot: true }),
    ]
    const result = recalcWithoutBots(rows)
    expect(result.totalClicks).toBe(100)
    expect(result.totalUnique).toBe(50)
    expect(result.botClicks).toBe(30)
  })

  it('calculates bot percentage correctly', () => {
    const rows = [
      makeRow({ clicks: 75, is_bot: false }),
      makeRow({ clicks: 25, is_bot: true }),
    ]
    const result = recalcWithoutBots(rows)
    expect(result.botPct).toBe(25)
  })

  it('handles all-bot rows', () => {
    const rows = [makeRow({ clicks: 50, is_bot: true })]
    const result = recalcWithoutBots(rows)
    expect(result.totalClicks).toBe(0)
    expect(result.botClicks).toBe(50)
    expect(result.botPct).toBe(100)
  })

  it('handles empty input', () => {
    const result = recalcWithoutBots([])
    expect(result.totalClicks).toBe(0)
    expect(result.botClicks).toBe(0)
    expect(result.botPct).toBe(0)
  })

  it('returns original totals when includesBots is true', () => {
    const rows = [
      makeRow({ clicks: 100, is_bot: false }),
      makeRow({ clicks: 30, is_bot: true }),
    ]
    const result = recalcWithoutBots(rows, true)
    expect(result.totalClicks).toBe(130)
    expect(result.botClicks).toBe(30)
  })

  it('rounds bot percentage to 1 decimal', () => {
    const rows = [
      makeRow({ clicks: 70, is_bot: false }),
      makeRow({ clicks: 33, is_bot: true }),
    ]
    const result = recalcWithoutBots(rows)
    expect(result.botPct).toBe(32)
  })
})
