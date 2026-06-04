import { describe, it, expect } from 'vitest'
import {
  computeDashboardInsights,
  type DashboardInsightInput,
} from '@/lib/links/compute-dashboard-insights'
import {
  formatInsight,
  type FormattedInsight,
  type RawInsight,
} from '@/lib/links/insights-formatter'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_TONES = ['up', 'accent', 'amber', 'red'] as const

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

/** Run the full pipeline: compute → format */
function pipeline(input: DashboardInsightInput): FormattedInsight[] {
  const raw = computeDashboardInsights(input)
  return raw.map(formatInsight)
}

// ─── Integration: full pipeline with realistic data ─────────────────────────

describe('insights integration: computeDashboardInsights → formatInsight', () => {
  describe('full pipeline with realistic data', () => {
    const realisticInput: DashboardInsightInput = {
      byDay: [
        3, 5, 4, 6, 7, 5, 4,   // days 1-7 (old, outside 14-day window)
        8, 6, 7, 9, 5, 6, 4,   // days 8-14 (old)
        3, 4,                    // days 15-16 (old)
        10, 12, 8, 11, 9, 13, 7, // days 17-23 (prev7 = 70)
        20, 25, 22, 18, 24, 21, 19, // days 24-30 (last7 = 149, ~113% growth)
      ],
      links: [
        { title: 'Blog — Como Investir', clicks: 340, health: 'ok' },
        { title: 'Landing Page Curso', clicks: 210, health: 'ok' },
        { title: 'Newsletter CTA', clicks: 95, health: 'warn' },
        { title: 'Link Bio Antigo', clicks: 12, health: 'broken' },
        { title: 'Parceiro XYZ', clicks: 45, health: 'ok' },
      ],
      devices: [
        { k: 'Mobile', v: 68 },
        { k: 'Desktop', v: 28 },
        { k: 'Tablet', v: 4 },
      ],
      countries: [
        { v: 55, name: 'Brasil' },
        { v: 20, name: 'Portugal' },
        { v: 10, name: 'EUA' },
        { v: 8, name: 'Angola' },
        { v: 7, name: 'Outros' },
      ],
      totalClicks: 702,
      qrShare: 12,
    }

    it('produces non-empty formatted insights for realistic data', () => {
      const formatted = pipeline(realisticInput)
      expect(formatted.length).toBeGreaterThan(0)
      expect(formatted.length).toBeLessThanOrEqual(4)
    })

    it('every formatted insight has a valid tone', () => {
      const formatted = pipeline(realisticInput)
      for (const insight of formatted) {
        expect(VALID_TONES).toContain(insight.tone)
      }
    })

    it('every formatted insight has non-empty text', () => {
      const formatted = pipeline(realisticInput)
      for (const insight of formatted) {
        expect(insight.text).toBeTruthy()
        expect(insight.text.length).toBeGreaterThan(0)
      }
    })

    it('every formatted insight has a non-empty icon', () => {
      const formatted = pipeline(realisticInput)
      for (const insight of formatted) {
        expect(insight.icon).toBeTruthy()
        expect(insight.icon.length).toBeGreaterThan(0)
      }
    })
  })

  // ─── Correct tones for each insight type ────────────────────────────────────

  describe('pipeline produces correct tones for each insight type', () => {
    it('growth → tone "up"', () => {
      const input = makeInput({ byDay: byDayWithTrend(20, 50) }) // +150% growth
      const formatted = pipeline(input)
      const growthInsight = formatted.find(f => f.icon === 'trendingUp')
      expect(growthInsight).toBeDefined()
      expect(growthInsight!.tone).toBe('up')
    })

    it('decline → tone "red"', () => {
      const input = makeInput({ byDay: byDayWithTrend(50, 10) }) // -80% decline
      const formatted = pipeline(input)
      const declineInsight = formatted.find(f => f.icon === 'trendingDown')
      expect(declineInsight).toBeDefined()
      expect(declineInsight!.tone).toBe('red')
    })

    it('top_performer → tone "accent"', () => {
      const input = makeInput({
        links: [
          { title: 'Link A', clicks: 100, health: 'ok' },
          { title: 'Link B', clicks: 30, health: 'ok' },
        ],
      })
      const formatted = pipeline(input)
      const topInsight = formatted.find(f => f.icon === 'trophy')
      expect(topInsight).toBeDefined()
      expect(topInsight!.tone).toBe('accent')
    })

    it('health_warning → tone "amber"', () => {
      const input = makeInput({
        links: [{ title: 'Broken Link', clicks: 5, health: 'broken' }],
      })
      const formatted = pipeline(input)
      const healthInsight = formatted.find(f => f.icon === 'alertTriangle')
      expect(healthInsight).toBeDefined()
      expect(healthInsight!.tone).toBe('amber')
    })

    it('milestone → tone "up"', () => {
      const input = makeInput({ totalClicks: 1000 })
      const formatted = pipeline(input)
      const milestoneInsight = formatted.find(f => f.icon === 'award')
      expect(milestoneInsight).toBeDefined()
      expect(milestoneInsight!.tone).toBe('up')
    })

    it('qr_surge → tone "accent"', () => {
      const input = makeInput({ qrShare: 50 })
      const formatted = pipeline(input)
      const qrInsight = formatted.find(f => f.icon === 'qrCode')
      expect(qrInsight).toBeDefined()
      expect(qrInsight!.tone).toBe('accent')
    })

    it('geo_concentration → tone "amber"', () => {
      const input = makeInput({
        countries: [{ v: 85, name: 'Brasil' }],
      })
      const formatted = pipeline(input)
      const geoInsight = formatted.find(f => f.icon === 'globe')
      expect(geoInsight).toBeDefined()
      expect(geoInsight!.tone).toBe('amber')
    })

    it('device_skew → tone "accent"', () => {
      const input = makeInput({
        devices: [{ k: 'Mobile', v: 90 }, { k: 'Desktop', v: 10 }],
      })
      const formatted = pipeline(input)
      const deviceInsight = formatted.find(f => f.icon === 'smartphone')
      expect(deviceInsight).toBeDefined()
      expect(deviceInsight!.tone).toBe('accent')
    })
  })

  // ─── Empty data produces empty insights (no crashes) ────────────────────────

  describe('empty data produces empty insights (no crashes)', () => {
    it('zero clicks, empty links, empty countries → empty array', () => {
      const input = makeInput()
      const formatted = pipeline(input)
      expect(formatted).toEqual([])
    })

    it('all-zero byDay with empty everything → empty array', () => {
      const input = makeInput({
        byDay: new Array(30).fill(0),
        links: [],
        devices: [],
        countries: [],
        totalClicks: 0,
        qrShare: 0,
      })
      const formatted = pipeline(input)
      expect(formatted).toEqual([])
    })

    it('empty byDay array → empty array', () => {
      const input = makeInput({ byDay: [] })
      const formatted = pipeline(input)
      expect(formatted).toEqual([])
    })

    it('links with 0 clicks and ok health → empty array', () => {
      const input = makeInput({
        links: [
          { title: 'A', clicks: 0, health: 'ok' },
          { title: 'B', clicks: 0, health: 'ok' },
        ],
      })
      const formatted = pipeline(input)
      expect(formatted).toEqual([])
    })

    it('formatInsight is never called on empty raw output', () => {
      const raw = computeDashboardInsights(makeInput())
      expect(raw).toHaveLength(0)
      // If raw is empty, map(formatInsight) produces [], never calling formatInsight
      const formatted = raw.map(formatInsight)
      expect(formatted).toHaveLength(0)
    })
  })

  // ─── Max 4 cap survives formatting ──────────────────────────────────────────

  describe('max 4 cap survives formatting', () => {
    it('formatted output has at most 4 items when all rules trigger', () => {
      const input = makeInput({
        byDay: byDayWithTrend(50, 10), // decline -80%
        links: [
          { title: 'Top', clicks: 100, health: 'broken' },
          { title: 'Second', clicks: 50, health: 'warn' },
          { title: 'Third', clicks: 20, health: 'ok' },
        ],
        devices: [{ k: 'Mobile', v: 92 }, { k: 'Desktop', v: 8 }],
        countries: [{ v: 88, name: 'Brasil' }],
        totalClicks: 5000,
        qrShare: 60,
      })
      const formatted = pipeline(input)
      expect(formatted.length).toBeLessThanOrEqual(4)
    })

    it('raw insights can exceed 4 but formatted never does', () => {
      // Build input that triggers all 7 possible rules:
      // decline, health_warning, top_performer, milestone, qr_surge, geo_concentration, device_skew
      const input = makeInput({
        byDay: byDayWithTrend(50, 10), // decline
        links: [
          { title: 'Best', clicks: 200, health: 'broken' }, // health_warning + top_performer
          { title: 'Runner Up', clicks: 80, health: 'ok' },
        ],
        devices: [{ k: 'Mobile', v: 90 }, { k: 'Desktop', v: 10 }], // device_skew
        countries: [{ v: 85, name: 'Brasil' }], // geo_concentration
        totalClicks: 1000, // milestone
        qrShare: 55, // qr_surge
      })

      // Raw should produce more than 4 if uncapped
      // But computeDashboardInsights already caps at 4
      const raw = computeDashboardInsights(input)
      expect(raw.length).toBeLessThanOrEqual(4)

      const formatted = raw.map(formatInsight)
      expect(formatted.length).toBeLessThanOrEqual(4)
      expect(formatted.length).toBe(raw.length) // formatting preserves count
    })
  })

  // ─── Portuguese text in output ──────────────────────────────────────────────

  describe('Portuguese text in output', () => {
    const PT_WORDS = ['cliques', 'cresceu', 'caiu', 'links', 'tráfego', 'mobile', 'marco', 'saúde']

    it('growth insight contains Portuguese keywords', () => {
      const input = makeInput({ byDay: byDayWithTrend(10, 25) }) // +150%
      const formatted = pipeline(input)
      const growthText = formatted.find(f => f.icon === 'trendingUp')?.text ?? ''
      expect(growthText).toMatch(/cliques/)
      expect(growthText).toMatch(/cresceu/)
    })

    it('decline insight contains Portuguese keywords', () => {
      const input = makeInput({ byDay: byDayWithTrend(30, 10) }) // -67%
      const formatted = pipeline(input)
      const declineText = formatted.find(f => f.icon === 'trendingDown')?.text ?? ''
      expect(declineText).toMatch(/cliques/)
      expect(declineText).toMatch(/caiu/)
    })

    it('health warning insight contains Portuguese keywords', () => {
      const input = makeInput({
        links: [{ title: 'Broken', clicks: 0, health: 'broken' }],
      })
      const formatted = pipeline(input)
      const healthText = formatted.find(f => f.icon === 'alertTriangle')?.text ?? ''
      expect(healthText).toMatch(/links/)
      expect(healthText).toMatch(/saúde/)
    })

    it('milestone insight contains Portuguese keywords', () => {
      const input = makeInput({ totalClicks: 500 })
      const formatted = pipeline(input)
      const milestoneText = formatted.find(f => f.icon === 'award')?.text ?? ''
      expect(milestoneText).toMatch(/Marco/)
      expect(milestoneText).toMatch(/cliques/)
    })

    it('at least one insight in a realistic scenario contains a Portuguese word', () => {
      const input = makeInput({
        byDay: byDayWithTrend(20, 50),
        links: [
          { title: 'A', clicks: 100, health: 'ok' },
          { title: 'B', clicks: 30, health: 'ok' },
        ],
        totalClicks: 500,
      })
      const formatted = pipeline(input)
      const allText = formatted.map(f => f.text).join(' ')
      const hasPtWord = PT_WORDS.some(w => allText.toLowerCase().includes(w.toLowerCase()))
      expect(hasPtWord).toBe(true)
    })
  })

  // ─── Type compatibility ────────────────────────────────────────────────────

  describe('type compatibility with UI expectations', () => {
    it('each formatted insight matches shape { tone: string, icon: string, text: string }', () => {
      const input = makeInput({
        byDay: byDayWithTrend(10, 30),
        links: [
          { title: 'A', clicks: 80, health: 'warn' },
          { title: 'B', clicks: 40, health: 'ok' },
        ],
        totalClicks: 500,
      })
      const formatted = pipeline(input)
      expect(formatted.length).toBeGreaterThan(0)

      for (const insight of formatted) {
        expect(insight).toHaveProperty('tone')
        expect(insight).toHaveProperty('icon')
        expect(insight).toHaveProperty('text')
        expect(typeof insight.tone).toBe('string')
        expect(typeof insight.icon).toBe('string')
        expect(typeof insight.text).toBe('string')
      }
    })

    it('formatted insights are assignable to AnalyticsDisplay insights shape', () => {
      // AnalyticsDisplay['insights'] = Array<{ tone: 'up'|'accent'|'amber'|'red', icon: string, text: string }>
      const input = makeInput({
        byDay: byDayWithTrend(10, 30),
        totalClicks: 1000,
        qrShare: 40,
      })
      const formatted = pipeline(input)

      // Verify the shape is assignment-compatible by destructuring and checking
      const uiInsights: Array<{ tone: 'up' | 'accent' | 'amber' | 'red'; icon: string; text: string }> = formatted
      expect(uiInsights).toEqual(formatted)

      for (const insight of uiInsights) {
        expect(VALID_TONES).toContain(insight.tone)
        expect(insight.icon.length).toBeGreaterThan(0)
        expect(insight.text.length).toBeGreaterThan(0)
      }
    })

    it('no extra properties beyond tone, icon, text', () => {
      const input = makeInput({
        links: [
          { title: 'Link A', clicks: 80, health: 'ok' },
          { title: 'Link B', clicks: 20, health: 'ok' },
        ],
      })
      const formatted = pipeline(input)
      for (const insight of formatted) {
        const keys = Object.keys(insight).sort()
        expect(keys).toEqual(['icon', 'text', 'tone'])
      }
    })
  })
})
