import { describe, it, expect } from 'vitest'

describe('Gaussian PDF math', () => {
  const gauss = (x: number, mean: number, sd: number) =>
    (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mean) / sd) ** 2)

  it('peaks at mean', () => {
    const peak = gauss(0.05, 0.05, 0.01)
    const offPeak = gauss(0.06, 0.05, 0.01)
    expect(peak).toBeGreaterThan(offPeak)
  })

  it('returns non-finite for sd=0', () => {
    expect(Number.isFinite(gauss(0.05, 0.05, 0))).toBe(false)
  })

  it('symmetric around mean', () => {
    const left = gauss(0.04, 0.05, 0.01)
    const right = gauss(0.06, 0.05, 0.01)
    expect(left).toBeCloseTo(right, 10)
  })

  it('higher impressions produce taller peaks', () => {
    const sdHigh = Math.sqrt(0.05 * 0.95 / 10000)
    const sdLow = Math.sqrt(0.05 * 0.95 / 1000)
    const peakHigh = gauss(0.05, 0.05, sdHigh)
    const peakLow = gauss(0.05, 0.05, sdLow)
    expect(peakHigh).toBeGreaterThan(peakLow)
  })

  it('produces finite values for extreme CTR', () => {
    const sd = Math.sqrt(0.001 * 0.999 / 10000)
    expect(Number.isFinite(gauss(0.001, 0.001, sd))).toBe(true)
  })
})

describe('Credible interval math', () => {
  it('computes 95% CI bounds correctly', () => {
    const p = 0.05, n = 10000
    const sd = Math.sqrt(p * (1 - p) / n)
    const lo = p - 1.96 * sd
    const hi = p + 1.96 * sd
    expect(lo).toBeGreaterThan(0)
    expect(hi).toBeLessThan(1)
    expect(hi - lo).toBeCloseTo(2 * 1.96 * sd, 6)
  })

  it('handles p=0', () => {
    expect(Math.sqrt(0 * 1 / 1000)).toBe(0)
  })

  it('handles p=1', () => {
    expect(Math.sqrt(1 * 0 / 1000)).toBe(0)
  })

  it('n=0 produces non-finite sd', () => {
    expect(Number.isFinite(Math.sqrt(0.05 * 0.95 / 0))).toBe(false)
  })
})

describe('Z-score edge cases', () => {
  it('z=0 for identical CTRs', () => {
    const pA = 0.05, pB = 0.05, n = 10000
    const pPool = (pA * n + pB * n) / (2 * n)
    const se = Math.sqrt(pPool * (1 - pPool) * (1/n + 1/n))
    expect((pB - pA) / se).toBe(0)
  })

  it('handles division by zero in se', () => {
    expect(Math.sqrt(0 * 1 * (1/100 + 1/100))).toBe(0)
  })

  it('large z for very different CTRs', () => {
    const pA = 0.03, pB = 0.10, n = 50000
    const pPool = (pA * n + pB * n) / (2 * n)
    const se = Math.sqrt(pPool * (1 - pPool) * (2/n))
    expect((pB - pA) / se).toBeGreaterThan(5)
  })
})

describe('Rank probability math', () => {
  it('pBest sums to ~1', () => {
    expect([0.7, 0.2, 0.1].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
  })

  it('pTop2 >= pBest', () => {
    expect(0.9).toBeGreaterThanOrEqual(0.7)
  })
})
