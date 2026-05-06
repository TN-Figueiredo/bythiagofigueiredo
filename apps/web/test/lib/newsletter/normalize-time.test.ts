import { describe, it, expect } from 'vitest'
import { normalizeTime } from '@/lib/newsletter/format'

describe('normalizeTime', () => {
  it('strips seconds from HH:MM:SS', () => {
    expect(normalizeTime('09:00:00')).toBe('09:00')
  })

  it('passes through valid HH:MM', () => {
    expect(normalizeTime('14:30')).toBe('14:30')
  })

  it('returns default for null', () => {
    expect(normalizeTime(null)).toBe('09:00')
  })

  it('returns default for undefined', () => {
    expect(normalizeTime(undefined)).toBe('09:00')
  })

  it('returns default for empty string', () => {
    expect(normalizeTime('')).toBe('09:00')
  })

  it('returns default for garbage', () => {
    expect(normalizeTime('not-a-time')).toBe('09:00')
  })

  it('handles HH:MM:SS.sss microseconds', () => {
    expect(normalizeTime('09:00:00.000000')).toBe('09:00')
  })
})
