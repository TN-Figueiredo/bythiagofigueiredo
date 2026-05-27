import { describe, it, expect } from 'vitest'
import { computeUrgencyScore } from '../../src/lib/pipeline/compute-urgency-score'
import type { Stage } from '../../src/lib/pipeline/up-next-constants'

describe('computeUrgencyScore', () => {
  const baseArgs = {
    today: '2026-05-26',
    stage: 'roteiro' as Stage,
    effortMinutes: 180,
  }

  it('returns a number between 0 and 100', () => {
    const score = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-26' })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('overdue items score higher than today items', () => {
    const overdue = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-24' })
    const today = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-26' })
    expect(overdue).toBeGreaterThan(today)
  })

  it('today items score higher than this_week items', () => {
    const todayScore = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-26' })
    const thisWeek = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-30' })
    expect(todayScore).toBeGreaterThan(thisWeek)
  })

  it('earlier stage scores higher than later stage (more work remaining)', () => {
    const idea = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-28', stage: 'idea' })
    const ready = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-28', stage: 'ready' })
    expect(idea).toBeGreaterThan(ready)
  })

  it('higher effort scores higher than lower effort', () => {
    const deep = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-28', effortMinutes: 240 })
    const quick = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-28', effortMinutes: 30 })
    expect(deep).toBeGreaterThan(quick)
  })

  it('returns 0 when deadline is null', () => {
    const score = computeUrgencyScore({ ...baseArgs, deadline: null })
    expect(score).toBe(0)
  })

  it('caps at 100 for extremely overdue items', () => {
    const score = computeUrgencyScore({
      ...baseArgs,
      deadline: '2026-05-10',
      stage: 'idea',
      effortMinutes: 240,
    })
    expect(score).toBe(100)
  })

  it('handles scheduled stage (stagesRemaining=0)', () => {
    const score = computeUrgencyScore({
      ...baseArgs,
      deadline: '2026-05-28',
      stage: 'scheduled',
      effortMinutes: 15,
    })
    expect(score).toBeLessThan(50)
  })

  it('handles published stage gracefully', () => {
    const score = computeUrgencyScore({
      ...baseArgs,
      deadline: '2026-05-28',
      stage: 'published',
      effortMinutes: 0,
    })
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('same deadline, same stage: deeper effort ranks higher', () => {
    const a = computeUrgencyScore({ deadline: '2026-05-28', today: '2026-05-26', stage: 'draft', effortMinutes: 120 })
    const b = computeUrgencyScore({ deadline: '2026-05-28', today: '2026-05-26', stage: 'draft', effortMinutes: 30 })
    expect(a).toBeGreaterThan(b)
  })

  it('computes exact score for known inputs (deadline=today, roteiro, 180min)', () => {
    // deadlinePressure = clamp(1 - 0/7, 0, 1.5) = 1.0
    // stagesRemaining = (8 - 3) / 8 = 0.625
    // effortWeight = clamp(180/240, 0, 1) = 0.75
    // raw = (1.0 * 60) + (0.625 * 25) + (0.75 * 15) = 60 + 15.625 + 11.25 = 86.875
    // rounded = 86.9
    const score = computeUrgencyScore({
      deadline: '2026-05-26',
      today: '2026-05-26',
      stage: 'roteiro',
      effortMinutes: 180,
    })
    expect(score).toBe(86.9)
  })

  it('computes exact score for 7-day-out deadline (zero deadline pressure)', () => {
    // deadlinePressure = clamp(1 - 7/7, 0, 1.5) = 0
    // stagesRemaining = (8 - 0) / 8 = 1.0 (idea stage)
    // effortWeight = clamp(120/240, 0, 1) = 0.5
    // raw = (0 * 60) + (1.0 * 25) + (0.5 * 15) = 0 + 25 + 7.5 = 32.5
    const score = computeUrgencyScore({
      deadline: '2026-06-02',
      today: '2026-05-26',
      stage: 'idea',
      effortMinutes: 120,
    })
    expect(score).toBe(32.5)
  })
})
