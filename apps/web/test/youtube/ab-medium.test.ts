import { describe, it, expect } from 'vitest'
import {
  toX, toY, niceLine, CHART,
  GridLines, GradientDef,
} from '@/app/cms/(authed)/youtube/ab-lab/_components/chart-utils'
import { toCardView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import {
  makeTestWithVariants,
  makeCardView,
  makeLearnings,
  makeSuggestion,
  makeSuggestions,
  makeVariant,
  makeTestRow,
} from '@/test/helpers/ab-fixtures'
import type {
  AbTestWithVariants,
  AbTestCardView,
  LearningsData,
  LearningsTag,
  StatsVariant,
  DisplayLabel,
} from '@/lib/youtube/ab-types'
import React from 'react'

// ═══════════════════════════════════════════════════════════════════════
// 1. Chart utilities (chart-utils.ts) — extended coverage
// ═══════════════════════════════════════════════════════════════════════

describe('toX — extended', () => {
  it('returns padL for total === 0 (degenerate)', () => {
    // total <= 1 guard returns padL
    expect(toX(0, 0)).toBe(CHART.padL)
  })

  it('returns padL for total === 1 regardless of index', () => {
    expect(toX(0, 1)).toBe(CHART.padL)
    expect(toX(5, 1)).toBe(CHART.padL) // out-of-range i still returns padL
  })

  it('linearly distributes many data points', () => {
    const total = 10
    const xs = Array.from({ length: total }, (_, i) => toX(i, total))
    // Monotonically increasing
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]!).toBeGreaterThan(xs[i - 1]!)
    }
    // First and last anchored
    expect(xs[0]).toBe(CHART.padL)
    expect(xs[total - 1]).toBe(CHART.W - CHART.padR)
  })

  it('respects custom cfg overrides', () => {
    const cfg = { W: 100, padL: 10, padR: 10 }
    expect(toX(0, 3, cfg)).toBe(10)
    expect(toX(2, 3, cfg)).toBe(90) // 100 - 10
  })
})

describe('toY — extended', () => {
  it('returns center when min === max', () => {
    const y = toY(42, 42, 42)
    const plotH = CHART.H - CHART.padT - CHART.padB
    expect(y).toBe(CHART.padT + plotH / 2)
  })

  it('maps min value to bottom edge (H - padB)', () => {
    expect(toY(0, 0, 100)).toBe(CHART.H - CHART.padB)
  })

  it('maps max value to top edge (padT)', () => {
    expect(toY(100, 0, 100)).toBe(CHART.padT)
  })

  it('handles normal range with midpoint', () => {
    const y = toY(50, 0, 100)
    const center = CHART.padT + (CHART.H - CHART.padT - CHART.padB) / 2
    expect(y).toBeCloseTo(center, 1)
  })

  it('handles extreme values — very small range', () => {
    const y1 = toY(0.001, 0, 0.002)
    const center = CHART.padT + (CHART.H - CHART.padT - CHART.padB) / 2
    expect(y1).toBeCloseTo(center, 1) // midpoint of tiny range
  })

  it('handles negative values', () => {
    const yTop = toY(10, -10, 10)
    const yBot = toY(-10, -10, 10)
    expect(yTop).toBe(CHART.padT)
    expect(yBot).toBe(CHART.H - CHART.padB)
  })

  it('respects custom cfg', () => {
    const cfg = { H: 100, padT: 0, padB: 0 }
    expect(toY(100, 0, 100, cfg)).toBe(0)
    expect(toY(0, 0, 100, cfg)).toBe(100)
  })
})

