import { describe, it, expect } from 'vitest'
import {
  computeDashboardInsights,
  type DashboardInsightInput,
} from '../../../src/lib/links/compute-dashboard-insights'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<DashboardInsightInput> = {}): DashboardInsightInput {
  return {
    byDay: new Array(30).fill(0),
    links: [],
    devices: [],
    countries: [],
    totalClicks: 0,
    qrShare: 0,
    ...overrides,
  }
}

/** Build a 30-slot byDay where prev7 (slots 16-22) and last7 (slots 23-29) have given totals */
function byDayWithTrend(prev7Total: number, last7Total: number): number[] {
  const arr = new Array(30).fill(0)
  const prevPerDay = Math.floor(prev7Total / 7)
  const prevRemainder = prev7Total - prevPerDay * 7
  for (let i = 16; i < 23; i++) {
    arr[i] = prevPerDay + (i - 16 < prevRemainder ? 1 : 0)
  }
  const lastPerDay = Math.floor(last7Total / 7)
  const lastRemainder = last7Total - lastPerDay * 7
  for (let i = 23; i < 30; i++) {
    arr[i] = lastPerDay + (i - 23 < lastRemainder ? 1 : 0)
  }
  return arr
}

// ─── Empty / zero data ──────────────────────────────────────────────────────

