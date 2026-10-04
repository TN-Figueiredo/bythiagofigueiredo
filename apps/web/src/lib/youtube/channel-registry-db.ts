// Cadastro de canais próprios (/cms/youtube): o que a página lê além do painel — a identidade de cada canal (idioma,
// slug, nicho) e os nichos do site com as contagens de uso. Nunca lança: a página não pode quebrar se a migration dos
// nichos / do slug ainda não chegou a este banco, nem se uma leitura de apoio falhar.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BUILTIN_NICHES, tabOrder } from './observatorio/niche'
import { nicheDefs, readNiches } from './observatorio/niches-db'
import type { NicheView } from './channel-registry'

/** Coluna que este banco ainda não tem (Postgres / PostgREST). */
const NO_COLUMN = new Set(['42703', 'PGRST204'])

export interface ChannelIdentityRow { locale: string; slug: string | null; niche: string | null }
export interface ChannelRegistry {
  /** por id do canal (uuid) */
  identity: Map<string, ChannelIdentityRow>
  /** na ordem das abas do Observatório (sort_order, depois slug) */
  niches: NicheView[]
  /** false = a tabela de nichos não pôde ser lida (ausente ou com erro): valem os de fábrica e não dá para criar */
  nichesAvailable: boolean
}

const record = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? Object.fromEntries(Object.entries(v)) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

async function readIdentity(sb: SupabaseClient, siteId: string): Promise<Map<string, ChannelIdentityRow>> {
  const out = new Map<string, ChannelIdentityRow>()
  const read = async (cols: string): Promise<{ rows: unknown[]; error: { code?: string; message: string } | null }> => {
    const { data, error } = await sb.from('youtube_channels').select(cols).eq('site_id', siteId)
    return { rows: Array.isArray(data) ? data : [], error }
  }
  let res = await read('id, locale, slug, niche')
  // a coluna slug ainda não existe: relê sem ela
  if (res.error && res.error.code != null && NO_COLUMN.has(res.error.code)) res = await read('id, locale, niche')
  if (res.error) {
    console.error('[youtube] channel identity read failed:', res.error.message)
    return out
  }
  for (const raw of res.rows) {
    const r = record(raw)
    const id = str(r.id)
    if (id) out.set(id, { locale: str(r.locale) ?? '', slug: str(r.slug), niche: str(r.niche) })
  }
  return out
}

/** Quantos concorrentes por nicho; null quando a leitura falha. */
async function readCompetitorCounts(sb: SupabaseClient, siteId: string): Promise<Map<string, number> | null> {
  const { data, error } = await sb.from('competitor_channels').select('niche').eq('site_id', siteId)
  if (error) {
    console.error('[youtube] competitor niche count failed:', error.message)
    return null
  }
  const out = new Map<string, number>()
  for (const raw of data ?? []) {
    const n = str(record(raw).niche)
    if (n) out.set(n, (out.get(n) ?? 0) + 1)
  }
  return out
}

export async function loadChannelRegistry(sb: SupabaseClient, siteId: string): Promise<ChannelRegistry> {
  const [identity, competitors, nicheRows] = await Promise.all([
    readIdentity(sb, siteId),
    readCompetitorCounts(sb, siteId),
    readNiches(sb, siteId).catch((e: unknown) => { console.error('[youtube] niches read failed:', e instanceof Error ? e.message : e); return null }),
  ])
  const defs = nicheRows === null ? [...BUILTIN_NICHES] : nicheDefs(nicheRows)
  const own = new Map<string, number>()
  for (const c of identity.values()) if (c.niche) own.set(c.niche, (own.get(c.niche) ?? 0) + 1)
  const niches = tabOrder(defs).flatMap((slug): NicheView[] => {
    const d = defs.find(x => x.id === slug)
    return d ? [{
      slug, label: d.label, dark: d.color.dark, light: d.color.light, builtin: d.builtin,
      channels: own.get(slug) ?? 0, competitors: competitors === null ? null : competitors.get(slug) ?? 0,
    }] : []
  })
  return { identity, niches, nichesAvailable: nicheRows !== null }
}
