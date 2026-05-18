import { describe, it, expect } from 'vitest'
import { safePassthrough, extractClickIds, KNOWN_CLICK_IDS } from './click-id-passthrough.js'

describe('Click ID Passthrough', () => {
  const dest = () => new URL('https://example.com/page?existing=keep')

  describe('safePassthrough', () => {
    it('forwards known click IDs to destination', () => {
      const incoming = new URL('https://go.site.com/abc?gclid=abc123&fbclid=def456')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.get('gclid')).toBe('abc123')
      expect(result.url.searchParams.get('fbclid')).toBe('def456')
      expect(result.forwarded).toEqual(['gclid', 'fbclid'])
      expect(result.rejected).toEqual([])
    })

    it('preserves existing destination params', () => {
      const incoming = new URL('https://go.site.com/abc?gclid=abc123')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.get('existing')).toBe('keep')
    })

    it('drops unknown params', () => {
      const incoming = new URL('https://go.site.com/abc?gclid=abc&unknown=evil')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.has('gclid')).toBe(true)
      expect(result.url.searchParams.has('unknown')).toBe(false)
    })

    it('skips utm_* params (handled separately)', () => {
      const incoming = new URL('https://go.site.com/abc?utm_source=google&gclid=abc')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.has('utm_source')).toBe(false)
      expect(result.url.searchParams.has('gclid')).toBe(true)
    })

    it('rejects values longer than 500 chars', () => {
      const longValue = 'a'.repeat(501)
      const incoming = new URL(`https://go.site.com/abc?gclid=${longValue}`)
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.has('gclid')).toBe(false)
      expect(result.rejected).toEqual(['gclid'])
    })

    it('accepts values exactly 500 chars', () => {
      const value = 'a'.repeat(500)
      const incoming = new URL(`https://go.site.com/abc?gclid=${value}`)
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.get('gclid')).toBe(value)
    })

    it('rejects values with unsafe characters', () => {
      const incoming = new URL('https://go.site.com/abc?gclid=abc%3Cscript%3Ealert(1)%3C/script%3E')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.has('gclid')).toBe(false)
      expect(result.rejected).toContain('gclid')
    })

    it('skips empty values', () => {
      const incoming = new URL('https://go.site.com/abc?gclid=')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.has('gclid')).toBe(false)
    })

    it('rolls back ALL forwarded params if URL exceeds 8192 chars', () => {
      const longDest = new URL('https://example.com/' + 'x'.repeat(7900))
      const incoming = new URL('https://go.site.com/abc?gclid=abc123&fbclid=def456')
      const result = safePassthrough(incoming, longDest)
      expect(result.url.searchParams.has('gclid')).toBe(false)
      expect(result.url.searchParams.has('fbclid')).toBe(false)
      expect(result.rejected).toContain('gclid')
      expect(result.rejected).toContain('fbclid')
    })

    it('preserves canonical casing (ScCid)', () => {
      const incoming = new URL('https://go.site.com/abc?scid=snap123')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.get('ScCid')).toBe('snap123')
    })

    it('handles all 13 known click IDs', () => {
      expect(KNOWN_CLICK_IDS.size).toBe(13)
    })

    it('returns empty result when no click IDs present', () => {
      const incoming = new URL('https://go.site.com/abc?ref=something')
      const result = safePassthrough(incoming, dest())
      expect(result.forwarded).toEqual([])
      expect(result.rejected).toEqual([])
      expect(result.url.searchParams.get('existing')).toBe('keep')
    })
  })

  describe('extractClickIds', () => {
    it('extracts known click IDs as a record', () => {
      const url = new URL('https://go.site.com/abc?gclid=abc&fbclid=def&ref=other')
      const ids = extractClickIds(url)
      expect(ids).toEqual({ gclid: 'abc', fbclid: 'def' })
    })

    it('returns empty object when no click IDs', () => {
      const url = new URL('https://go.site.com/abc?ref=other')
      expect(extractClickIds(url)).toEqual({})
    })
  })
})
