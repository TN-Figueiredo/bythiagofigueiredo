import { describe, it, expect } from 'vitest'
import { sanitizeForFilter, sanitizeForTsquery } from '@/lib/pipeline/sanitize'

describe('sanitizeForFilter edge cases', () => {
  it('preserves full ISO 8601 timestamp', () => {
    expect(sanitizeForFilter('2026-05-15T12:30:00.123456+00:00')).toBe('2026-05-15T12:30:00.123456+00:00')
  })

  it('preserves negative timezone offset', () => {
    expect(sanitizeForFilter('2026-05-15T09:30:00-03:00')).toBe('2026-05-15T09:30:00-03:00')
  })

  it('strips SQL injection chars but keeps dashes', () => {
    expect(sanitizeForFilter("'; DROP TABLE--")).toBe(' DROP TABLE--')
  })

  it('strips angle brackets but keeps forward slash', () => {
    expect(sanitizeForFilter('<script>alert(1)</script>')).toBe('scriptalert1/script')
  })
})

describe('sanitizeForTsquery edge cases', () => {
  it('strips colons used in tsquery operators', () => {
    expect(sanitizeForTsquery('admin:*')).toBe('admin')
  })

  it('handles mixed content', () => {
    expect(sanitizeForTsquery('hello & "world" | test')).toBe('hello world test')
  })
})
