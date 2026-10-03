import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createObservatory } from '@/lib/youtube/observatorio'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { getUserNiche } from '../niche-actions'
import { toggleChangeBookmark } from '../actions'
import { buildMudancasView } from '../_mudancas/view-model'
import { resolveSwipeKeys, type SwipeLegacyRow } from '../_mudancas/swipe-keys'
import { MudancasScreen } from '../_mudancas/mudancas-screen'
import '../_mudancas/mudancas.css'

export const metadata = { title: 'Mudanças · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** competitor_changes rows the swipe file needs: the bookmarked ones and the legacy ones (from_version_id null), paged. */
async function loadSwipeRows(siteId: string) {
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

export default async function MudancasPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { siteId } = await getSiteContext()
  const [obs, rows, niche] = await Promise.all([
    loadDataset({ siteId, now: observatoryNow() }).then(createObservatory),
    loadSwipeRows(siteId),
    parseNiche(flat.niche) ?? getUserNiche(),
  ])
  const keys = resolveSwipeKeys(obs.changes, rows.legacy)
  const saved = new Set(obs.changes.filter(c => { const k = keys.get(c.id); return k != null && rows.bookmarked.has(k) }).map(c => c.id))
  const view = buildMudancasView(obs, { ...flat, niche }, saved, keys)
  return (
    <ObservatoryChromeServer tab="mudancas" searchParams={sp} obs={obs}>
      <MudancasScreen view={view} onToggleSwipe={toggleChangeBookmark} />
    </ObservatoryChromeServer>
  )
}
