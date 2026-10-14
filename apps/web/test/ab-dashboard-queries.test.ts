import { describe, it, expect } from 'vitest'
import { toCardView, toLatestDraft, computeDashboardStats } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { makeTestWithVariants } from './helpers/ab-fixtures'
import type { AbTestWithVariants } from '@/lib/youtube/ab-types'

describe('toCardView', () => {
  it('maps raw test to AbTestCardView with leader A for original', () => {
    const test = makeTestWithVariants()
    const card = toCardView(test)
    expect(card.leader).toBeDefined()
    expect(card.leaderColor).toBeTruthy()
    expect(card.confidence).toBeNull()
  })
  it('calculates lift as percentage', () => {
    const test = makeTestWithVariants()
    test.result_metadata = { ctr_lift_percent: 7.5, winner_label: 'B', total_impressions: 100, estimated_monthly_extra_clicks: 1 }
    const card = toCardView(test)
    expect(card.lift).toBe(7.5)
  })
  it('lift é nulo (nunca 0) quando não há medição', () => {
    const test = makeTestWithVariants()
    expect(toCardView(test).lift).toBeNull()
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
  type Razao = AbTestWithVariants['completed_reason']
  function concluido(reason: Razao, comVencedor: boolean) {
    const t = makeTestWithVariants({ hasWinner: comVencedor })
    t.status = 'completed'
    t.completed_reason = reason
    return t
  }

  it('sem testes: winRate null (não 0) e sem avgConfidence/avgLift', () => {
    const s = computeDashboardStats([], [])
    expect(s).toEqual({ activeTests: 0, winRate: null, completedTests: 0, testsWon: 0 })
    expect(s).not.toHaveProperty('avgConfidence')
    expect(s).not.toHaveProperty('avgLift')
  })
  it('exclui filho de playoff: sem teste que conte, winRate null', () => {
    const c = concluido('manual_apply', true)
    c.parent_test_id = 'parent-1'
    expect(computeDashboardStats([], [c]).winRate).toBeNull()
  })
  it('um manual com vencedor, um auto_resolve, um inconclusivo: 1 de 2 = 50 (mesma regra do pipeline)', () => {
    const manual = concluido('manual_apply', true)
    const auto = concluido('auto_resolve', true)
    const inconclusivo = concluido('max_duration', false)
    const s = computeDashboardStats([], [manual, auto, inconclusivo])
    expect(s.winRate).toBe(50)
    expect(s.testsWon).toBe(1)
    expect(s.completedTests).toBe(2)
  })
  it('só auto_resolve: nenhum teste conta, winRate null', () => {
    const s = computeDashboardStats([], [concluido('auto_resolve', true)])
    expect(s.winRate).toBeNull()
  })
  it('razão desconhecida (null) fica fora do numerador e do denominador', () => {
    const s = computeDashboardStats([], [concluido(null, true), concluido('manual_apply', true)])
    expect(s.winRate).toBe(100)
  })
  it('counts active tests', () => {
    const active = [makeTestWithVariants(), makeTestWithVariants()]
    expect(computeDashboardStats(active, []).activeTests).toBe(2)
  })
})
