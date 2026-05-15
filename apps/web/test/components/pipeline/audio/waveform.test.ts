import { describe, it, expect } from 'vitest'
import { resamplePeaks } from '@/app/cms/(authed)/pipeline/audio/_components/waveform'

describe('resamplePeaks', () => {
  it('reduces a large array to target count', () => {
    const input = Array.from({ length: 200 }, (_, i) => i / 200)
    expect(resamplePeaks(input, 40)).toHaveLength(40)
  })

  it('returns empty for empty input', () => {
    expect(resamplePeaks([], 40)).toEqual([])
  })

  it('returns original if shorter than target', () => {
    expect(resamplePeaks([0.1, 0.5, 0.9], 40)).toEqual([0.1, 0.5, 0.9])
  })

  it('preserves first and last values', () => {
    const input = Array.from({ length: 100 }, () => Math.random())
    input[0] = 0.0
    input[99] = 1.0
    const result = resamplePeaks(input, 10)
    expect(result[0]).toBeCloseTo(0.0, 5)
    expect(result[result.length - 1]).toBeCloseTo(1.0, 5)
  })

  it('produces values within [0, 1]', () => {
    const result = resamplePeaks(Array.from({ length: 80 }, () => Math.random()), 20)
    for (const v of result) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
