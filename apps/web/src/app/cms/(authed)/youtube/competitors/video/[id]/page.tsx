import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { ObservatoryChromeServer } from '../../_chrome/chrome-server'
import type { ObsSearchParams } from '../../_chrome/resolve-niche'
import { openObservatoryPage } from '../../_chrome/page-data'
import { loadSwipeRows, savedFromRows } from '../../_mudancas/swipe-rows'
import { buildHistoricoView } from '../../_historico/view-model'
import { HistoricoScreen } from '../../_historico/historico-screen'
import '../../_historico/historico.css'
import { askForjaReading, cancelForjaReading } from '../../forja-actions'
import { pinVideo, unpinVideo } from '../../actions'

export const metadata = { title: 'Histórico do vídeo · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function HistoricoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ObsSearchParams> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { siteId, obs, savedNiche } = await openObservatoryPage()
  const formParam = parseNiche(flat.niche) ?? undefined
  // parseNiche checks the form; the engine says whether the niche exists (an unknown one is ignored: the saved niche, else Todos)
  const nicheParam = formParam != null && obs.scopeOf(formParam) === formParam ? formParam : undefined
  const niche = nicheParam ?? obs.scopeOf(savedNiche)
  // The pager rebuilds a "Só salvas" Mudanças list with the same swipe rows the Mudanças screen reads.
  const saved = flat.from !== 'outliers' && flat.from !== 'canais' && /(^|[?&])saved=1(&|$)/.test(flat.back ?? '')
    ? savedFromRows(obs, await loadSwipeRows(siteId)).saved : undefined
  // An unknown id renders the not-found state inside the chrome (never a 500).
  const view = buildHistoricoView(obs, id, { ...flat, niche, nicheParam }, { savedChangeIds: saved })
  // In Histórico the current tab is the origin (?from=, default Mudanças). A video of another niche shows its niche for
  // this view only (nicheOverride, R47: never persisted).
  return (
    <ObservatoryChromeServer tab={view.crumbs.from} searchParams={sp} obs={obs} coworkFor="historico"
      nicheOverride={view.chromeNiche !== niche ? view.chromeNiche : undefined} forja={view.forja}>
      <HistoricoScreen view={view} onAskForja={askForjaReading} onCancelForja={cancelForjaReading} onPin={pinVideo} onUnpin={unpinVideo} />
    </ObservatoryChromeServer>
  )
}
