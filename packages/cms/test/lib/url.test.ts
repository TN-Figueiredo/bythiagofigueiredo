import { describe, it, expect } from 'vitest'
import { isSafeUrl } from '../../src/lib/url'

describe('isSafeUrl', () => {
  it('accepts null/undefined/empty (no URL supplied)', () => {
    expect(isSafeUrl(null)).toBe(true)
    expect(isSafeUrl(undefined)).toBe(true)
    expect(isSafeUrl('')).toBe(true)
    expect(isSafeUrl('   ')).toBe(true)
  })

  it('accepts http and https absolute URLs', () => {
    expect(isSafeUrl('http://example.com/a')).toBe(true)
    expect(isSafeUrl('https://example.com/a.png')).toBe(true)
  })

  it('accepts root-relative paths', () => {
    expect(isSafeUrl('/assets/a.png')).toBe(true)
  })

  it('rejects protocol-relative URLs', () => {
    expect(isSafeUrl('//evil.example.com/x')).toBe(false)
  })

  it('rejects javascript:, data:, vbscript:', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false)
    expect(isSafeUrl('data:text/html,<script>')).toBe(false)
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false)
  })

  it('rejects garbage', () => {
    expect(isSafeUrl('not a url at all')).toBe(false)
  })
})