describe('computeDashboardInsights', () => {
  describe('empty / zero data', () => {
    it('returns empty array for default zero input', () => {
      expect(computeDashboardInsights(makeInput())).toEqual([])
    })

    it('returns empty array when byDay is empty', () => {
      expect(computeDashboardInsights(makeInput({ byDay: [] }))).toEqual([])
    })

    it('returns empty array when all values are zero', () => {
      const input = makeInput({
        byDay: new Array(30).fill(0),
        links: [{ title: 'A', clicks: 0, health: 'ok' }],
        devices: [{ k: 'Mobile', v: 50 }, { k: 'Desktop', v: 50 }],
        countries: [{ v: 40, name: 'Brazil' }],
        totalClicks: 0,
        qrShare: 0,
      })
      expect(computeDashboardInsights(input)).toEqual([])
    })
  })

  // ─── Growth rule ────────────────────────────────────────────────────────────

  describe('growth rule', () => {
    it('fires when last7 > prev7 by more than 20%', () => {
      const input = makeInput({ byDay: byDayWithTrend(10, 15) }) // 50% growth
      const result = computeDashboardInsights(input)
      expect(result).toContainEqual(
        expect.objectContaining({ type: 'growth', period: '7d' }),
      )
      const growth = result.find(r => r.type === 'growth')!
      expect(growth.value).toBe(50)
    })

    it('does not fire when growth is exactly 20%', () => {
      // prev7=10, last7=12 → 20% exactly → not > 20
      const input = makeInput({ byDay: byDayWithTrend(10, 12) })
      const result = computeDashboardInsights(input)
      expect(result.find(r => r.type === 'growth')).toBeUndefined()
    })

    it('fires at 21% growth (just above threshold)', () => {
      // prev7=100, last7=121 → 21%
      const input = makeInput({ byDay: byDayWithTrend(100, 121) })
      const result = computeDashboardInsights(input)
      expect(result.find(r => r.type === 'growth')).toBeDefined()
    })

    it('does not fire when byDay has fewer than 14 items', () => {
      const input = makeInput({ byDay: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] })
      const result = computeDashboardInsights(input)
      expect(result.find(r => r.type === 'growth')).toBeUndefined()
      expect(result.find(r => r.type === 'decline')).toBeUndefined()
    })

    it('does not fire when prev7 < 5 (insufficient data)', () => {
      const input = makeInput({ byDay: byDayWithTrend(4, 100) })
      const result = computeDashboardInsights(input)
      expect(result.find(r => r.type === 'growth')).toBeUndefined()
    })

    it('does not fire for moderate increase (15%)', () => {
      // prev7=20, last7=23 → 15%
      const input = makeInput({ byDay: byDayWithTrend(20, 23) })
      const result = computeDashboardInsights(input)
      expect(result.find(r => r.type === 'growth')).toBeUndefined()
    })
  })

  // ─── Decline rule ──────────────────────────────────────────────────────────

  describe('decline rule', () => {
    it('fires when last7 drops more than 20% from prev7', () => {
      const input = makeInput({ byDay: byDayWithTrend(20, 10) }) // -50%
      const result = computeDashboardInsights(input)
      const decline = result.find(r => r.type === 'decline')
      expect(decline).toBeDefined()
      expect(decline!.value).toBe(50) // absolute value
      expect(decline!.period).toBe('7d')
    })

    it('does not fire when decline is exactly -20%', () => {
      // prev7=10, last7=8 → -20% exactly → not < -20
      const input = makeInput({ byDay: byDayWithTrend(10, 8) })
      const result = computeDashboardInsights(input)
      expect(result.find(r => r.type === 'decline')).toBeUndefined()
    })

    it('fires at -21% (just below threshold)', () => {
      // prev7=100, last7=79 → -21%
      const input = makeInput({ byDay: byDayWithTrend(100, 79) })
      const result = computeDashboardInsights(input)
      expect(result.find(r => r.type === 'decline')).toBeDefined()
    })

    it('does not fire when prev7 < 5', () => {
      const input = makeInput({ byDay: byDayWithTrend(4, 0) })
      const result = computeDashboardInsights(input)
      expect(result.find(r => r.type === 'decline')).toBeUndefined()
    })

    it('value is stored as absolute (positive) number', () => {
      const input = makeInput({ byDay: byDayWithTrend(50, 20) }) // -60%
      const decline = computeDashboardInsights(input).find(r => r.type === 'decline')!
      expect(decline.value).toBeGreaterThan(0)
    })
  })

  // ─── Top performer rule ────────────────────────────────────────────────────

  describe('top performer rule', () => {
    it('fires when 2+ links have clicks > 0', () => {
      const input = makeInput({
        links: [
          { title: 'Alpha', clicks: 50, health: 'ok' },
          { title: 'Beta', clicks: 30, health: 'ok' },
        ],
      })
      const result = computeDashboardInsights(input)
      const top = result.find(r => r.type === 'top_performer')
      expect(top).toBeDefined()
      expect(top!.value).toBe(50)
      expect(top!.linkTitle).toBe('Alpha')
    })

    it('picks highest clicks link regardless of input order', () => {
      const input = makeInput({
        links: [
          { title: 'Low', clicks: 5, health: 'ok' },
          { title: 'High', clicks: 200, health: 'ok' },
          { title: 'Mid', clicks: 100, health: 'ok' },
        ],
      })
      const top = computeDashboardInsights(input).find(r => r.type === 'top_performer')!
      expect(top.linkTitle).toBe('High')
      expect(top.value).toBe(200)
    })

    it('does not fire with only 1 link (even with clicks)', () => {
      const input = makeInput({
        links: [{ title: 'Solo', clicks: 999, health: 'ok' }],
      })
      const result = computeDashboardInsights(input)
      expect(result.find(r => r.type === 'top_performer')).toBeUndefined()
    })

    it('does not fire when all links have 0 clicks', () => {
      const input = makeInput({
        links: [
          { title: 'A', clicks: 0, health: 'ok' },
          { title: 'B', clicks: 0, health: 'ok' },
        ],
      })
      expect(computeDashboardInsights(input).find(r => r.type === 'top_performer')).toBeUndefined()
    })

    it('does not fire when only 1 link has clicks > 0', () => {
      const input = makeInput({
        links: [
          { title: 'A', clicks: 10, health: 'ok' },
          { title: 'B', clicks: 0, health: 'ok' },
        ],
      })
      expect(computeDashboardInsights(input).find(r => r.type === 'top_performer')).toBeUndefined()
    })

    it('does not fire with no links', () => {
      expect(computeDashboardInsights(makeInput()).find(r => r.type === 'top_performer')).toBeUndefined()
    })
  })

  // ─── Health warning rule ───────────────────────────────────────────────────

  describe('health warning rule', () => {
    it('fires when any link has health = warn', () => {
      const input = makeInput({
        links: [
          { title: 'A', clicks: 10, health: 'ok' },
          { title: 'B', clicks: 5, health: 'warn' },
        ],
      })
      const hw = computeDashboardInsights(input).find(r => r.type === 'health_warning')
      expect(hw).toBeDefined()
      expect(hw!.value).toBe(1)
    })

    it('fires when any link has health = broken', () => {
      const input = makeInput({
        links: [{ title: 'A', clicks: 0, health: 'broken' }],
      })
      const hw = computeDashboardInsights(input).find(r => r.type === 'health_warning')
      expect(hw).toBeDefined()
      expect(hw!.value).toBe(1)
    })

    it('counts all unhealthy links', () => {
      const input = makeInput({
        links: [
          { title: 'A', clicks: 0, health: 'warn' },
          { title: 'B', clicks: 0, health: 'broken' },
          { title: 'C', clicks: 0, health: 'ok' },
        ],
      })
      const hw = computeDashboardInsights(input).find(r => r.type === 'health_warning')!
      expect(hw.value).toBe(2)
    })

    it('does not fire when all links are ok', () => {
      const input = makeInput({
        links: [
          { title: 'A', clicks: 10, health: 'ok' },
          { title: 'B', clicks: 5, health: 'ok' },
        ],
      })
      expect(computeDashboardInsights(input).find(r => r.type === 'health_warning')).toBeUndefined()
    })

    it('does not fire with no links', () => {
      expect(computeDashboardInsights(makeInput()).find(r => r.type === 'health_warning')).toBeUndefined()
    })
  })

  // ─── Milestone rule ────────────────────────────────────────────────────────

  describe('milestone rule', () => {
    it('does not fire below 100 totalClicks', () => {
      const input = makeInput({ totalClicks: 99 })
      expect(computeDashboardInsights(input).find(r => r.type === 'milestone')).toBeUndefined()
    })

    it('fires at exactly 100', () => {
      const input = makeInput({ totalClicks: 100 })
      const ms = computeDashboardInsights(input).find(r => r.type === 'milestone')
      expect(ms).toBeDefined()
      expect(ms!.value).toBe(100)
    })

    it('fires at 500', () => {
      const ms = computeDashboardInsights(makeInput({ totalClicks: 500 })).find(r => r.type === 'milestone')!
      expect(ms.value).toBe(500)
    })

    it('fires at 1000', () => {
      const ms = computeDashboardInsights(makeInput({ totalClicks: 1000 })).find(r => r.type === 'milestone')!
      expect(ms.value).toBe(1000)
    })

    it('fires at 5000', () => {
      const ms = computeDashboardInsights(makeInput({ totalClicks: 5000 })).find(r => r.type === 'milestone')!
      expect(ms.value).toBe(5000)
    })

    it('fires at 10000', () => {
      const ms = computeDashboardInsights(makeInput({ totalClicks: 10000 })).find(r => r.type === 'milestone')!
      expect(ms.value).toBe(10000)
    })

    it('value reflects actual totalClicks, not threshold', () => {
      const ms = computeDashboardInsights(makeInput({ totalClicks: 7777 })).find(r => r.type === 'milestone')!
      expect(ms.value).toBe(7777)
    })

    it('does not fire at 50', () => {
      expect(computeDashboardInsights(makeInput({ totalClicks: 50 })).find(r => r.type === 'milestone')).toBeUndefined()
    })
  })

  // ─── QR surge rule ─────────────────────────────────────────────────────────

  describe('qr surge rule', () => {
    it('fires when qrShare > 30', () => {
      const input = makeInput({ qrShare: 45 })
      const qr = computeDashboardInsights(input).find(r => r.type === 'qr_surge')
      expect(qr).toBeDefined()
      expect(qr!.value).toBe(45)
    })

    it('does not fire at exactly 30', () => {
      const input = makeInput({ qrShare: 30 })
      expect(computeDashboardInsights(input).find(r => r.type === 'qr_surge')).toBeUndefined()
    })

    it('does not fire below 30', () => {
      const input = makeInput({ qrShare: 15 })
      expect(computeDashboardInsights(input).find(r => r.type === 'qr_surge')).toBeUndefined()
    })

    it('rounds the value', () => {
      const input = makeInput({ qrShare: 33.7 })
      const qr = computeDashboardInsights(input).find(r => r.type === 'qr_surge')!
      expect(qr.value).toBe(34)
    })

    it('includes period = 30d', () => {
      const input = makeInput({ qrShare: 50 })
      const qr = computeDashboardInsights(input).find(r => r.type === 'qr_surge')!
      expect(qr.period).toBe('30d')
    })
  })

  // ─── Geo concentration rule ────────────────────────────────────────────────

  describe('geo concentration rule', () => {
    it('fires when top country > 70%', () => {
      const input = makeInput({
        countries: [{ v: 85, name: 'Brazil' }],
      })
      const geo = computeDashboardInsights(input).find(r => r.type === 'geo_concentration')
      expect(geo).toBeDefined()
      expect(geo!.value).toBe(85)
      expect(geo!.linkTitle).toBe('Brazil')
    })

    it('does not fire at exactly 70%', () => {
      const input = makeInput({
        countries: [{ v: 70, name: 'Brazil' }],
      })
      expect(computeDashboardInsights(input).find(r => r.type === 'geo_concentration')).toBeUndefined()
    })

    it('does not fire below 70%', () => {
      const input = makeInput({
        countries: [{ v: 55, name: 'Brazil' }],
      })
      expect(computeDashboardInsights(input).find(r => r.type === 'geo_concentration')).toBeUndefined()
    })

    it('does not fire with empty countries array', () => {
      expect(computeDashboardInsights(makeInput({ countries: [] })).find(r => r.type === 'geo_concentration')).toBeUndefined()
    })

    it('uses first country entry only', () => {
      const input = makeInput({
        countries: [
          { v: 40, name: 'Brazil' },
          { v: 90, name: 'US' },
        ],
      })
      expect(computeDashboardInsights(input).find(r => r.type === 'geo_concentration')).toBeUndefined()
    })
  })

  // ─── Device skew rule ──────────────────────────────────────────────────────

  describe('device skew rule', () => {
    it('fires for mobile when Mobile >= 80%', () => {
      const input = makeInput({
        devices: [{ k: 'Mobile', v: 85 }, { k: 'Desktop', v: 15 }],
      })
      const ds = computeDashboardInsights(input).find(r => r.type === 'device_skew')
      expect(ds).toBeDefined()
      expect(ds!.linkTitle).toBe('mobile')
      expect(ds!.value).toBe(85)
    })

    it('fires for mobile at exactly 80%', () => {
      const input = makeInput({
        devices: [{ k: 'Mobile', v: 80 }, { k: 'Desktop', v: 20 }],
      })
      const ds = computeDashboardInsights(input).find(r => r.type === 'device_skew')
      expect(ds).toBeDefined()
      expect(ds!.linkTitle).toBe('mobile')
    })

    it('fires for desktop when Desktop >= 80%', () => {
      const input = makeInput({
        devices: [{ k: 'Mobile', v: 10 }, { k: 'Desktop', v: 90 }],
      })
      const ds = computeDashboardInsights(input).find(r => r.type === 'device_skew')
      expect(ds).toBeDefined()
      expect(ds!.linkTitle).toBe('desktop')
      expect(ds!.value).toBe(90)
    })

    it('prefers mobile skew when both are >= 80% (edge case)', () => {
      // Unrealistic but tests code path: mobile checked first
      const input = makeInput({
        devices: [{ k: 'Mobile', v: 85 }, { k: 'Desktop', v: 85 }],
      })
      const ds = computeDashboardInsights(input).find(r => r.type === 'device_skew')!
      expect(ds.linkTitle).toBe('mobile')
    })

    it('does not fire when both below 80%', () => {
      const input = makeInput({
        devices: [{ k: 'Mobile', v: 60 }, { k: 'Desktop', v: 40 }],
      })
      expect(computeDashboardInsights(input).find(r => r.type === 'device_skew')).toBeUndefined()
    })

    it('does not fire at 79% mobile', () => {
      const input = makeInput({
        devices: [{ k: 'Mobile', v: 79 }, { k: 'Desktop', v: 21 }],
      })
      expect(computeDashboardInsights(input).find(r => r.type === 'device_skew')).toBeUndefined()
    })

    it('does not fire with empty devices', () => {
      expect(computeDashboardInsights(makeInput({ devices: [] })).find(r => r.type === 'device_skew')).toBeUndefined()
    })

    it('does not fire when device keys are not Mobile/Desktop', () => {
      const input = makeInput({
        devices: [{ k: 'Tablet', v: 90 }],
      })
      expect(computeDashboardInsights(input).find(r => r.type === 'device_skew')).toBeUndefined()
    })
  })

  // ─── Priority ordering ────────────────────────────────────────────────────

  describe('priority ordering', () => {
    it('health_warning comes before decline', () => {
      const input = makeInput({
        byDay: byDayWithTrend(20, 5), // decline -75%
        links: [{ title: 'A', clicks: 0, health: 'broken' }],
      })
      const result = computeDashboardInsights(input)
      const types = result.map(r => r.type)
      expect(types.indexOf('health_warning')).toBeLessThan(types.indexOf('decline'))
    })

    it('decline comes before growth (mutually exclusive but tests priority map)', () => {
      // Not possible to have both growth and decline, but we can check priority via other combos
      const input = makeInput({
        byDay: byDayWithTrend(20, 30), // growth 50%
        links: [
          { title: 'A', clicks: 10, health: 'warn' },
          { title: 'B', clicks: 5, health: 'ok' },
        ],
        totalClicks: 100,
      })
      const types = computeDashboardInsights(input).map(r => r.type)
      // health_warning < growth < top_performer < milestone
      expect(types.indexOf('health_warning')).toBeLessThan(types.indexOf('growth'))
      expect(types.indexOf('growth')).toBeLessThan(types.indexOf('top_performer'))
    })

    it('device_skew comes before geo_concentration', () => {
      const input = makeInput({
        devices: [{ k: 'Mobile', v: 90 }, { k: 'Desktop', v: 10 }],
        countries: [{ v: 85, name: 'Brazil' }],
      })
      const types = computeDashboardInsights(input).map(r => r.type)
      expect(types.indexOf('device_skew')).toBeLessThan(types.indexOf('geo_concentration'))
    })

    it('milestone comes before qr_surge', () => {
      const input = makeInput({
        totalClicks: 100,
        qrShare: 50,
      })
      const types = computeDashboardInsights(input).map(r => r.type)
      expect(types.indexOf('milestone')).toBeLessThan(types.indexOf('qr_surge'))
    })

    it('full priority chain: health > decline > device > geo > top > milestone > qr', () => {
      const input = makeInput({
        byDay: byDayWithTrend(20, 5), // decline -75%
        links: [
          { title: 'A', clicks: 50, health: 'broken' },
          { title: 'B', clicks: 30, health: 'ok' },
        ],
        devices: [{ k: 'Mobile', v: 90 }, { k: 'Desktop', v: 10 }],
        countries: [{ v: 85, name: 'Brazil' }],
        totalClicks: 500,
        qrShare: 60,
      })
      const result = computeDashboardInsights(input)
      const types = result.map(r => r.type)
      // Only 4 returned, but first 4 in priority should be:
      // health_warning(0), decline(1), device_skew(3), geo_concentration(4)
      expect(types).toEqual(['health_warning', 'decline', 'device_skew', 'geo_concentration'])
    })
  })

  // ─── Max 4 cap ─────────────────────────────────────────────────────────────

  describe('max 4 cap', () => {
    it('returns at most 4 insights even when all rules fire', () => {
      const input = makeInput({
        byDay: byDayWithTrend(20, 5), // decline
        links: [
          { title: 'A', clicks: 50, health: 'broken' },
          { title: 'B', clicks: 30, health: 'ok' },
        ],
        devices: [{ k: 'Mobile', v: 90 }, { k: 'Desktop', v: 10 }],
        countries: [{ v: 85, name: 'Brazil' }],
        totalClicks: 1000,
        qrShare: 50,
      })
      const result = computeDashboardInsights(input)
      expect(result.length).toBeLessThanOrEqual(4)
    })

    it('lower-priority insights are dropped, not higher-priority', () => {
      const input = makeInput({
        byDay: byDayWithTrend(20, 5), // decline
        links: [
          { title: 'A', clicks: 50, health: 'warn' },
          { title: 'B', clicks: 30, health: 'ok' },
        ],
        devices: [{ k: 'Mobile', v: 90 }, { k: 'Desktop', v: 10 }],
        countries: [{ v: 85, name: 'Brazil' }],
        totalClicks: 1000,
        qrShare: 50,
      })
      const types = computeDashboardInsights(input).map(r => r.type)
      // health_warning(0), decline(1), device_skew(3), geo_concentration(4) — top_performer, milestone, qr_surge dropped
      expect(types).toContain('health_warning')
      expect(types).toContain('decline')
      expect(types).not.toContain('qr_surge')
      expect(types).not.toContain('milestone')
    })

    it('returns fewer than 4 when fewer rules fire', () => {
      const input = makeInput({ totalClicks: 100, qrShare: 50 })
      const result = computeDashboardInsights(input)
      expect(result).toHaveLength(2)
    })

    it('returns exactly 4 when exactly 4 rules fire', () => {
      const input = makeInput({
        links: [
          { title: 'A', clicks: 50, health: 'warn' },
          { title: 'B', clicks: 30, health: 'ok' },
        ],
        devices: [{ k: 'Mobile', v: 90 }, { k: 'Desktop', v: 10 }],
        totalClicks: 500,
        qrShare: 40,
      })
      const result = computeDashboardInsights(input)
      // health_warning, device_skew, top_performer, milestone — exactly 4
      expect(result).toHaveLength(4)
    })
  })

  // ─── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('byDay with exactly 14 items works for growth/decline', () => {
      const arr = new Array(14).fill(0)
      // prev7 = slots 0-6, last7 = slots 7-13
      for (let i = 0; i < 7; i++) arr[i] = 2 // prev7 = 14
      for (let i = 7; i < 14; i++) arr[i] = 5 // last7 = 35 → ~150% growth
      const result = computeDashboardInsights(makeInput({ byDay: arr }))
      expect(result.find(r => r.type === 'growth')).toBeDefined()
    })

    it('byDay with 13 items does not trigger growth or decline', () => {
      const arr = new Array(13).fill(10)
      const result = computeDashboardInsights(makeInput({ byDay: arr }))
      expect(result.find(r => r.type === 'growth')).toBeUndefined()
      expect(result.find(r => r.type === 'decline')).toBeUndefined()
    })

    it('prev7 exactly 5 is sufficient for growth/decline check', () => {
      const input = makeInput({ byDay: byDayWithTrend(5, 10) }) // 100% growth
      const result = computeDashboardInsights(input)
      expect(result.find(r => r.type === 'growth')).toBeDefined()
    })

    it('prev7 exactly 4 is insufficient', () => {
      const input = makeInput({ byDay: byDayWithTrend(4, 100) })
      const result = computeDashboardInsights(input)
      expect(result.find(r => r.type === 'growth')).toBeUndefined()
    })

    it('growth and decline are mutually exclusive', () => {
      const input = makeInput({ byDay: byDayWithTrend(10, 15) })
      const result = computeDashboardInsights(input)
      const hasGrowth = result.some(r => r.type === 'growth')
      const hasDecline = result.some(r => r.type === 'decline')
      expect(hasGrowth && hasDecline).toBe(false)
    })

    it('zero prev7 and zero last7 does not fire (prev7 < 5)', () => {
      const input = makeInput({ byDay: byDayWithTrend(0, 0) })
      const result = computeDashboardInsights(input)
      expect(result.find(r => r.type === 'growth')).toBeUndefined()
      expect(result.find(r => r.type === 'decline')).toBeUndefined()
    })

    it('milestone fires for totalClicks between thresholds (e.g. 250 hits 100 threshold)', () => {
      const ms = computeDashboardInsights(makeInput({ totalClicks: 250 })).find(r => r.type === 'milestone')!
      expect(ms).toBeDefined()
      expect(ms.value).toBe(250)
    })

    it('large totalClicks still fires milestone only once', () => {
      const result = computeDashboardInsights(makeInput({ totalClicks: 99999 }))
      const milestones = result.filter(r => r.type === 'milestone')
      expect(milestones).toHaveLength(1)
      expect(milestones[0].value).toBe(99999)
    })
  })
})
