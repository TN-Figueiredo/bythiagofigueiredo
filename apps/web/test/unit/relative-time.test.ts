import { describe, it, expect } from 'vitest'
import { relTimeShort } from '../../lib/cms/relative-time'

const NOW = Date.parse('2026-06-17T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('relTimeShort', () => {
  it('returns "now" under 1h', () => {
    expect(relTimeShort(ago(0), NOW)).toBe('now')
    expect(relTimeShort(ago(59 * 60_000), NOW)).toBe('now')
  })

  it('returns Nh between 1h and 24h', () => {
    expect(relTimeShort(ago(60 * 60_000), NOW)).toBe('1h')
    expect(relTimeShort(ago(23 * 3_600_000), NOW)).toBe('23h')
  })

  it('rolls over to Nd at/after 24h', () => {
    expect(relTimeShort(ago(24 * 3_600_000), NOW)).toBe('1d')
    expect(relTimeShort(ago(72 * 3_600_000), NOW)).toBe('3d')
  })

  it('clamps a future timestamp to "now" (never negative)', () => {
    expect(relTimeShort(ago(-3_600_000), NOW)).toBe('now')
  })
})
