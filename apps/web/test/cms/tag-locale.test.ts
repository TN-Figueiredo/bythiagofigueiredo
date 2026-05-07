import { describe, it, expect } from 'vitest'
import { resolveTagName, formatTagNameCms } from '@/app/cms/(authed)/blog/_hub/tag-locale'

describe('resolveTagName', () => {
  it('returns translated name when available', () => {
    expect(resolveTagName({ name: 'Bastidores', nameTranslations: { en: 'Behind the Scenes' } }, 'en'))
      .toBe('Behind the Scenes')
  })

  it('falls back to primary name when locale missing', () => {
    expect(resolveTagName({ name: 'Bastidores', nameTranslations: { en: 'Behind the Scenes' } }, 'fr'))
      .toBe('Bastidores')
  })

  it('falls back to primary name when translations null', () => {
    expect(resolveTagName({ name: 'Bastidores', nameTranslations: null }, 'en'))
      .toBe('Bastidores')
  })

  it('falls back to primary name when translations undefined', () => {
    expect(resolveTagName({ name: 'Bastidores' }, 'en'))
      .toBe('Bastidores')
  })

  it('falls back when translation is empty string', () => {
    expect(resolveTagName({ name: 'Bastidores', nameTranslations: { en: '  ' } }, 'en'))
      .toBe('Bastidores')
  })

  it('handles corrupted JSONB (non-object)', () => {
    expect(resolveTagName({ name: 'Bastidores', nameTranslations: 'broken' as unknown as Record<string, string> }, 'en'))
      .toBe('Bastidores')
  })
})

describe('formatTagNameCms', () => {
  it('returns "Primary (Translation)" when translation exists', () => {
    expect(formatTagNameCms({ name: 'Bastidores', nameTranslations: { en: 'Behind the Scenes' } }))
      .toBe('Bastidores (Behind the Scenes)')
  })

  it('returns just primary when no translations', () => {
    expect(formatTagNameCms({ name: 'Bastidores', nameTranslations: {} }))
      .toBe('Bastidores')
  })

  it('returns just primary when translations null', () => {
    expect(formatTagNameCms({ name: 'Bastidores', nameTranslations: null }))
      .toBe('Bastidores')
  })

  it('strips empty translation values', () => {
    expect(formatTagNameCms({ name: 'Bastidores', nameTranslations: { en: '', fr: '  ' } }))
      .toBe('Bastidores')
  })

  it('joins multiple translations', () => {
    expect(formatTagNameCms({ name: 'Bastidores', nameTranslations: { en: 'Behind the Scenes', es: 'Detrás de Cámaras' } }))
      .toBe('Bastidores (Behind the Scenes, Detrás de Cámaras)')
  })
})
