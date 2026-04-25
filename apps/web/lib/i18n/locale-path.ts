export const LOCALE_PREFIX_MAP: Record<string, string> = {
  pt: 'pt-BR',
}

export const DEFAULT_LOCALE = 'en'

const LOCALE_TO_PREFIX: Record<string, string> = {
  en: '',
  'pt-BR': '/pt',
}

export function localePath(path: string, locale: string): string {
  const prefix = LOCALE_TO_PREFIX[locale] ?? ''
  return `${prefix}${path}`
}

export function localeFromPrefix(prefix: string): string | null {
  return LOCALE_PREFIX_MAP[prefix] ?? null
}

export function prefixFromLocale(locale: string): string {
  return LOCALE_TO_PREFIX[locale] ?? ''
}

export function hreflangCode(locale: string): string {
  return locale === 'pt-BR' ? 'pt' : locale
}
