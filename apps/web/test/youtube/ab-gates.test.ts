import { describe, it, expect } from 'vitest'
import { computeGates } from '@/lib/youtube/ab-gates'
import type { GateInput } from '@/lib/youtube/ab-gates'

function makeInput(overrides?: Partial<GateInput>): GateInput {
  return {
    confidence: 0.97, threshold: 0.95, minImpressions: [1200, 1500],
    daysSinceStart: 10, confirmedCycles: 16, burnInDays: 2, variantCount: 2,
    eligibleCycles: 14, consecutiveConfident: 3, stabilityThreshold: 3,
    ...overrides,
  }
}

describe('computeGates', () => {
  it('returns 6 gates', () => {
    expect(computeGates(makeInput())).toHaveLength(6)
  })
  it('all pass when all criteria met', () => {
    expect(computeGates(makeInput()).every(g => g.passed)).toBe(true)
  })
  it('confidence gate fails below threshold', () => {
    const g = computeGates(makeInput({ confidence: 0.80 }))
    expect(g[0]!.passed).toBe(false)
    expect(g[0]!.hint).toContain('more')
  })
  it('impressions gate fails when any variant < 1000', () => {
    const g = computeGates(makeInput({ minImpressions: [500, 1500] }))
    expect(g[1]!.passed).toBe(false)
  })
  it('duration gate fails before 7 days', () => {
    const g = computeGates(makeInput({ daysSinceStart: 3 }))
    expect(g[2]!.passed).toBe(false)
    expect(g[2]!.hint).toContain('4 days')
  })
  it('cycles gate fails below threshold', () => {
    const g = computeGates(makeInput({ confirmedCycles: 8 }))
    expect(g[3]!.passed).toBe(false)
  })
  it('burn-in gate passes when burnInDays is 0', () => {
    const g = computeGates(makeInput({ burnInDays: 0 }))
    expect(g[4]!.passed).toBe(true)
    expect(g[4]!.value).toBe('Skipped')
  })
  it('burn-in gate fails when no eligible cycles after burn-in', () => {
    const g = computeGates(makeInput({ eligibleCycles: 0, burnInDays: 2 }))
    expect(g[4]!.passed).toBe(false)
  })
  it('stability gate fails when consecutive < threshold', () => {
    const g = computeGates(makeInput({ consecutiveConfident: 1 }))
    expect(g[5]!.passed).toBe(false)
  })
  it('each gate has name, passed, value', () => {
    const gates = computeGates(makeInput())
    for (const g of gates) {
      expect(g).toHaveProperty('name')
      expect(g).toHaveProperty('passed')
      expect(g).toHaveProperty('value')
    }
  })
  it('empty impressions array fails', () => {
    const g = computeGates(makeInput({ minImpressions: [] }))
    expect(g[1]!.passed).toBe(false)
  })
  it('boundary: exactly 1000 impressions passes', () => {
    const g = computeGates(makeInput({ minImpressions: [1000, 2000] }))
    expect(g[1]!.passed).toBe(true)
  })
  it('boundary: exactly 7 days passes', () => {
    const g = computeGates(makeInput({ daysSinceStart: 7 }))
    expect(g[2]!.passed).toBe(true)
  })
  it('single variant needs 7 cycles', () => {
    const g = computeGates(makeInput({ variantCount: 1, confirmedCycles: 7 }))
    expect(g[3]!.passed).toBe(true)
  })
})
