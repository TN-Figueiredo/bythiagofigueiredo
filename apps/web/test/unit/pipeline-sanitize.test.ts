import { describe, it, expect } from 'vitest'
import { sanitizeForTsquery, sanitizeForLike, sanitizeForFilter } from '@/lib/pipeline/sanitize'

describe('sanitizeForTsquery', () => {
  it('removes backslash', () => {
    expect(sanitizeForTsquery('hello\\')).toBe('hello')
  })

  it('removes unbalanced quotes', () => {
    expect(sanitizeForTsquery('"hello')).toBe('hello')
  })

  it('removes tsquery operators', () => {
    expect(sanitizeForTsquery('hello & world | test')).toBe('hello world test')
  })

  it('preserves normal text', () => {
    expect(sanitizeForTsquery('como gravar vídeo')).toBe('como gravar vídeo')
  })

  it('collapses whitespace', () => {
    expect(sanitizeForTsquery('hello   world')).toBe('hello world')
  })

  it('handles empty after sanitize', () => {
    expect(sanitizeForTsquery('&|*!')).toBe('')
  })
})

describe('sanitizeForLike', () => {
  it('escapes percent', () => {
    expect(sanitizeForLike('100%')).toBe('100\\%')
  })

  it('escapes underscore', () => {
    expect(sanitizeForLike('test_value')).toBe('test\\_value')
  })

  it('escapes backslash', () => {
    expect(sanitizeForLike('path\\to')).toBe('path\\\\to')
  })
})

describe('sanitizeForFilter', () => {
  it('preserves dots and plus for ISO timestamps', () => {
    expect(sanitizeForFilter('2026-05-15T12:30:00.123+00:00')).toBe('2026-05-15T12:30:00.123+00:00')
  })

  it('removes commas', () => {
    expect(sanitizeForFilter('a.b,c')).toBe('a.bc')
  })

  it('removes parentheses', () => {
    expect(sanitizeForFilter('test(1)')).toBe('test1')
  })
})
