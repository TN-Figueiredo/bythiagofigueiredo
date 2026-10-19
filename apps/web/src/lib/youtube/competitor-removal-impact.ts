// What removing a competitor channel deletes (the channel's delete cascades to videos, versions and daily records).
// Read-only, numbers only: the dialog's wording belongs to the screen.
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface CompetitorRemovalImpact {
  name: string | null; videos: number; pinned: number; versions: number; dailyDays: number; bookmarks: number
  /** leituras da forja (`competitor_readings`) */
  readings: number
  /** o que a página de vídeo (watch) também perde: `competitor_channel_removal_extra` */
  watch: { readings: number; thumbs: number; alvos: number }
}
/** O que `parseRemovalImpact` lê: a função do banco não conhece as leituras da forja nem a watch. */
export type ImpactoBase = Omit<CompetitorRemovalImpact, 'readings' | 'watch'>

const FN = 'competitor_channel_removal_impact'
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0

/** The function's jsonb → the impact. null = the channel is not this site's. Any other shape THROWS: a count is never guessed as 0. */
export function parseRemovalImpact(data: unknown): ImpactoBase | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error(FN + ': resposta inesperada')
  const d = data as Record<string, unknown>
  if (d.status === 'not_found') return null
  if (d.status !== 'ok' || !isCount(d.videos) || !isCount(d.pinned) || !isCount(d.versions) || !isCount(d.daily_days) || !isCount(d.bookmarks)) throw new Error(FN + ': resposta inesperada')
  return { name: typeof d.name === 'string' ? d.name : null, videos: d.videos, pinned: d.pinned, versions: d.versions, dailyDays: d.daily_days, bookmarks: d.bookmarks }
}

const EXTRA = 'competitor_channel_removal_extra'

/** A janela "sem guardar": o canal tem até `limiteDias` dias? Mesma fronteira do banco (`>`). */
export type SemGuardar = { pode: true } | { pode: false; porque: 'antigo'; meses: number } | { pode: false; porque: 'sem_data' }

export function semGuardarDe(addedAtIso: string | null, agoraMs: number, limiteDias: number): SemGuardar {
  const added = addedAtIso == null ? NaN : Date.parse(addedAtIso)
  if (!Number.isFinite(added)) return { pode: false, porque: 'sem_data' }
  const dias = (agoraMs - added) / 86_400_000
  if (dias > limiteDias) return { pode: false, porque: 'antigo', meses: Math.max(1, Math.floor(dias / 30)) }
  return { pode: true }
}

function parseExtra(data: unknown): CompetitorRemovalImpact['watch'] {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error(EXTRA + ': resposta inesperada')
  const d = data as Record<string, unknown>
  if (!isCount(d.readings) || !isCount(d.thumbs) || !isCount(d.alvos)) throw new Error(EXTRA + ': resposta inesperada')
  return { readings: d.readings, thumbs: d.thumbs, alvos: d.alvos }
}

/**
 * Service-role read: the caller must have passed the site guard. null = o canal não é deste site (ou sumiu no meio da leitura).
 * Qualquer contagem que falhe LANÇA: um número nunca vira 0 por falha. Quem calcula `semGuardar` é a action (a lib não conhece o relógio).
 */
export async function getCompetitorRemovalImpact(siteId: string, channelRowId: string): Promise<{ impact: CompetitorRemovalImpact; addedAt: string | null } | null> {
  const sb = getSupabaseServiceClient()
  const [base, extra, leituras, canal] = await Promise.all([
    sb.rpc(FN, { p_site_id: siteId, p_channel_id: channelRowId }),
    sb.rpc(EXTRA, { p_site: siteId, p_channel: channelRowId }),
    sb.from('competitor_readings').select('id, competitor_videos!inner(competitor_channel_id)', { count: 'exact', head: true })
      .eq('site_id', siteId).eq('competitor_videos.competitor_channel_id', channelRowId),
    sb.from('competitor_channels').select('added_at').eq('id', channelRowId).eq('site_id', siteId).maybeSingle(),
  ])
  if (base.error) throw new Error(FN + ': ' + base.error.message)
  const b = parseRemovalImpact(base.data)
  if (!b) return null
  if (extra.error) {
    if (/E10:canal_nao_encontrado/.test(extra.error.message ?? '')) return null
    throw new Error(EXTRA + ': ' + extra.error.message)
  }
  const watch = parseExtra(extra.data)
  if (leituras.error) throw new Error('competitor_readings: ' + leituras.error.message)
  if (typeof leituras.count !== 'number' || !isCount(leituras.count)) throw new Error('competitor_readings: contagem ausente')
  if (canal.error) throw new Error('competitor_channels: ' + canal.error.message)
  if (!canal.data) return null
  const added = (canal.data as { added_at?: unknown }).added_at
  return { impact: { ...b, readings: leituras.count, watch }, addedAt: typeof added === 'string' ? added : null }
}
