import { describe, it, expect } from 'vitest'
import { aggregateByUtm, type UtmClickRow } from './utm-attribution.js'

function makeRow(overrides: Partial<UtmClickRow> = {}): UtmClickRow {
  return {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    clicks: 1,
    ...overrides,
  }
}

describe('aggregateByUtm', () => {
  it('groups clicks by utm_source', () => {
    const rows: UtmClickRow[] = [
      makeRow({ utm_source: 'google', clicks: 10 }),
      makeRow({ utm_source: 'twitter', clicks: 5 }),
      makeRow({ utm_source: 'google', clicks: 3 }),
    ]
    const result = aggregateByUtm(rows, 'source')
    expect(result).toEqual([
      { key: 'google', clicks: 13, pct: expect.closeTo(72.2, 0) },
      { key: 'twitter', clicks: 5, pct: expect.closeTo(27.8, 0) },
    ])
  })

  it('groups clicks by utm_medium', () => {
    const rows: UtmClickRow[] = [
      makeRow({ utm_medium: 'cpc', clicks: 20 }),
      makeRow({ utm_medium: 'email', clicks: 10 }),
    ]
    const result = aggregateByUtm(rows, 'medium')
    expect(result).toEqual([
      { key: 'cpc', clicks: 20, pct: expect.closeTo(66.7, 0) },
      { key: 'email', clicks: 10, pct: expect.closeTo(33.3, 0) },
    ])
  })

  it('groups clicks by utm_campaign', () => {
    const rows: UtmClickRow[] = [
      makeRow({ utm_campaign: 'launch', clicks: 15 }),
      makeRow({ utm_campaign: 'black-friday', clicks: 25 }),
    ]
    const result = aggregateByUtm(rows, 'campaign')
    expect(result).toEqual([
      { key: 'black-friday', clicks: 25, pct: expect.closeTo(62.5, 0) },
      { key: 'launch', clicks: 15, pct: expect.closeTo(37.5, 0) },
    ])
  })

  it('buckets null UTM values as "(direct)"', () => {
    const rows: UtmClickRow[] = [
      makeRow({ utm_source: null, clicks: 30 }),
      makeRow({ utm_source: 'google', clicks: 10 }),
    ]
    const result = aggregateByUtm(rows, 'source')
    expect(result[0].key).toBe('(direct)')
    expect(result[0].clicks).toBe(30)
  })

  it('returns empty array for empty input', () => {
    expect(aggregateByUtm([], 'source')).toEqual([])
  })

  it('sorts descending by clicks', () => {
    const rows: UtmClickRow[] = [
      makeRow({ utm_source: 'a', clicks: 1 }),
      makeRow({ utm_source: 'b', clicks: 100 }),
      makeRow({ utm_source: 'c', clicks: 50 }),
    ]
    const result = aggregateByUtm(rows, 'source')
    expect(result.map((r) => r.key)).toEqual(['b', 'c', 'a'])
  })
})
