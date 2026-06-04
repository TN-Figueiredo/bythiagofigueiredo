import { describe, it, expect } from 'vitest'
import {
  ruleSpikeDetection,
  ruleGeoConcentration,
  ruleBestTime,
  ruleDeviceInsight,
  ruleGrowthTrend,
  ruleLowEngagement,
  type AggregatedMetrics,
} from '../../../src/lib/links/insights'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<AggregatedMetrics> = {}): AggregatedMetrics {
  return {
    clicksByDay: new Map(),
    clicksByHour: new Array(24).fill(0),
    countryMap: new Map(),
    mobileClicks: 0,
    desktopClicks: 0,
    total: 0,
    recentTotal: 0,
    prevTotal: 0,
    ...overrides,
  }
}

// ─── ruleSpikeDetection ──────────────────────────────────────────────────────

describe('ruleSpikeDetection', () => {
  it('returns null when fewer than 3 days of data', () => {
    const m = makeMetrics({
      clicksByDay: new Map([
        ['2026-05-01', 10],
        ['2026-05-02', 30],
      ]),
    })
    expect(ruleSpikeDetection(m)).toBeNull()
  })

  it('returns null when no spike (last day close to average)', () => {
    const m = makeMetrics({
      clicksByDay: new Map([
        ['2026-04-28', 10],
        ['2026-04-29', 12],
        ['2026-04-30', 11],
        ['2026-05-01', 10],
        ['2026-05-02', 9],
        ['2026-05-03', 11],
        ['2026-05-04', 12],
        ['2026-05-05', 13],
      ]),
    })
    expect(ruleSpikeDetection(m)).toBeNull()
  })

  it('fires when last day is 3x+ the 7-day average', () => {
    const m = makeMetrics({
      clicksByDay: new Map([
        ['2026-04-28', 10],
        ['2026-04-29', 10],
        ['2026-04-30', 10],
        ['2026-05-01', 10],
        ['2026-05-02', 10],
        ['2026-05-03', 10],
        ['2026-05-04', 10],
        ['2026-05-05', 50],
      ]),
    })
    const result = ruleSpikeDetection(m)
    expect(result).not.toBeNull()
    expect(result).toContain('Traffic spike detected')
    expect(result).toContain('50 clicks on 2026-05-05')
  })

  it('returns null when prior 7-day average is 0', () => {
    const m = makeMetrics({
      clicksByDay: new Map([
        ['2026-05-01', 0],
        ['2026-05-02', 0],
        ['2026-05-03', 0],
        ['2026-05-04', 50],
      ]),
    })
    expect(ruleSpikeDetection(m)).toBeNull()
  })
})

// ─── ruleGeoConcentration ────────────────────────────────────────────────────

describe('ruleGeoConcentration', () => {
  it('returns null when total < 15', () => {
    const m = makeMetrics({
      total: 10,
      countryMap: new Map([['BR', 10]]),
    })
    expect(ruleGeoConcentration(m)).toBeNull()
  })

  it('returns null when no single country exceeds 70%', () => {
    const m = makeMetrics({
      total: 100,
      countryMap: new Map([
        ['BR', 40],
        ['US', 35],
        ['DE', 25],
      ]),
    })
    expect(ruleGeoConcentration(m)).toBeNull()
  })

  it('fires when a single country has 70%+ of clicks', () => {
    const m = makeMetrics({
      total: 100,
      countryMap: new Map([
        ['BR', 80],
        ['US', 20],
      ]),
    })
    const result = ruleGeoConcentration(m)
    expect(result).not.toBeNull()
    expect(result).toContain('Geographic concentration')
    expect(result).toContain('80%')
    expect(result).toContain('"BR"')
  })

  it('returns null when country map is empty', () => {
    const m = makeMetrics({ total: 20, countryMap: new Map() })
    expect(ruleGeoConcentration(m)).toBeNull()
  })
})

// ─── ruleBestTime ────────────────────────────────────────────────────────────

describe('ruleBestTime', () => {
  it('returns null when total < 20', () => {
    const hours = new Array(24).fill(0)
    hours[10] = 15
    const m = makeMetrics({ total: 15, clicksByHour: hours })
    expect(ruleBestTime(m)).toBeNull()
  })

  it('returns null when clicks are spread across hours', () => {
    const hours = new Array(24).fill(5)
    const m = makeMetrics({ total: 120, clicksByHour: hours })
    expect(ruleBestTime(m)).toBeNull()
  })

  it('fires when a 4-hour window concentrates 50%+ of clicks', () => {
    const hours = new Array(24).fill(1) // 24 baseline clicks
    hours[14] = 30
    hours[15] = 25
    hours[16] = 20
    hours[17] = 15
    const total = hours.reduce((s: number, c: number) => s + c, 0)
    const m = makeMetrics({ total, clicksByHour: hours })
    const result = ruleBestTime(m)
    expect(result).not.toBeNull()
    expect(result).toContain('Best time')
    expect(result).toContain('UTC')
  })

  it('handles wrap-around at midnight', () => {
    const hours = new Array(24).fill(0)
    hours[22] = 15
    hours[23] = 15
    hours[0] = 15
    hours[1] = 15
    const total = 60
    const m = makeMetrics({ total, clicksByHour: hours })
    const result = ruleBestTime(m)
    expect(result).not.toBeNull()
    expect(result).toContain('Best time')
    expect(result).toContain('100%')
  })
})

