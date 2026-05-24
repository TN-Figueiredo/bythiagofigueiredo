/**
 * Type-safe locale dictionary accessor.
 *
 * JSON imports are inferred as narrow literal types by TypeScript
 * (dot-separated keys like "meta.title" prevent assignability to
 * `Record<string, string>` — a known TypeScript limitation).
 *
 * This module centralises the single necessary double cast,
 * eliminating scattered `as unknown as Record<string, string>`
 * in 9+ consumer files.
 */
import _en from './en.json'
import _ptBr from './pt-BR.json'

export type SupportedLocale = 'en' | 'pt-BR'

// Centralised cast: TypeScript literal types from JSON with
// dot-separated keys (e.g. "meta.title") lack index signatures
// and require `as unknown as` — this is a known TS limitation,
// not a type safety bypass. Both files are flat `{ key: string }` objects.
const en = _en as unknown as Record<string, string>
const ptBr = _ptBr as unknown as Record<string, string>

/** Flat key-value dictionaries keyed by locale */
export const DICTIONARIES: Record<SupportedLocale, Record<string, string>> = {
  en,
  'pt-BR': ptBr,
}

/** Get the dictionary for a locale, defaulting to English */
export function getDictionary(locale: string): Record<string, string> {
  return DICTIONARIES[locale as SupportedLocale] ?? DICTIONARIES.en
}
