import { describe, it, expect } from 'vitest'
import { computeViewGrowthSparkline } from '@/lib/youtube/sparkline-math'

function makeSnapshots(
  viewCounts: (number | null)[],
  startDate = '2024-01-01',
): { view_count: number | null; snapshot_date: string }[] {
  return viewCounts.map((view_count, i) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    return { view_count, snapshot_date: d.toISOString().slice(0, 10) }
  })
}

function makeSnapshotsWithGap(
  entries: { view_count: number | null; daysFromStart: number }[],
  startDate = '2024-01-01',
): { view_count: number | null; snapshot_date: string }[] {
  return entries.map(({ view_count, daysFromStart }) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + daysFromStart)
    return { view_count, snapshot_date: d.toISOString().slice(0, 10) }
  })
}

describe('computeViewGrowthSparkline', () => {
  it('returns [] for empty array', () => {
    expect(computeViewGrowthSparkline([])).toEqual([])
  })

  it('returns [] for single snapshot', () => {
    expect(computeViewGrowthSparkline([{ view_count: 1000, snapshot_date: '2024-01-01' }])).toEqual([])
  })

  it('two consecutive snapshots (1-day gap) → single delta', () => {
    const snapshots = makeSnapshots([1000, 1100])
    const result = computeViewGrowthSparkline(snapshots)
    expect(result).toEqual([100])
  })

  it('two snapshots with 3-day gap → 3 evenly distributed values', () => {
    const snapshots = makeSnapshotsWithGap([
      { view_count: 0, daysFromStart: 0 },
      { view_count: 300, daysFromStart: 3 },
    ])
    const result = computeViewGrowthSparkline(snapshots)
    // 300 views over 3 days = 100/day; window expands: [100], [100,100], [100,100,100]
    expect(result).toHaveLength(3)
    expect(result).toEqual([100, 100, 100])
  })

  it('7 consecutive daily snapshots → expanding window averages', () => {
    // uniform 100 views/day: expanding window of the same value = always 100
    const snapshots = makeSnapshots([0, 100, 200, 300, 400, 500, 600, 700])
    const result = computeViewGrowthSparkline(snapshots)
    // all deltas are 100, so rolling avg at every position = 100
    expect(result).toHaveLength(7)
    result.forEach(v => expect(v).toBe(100))
  })

  it('expanding window: first points use fewer days than windowSize', () => {
    // varying deltas: 10, 20, 30, 40, 50, 60, 70
    const snapshots = makeSnapshots([0, 10, 30, 60, 100, 150, 210, 280])
    const result = computeViewGrowthSparkline(snapshots)
    // deltas: [10, 20, 30, 40, 50, 60, 70]
    // smoothed[0] = round(10/1) = 10
    // smoothed[1] = round((10+20)/2) = 15
    // smoothed[2] = round((10+20+30)/3) = 20
    // smoothed[3] = round((10+20+30+40)/4) = 25
    // smoothed[4] = round((10+20+30+40+50)/5) = 30
    // smoothed[5] = round((10+20+30+40+50+60)/6) = 35
    // smoothed[6] = round((10+20+30+40+50+60+70)/7) = 40
    expect(result).toEqual([10, 15, 20, 25, 30, 35, 40])
  })

  it('35+ snapshots → returns exactly 30 points', () => {
    const views = Array.from({ length: 36 }, (_, i) => i * 100)
    const snapshots = makeSnapshots(views)
    const result = computeViewGrowthSparkline(snapshots)
    expect(result).toHaveLength(30)
  })

  it('negative delta (API glitch) → clamped to 0', () => {
    const snapshots = makeSnapshots([1000, 800, 900])
    const result = computeViewGrowthSparkline(snapshots)
    // delta 0: 800-1000 = -200 → 0; delta 1: 900-800 = 100 → 100
    // smoothed[0] = round(0/1) = 0
    // smoothed[1] = round((0+100)/2) = 50
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(50)
  })

  it('all view_count null → all zeros', () => {
    const snapshots = makeSnapshots([null, null, null, null])
    const result = computeViewGrowthSparkline(snapshots)
    expect(result).toEqual([0, 0, 0])
  })

  it('viral spike is dampened by rolling average', () => {
    // 6 days of 100/day, then 1 day of 10000, then 1 day back to 100
    const base = [0, 100, 200, 300, 400, 500, 600, 10600, 10700]
    const snapshots = makeSnapshots(base)
    const result = computeViewGrowthSparkline(snapshots)
    // deltas: [100,100,100,100,100,100,10000,100]
    // the spike at index 6 is 10000, but smoothed[6] = round((100*6+10000)/7) ≈ 1514
    // smoothed[7] = round((100*5+10000+100)/7) ≈ 1514 as well (drops first 100)
    // The spike value should be less than 10000 (dampened)
    const spikeIdx = result.length - 2  // second to last
    expect(result[spikeIdx]).toBeLessThan(10000)
    expect(result[spikeIdx]).toBeGreaterThan(100)
  })

  it('flat growth (identical deltas) → flat line', () => {
    const snapshots = makeSnapshots([0, 50, 100, 150, 200, 250, 300, 350, 400, 450])
    const result = computeViewGrowthSparkline(snapshots)
    // all deltas are 50, so rolling avg is always 50
    result.forEach(v => expect(v).toBe(50))
  })

  it('custom window size 3 instead of 7', () => {
    // deltas: [10, 20, 30, 40, 50]
    const snapshots = makeSnapshots([0, 10, 30, 60, 100, 150])
    const result = computeViewGrowthSparkline(snapshots, 3)
    // smoothed[0] = round(10/1) = 10
    // smoothed[1] = round((10+20)/2) = 15
    // smoothed[2] = round((10+20+30)/3) = 20
    // smoothed[3] = round((20+30+40)/3) = 30
    // smoothed[4] = round((30+40+50)/3) = 40
    expect(result).toEqual([10, 15, 20, 30, 40])
  })
})