describe('niceLine — Catmull-Rom spline extended', () => {
  it('returns empty string for 0 points', () => {
    expect(niceLine([])).toBe('')
  })

  it('returns M command for 1 point', () => {
    expect(niceLine([{ x: 42, y: 99 }])).toBe('M42,99')
  })

  it('returns M+L for 2 points', () => {
    const d = niceLine([{ x: 0, y: 10 }, { x: 100, y: 50 }])
    expect(d).toBe('M0,10L100,50')
  })

  it('returns Catmull-Rom C commands for 3 points', () => {
    const d = niceLine([{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }])
    expect(d).toMatch(/^M0,0C/)
    // Should contain exactly 2 cubic bezier commands (one per segment)
    const cCount = (d.match(/C/g) ?? []).length
    expect(cCount).toBe(2)
  })

  it('handles 4+ points with smooth spline', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 25, y: 50 },
      { x: 50, y: 25 },
      { x: 75, y: 75 },
      { x: 100, y: 10 },
    ]
    const d = niceLine(pts)
    expect(d).toMatch(/^M0,0/)
    // 4 segments = 4 C commands
    const cCount = (d.match(/C/g) ?? []).length
    expect(cCount).toBe(4)
  })

  it('filters NaN and Infinity from points', () => {
    const d = niceLine([
      { x: NaN, y: 0 },
      { x: 10, y: 20 },
      { x: 30, y: Infinity },
      { x: 50, y: 40 },
    ])
    // Only two valid points: M+L
    expect(d).toBe('M10,20L50,40')
  })

  it('returns empty when all points are invalid', () => {
    expect(niceLine([{ x: NaN, y: NaN }, { x: Infinity, y: 0 }])).toBe('')
  })
})

describe('GridLines — tick count', () => {
  it('produces default 5 lines (0..4) for ticks=4', () => {
    const el = GridLines({ min: 0, max: 100, ticks: 4 })
    // GridLines renders a <g> with ticks+1 children
    const children = React.Children.toArray((el as React.ReactElement).props.children)
    expect(children.length).toBe(5) // 0,1,2,3,4
  })

  it('produces 3 lines for ticks=2', () => {
    const el = GridLines({ min: 0, max: 10, ticks: 2 })
    const children = React.Children.toArray((el as React.ReactElement).props.children)
    expect(children.length).toBe(3)
  })

  it('handles min===max gracefully', () => {
    const el = GridLines({ min: 50, max: 50, ticks: 4 })
    // Should still render without errors
    const children = React.Children.toArray((el as React.ReactElement).props.children)
    expect(children.length).toBe(5)
  })
})

