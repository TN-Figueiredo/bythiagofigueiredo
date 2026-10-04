// Observatório — os nichos do site (tabela youtube_niches). Junto com load.ts, o único lugar do motor que lê o banco.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BUILTIN_NICHES, isNicheSlug, type NicheDef } from './niche'

export class ObservatoryLoadError extends Error {
  constructor(public table: string, public code: string | undefined, message: string) { super('observatório: falha ao ler ' + table + ': ' + message); this.name = 'ObservatoryLoadError' }
}

export interface NicheRow { slug: string; label: string; color_dark: string; color_light: string; sort_order: number }
const NICHE_COLS = 'slug, label, color_dark, color_light, sort_order'
/** Postgres 42P01 (undefined_table) / PostgREST PGRST205 (tabela fora do schema cache): a migration dos nichos ainda não chegou a este banco. */
const NO_TABLE = new Set(['42P01', 'PGRST205'])
const BUILTIN_IDS = new Set(BUILTIN_NICHES.map(n => n.id))

/**
 * Linhas → definições. null / vazio (tabela ausente, site sem linha) → os dois de fábrica, com as cores atuais.
 * Uma linha com slug mal formado ou repetido fica de fora: nunca vira uma aba quebrada.
 */
export function nicheDefs(rows: readonly NicheRow[] | null | undefined): NicheDef[] {
  const seen = new Set<string>(), out: NicheDef[] = []
  for (const r of rows ?? []) {
    if (!isNicheSlug(r.slug) || seen.has(r.slug)) continue
    seen.add(r.slug)
    out.push({ id: r.slug, label: r.label, color: { dark: r.color_dark, light: r.color_light }, order: r.sort_order, builtin: BUILTIN_IDS.has(r.slug) })
  }
  return out.length ? out : [...BUILTIN_NICHES]
}

/** Lê youtube_niches do site. Tabela ausente (42P01 / PGRST205) → null (valem os de fábrica). Outro erro é lançado. */
export async function readNiches(sb: SupabaseClient, siteId: string): Promise<NicheRow[] | null> {
  const { data, error } = await sb.from('youtube_niches').select(NICHE_COLS).eq('site_id', siteId).order('sort_order').order('slug')
  if (error) {
    if (error.code != null && NO_TABLE.has(error.code)) return null
    throw new ObservatoryLoadError('youtube_niches', error.code, error.message)
  }
  return Array.isArray(data) ? (data as NicheRow[]) : []
}
/** Os nichos do site prontos para o motor e para as actions (existência de um slug: `defs.some(d => d.id === slug)`). */
export async function readNicheDefs(sb: SupabaseClient, siteId: string): Promise<NicheDef[]> {
  return nicheDefs(await readNiches(sb, siteId))
}
