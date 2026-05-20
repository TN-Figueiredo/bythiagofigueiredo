import { describe, it, expect } from 'vitest'

function detectLocale(
  cookie: string | undefined,
  acceptLanguage: string,
  supportedLocales: string[],
  defaultLocale: string,
): string {
  if (cookie && supportedLocales.includes(cookie)) return cookie
  const preferred = acceptLanguage.split(',').map((p) => p.split(';')[0]?.trim() ?? '')
  for (const pref of preferred) {
    if (pref.startsWith('pt')) return 'pt-BR'
    if (pref.startsWith('en')) return 'en'
  }
  return defaultLocale
}

describe('detectLocale', () => {
  const supported = ['pt-BR', 'en']

  it('prioritizes cookie over Accept-Language', () => {
    expect(detectLocale('en', 'pt-BR,pt;q=0.9', supported, 'pt-BR')).toBe('en')
  })

  it('parses Accept-Language when no cookie', () => {
    expect(detectLocale(undefined, 'en-US,en;q=0.9', supported, 'pt-BR')).toBe('en')
  })

  it('falls back to default locale when nothing matches', () => {
    expect(detectLocale(undefined, 'ja,zh;q=0.9', supported, 'pt-BR')).toBe('pt-BR')
  })
})
