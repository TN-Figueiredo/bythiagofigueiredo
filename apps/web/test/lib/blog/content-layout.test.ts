import { describe, it, expect } from 'vitest'
import {
  computeInlineAdIndex,
  computeMobileInlineIndex,
} from '../../../src/lib/blog/content-layout'

describe('computeInlineAdIndex', () => {
  it('places before 2nd h2 when >=2 h2s exist', () => {
    const idx = computeInlineAdIndex(20, [3, 10])
    expect(idx).toBe(9)
  })

  it('places before 2nd h2 when 3+ h2s exist', () => {
    const idx = computeInlineAdIndex(30, [4, 12, 20])
    expect(idx).toBe(11)
  })

  it('places ~60% after single h2', () => {
    const idx = computeInlineAdIndex(20, [5])
    expect(idx).toBe(14)
  })

  it('places ~55% through body when no h2s', () => {
    const idx = computeInlineAdIndex(20, [])
    expect(idx).toBe(11)
  })

  it('caps single-h2 placement at bodyBlockCount - 2', () => {
    const idx = computeInlineAdIndex(10, [1])
    expect(idx).toBe(6)
  })
})

describe('computeMobileInlineIndex', () => {
  it('places before last h2 when >=2 h2s exist', () => {
    const idx = computeMobileInlineIndex(20, [3, 15])
    expect(idx).toBe(14)
  })

  it('places at ~70% when fewer than 2 h2s', () => {
    const idx = computeMobileInlineIndex(20, [5])
    expect(idx).toBe(14)
  })

  it('places at ~70% when no h2s', () => {
    const idx = computeMobileInlineIndex(30, [])
    expect(idx).toBe(21)
  })
})
