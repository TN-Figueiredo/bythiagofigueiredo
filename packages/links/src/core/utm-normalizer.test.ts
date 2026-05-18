import { describe, it, expect } from 'vitest'
import {
  normalizeUtmValue,
  normalizeAllUtmFields,
  slugifyForCampaign,
  isKnownMedium,
  GA4_MEDIUM_SUGGESTIONS,
  KNOWN_UTM_SOURCES,
} from './utm-normalizer.js'
import type { UtmField } from './utm-normalizer.js'

describe('UTM Normalizer', () => {
  describe('normalizeUtmValue', () => {
    it('returns null for null input', () => {
      expect(normalizeUtmValue('utm_source', null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(normalizeUtmValue('utm_source', undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(normalizeUtmValue('utm_source', '')).toBeNull()
    })

    it('returns null for whitespace-only string', () => {
      expect(normalizeUtmValue('utm_source', '   ')).toBeNull()
    })

    it('lowercases values', () => {
      expect(normalizeUtmValue('utm_source', 'Google')).toBe('google')
    })

    it('strips diacritics via NFKD', () => {
      expect(normalizeUtmValue('utm_campaign', 'café')).toBe('cafe')
      expect(normalizeUtmValue('utm_campaign', 'lançamento')).toBe('lancamento')
      expect(normalizeUtmValue('utm_campaign', 'promoção')).toBe('promocao')
    })

    it('replaces whitespace with hyphens', () => {
      expect(normalizeUtmValue('utm_campaign', 'spring sale 2026')).toBe('spring-sale-2026')
    })

    it('collapses multiple hyphens', () => {
      expect(normalizeUtmValue('utm_campaign', 'spring--sale---2026')).toBe('spring-sale-2026')
    })

    it('trims leading and trailing hyphens', () => {
      expect(normalizeUtmValue('utm_campaign', '-spring-sale-')).toBe('spring-sale')
    })

    it('strips non-alphanumeric chars except dots, underscores, hyphens', () => {
      expect(normalizeUtmValue('utm_source', 'goo!gle@ads')).toBe('googleads')
      expect(normalizeUtmValue('utm_campaign', 'sale_2026.q3')).toBe('sale_2026.q3')
    })

    it('decodes URL-encoded values', () => {
      expect(normalizeUtmValue('utm_campaign', 'spring%20sale')).toBe('spring-sale')
    })

    it('handles malformed percent-encoding gracefully', () => {
      expect(normalizeUtmValue('utm_source', '%ZZbad')).toBe('zzbad')
    })

    it('preserves dots and underscores', () => {
      expect(normalizeUtmValue('utm_medium', 'paid_social')).toBe('paid_social')
      expect(normalizeUtmValue('utm_source', 'news.google.com')).toBe('news.google.com')
    })

    it('preserves + in utm_term (GA4 keyword separator)', () => {
      expect(normalizeUtmValue('utm_term', 'buy+flowers+online')).toBe('buy+flowers+online')
    })

    it('lowercases utm_term but does not strip special chars', () => {
      expect(normalizeUtmValue('utm_term', 'Buy Flowers')).toBe('buy flowers')
    })

    it('trims utm_term whitespace', () => {
      expect(normalizeUtmValue('utm_term', '  flowers  ')).toBe('flowers')
    })

    it('returns null for empty utm_term', () => {
      expect(normalizeUtmValue('utm_term', '')).toBeNull()
    })

    it('normalizes utm_id like other fields', () => {
      expect(normalizeUtmValue('utm_id', 'Campaign-123')).toBe('campaign-123')
    })
  })

  describe('idempotence', () => {
    const samples = [
      'Google', 'paid_social', 'café-lançamento', 'spring sale 2026',
      'CAMPAIGN--123', '-trimmed-', 'news.google.com', 'a!@#b',
      'spring%20sale', 'Campaign-123', 'UPPER_CASE.value',
    ]
    const fields: UtmField[] = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_id']

    for (const sample of samples) {
      for (const field of fields) {
        it(`normalize(normalize("${sample}")) === normalize("${sample}") for ${field}`, () => {
          const once = normalizeUtmValue(field, sample)
          const twice = normalizeUtmValue(field, once)
          expect(twice).toBe(once)
        })
      }
    }

    it('idempotent for utm_term', () => {
      const termSamples = ['Buy Flowers', 'buy+flowers+online', '  spaces  ']
      for (const s of termSamples) {
        const once = normalizeUtmValue('utm_term', s)
        const twice = normalizeUtmValue('utm_term', once)
        expect(twice).toBe(once)
      }
    })
  })

  describe('normalizeAllUtmFields', () => {
    it('normalizes all fields at once', () => {
      const result = normalizeAllUtmFields({
        utm_source: 'Google',
        utm_medium: 'PAID_SOCIAL',
        utm_campaign: 'Café Lançamento',
        utm_term: 'Buy Flowers',
        utm_content: 'Banner-A',
        utm_id: 'Camp-1',
      })
      expect(result).toEqual({
        utm_source: 'google',
        utm_medium: 'paid_social',
        utm_campaign: 'cafe-lancamento',
        utm_term: 'buy flowers',
        utm_content: 'banner-a',
        utm_id: 'camp-1',
      })
    })

    it('handles all-null input', () => {
      const result = normalizeAllUtmFields({})
      expect(result).toEqual({
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_term: null,
        utm_content: null,
        utm_id: null,
      })
    })
  })

  describe('slugifyForCampaign', () => {
    it('converts title to campaign slug', () => {
      expect(slugifyForCampaign('Como Investir em 2026')).toBe('como-investir-em-2026')
    })

    it('strips diacritics in title', () => {
      expect(slugifyForCampaign('Lançamento Promoção')).toBe('lancamento-promocao')
    })

    it('returns empty string for empty title', () => {
      expect(slugifyForCampaign('')).toBe('')
    })
  })

  describe('isKnownMedium', () => {
    it('returns true for GA4 standard mediums', () => {
      expect(isKnownMedium('cpc')).toBe(true)
      expect(isKnownMedium('paid_social')).toBe(true)
      expect(isKnownMedium('email')).toBe(true)
      expect(isKnownMedium('organic')).toBe(true)
    })

    it('returns false for unknown mediums', () => {
      expect(isKnownMedium('banana')).toBe(false)
      expect(isKnownMedium('paid-social')).toBe(false)
    })
  })

  describe('constants', () => {
    it('GA4_MEDIUM_SUGGESTIONS has standard mediums', () => {
      expect(GA4_MEDIUM_SUGGESTIONS).toContain('cpc')
      expect(GA4_MEDIUM_SUGGESTIONS).toContain('paid_social')
      expect(GA4_MEDIUM_SUGGESTIONS).toContain('email')
      expect(GA4_MEDIUM_SUGGESTIONS).toContain('social')
      expect(GA4_MEDIUM_SUGGESTIONS).toContain('organic')
      expect(GA4_MEDIUM_SUGGESTIONS.length).toBeGreaterThan(20)
    })

    it('KNOWN_UTM_SOURCES has major platforms', () => {
      expect(KNOWN_UTM_SOURCES).toContain('google')
      expect(KNOWN_UTM_SOURCES).toContain('youtube')
      expect(KNOWN_UTM_SOURCES).toContain('facebook')
      expect(KNOWN_UTM_SOURCES).toContain('instagram')
    })
  })
})
