import { describe, it, expect } from 'vitest'
import {
  getSubscriberResolution,
  getSubscriberBounds,
  formatSubscriberCount,
  detectGrowthAmbiguity,
} from '@/lib/youtube/subscriber-resolution'

// Minimal fmtC stub: compact Brazilian-style notation
function fmtC(n: number): string {
  if (n === 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')} mil`
  return String(n)
}

// ─── getSubscriberResolution ──────────────────────────────────────────────────

describe('getSubscriberResolution', () => {
  it('returns 1 for counts below 1,000', () => {
    expect(getSubscriberResolution(0)).toBe(1)
    expect(getSubscriberResolution(847)).toBe(1)
    expect(getSubscriberResolution(999)).toBe(1)
  })

  it('returns 10 for the 1K–9,999 tier', () => {
    expect(getSubscriberResolution(1_000)).toBe(10)
    expect(getSubscriberResolution(5_500)).toBe(10)
    expect(getSubscriberResolution(9_999)).toBe(10)
  })

  it('returns 100 for the 10K–99,999 tier', () => {
    expect(getSubscriberResolution(10_000)).toBe(100)
    expect(getSubscriberResolution(50_000)).toBe(100)
    expect(getSubscriberResolution(99_999)).toBe(100)
  })

  it('returns 1,000 for the 100K–999,999 tier', () => {
    expect(getSubscriberResolution(100_000)).toBe(1_000)
    expect(getSubscriberResolution(500_000)).toBe(1_000)
    expect(getSubscriberResolution(999_999)).toBe(1_000)
  })

  it('returns 10,000 for the 1M–9.9M tier', () => {
    expect(getSubscriberResolution(1_000_000)).toBe(10_000)
    expect(getSubscriberResolution(1_910_000)).toBe(10_000)
    expect(getSubscriberResolution(9_999_999)).toBe(10_000)
  })

  it('returns 100,000 for the 10M–99.9M tier', () => {
    expect(getSubscriberResolution(10_000_000)).toBe(100_000)
    expect(getSubscriberResolution(50_000_000)).toBe(100_000)
    expect(getSubscriberResolution(99_999_999)).toBe(100_000)
  })

  it('returns 1,000,000 for counts at or above 100M', () => {
    expect(getSubscriberResolution(100_000_000)).toBe(1_000_000)
    expect(getSubscriberResolution(250_000_000)).toBe(1_000_000)
  })
})

// ─── getSubscriberBounds ──────────────────────────────────────────────────────

describe('getSubscriberBounds', () => {
  it('exact count below 1K — upper equals lower', () => {
    const b = getSubscriberBounds(847)
    expect(b).toEqual({ lower: 847, upper: 847, resolution: 1 })
  })

  it('1K tier example', () => {
    const b = getSubscriberBounds(1_230)
    expect(b).toEqual({ lower: 1_230, upper: 1_239, resolution: 10 })
  })

  it('1M tier example (1,910,000)', () => {
    const b = getSubscriberBounds(1_910_000)
    expect(b).toEqual({ lower: 1_910_000, upper: 1_919_999, resolution: 10_000 })
  })

  it('100K tier example', () => {
    const b = getSubscriberBounds(350_000)
    expect(b).toEqual({ lower: 350_000, upper: 350_999, resolution: 1_000 })
  })

  it('100M tier example', () => {
    const b = getSubscriberBounds(200_000_000)
    expect(b).toEqual({ lower: 200_000_000, upper: 200_999_999, resolution: 1_000_000 })
  })
})

// ─── formatSubscriberCount ────────────────────────────────────────────────────

describe('formatSubscriberCount', () => {
  it('exact count (below 1K) — no tilde, not approximate', () => {
    const f = formatSubscriberCount(847, fmtC)
    expect(f.isApproximate).toBe(false)
    expect(f.text).toBe('847')
    expect(f.boundsLabel).toBe('847 inscritos')
  })

  it('zero — not approximate', () => {
    const f = formatSubscriberCount(0, fmtC)
    expect(f.isApproximate).toBe(false)
    expect(f.text).toBe('0')
    expect(f.boundsLabel).toBe('0 inscritos')
  })

  it('approximate count (1,910,000) — tilde prefix and PT-BR bounds label', () => {
    const f = formatSubscriberCount(1_910_000, fmtC)
    expect(f.isApproximate).toBe(true)
    expect(f.text).toBe('~1,9 mi')
    expect(f.boundsLabel).toBe('entre 1.910.000 e 1.919.999 inscritos')
  })

  it('approximate count at 10K tier', () => {
    const f = formatSubscriberCount(15_300, fmtC)
    expect(f.isApproximate).toBe(true)
    expect(f.text).toBe('~15,3 mil')
    expect(f.boundsLabel).toBe('entre 15.300 e 15.399 inscritos')
  })
})

// ─── detectGrowthAmbiguity ────────────────────────────────────────────────────

describe('detectGrowthAmbiguity', () => {
  it('returns not ambiguous when subscriberCount is null', () => {
    const r = detectGrowthAmbiguity(null, 0, true)
    expect(r.isAmbiguous).toBe(false)
    expect(r.maxHiddenGrowth).toBe(0)
  })

  it('returns not ambiguous when delta is null', () => {
    const r = detectGrowthAmbiguity(1_910_000, null, true)
    expect(r.isAmbiguous).toBe(false)
  })

  it('returns not ambiguous when delta !== 0', () => {
    const r = detectGrowthAmbiguity(1_910_000, 5, true)
    expect(r.isAmbiguous).toBe(false)
  })

  it('returns not ambiguous when delta === 0 but views are NOT growing', () => {
    const r = detectGrowthAmbiguity(1_910_000, 0, false)
    expect(r.isAmbiguous).toBe(false)
  })

  it('returns not ambiguous when count is below 1K (resolution = 1, exact)', () => {
    const r = detectGrowthAmbiguity(847, 0, true)
    expect(r.isAmbiguous).toBe(false)
    expect(r.maxHiddenGrowth).toBe(0)
  })

  it('is ambiguous when delta === 0, views growing, count in 1M tier', () => {
    const r = detectGrowthAmbiguity(1_910_000, 0, true)
    expect(r.isAmbiguous).toBe(true)
    expect(r.maxHiddenGrowth).toBe(9_999)
    expect(r.label).toBe(
      'Crescendo (até +9.999 inscritos podem estar ocultos pelo arredondamento)',
    )
  })

  it('is ambiguous when delta === 0, views growing, count in 10K tier', () => {
    const r = detectGrowthAmbiguity(15_300, 0, true)
    expect(r.isAmbiguous).toBe(true)
    expect(r.maxHiddenGrowth).toBe(99)
    expect(r.label).toBe(
      'Crescendo (até +99 inscritos podem estar ocultos pelo arredondamento)',
    )
  })
})
