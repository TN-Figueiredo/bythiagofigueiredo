export type NicheScope = 'todos' | 'viagem' | 'ia'
const SCOPES: readonly NicheScope[] = ['todos', 'viagem', 'ia']
export function parseNiche(raw: string | null | undefined): NicheScope | null {
  return SCOPES.includes(raw as NicheScope) ? (raw as NicheScope) : null
}
/** Port of dados.js:813. */
export const inNiche = (niche: NicheScope | 'all' | null | undefined, x: { niche: string | null }): boolean =>
  !niche || niche === 'todos' || niche === 'all' || x.niche === niche
