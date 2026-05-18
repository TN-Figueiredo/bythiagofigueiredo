import { describe, it, expect } from 'vitest'
import { resamplePeaks } from '@/app/cms/(authed)/pipeline/audio/_components/waveform'

describe('resamplePeaks', () => {
  it('returns empty array for empty input', () => {
    expect(resamplePeaks([], 10)).toEqual([])
  })

  it('returns input unchanged when shorter than target', () => {
    const peaks = [0.1, 0.5, 0.9]
    expect(resamplePeaks(peaks, 10)).toEqual(peaks)
  })

  it('returns single element when target is 1', () => {
    expect(resamplePeaks([0.1, 0.5, 0.9], 1)).toEqual([0.1])
  })

  it('downsamples to target count', () => {
    const peaks = [0, 0.25, 0.5, 0.75, 1.0]
    const result = resamplePeaks(peaks, 3)
    expect(result).toHaveLength(3)
    expect(result[0]).toBeCloseTo(0, 5)
    expect(result[1]).toBeCloseTo(0.5, 5)
    expect(result[2]).toBeCloseTo(1.0, 5)
  })

  it('returns input when length equals target', () => {
    const peaks = [0, 0.5, 1]
    expect(resamplePeaks(peaks, 3)).toEqual(peaks)
  })

  it('interpolates between peaks', () => {
    const peaks = [0, 0.5, 1, 0.5, 0]
    const result = resamplePeaks(peaks, 3)
    expect(result).toHaveLength(3)
    expect(result[0]).toBeCloseTo(0, 5)
    expect(result[1]).toBeCloseTo(1, 5)
    expect(result[2]).toBeCloseTo(0, 5)
  })

  it('preserves start and end values', () => {
    const peaks = [0.2, 0.4, 0.6, 0.8, 1.0]
    const result = resamplePeaks(peaks, 2)
    expect(result[0]).toBeCloseTo(0.2, 5)
    expect(result[1]).toBeCloseTo(1.0, 5)
  })
})
