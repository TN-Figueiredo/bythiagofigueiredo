import { describe, it, expect } from 'vitest'
import { coverGradient } from '../../../lib/home/cover-image'

describe('coverGradient', () => {
  it('returns a CSS linear-gradient string', () => {
    const result = coverGradient('tech', true)
    expect(result).toMatch(/^linear-gradient/)
    expect(result).toContain('135deg')
  })

  it('uses tech hues (220, 260) in dark mode', () => {
    const result = coverGradient('tech', true)
    expect(result).toContain('hsl(220,')
    expect(result).toContain('hsl(260,')
  })

  it('uses default hues (35, 50) for unknown category', () => {
    const result = coverGradient('unknown', false)
    expect(result).toContain('hsl(35,')
    expect(result).toContain('hsl(50,')
  })

  it('handles null category', () => {
    const result = coverGradient(null, false)
    expect(result).toContain('hsl(35,')
  })

  it('uses different lightness for dark vs light mode', () => {
    const dark = coverGradient('vida', true)
    const light = coverGradient('vida', false)
    expect(dark).not.toEqual(light)
    expect(dark).toContain('28%')
    expect(light).toContain('72%')
  })
})
