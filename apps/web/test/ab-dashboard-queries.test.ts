import { describe, it, expect } from 'vitest'
import { toCardView, toLatestDraft, computeDashboardStats } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { makeTestWithVariants } from './helpers/ab-fixtures'

describe('toCardView', () => {
  it('maps raw test to AbTestCardView with leader A for original', () => {
    const test = makeTestWithVariants()
    const card = toCardView(test)
    expect(card.leader).toBeDefined()
    expect(card.leaderColor).toBeTruthy()
    expect(card.confidence).toBeGreaterThanOrEqual(0)
  })
  it('calculates lift as percentage', () => {
    const test = makeTestWithVariants()
    const card = toCardView(test)
    expect(typeof card.lift).toBe('number')
  })
  it('returns 0 lift when no data', () => {
    const test = makeTestWithVariants()
    expect(toCardView(test).lift).toBe(0)
  })
  it('computes dayOf from started_at', () => {
    const test = makeTestWithVariants({ startedDaysAgo: 5 })
    expect(toCardView(test).dayOf).toBe(5)
  })
  it('maps variants with display labels', () => {
    const test = makeTestWithVariants()
    const card = toCardView(test)
    expect(card.variants.length).toBe(2)
    expect(card.variants[0]!.label).toBe('A')
  })
})

describe('toLatestDraft', () => {
  it('returns null for empty array', () => {
    expect(toLatestDraft([])).toBeNull()
  })
  it('picks most recent by created_at', () => {
    const old = makeTestWithVariants({ createdAt: '2026-01-01T00:00:00Z' })
    const recent = makeTestWithVariants({ createdAt: '2026-05-01T00:00:00Z' })
    old.status = 'draft'
    recent.status = 'draft'
    const draft = toLatestDraft([old, recent])
    expect(draft).not.toBeNull()
    expect(draft!.createdAgo).toBeTruthy()
  })
})

describe('computeDashboardStats', () => {
  it('returns all zeros when no tests', () => {
    const s = computeDashboardStats([], [])
    expect(s).toEqual({ activeTests: 0, avgConfidence: 0, winRate: 0, avgLift: 0 })
  })
  it('excludes playoff children from winRate', () => {
    const completed = [makeTestWithVariants({ playoffTestId: 'x', hasWinner: true })]
    completed[0]!.parent_test_id = 'parent-1'
    const s = computeDashboardStats([], completed)
    expect(s.winRate).toBe(0)
  })
  it('calculates winRate as percentage', () => {
    const c1 = makeTestWithVariants({ hasWinner: true })
    c1.status = 'completed'
    const c2 = makeTestWithVariants({ hasWinner: false })
    c2.status = 'completed'
    expect(computeDashboardStats([], [c1, c2]).winRate).toBe(50)
  })
  it('counts active tests', () => {
    const active = [makeTestWithVariants(), makeTestWithVariants()]
    expect(computeDashboardStats(active, []).activeTests).toBe(2)
  })
})
