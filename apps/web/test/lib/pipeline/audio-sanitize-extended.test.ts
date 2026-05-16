import { describe, it, expect } from 'vitest'
import { sanitizeForFilter, sanitizeForTsquery, sanitizeForLike } from '@/lib/pipeline/sanitize'

describe('sanitizeForFilter Unicode support', () => {
  it('preserves Portuguese accented characters', () => {
    expect(sanitizeForFilter('Acústico')).toBe('Acústico')
    expect(sanitizeForFilter('eletrônica')).toBe('eletrônica')
    expect(sanitizeForFilter('canção')).toBe('canção')
  })

  it('preserves other Unicode letters', () => {
    expect(sanitizeForFilter('日本語')).toBe('日本語')
    expect(sanitizeForFilter('über')).toBe('über')
  })

  it('still strips dangerous characters', () => {
    expect(sanitizeForFilter('test<script>')).toBe('testscript')
    expect(sanitizeForFilter("test'; DROP TABLE")).toBe('test DROP TABLE')
  })
})

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

describe('sanitizeForLike', () => {
  it('escapes backslashes', () => {
    expect(sanitizeForLike('test\\path')).toBe('test\\\\path')
  })

  it('escapes percent signs', () => {
    expect(sanitizeForLike('100% done')).toBe('100\\% done')
  })

  it('escapes underscores', () => {
    expect(sanitizeForLike('test_value')).toBe('test\\_value')
  })

  it('escapes all special chars together', () => {
    expect(sanitizeForLike('50%_\\test')).toBe('50\\%\\_\\\\test')
  })

  it('returns empty string unchanged', () => {
    expect(sanitizeForLike('')).toBe('')
  })
})
