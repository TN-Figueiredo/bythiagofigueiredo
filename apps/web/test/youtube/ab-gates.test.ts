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
  it('F18: 3 variants with 14 confirmed cycles fails min_cycles (needs 21)', () => {
    const g = computeGates(makeInput({ variantCount: 3, confirmedCycles: 14 }))
    expect(g[3]!.passed).toBe(false)
    expect(g[3]!.value).toBe('14 / 21 cycles')
  })
  describe('S8-F2: nao_medido', () => {
    it('minImpressions com nulo dá "não medido", nunca 0', () => {
      const g = computeGates(makeInput({ minImpressions: [null, 1500] }))
      expect(g[1]!.passed).toBe(false)
      expect(g[1]!.value).toBe('não medido')
      expect(g[1]!.estado).toBe('nao_medido')
      expect(g[1]!.value).not.toContain('0')
    })
    it('confidence nula dá "não medido"', () => {
      const g = computeGates(makeInput({ confidence: null }))
      expect(g[0]!.passed).toBe(false)
      expect(g[0]!.value).toBe('não medido')
      expect(g[0]!.estado).toBe('nao_medido')
      expect(g[0]!.hint).toBeUndefined()
    })
    it('stability é não medido com confiança nula, mesmo com contador antigo 5/3', () => {
      const g = computeGates(makeInput({ confidence: null, consecutiveConfident: 5, stabilityThreshold: 3 }))
      expect(g[5]!.passed).toBe(false)
      expect(g[5]!.estado).toBe('nao_medido')
      expect(g[5]!.value).toBe('não medido')
    })
    it('stability é não medido com contador nulo', () => {
      const g = computeGates(makeInput({ consecutiveConfident: null }))
      expect(g[5]!.estado).toBe('nao_medido')
      expect(g[5]!.passed).toBe(false)
    })
    it('com números nenhum gate tem estado', () => {
      for (const g of computeGates(makeInput())) expect(g.estado).toBeUndefined()
    })
  })
})
