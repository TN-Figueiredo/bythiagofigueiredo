// What removing a competitor channel deletes (the channel's delete cascades to videos, versions and daily records).
// Read-only, numbers only: the dialog's wording belongs to the screen.
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface CompetitorRemovalImpact { name: string | null; videos: number; pinned: number; versions: number; dailyDays: number; bookmarks: number }

const FN = 'competitor_channel_removal_impact'
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0

/** The function's jsonb → the impact. null = the channel is not this site's. Any other shape THROWS: a count is never guessed as 0. */
export function parseRemovalImpact(data: unknown): CompetitorRemovalImpact | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error(FN + ': resposta inesperada')
  const d = data as Record<string, unknown>
  if (d.status === 'not_found') return null
  if (d.status !== 'ok' || !isCount(d.videos) || !isCount(d.pinned) || !isCount(d.versions) || !isCount(d.daily_days) || !isCount(d.bookmarks)) throw new Error(FN + ': resposta inesperada')
  return { name: typeof d.name === 'string' ? d.name : null, videos: d.videos, pinned: d.pinned, versions: d.versions, dailyDays: d.daily_days, bookmarks: d.bookmarks }
}

/** Service-role read: the caller must have passed the site guard. */
export async function getCompetitorRemovalImpact(siteId: string, channelRowId: string): Promise<CompetitorRemovalImpact | null> {
  const sb = getSupabaseServiceClient()
  const { data, error } = await sb.rpc(FN, { p_site_id: siteId, p_channel_id: channelRowId })
  if (error) throw new Error(FN + ': ' + error.message)
  return parseRemovalImpact(data)
}
