import { describe, it, expect } from 'vitest'
import { computeConversion, matchGoal, type Goal, type GoalResult } from './goals.js'

describe('matchGoal', () => {
  it('matches when clicks >= threshold', () => {
    const goal: Goal = { id: 'g1', name: 'Test', metric: 'clicks', threshold: 100, linkId: 'l1' }
    expect(matchGoal(goal, 150)).toBe(true)
  })

  it('does not match when clicks < threshold', () => {
    const goal: Goal = { id: 'g1', name: 'Test', metric: 'clicks', threshold: 100, linkId: 'l1' }
    expect(matchGoal(goal, 50)).toBe(false)
  })

  it('matches exactly at threshold', () => {
    const goal: Goal = { id: 'g1', name: 'Test', metric: 'clicks', threshold: 100, linkId: 'l1' }
    expect(matchGoal(goal, 100)).toBe(true)
  })
})

describe('computeConversion', () => {
  it('computes conversion rate from views and clicks', () => {
    const result = computeConversion(1000, 150)
    expect(result.rate).toBeCloseTo(15.0, 0)
    expect(result.views).toBe(1000)
    expect(result.conversions).toBe(150)
  })

  it('returns 0 when no views', () => {
    const result = computeConversion(0, 0)
    expect(result.rate).toBe(0)
  })

  it('caps rate at 100', () => {
    const result = computeConversion(50, 100)
    expect(result.rate).toBe(100)
  })

  it('formats label correctly', () => {
    const result = computeConversion(1000, 250)
    expect(result.label).toBe('25.0%')
  })

  it('handles large numbers', () => {
    const result = computeConversion(1000000, 50000)
    expect(result.rate).toBeCloseTo(5.0, 0)
  })

  it('returns progress as 0-1 fraction', () => {
    const result = computeConversion(200, 50)
    expect(result.progress).toBeCloseTo(0.25, 2)
  })
})
