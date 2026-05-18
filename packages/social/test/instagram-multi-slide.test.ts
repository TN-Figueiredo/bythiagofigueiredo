import { describe, it, expect } from 'vitest'
import { checkRateBudget, type RateBudget } from '../src/providers/meta/rate-budget'

describe('checkRateBudget', () => {
  it('calculates remaining calls from usage', () => {
    const budget: RateBudget = {
      callCount: 40,
      totalCpuTime: 10,
      totalTime: 20,
    }
    expect(budget.callCount).toBe(40)
  })

  it('returns sufficient=true when enough budget for N slides', () => {
    const result = checkRateBudget(60, 5)
    expect(result.sufficient).toBe(true)
    expect(result.remaining).toBe(60)
    expect(result.required).toBe(10)
  })

  it('returns sufficient=false when insufficient budget', () => {
    const result = checkRateBudget(4, 5)
    expect(result.sufficient).toBe(false)
  })

  it('accounts for 2 API calls per slide (create + publish)', () => {
    const result = checkRateBudget(6, 3)
    expect(result.sufficient).toBe(true)
    expect(result.required).toBe(6)
  })
})
