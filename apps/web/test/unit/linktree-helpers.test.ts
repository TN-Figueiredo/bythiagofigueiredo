import { describe, it, expect } from 'vitest'

import { formatCount } from '../../src/app/go/linktree/_components/link-row'
import { formatDate, formatViews } from '../../src/app/go/linktree/_components/latest-section'
import { normalizeLocale, localeMatches } from '../../src/app/go/linktree/_lib/build-sections'

describe('linktree helpers', () => {
  describe('formatCount', () => {
    it('returns plain number for values below 1000', () => {
      expect(formatCount(0)).toBe('0')
      expect(formatCount(999)).toBe('999')
    })

    it('formats thousands with K suffix', () => {
      expect(formatCount(1000)).toBe('1.0K')
      expect(formatCount(1500)).toBe('1.5K')
    })

    it('formats values just below 1M as K', () => {
      expect(formatCount(999999)).toBe('1000.0K')
    })

    it('formats millions with M suffix', () => {
      expect(formatCount(1000000)).toBe('1.0M')
      expect(formatCount(1500000)).toBe('1.5M')
    })
  })

  describe('formatDate', () => {
    it('formats date in pt-BR locale', () => {
      // Use ISO datetime with T12:00 to avoid timezone day-shift
      const result = formatDate('2026-01-15T12:00:00', 'pt-BR')
      expect(result).toContain('15')
      expect(result).toContain('2026')
      expect(result.toLowerCase()).toContain('jan')
    })

    it('formats date in en locale', () => {
      const result = formatDate('2026-01-15T12:00:00', 'en')
      expect(result).toContain('15')
      expect(result).toContain('2026')
      expect(result.toLowerCase()).toContain('jan')
    })

    it('treats pt-PT as pt-BR formatting', () => {
      const ptBR = formatDate('2026-06-20T12:00:00', 'pt-BR')
      const ptPT = formatDate('2026-06-20T12:00:00', 'pt-PT')
      expect(ptBR).toBe(ptPT)
    })

    it('treats en-GB as en-US formatting', () => {
      const enUS = formatDate('2026-06-20T12:00:00', 'en-US')
      const enGB = formatDate('2026-06-20T12:00:00', 'en-GB')
      expect(enUS).toBe(enGB)
    })
  })

  describe('formatViews', () => {
    it('returns plain number with label for small values', () => {
      expect(formatViews(0, 'en')).toBe('0 views')
      expect(formatViews(500, 'pt-BR')).toBe('500 views')
    })

    it('formats thousands with K suffix', () => {
      expect(formatViews(1200, 'en')).toBe('1.2K views')
    })

    it('formats millions with M suffix', () => {
      expect(formatViews(1500000, 'pt-BR')).toBe('1.5M views')
    })

    it('uses views label for both locales', () => {
      // Both pt and en use "views" (current implementation)
      expect(formatViews(100, 'pt-BR')).toBe('100 views')
      expect(formatViews(100, 'en')).toBe('100 views')
    })
  })

  describe('normalizeLocale', () => {
    it('normalizes pt variants to pt-BR', () => {
      expect(normalizeLocale('pt')).toBe('pt-BR')
      expect(normalizeLocale('pt-BR')).toBe('pt-BR')
      expect(normalizeLocale('pt-PT')).toBe('pt-BR')
    })

    it('normalizes en variants to en', () => {
      expect(normalizeLocale('en')).toBe('en')
      expect(normalizeLocale('en-US')).toBe('en')
      expect(normalizeLocale('en-GB')).toBe('en')
    })

    it('returns other locales as-is', () => {
      expect(normalizeLocale('fr')).toBe('fr')
      expect(normalizeLocale('es')).toBe('es')
    })
  })

  describe('localeMatches', () => {
    it('matches pt variants against each other', () => {
      expect(localeMatches('pt', 'pt-BR')).toBe(true)
      expect(localeMatches('pt-BR', 'pt')).toBe(true)
      expect(localeMatches('pt-PT', 'pt-BR')).toBe(true)
    })

    it('matches en variants against each other', () => {
      expect(localeMatches('en', 'en-US')).toBe(true)
      expect(localeMatches('en-US', 'en-GB')).toBe(true)
    })

    it('does not match cross-language', () => {
      expect(localeMatches('pt-BR', 'en')).toBe(false)
      expect(localeMatches('en', 'pt')).toBe(false)
    })

    it('does not match unknown locales with known ones', () => {
      expect(localeMatches('fr', 'pt-BR')).toBe(false)
      expect(localeMatches('es', 'en')).toBe(false)
    })

    it('matches identical unknown locales', () => {
      expect(localeMatches('fr', 'fr')).toBe(true)
    })
  })
})