// ─── ruleDeviceInsight ───────────────────────────────────────────────────────

describe('ruleDeviceInsight', () => {
  it('returns null when total < 15', () => {
    const m = makeMetrics({ total: 10, mobileClicks: 10 })
    expect(ruleDeviceInsight(m)).toBeNull()
  })

  it('fires when mobile share exceeds 80%', () => {
    const m = makeMetrics({ total: 100, mobileClicks: 85, desktopClicks: 15 })
    const result = ruleDeviceInsight(m)
    expect(result).not.toBeNull()
    expect(result).toContain('Mostly mobile audience')
    expect(result).toContain('85%')
  })

  it('fires when mobile share is below 20% and total >= 30', () => {
    const m = makeMetrics({ total: 100, mobileClicks: 10, desktopClicks: 90 })
    const result = ruleDeviceInsight(m)
    expect(result).not.toBeNull()
    expect(result).toContain('Predominantly desktop audience')
    expect(result).toContain('90%')
  })

  it('does not fire desktop insight when total < 30 even if mobile is low', () => {
    const m = makeMetrics({ total: 20, mobileClicks: 2, desktopClicks: 18 })
    expect(ruleDeviceInsight(m)).toBeNull()
  })

  it('returns null when mobile share is in the middle range', () => {
    const m = makeMetrics({ total: 100, mobileClicks: 50, desktopClicks: 50 })
    expect(ruleDeviceInsight(m)).toBeNull()
  })
})

// ─── ruleGrowthTrend ─────────────────────────────────────────────────────────

describe('ruleGrowthTrend', () => {
  it('returns null when prevTotal is 0', () => {
    const m = makeMetrics({ recentTotal: 100, prevTotal: 0 })
    expect(ruleGrowthTrend(m)).toBeNull()
  })

  it('fires growth when recentTotal is 50%+ above prevTotal', () => {
    const m = makeMetrics({ recentTotal: 90, prevTotal: 50 })
    const result = ruleGrowthTrend(m)
    expect(result).not.toBeNull()
    expect(result).toContain('Accelerated growth')
    expect(result).toContain('+80%')
  })

  it('fires decline when recentTotal is 40%+ below prevTotal and prevTotal >= 10', () => {
    const m = makeMetrics({ recentTotal: 5, prevTotal: 20 })
    const result = ruleGrowthTrend(m)
    expect(result).not.toBeNull()
    expect(result).toContain('Traffic decline')
    expect(result).toContain('75%')
  })

  it('does not fire decline when prevTotal < 10', () => {
    const m = makeMetrics({ recentTotal: 3, prevTotal: 8 })
    expect(ruleGrowthTrend(m)).toBeNull()
  })

  it('returns null when change is moderate', () => {
    const m = makeMetrics({ recentTotal: 60, prevTotal: 50 })
    expect(ruleGrowthTrend(m)).toBeNull()
  })

  it('does not fire growth when prevTotal < 10 (insufficient sample)', () => {
    const m = makeMetrics({ recentTotal: 6, prevTotal: 3 })
    expect(ruleGrowthTrend(m)).toBeNull()
  })
})

// ─── ruleLowEngagement ───────────────────────────────────────────────────────

describe('ruleLowEngagement', () => {
  it('fires when 7+ days of data but total < 5', () => {
    const days = new Map<string, number>()
    for (let i = 0; i < 8; i++) {
      days.set(`2026-04-${String(20 + i).padStart(2, '0')}`, 0)
    }
    days.set('2026-04-27', 2)
    const m = makeMetrics({ clicksByDay: days, total: 2 })
    const result = ruleLowEngagement(m)
    expect(result).not.toBeNull()
    expect(result).toContain('Low engagement')
  })

  it('returns null when fewer than 7 days of data', () => {
    const days = new Map<string, number>()
    for (let i = 0; i < 5; i++) {
      days.set(`2026-04-${String(20 + i).padStart(2, '0')}`, 0)
    }
    const m = makeMetrics({ clicksByDay: days, total: 0 })
    expect(ruleLowEngagement(m)).toBeNull()
  })

  it('returns null when total is >= 5', () => {
    const days = new Map<string, number>()
    for (let i = 0; i < 10; i++) {
      days.set(`2026-04-${String(15 + i).padStart(2, '0')}`, 1)
    }
    const m = makeMetrics({ clicksByDay: days, total: 10 })
    expect(ruleLowEngagement(m)).toBeNull()
  })
})
