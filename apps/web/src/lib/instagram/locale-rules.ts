export type InstagramLocale = 'all' | 'pt' | 'en'

/**
 * `UNIQUE (site_id, locale)` permite `pt` + `all` na mesma coluna, e
 * `src/lib/instagram/queries.ts:17-19` faria a linha `all` sombrear a `pt`.
 * A defesa é impedir a combinação — servidor e cliente usam ESTA função.
 */
export const LOCALE_CONFLICT_ERROR =
  'Locale conflict — an "All (PT + EN)" account cannot coexist with a PT-BR or EN account'

export function allowedLocales(taken: readonly string[], own?: string): InstagramLocale[] {
  const others = new Set(taken.filter((l) => l !== own))
  const keepOwn = (list: InstagramLocale[]): InstagramLocale[] => {
    if (own && (own === 'all' || own === 'pt' || own === 'en') && !list.includes(own)) {
      return [own, ...list]
    }
    return list
  }
  if (others.has('all')) return keepOwn([])
  const free = (['all', 'pt', 'en'] as const).filter((l) => !others.has(l))
  return keepOwn(free.filter((l) => l !== 'all' || (!others.has('pt') && !others.has('en'))))
}
