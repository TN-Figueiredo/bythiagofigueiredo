/**
 * Nicho é dado do site (tabela `youtube_niches`): o slug é o identificador, o rótulo e a cor vêm da linha.
 * Viagem e IA são os de fábrica e existem em todo site; sem lista (dataset antigo, oráculo de teste, tabela ausente)
 * valem só eles. Este arquivo é puro: quem lê o banco é niches-db.ts.
 */
export type Niche = string
export type NicheScope = 'todos' | Niche
export interface NicheDef { id: Niche; label: string; color: { dark: string; light: string }; order: number; builtin: boolean }

export const BUILTIN_NICHES: readonly NicheDef[] = [
  { id: 'viagem', label: 'Viagem', color: { dark: '#5BBF8A', light: '#11692F' }, order: 10, builtin: true },
  { id: 'ia', label: 'IA', color: { dark: '#6EA8FE', light: '#1D4ED8' }, order: 20, builtin: true },
]
/** A ordem em que a forja enumera os de fábrica (dados.js): IA, depois Viagem. */
const FORJA_FIRST: readonly Niche[] = ['ia', 'viagem']
export const NICHE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** O mesmo limite do CHECK de youtube_niches.slug. */
const SLUG_MIN = 2, SLUG_MAX = 24
export const RESERVED_NICHE_SLUGS: ReadonlySet<string> = new Set(['todos', 'all', 'sem', 'none'])
/**
 * As quatro cores (escuro / claro) dos nichos criados pelo dono — as do CHECK de youtube_niches. Nenhuma repete cor com
 * significado no Observatório; passando de quatro nichos criados, repetem-se em ciclo.
 */
export const NICHE_PALETTE: ReadonlyArray<{ id: string; dark: string; light: string }> = [
  { id: 'ameixa', dark: '#D29AE8', light: '#7B2A91' },
  { id: 'rosa', dark: '#F293C2', light: '#A3216B' },
  { id: 'lima', dark: '#B9CB62', light: '#55650B' },
  { id: 'ardosia', dark: '#AAB4C0', light: '#4B5563' },
]

/** Só a forma de um slug de nicho (não diz se o nicho existe). */
export function isNicheSlug(raw: unknown): raw is Niche {
  return typeof raw === 'string' && raw.length >= SLUG_MIN && raw.length <= SLUG_MAX && NICHE_SLUG_RE.test(raw) && !RESERVED_NICHE_SLUGS.has(raw)
}
/** Só a forma: 'todos' ou um slug válido. Não diz se o nicho existe (isso é do motor: obs.scopeOf). */
export function parseNiche(raw: string | null | undefined): NicheScope | null {
  return raw === 'todos' || isNicheSlug(raw) ? raw : null
}
/** Ordem das abas: por order, depois slug. */
export function tabOrder(defs: readonly NicheDef[]): Niche[] {
  return [...defs].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map(d => d.id)
}
/** Ordem em que a forja enumera: 'ia', 'viagem' (como dados.js), depois os demais na ordem das abas. */
export function forjaOrder(defs: readonly NicheDef[]): Niche[] {
  const tabs = tabOrder(defs)
  return [...FORJA_FIRST.filter(n => tabs.includes(n)), ...tabs.filter(n => !FORJA_FIRST.includes(n))]
}
/** Rótulo do nicho; o próprio slug quando o nicho não existe mais. Nunca lança. */
export function nicheLabel(defs: readonly NicheDef[], n: Niche): string {
  return defs.find(d => d.id === n)?.label ?? n
}
/** "Viagem e IA" · "Viagem, IA e Jogos": a lista de rótulos com o conector do português. */
export function joinLabels(labels: readonly string[]): string {
  return labels.length <= 1 ? labels.join('') : labels.slice(0, -1).join(', ') + ' e ' + labels[labels.length - 1]
}
/** Port of dados.js:813. */
export const inNiche = (niche: NicheScope | 'all' | null | undefined, x: { niche: string | null }): boolean =>
  !niche || niche === 'todos' || niche === 'all' || x.niche === niche
