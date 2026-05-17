import { describe, it, expect } from 'vitest'
import { getVariantForCycle } from '@/lib/youtube/ab-rotation'

describe('getVariantForCycle', () => {
  describe('2 variants (block size 4)', () => {
    it('follows ABBA pattern: [0,1,1,0] repeating', () => {
      const expected = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0]
      const actual = expected.map((_, i) => getVariantForCycle(2, i))
      expect(actual).toEqual(expected)
    })
  })

  describe('3 variants (block size 6)', () => {
    it('follows forward-reverse pattern: [0,1,2,2,1,0] repeating', () => {
      const expected = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0]
      const actual = expected.map((_, i) => getVariantForCycle(3, i))
      expect(actual).toEqual(expected)
    })
  })

  describe('4 variants (block size 8)', () => {
    it('follows forward-reverse pattern: [0,1,2,3,3,2,1,0] repeating', () => {
      const expected = [0, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 3, 3, 2, 1, 0]
      const actual = expected.map((_, i) => getVariantForCycle(4, i))
      expect(actual).toEqual(expected)
    })
  })

  describe('day-of-week balance', () => {
    it('each variant gets equal exposure over 14 days with 2 variants', () => {
      const counts = [0, 0]
      for (let i = 0; i < 14; i++) counts[getVariantForCycle(2, i)]++
      expect(counts[0]).toBe(7)
      expect(counts[1]).toBe(7)
    })
  })

  describe('edge cases', () => {
    it('returns 0 for single variant', () => {
      expect(getVariantForCycle(1, 0)).toBe(0)
      expect(getVariantForCycle(1, 5)).toBe(0)
      expect(getVariantForCycle(1, 100)).toBe(0)
    })

    it('returns 0 for zero variants (guard)', () => {
      expect(getVariantForCycle(0, 0)).toBe(0)
      expect(getVariantForCycle(0, 5)).toBe(0)
    })
  })
})
