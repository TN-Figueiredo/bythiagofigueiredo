import { describe, it, expect } from 'vitest'
import { escapeCsv } from '@/lib/cms/csv'

describe('escapeCsv', () => {
  it('passes plain values through unquoted', () => {
    expect(escapeCsv('hello')).toBe('hello')
    expect(escapeCsv(123)).toBe('123')
    expect(escapeCsv(null)).toBe('')
    expect(escapeCsv(undefined)).toBe('')
  })
  it('handles empty / falsy-but-defined boundary values', () => {
    expect(escapeCsv('')).toBe('')
    expect(escapeCsv(0)).toBe('0')
    expect(escapeCsv(false)).toBe('false')
  })
  it('quotes and escapes commas, quotes, newlines (RFC-4180)', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"')
    expect(escapeCsv('he said "hi"')).toBe('"he said ""hi"""')
    expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"')
    expect(escapeCsv('a\rb')).toBe('"a\rb"')
  })
  it('neutralizes formula-injection leading chars', () => {
    expect(escapeCsv('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`)
    expect(escapeCsv('+1')).toBe(`"'+1"`)
    expect(escapeCsv('-1')).toBe(`"'-1"`)
    expect(escapeCsv('@cmd')).toBe(`"'@cmd"`)
    expect(escapeCsv('\tTAB')).toBe(`"'\tTAB"`)
    expect(escapeCsv('\rCR')).toBe(`"'\rCR"`)
    expect(escapeCsv('=')).toBe(`"'="`)
  })
})
