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
})
