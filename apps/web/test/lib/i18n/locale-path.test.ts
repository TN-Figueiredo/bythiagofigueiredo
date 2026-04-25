import { describe, it, expect } from 'vitest'
import {
  localePath,
  localeFromPrefix,
  prefixFromLocale,
  LOCALE_PREFIX_MAP,
  DEFAULT_LOCALE,
} from '@/lib/i18n/locale-path'

describe('localePath', () => {
  it('returns unprefixed path for default locale (en)', () => {
    expect(localePath('/blog/my-post', 'en')).toBe('/blog/my-post')
  })

  it('prefixes /pt for pt-BR locale', () => {
    expect(localePath('/blog/meu-post', 'pt-BR')).toBe('/pt/blog/meu-post')
  })

  it('handles root path for pt-BR', () => {
    expect(localePath('/', 'pt-BR')).toBe('/pt/')
  })

  it('handles root path for en', () => {
    expect(localePath('/', 'en')).toBe('/')
  })

  it('returns path unchanged for unknown locale', () => {
    expect(localePath('/blog/x', 'fr')).toBe('/blog/x')
  })
})

describe('localeFromPrefix', () => {
  it('returns pt-BR for /pt prefix', () => {
    expect(localeFromPrefix('pt')).toBe('pt-BR')
  })

  it('returns null for unknown prefix', () => {
    expect(localeFromPrefix('fr')).toBeNull()
  })
})

describe('prefixFromLocale', () => {
  it('returns empty string for en', () => {
    expect(prefixFromLocale('en')).toBe('')
  })

  it('returns /pt for pt-BR', () => {
    expect(prefixFromLocale('pt-BR')).toBe('/pt')
  })
})

describe('constants', () => {
  it('LOCALE_PREFIX_MAP maps pt to pt-BR', () => {
    expect(LOCALE_PREFIX_MAP).toEqual({ pt: 'pt-BR' })
  })

  it('DEFAULT_LOCALE is en', () => {
    expect(DEFAULT_LOCALE).toBe('en')
  })
})