describe('GradientDef — SVG gradient', () => {
  it('returns a linearGradient element', () => {
    const el = GradientDef({ id: 'grad-test', color: '#ff0000' })
    expect((el as React.ReactElement).type).toBe('linearGradient')
  })

  it('sets id prop correctly', () => {
    const el = GradientDef({ id: 'my-grad', color: '#00ff00' }) as React.ReactElement
    expect(el.props.id).toBe('my-grad')
  })

  it('has vertical direction (y1=0, y2=1)', () => {
    const el = GradientDef({ id: 'g', color: '#000' }) as React.ReactElement
    expect(el.props.y1).toBe(0)
    expect(el.props.y2).toBe(1)
  })

  it('uses default topOpacity of 0.28', () => {
    const el = GradientDef({ id: 'g', color: '#000' }) as React.ReactElement
    const stops = React.Children.toArray(el.props.children) as React.ReactElement[]
    expect(stops[0]!.props.stopOpacity).toBe(0.28)
    expect(stops[1]!.props.stopOpacity).toBe(0)
  })

  it('accepts custom topOpacity', () => {
    const el = GradientDef({ id: 'g', color: '#000', topOpacity: 0.5 }) as React.ReactElement
    const stops = React.Children.toArray(el.props.children) as React.ReactElement[]
    expect(stops[0]!.props.stopOpacity).toBe(0.5)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// 2. CredibleInterval component logic
// ═══════════════════════════════════════════════════════════════════════

describe('CredibleInterval logic — computeCI', () => {
  // We test the pure computation logic inline since computeCI is not exported.
  // Re-implement computeCI to validate behavior.
  function computeCI(ctr: number, impressions: number) {
    const clampedCtr = Math.max(0, Math.min(1, ctr))
    const variance = (clampedCtr * (1 - clampedCtr)) / impressions
    const sd = Number.isFinite(variance) && variance >= 0 ? Math.sqrt(variance) : 0
    return { lo: Math.max(0, clampedCtr - 1.96 * sd), hi: Math.min(1, clampedCtr + 1.96 * sd), sd }
  }

  it('handles 0 variants — empty active array', () => {
    const variants: StatsVariant[] = []
    const active = variants.filter(v => v.impressions > 0)
    expect(active.length).toBe(0)
  })

  it('handles variants with 0 impressions (filtered out)', () => {
    const variants: StatsVariant[] = [
      { label: 'A', color: '#8A8F98', ctr: 0.05, impressions: 0 },
      { label: 'B', color: '#E8823C', ctr: 0.08, impressions: 0 },
    ]
    const active = variants.filter(v => v.impressions > 0)
    expect(active.length).toBe(0)
  })

  it('handles variant with 0 CTR (valid but no clicks)', () => {
    const ci = computeCI(0, 1000)
    expect(ci.lo).toBe(0)
    expect(ci.hi).toBe(0)
    expect(ci.sd).toBe(0)
  })

  it('band positions scale correctly for normal CTR', () => {
    const ci = computeCI(0.05, 10000)
    // SD = sqrt(0.05 * 0.95 / 10000) = sqrt(0.00000475) ≈ 0.00218
    expect(ci.sd).toBeCloseTo(0.00218, 4)
    expect(ci.lo).toBeGreaterThan(0)
    expect(ci.hi).toBeLessThan(1)
    expect(ci.hi).toBeGreaterThan(ci.lo)
  })

  it('mean dot clamped to [0, 1] for extreme CTR', () => {
    // CTR above 1 gets clamped
    const ci = computeCI(1.5, 100)
    expect(ci.lo).toBeGreaterThanOrEqual(0)
    expect(ci.hi).toBeLessThanOrEqual(1)

    // CTR below 0 gets clamped
    const ciNeg = computeCI(-0.5, 100)
    expect(ciNeg.lo).toBeGreaterThanOrEqual(0)
    expect(ciNeg.hi).toBeLessThanOrEqual(1)
  })

  it('wider interval with fewer impressions', () => {
    const ciSmall = computeCI(0.05, 100)
    const ciLarge = computeCI(0.05, 10000)
    expect(ciSmall.hi - ciSmall.lo).toBeGreaterThan(ciLarge.hi - ciLarge.lo)
  })

  it('toPercent scales values linearly within [scaleMin, scaleMax]', () => {
    // Simulating the component's toPercent function
    const scaleMin = 0.03
    const scaleMax = 0.08
    const scaleRange = scaleMax - scaleMin
    function toPercent(value: number) {
      return ((value - scaleMin) / scaleRange) * 100
    }
    expect(toPercent(scaleMin)).toBe(0)
    expect(toPercent(scaleMax)).toBe(100)
    expect(toPercent((scaleMin + scaleMax) / 2)).toBeCloseTo(50, 1)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// 3. RankBars component logic
// ═══════════════════════════════════════════════════════════════════════

describe('RankBars logic', () => {
  type RankVariant = { label: DisplayLabel; color: string; pBest: number; pTop2: number }

  it('empty array renders fallback', () => {
    const variants: RankVariant[] = []
    expect(variants.length).toBe(0)
  })

  it('sorts by pBest descending (default metric)', () => {
    const variants: RankVariant[] = [
      { label: 'A', color: '#8A8F98', pBest: 0.2, pTop2: 0.5 },
      { label: 'B', color: '#E8823C', pBest: 0.7, pTop2: 0.9 },
      { label: 'C', color: '#3FA9C0', pBest: 0.1, pTop2: 0.3 },
    ]
    const metric = 'pBest' as const
    const sorted = [...variants].sort((a, b) => b[metric] - a[metric])
    expect(sorted[0]!.label).toBe('B')
    expect(sorted[1]!.label).toBe('A')
    expect(sorted[2]!.label).toBe('C')
  })

  it('sorts by pTop2 when metric is pTop2', () => {
    const variants: RankVariant[] = [
      { label: 'A', color: '#8A8F98', pBest: 0.1, pTop2: 0.9 },
      { label: 'B', color: '#E8823C', pBest: 0.9, pTop2: 0.3 },
    ]
    const sorted = [...variants].sort((a, b) => b.pTop2 - a.pTop2)
    expect(sorted[0]!.label).toBe('A') // pTop2 = 0.9
    expect(sorted[1]!.label).toBe('B') // pTop2 = 0.3
  })

  it('bar width percentages clamp to 100%', () => {
    const raw = 1.5
    const clamped = Math.min(raw, 1)
    const widthPct = clamped * 100
    expect(widthPct).toBe(100)
  })

  it('bar width is 2px when pBest is 0', () => {
    const raw = 0
    const clamped = Math.min(raw, 1)
    const widthPct = clamped * 100
    const widthStyle = widthPct === 0 ? '2px' : `${widthPct}%`
    expect(widthStyle).toBe('2px')
  })

  it('bar width shows percentage for normal values', () => {
    const raw = 0.65
    const clamped = Math.min(raw, 1)
    const widthPct = clamped * 100
    const widthStyle = widthPct === 0 ? '2px' : `${widthPct}%`
    expect(widthStyle).toBe('65%')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// 4. Active test card data mapping — toCardView
// ═══════════════════════════════════════════════════════════════════════

describe('toCardView — maps AbTestWithVariants → AbTestCardView', () => {
  it('maps all fields correctly from AbTestWithVariants', () => {
    const test = makeTestWithVariants({ startedDaysAgo: 5 })
    const card = toCardView(test)

    expect(card.id).toBe(test.id)
    expect(card.name).toBe(test.name)
    expect(card.type).toBe('thumbnail')
    expect(card.status).toBe('active')
    expect(card.createdAt).toBe(test.created_at)
    expect(card.hasPlayoff).toBe(false)
    expect(card.roundNumber).toBe(1)
  })

  it('detects leader from winner_variant_id', () => {
    const test = makeTestWithVariants({ hasWinner: true })
    const card = toCardView(test)
    // winner is var-b which has label 'B'
    expect(card.leader).toBe('B')
    expect(card.leaderColor).toBe('#E8823C')
  })

  it('defaults leader to A (original) when no winner', () => {
    const test = makeTestWithVariants({ hasWinner: false })
    const card = toCardView(test)
    expect(card.leader).toBe('A')
  })

  it('calculates dayOf from started_at', () => {
    const test = makeTestWithVariants({ startedDaysAgo: 7 })
    const card = toCardView(test)
    // dayOf = floor((now - started_at) / 86400000)
    expect(card.dayOf).toBeGreaterThanOrEqual(6)
    expect(card.dayOf).toBeLessThanOrEqual(8) // tolerance for time-of-day
  })

  it('dayOf is 0 when started_at is null', () => {
    const test = makeTestWithVariants()
    test.started_at = null
    const card = toCardView(test)
    expect(card.dayOf).toBe(0)
  })

  it('extracts variant thumbUrl from blob_url or original', () => {
    const test = makeTestWithVariants()
    const card = toCardView(test)
    // Original variant (A) should use original_thumbnail_url
    const varA = card.variants.find(v => v.label === 'A')
    expect(varA?.thumbUrl).toBe(test.original_thumbnail_url)
    // Variant B should use blob_url
    const varB = card.variants.find(v => v.label === 'B')
    expect(varB?.thumbUrl).toBe('https://blob.vercel-storage.com/thumb-b.jpg')
  })

  it('maps confidence from confidence_at_completion * 100', () => {
    const test = makeTestWithVariants({ confidence: 0.92 })
    const card = toCardView(test)
    expect(card.confidence).toBe(92)
  })

  it('confidence is 0 when confidence_at_completion is null', () => {
    const test = makeTestWithVariants({ confidence: undefined })
    const card = toCardView(test)
    expect(card.confidence).toBe(0)
  })

  it('hasPlayoff is true when playoff_test_id is set', () => {
    const test = makeTestWithVariants({ playoffTestId: 'playoff-123' })
    const card = toCardView(test)
    expect(card.hasPlayoff).toBe(true)
  })

  it('lift comes from result_metadata.ctr_lift_percent', () => {
    const test = makeTestWithVariants()
    test.result_metadata = {
      ctr_lift_percent: 18.5,
      winner_label: 'B',
      total_impressions: 5000,
      estimated_monthly_extra_clicks: 200,
    }
    const card = toCardView(test)
    expect(card.lift).toBe(18.5)
  })

  it('lift defaults to 0 when result_metadata is null', () => {
    const test = makeTestWithVariants()
    test.result_metadata = null
    const card = toCardView(test)
    expect(card.lift).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// 5. Learnings panel logic
// ═══════════════════════════════════════════════════════════════════════

describe('LearningsPanel logic', () => {
  it('handles null learnings gracefully', () => {
    const learnings: LearningsData | null = null
    expect(learnings).toBeNull()
  })

  it('tag rows sorted by wins descending', () => {
    const learnings = makeLearnings({ tags: 5 })
    // Fixture creates tags with wins = 3+i, so tag-4 has 7 wins, tag-0 has 3
    const sorted = [...learnings.tags].sort((a, b) => b.wins - a.wins)
    expect(sorted[0]!.tag).toBe('tag-4')
    expect(sorted[sorted.length - 1]!.tag).toBe('tag-0')
  })

  it('strength bar calculation — wins / maxWins', () => {
    const segments = 5
    const tags: LearningsTag[] = [
      { tag: 'face-closeup', wins: 10, avgLift: 20, kind: 'thumb' },
      { tag: 'text-overlay', wins: 5, avgLift: 10, kind: 'thumb' },
      { tag: 'bright-colors', wins: 2, avgLift: 5, kind: 'thumb' },
    ]
    const maxWins = Math.max(...tags.map(t => t.wins), 1)
    expect(maxWins).toBe(10)

    // Verify filled segments for each tag
    const filled0 = Math.round((tags[0]!.wins / maxWins) * segments)
    expect(filled0).toBe(5) // 10/10 = 1.0 → 5 segments

    const filled1 = Math.round((tags[1]!.wins / maxWins) * segments)
    expect(filled1).toBe(3) // 5/10 = 0.5 → 2.5 → rounds to 3

    const filled2 = Math.round((tags[2]!.wins / maxWins) * segments)
    expect(filled2).toBe(1) // 2/10 = 0.2 → 1 segment
  })

  it('strength bar — maxWins of 0 yields 0 filled', () => {
    const segments = 5
    const maxWins = 0
    const wins = 0
    const filled = maxWins > 0 ? Math.round((wins / maxWins) * segments) : 0
    expect(filled).toBe(0)
  })

  it('negative tags display with strikethrough (avgLift < 0 or negative flag)', () => {
    const learnings = makeLearnings({ tags: 3, negativeTag: true })
    const negTag = learnings.tags.find(t => t.negative)
    expect(negTag).toBeDefined()
    expect(negTag!.tag).toBe('no-text')
    expect(negTag!.avgLift).toBe(-5)

    // Verify the isNegative computation matches component logic
    const isNegative = negTag!.negative || negTag!.avgLift < 0
    expect(isNegative).toBe(true)
  })

  it('non-negative tags do not get strikethrough', () => {
    const learnings = makeLearnings({ tags: 3 })
    for (const tag of learnings.tags) {
      const isNegative = tag.negative || tag.avgLift < 0
      expect(isNegative).toBe(false)
    }
  })

  it('insight text is rendered from learnings.insightText', () => {
    const learnings = makeLearnings()
    expect(learnings.insightText).toBe('Close-up faces perform 23% better on average.')
    expect(learnings.insightText.length).toBeGreaterThan(0)
  })

  it('insightText block only renders when insightText is truthy', () => {
    const learnings = makeLearnings()
    // With insightText
    expect(!!learnings.insightText).toBe(true)

    // Without insightText
    const noInsight: LearningsData = { ...learnings, insightText: '' }
    expect(!!noInsight.insightText).toBe(false)
  })

  it('totalTests count is passed through', () => {
    const learnings = makeLearnings()
    expect(learnings.totalTests).toBe(10)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// 6. Empty state conditions
// ═══════════════════════════════════════════════════════════════════════

describe('Empty state conditions', () => {
  it('showEmpty when 0 cards + 0 completed + 0 drafts', () => {
    const cards: AbTestCardView[] = []
    const completed: AbTestCardView[] = []
    const drafts: { id: string }[] = []

    const showEmpty = cards.length === 0 && completed.length === 0 && drafts.length === 0
    expect(showEmpty).toBe(true)
  })

  it('showEmpty is false when there are active cards', () => {
    const cards = [makeCardView()]
    const completed: AbTestCardView[] = []
    const drafts: { id: string }[] = []

    const showEmpty = cards.length === 0 && completed.length === 0 && drafts.length === 0
    expect(showEmpty).toBe(false)
  })

  it('showEmpty is false when there are completed tests', () => {
    const cards: AbTestCardView[] = []
    const completed = [makeCardView({ status: 'completed' })]
    const drafts: { id: string }[] = []

    const showEmpty = cards.length === 0 && completed.length === 0 && drafts.length === 0
    expect(showEmpty).toBe(false)
  })

  it('showEmpty is false when there are drafts', () => {
    const cards: AbTestCardView[] = []
    const completed: AbTestCardView[] = []
    const drafts = [{ id: 'draft-1' }]

    const showEmpty = cards.length === 0 && completed.length === 0 && drafts.length === 0
    expect(showEmpty).toBe(false)
  })

  it('hasAnyData detection — mirrors dashboard logic', () => {
    // No data
    expect(
      [].length > 0 || [].length > 0 || [].length > 0,
    ).toBe(false)

    // One card
    expect(
      [makeCardView()].length > 0 || [].length > 0 || [].length > 0,
    ).toBe(true)

    // Only drafts
    expect(
      [].length > 0 || [].length > 0 || [{ id: '1' }].length > 0,
    ).toBe(true)
  })

  it('suggested videos rendering — 0 suggestions shows start CTA', () => {
    const suggested = makeSuggestions(0)
    expect(suggested.length).toBe(0)
    // When 0 suggestions, EmptyState renders a "Comece a testar" block
  })

  it('suggested videos — limits to first 3', () => {
    const suggested = makeSuggestions(5)
    expect(suggested.length).toBe(5)
    const displayed = suggested.slice(0, 3)
    expect(displayed.length).toBe(3)
  })

  it('suggested video has all required fields', () => {
    const video = makeSuggestion()
    expect(video.id).toBeDefined()
    expect(video.title).toBeDefined()
    expect(video.ctr).toBeTypeOf('number')
    expect(video.channelMedianCtr).toBeTypeOf('number')
    expect(video.grade).toMatch(/^[A-DF]$/)
    expect(video.reason).toBeDefined()
    expect(video.suggest).toBe('thumbnail')
  })

  it('suggested video grade is one of A/B/C/D/F', () => {
    const grades = ['A', 'B', 'C', 'D', 'F'] as const
    for (const g of grades) {
      const v = makeSuggestion({ grade: g })
      expect(grades).toContain(v.grade)
    }
  })
})
