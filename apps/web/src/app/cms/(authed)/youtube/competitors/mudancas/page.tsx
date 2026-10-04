import { getSiteContext } from '@/lib/cms/site-context'
import { createObservatory } from '@/lib/youtube/observatorio'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { getUserNiche } from '../niche-actions'
import { toggleChangeBookmark } from '../actions'
import { askForjaReading } from '../forja-actions'
import { buildMudancasView } from '../_mudancas/view-model'
import { loadSwipeRows, savedFromRows } from '../_mudancas/swipe-rows'
import { MudancasScreen } from '../_mudancas/mudancas-screen'
import '../_mudancas/mudancas.css'

export const metadata = { title: 'Mudanças · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function MudancasPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { siteId } = await getSiteContext()
  const [obs, rows, asked] = await Promise.all([
    loadDataset({ siteId, now: observatoryNow() }).then(createObservatory),
    loadSwipeRows(siteId),
    parseNiche(flat.niche) ?? getUserNiche(),
  ])
  // parseNiche checks the form; the engine says whether the niche exists (an unknown one opens in Todos)
  const niche = obs.scopeOf(asked)
  const { saved, keys } = savedFromRows(obs, rows)
  const view = buildMudancasView(obs, { ...flat, niche }, saved, keys)
  return (
    <ObservatoryChromeServer tab="mudancas" searchParams={sp} obs={obs} forja={view.forja}>
      <MudancasScreen view={view} onToggleSwipe={toggleChangeBookmark} onAskForja={askForjaReading} />
    </ObservatoryChromeServer>
  )
}
