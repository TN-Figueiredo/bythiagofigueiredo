/**
 * Server-side read of the swipe file (competitor_changes.bookmarked) and its resolution to engine change ids.
 * Shared by Mudanças (the "Só salvas" list) and Histórico (its pager rebuilds that same list).
 */
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Observatory } from '@/lib/youtube/observatorio'
import { resolveSwipeKeys, type SwipeLegacyRow } from './swipe-keys'

/** competitor_changes rows the swipe file needs: the bookmarked ones and the legacy ones (from_version_id null), paged. */
export async function loadSwipeRows(siteId: string): Promise<{ legacy: SwipeLegacyRow[]; bookmarked: Set<string> }> {
  const sb = getSupabaseServiceClient()
  const PAGE = 1000
  const legacy: SwipeLegacyRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('competitor_changes').select('id, video_id, change_type, detected_at')
      .eq('site_id', siteId).is('from_version_id', null).in('change_type', ['title', 'description']).order('id').range(from, from + PAGE - 1)
    if (error || !data) break
    legacy.push(...data)
    if (data.length < PAGE) break
  }
  const bookmarked = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('competitor_changes').select('id, to_version_id').eq('site_id', siteId).eq('bookmarked', true).order('id').range(from, from + PAGE - 1)
    if (error || !data) break
    for (const r of data) { bookmarked.add(r.id); if (r.to_version_id) bookmarked.add(r.to_version_id) }
    if (data.length < PAGE) break
  }
  return { legacy, bookmarked }
}

/** Engine change ids in the swipe file, plus the change → row key map (legacy rows resolved). */
export function savedFromRows(obs: Observatory, rows: { legacy: SwipeLegacyRow[]; bookmarked: Set<string> }): { saved: Set<string>; keys: Map<string, string | null> } {
  const keys = resolveSwipeKeys(obs.changes, rows.legacy)
  const saved = new Set(obs.changes.filter(c => { const k = keys.get(c.id); return k != null && rows.bookmarked.has(k) }).map(c => c.id))
  return { saved, keys }
}
