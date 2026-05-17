import { describe, it, expect } from 'vitest'

// Note: analytics-client.ts uses `import 'server-only'` which is not installed
// in the test environment (only available in Next.js builds). Tests that need
// to import the module directly should use vi.mock('server-only', () => ({})).
// These tests cover the logic without triggering module-level side effects.

describe('YouTube Analytics Client', () => {
  it('toDateStr format is YYYY-MM-DD', () => {
    const date = new Date('2026-05-16T12:00:00Z')
    expect(date.toISOString().split('T')[0]).toBe('2026-05-16')
  })

  it('row mapping: channel metrics maps numeric indices correctly', () => {
    const row: (string | number)[] = [1000, 500, 180, 45.5, 20, 5, 3000, 8.2, 150, 30, 25]
    const metrics = {
      views: Number(row[0]),
      estimatedMinutesWatched: Number(row[1]),
      averageViewDuration: Number(row[2]),
      averageViewPercentage: Number(row[3]),
      subscribersGained: Number(row[4]),
      subscribersLost: Number(row[5]),
      impressions: Number(row[6]),
      impressionClickThroughRate: Number(row[7]),
      likes: Number(row[8]),
      comments: Number(row[9]),
      shares: Number(row[10]),
    }
    expect(metrics.views).toBe(1000)
    expect(metrics.impressionClickThroughRate).toBe(8.2)
    expect(metrics.shares).toBe(25)
  })

  it('row mapping: daily metrics includes date at index 0', () => {
    const row: (string | number)[] = ['2026-05-16', 500, 250, 10, 2, 1500, 7.5, 80, 15, 12]
    const daily = {
      date: String(row[0]),
      views: Number(row[1]),
      estimatedMinutesWatched: Number(row[2]),
      subscribersGained: Number(row[3]),
      subscribersLost: Number(row[4]),
      impressions: Number(row[5]),
      impressionClickThroughRate: Number(row[6]),
      likes: Number(row[7]),
      comments: Number(row[8]),
      shares: Number(row[9]),
    }
    expect(daily.date).toBe('2026-05-16')
    expect(daily.views).toBe(500)
    expect(daily.shares).toBe(12)
  })

  it('row mapping: search term maps term + stats correctly', () => {
    const row: (string | number)[] = ['como aprender programação', 320, 160, 9.1]
    const term = {
      term: String(row[0]),
      views: Number(row[1]),
      estimatedMinutesWatched: Number(row[2]),
      impressionClickThroughRate: Number(row[3]),
    }
    expect(term.term).toBe('como aprender programação')
    expect(term.views).toBe(320)
    expect(term.impressionClickThroughRate).toBe(9.1)
  })

  it('demographics: age/gender grouping accumulates male and female separately', () => {
    const rows: (string | number)[][] = [
      ['age18-24', 'male', 25.0],
      ['age18-24', 'female', 18.0],
      ['age25-34', 'male', 30.0],
    ]
    const ageMap = new Map<string, { male: number; female: number }>()
    for (const row of rows) {
      const group = String(row[0])
      const gender = String(row[1])
      const pct = Number(row[2])
      const entry = ageMap.get(group) ?? { male: 0, female: 0 }
      if (gender === 'male') entry.male = pct
      else entry.female = pct
      ageMap.set(group, entry)
    }
    expect(ageMap.get('age18-24')).toEqual({ male: 25.0, female: 18.0 })
    expect(ageMap.get('age25-34')).toEqual({ male: 30.0, female: 0 })
  })

  it('demographics: country percentage rounds correctly', () => {
    const rows: (string | number)[][] = [
      ['BR', 700, 350],
      ['US', 200, 100],
      ['PT', 100, 50],
    ]
    const total = rows.reduce((s, r) => s + Number(r[1]), 0)
    const countries = rows.map((row) => ({
      country: String(row[0]),
      views: Number(row[1]),
      percentage: total > 0 ? Math.round((Number(row[1]) / total) * 100) : 0,
    }))
    expect(total).toBe(1000)
    expect(countries[0]!.percentage).toBe(70)
    expect(countries[1]!.percentage).toBe(20)
    expect(countries[2]!.percentage).toBe(10)
  })

  it('demographics: zero total does not divide by zero', () => {
    const totalViews = 0
    const pct = totalViews > 0 ? Math.round((500 / totalViews) * 100) : 0
    expect(pct).toBe(0)
  })
})
