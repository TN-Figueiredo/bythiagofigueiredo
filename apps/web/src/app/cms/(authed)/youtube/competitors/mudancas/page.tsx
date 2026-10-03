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
import { MudancasScreen } from '../_mudancas/mudancas-screen'
import '../_mudancas/mudancas.css'

export const metadata = { title: 'Mudanças · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Version keys of the saved changes (swipe file = competitor_changes.bookmarked): `to_version_id`, or the row id of a legacy row. */
async function loadSwipeKeys(siteId: string): Promise<Set<string>> {
  const { data, error } = await getSupabaseServiceClient()
    .from('competitor_changes').select('id, to_version_id').eq('site_id', siteId).eq('bookmarked', true).limit(1000)
  if (error || !data) return new Set()
  const keys = new Set<string>()
  for (const r of data) { keys.add(r.id); if (r.to_version_id) keys.add(r.to_version_id) }
  return keys
}

export default async function MudancasPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { siteId } = await getSiteContext()
  const [obs, keys, niche] = await Promise.all([
    loadDataset({ siteId, now: observatoryNow() }).then(createObservatory),
    loadSwipeKeys(siteId),
    parseNiche(flat.niche) ?? getUserNiche(),
  ])
  const saved = new Set(obs.changes.filter(c => keys.has(c.toId)).map(c => c.id))
  const view = buildMudancasView(obs, { ...flat, niche }, saved)
  return (
    <ObservatoryChromeServer tab="mudancas" searchParams={sp} obs={obs}>
      <MudancasScreen view={view} onToggleSwipe={toggleChangeBookmark} />
    </ObservatoryChromeServer>
  )
}
