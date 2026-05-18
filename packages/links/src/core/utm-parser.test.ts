import { describe, it, expect } from 'vitest'
import { parseUtm, buildUtmUrl, extractUtmFromSearchParams, stripUtm } from './utm-parser.js'

describe('UtmParser', () => {
  describe('parseUtm', () => {
    it('extracts all utm_* params from a URL', () => {
      const url = 'https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_term=flowers&utm_content=banner'
      const utm = parseUtm(url)
      expect(utm).toEqual({
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'spring',
        utmTerm: 'flowers',
        utmContent: 'banner',
      })
    })

    it('returns undefined fields for missing params', () => {
      const utm = parseUtm('https://example.com/page?utm_source=twitter')
      expect(utm).toEqual({
        utmSource: 'twitter',
        utmMedium: undefined,
        utmCampaign: undefined,
        utmTerm: undefined,
        utmContent: undefined,
      })
    })

    it('returns all undefined for URL without UTM params', () => {
      const utm = parseUtm('https://example.com/page?ref=abc')
      expect(utm.utmSource).toBeUndefined()
      expect(utm.utmMedium).toBeUndefined()
    })

    it('handles URL with hash', () => {
      const utm = parseUtm('https://example.com/page?utm_source=test#section')
      expect(utm.utmSource).toBe('test')
    })

    it('extracts utm_id from URL', () => {
      const utm = parseUtm('https://example.com?utm_id=camp123&utm_source=google')
      expect(utm.utmId).toBe('camp123')
    })
  })

  describe('buildUtmUrl', () => {
    it('appends UTM params to a base URL', () => {
      const result = buildUtmUrl('https://example.com/page', {
        utmSource: 'google',
        utmMedium: 'cpc',
      })
      const url = new URL(result)
      expect(url.searchParams.get('utm_source')).toBe('google')
      expect(url.searchParams.get('utm_medium')).toBe('cpc')
      expect(url.origin + url.pathname).toBe('https://example.com/page')
    })

    it('skips undefined/null params', () => {
      const result = buildUtmUrl('https://example.com', {
        utmSource: 'test',
        utmMedium: undefined,
      })
      const url = new URL(result)
      expect(url.searchParams.has('utm_source')).toBe(true)
      expect(url.searchParams.has('utm_medium')).toBe(false)
    })

    it('preserves existing query params', () => {
      const result = buildUtmUrl('https://example.com/page?ref=abc', {
        utmSource: 'google',
      })
      const url = new URL(result)
      expect(url.searchParams.get('ref')).toBe('abc')
      expect(url.searchParams.get('utm_source')).toBe('google')
    })

    it('does not overwrite existing UTM params by default', () => {
      const result = buildUtmUrl('https://example.com?utm_source=existing', {
        utmSource: 'new',
      })
      const url = new URL(result)
      // existing UTMs should be preserved (not overwritten)
      expect(url.searchParams.get('utm_source')).toBe('existing')
    })

    it('appends utm_id to URL', () => {
      const result = buildUtmUrl('https://example.com', { utmId: 'camp123' })
      const url = new URL(result)
      expect(url.searchParams.get('utm_id')).toBe('camp123')
    })
  })

  describe('extractUtmFromSearchParams', () => {
    it('extracts UTM from URLSearchParams', () => {
      const sp = new URLSearchParams('utm_source=google&utm_medium=cpc&foo=bar')
      const utm = extractUtmFromSearchParams(sp)
      expect(utm.utmSource).toBe('google')
      expect(utm.utmMedium).toBe('cpc')
    })

    it('extracts utm_id from URLSearchParams', () => {
      const sp = new URLSearchParams('utm_id=camp123')
      const utm = extractUtmFromSearchParams(sp)
      expect(utm.utmId).toBe('camp123')
    })
  })

  describe('stripUtm', () => {
    it('removes all utm_* params from a URL', () => {
      const result = stripUtm('https://example.com/page?utm_source=google&utm_medium=cpc&ref=abc')
      const url = new URL(result)
      expect(url.searchParams.has('utm_source')).toBe(false)
      expect(url.searchParams.has('utm_medium')).toBe(false)
      expect(url.searchParams.get('ref')).toBe('abc')
    })

    it('returns clean URL when only UTM params present', () => {
      const result = stripUtm('https://example.com/page?utm_source=test')
      expect(result).toBe('https://example.com/page')
    })

    it('preserves URL without query params', () => {
      const result = stripUtm('https://example.com/page')
      expect(result).toBe('https://example.com/page')
    })
  })
})
