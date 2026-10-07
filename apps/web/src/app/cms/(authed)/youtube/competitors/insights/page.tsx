import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { openObservatoryPage } from '../_chrome/page-data'
import { buildInsightsView } from '../_insights/view-model'
import { InsightsScreen } from '../_insights/insights-screen'
import { readingCopyText } from '../_chrome/forja-view-model'
import '../_insights/insights.css'

export const metadata = { title: 'Insights · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function InsightsPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { obs, savedNiche } = await openObservatoryPage()
  // parseNiche checks the form; the engine says whether the niche exists (an unknown one opens in Todos)
  const view = buildInsightsView(obs, { niche: obs.scopeOf(parseNiche(flat.niche) ?? savedNiche), fmt: flat.fmt })
  return (
    <ObservatoryChromeServer tab="insights" searchParams={sp} obs={obs} forja={view.forja}
      readingCopy={view.hero?.reading ? readingCopyText([view.hero.themes, view.hero.reading], view.hero.noteLabel) : null}>
      <InsightsScreen view={view} heatMode={flat.heat === 'views' ? 'views' : 'uploads'} />
    </ObservatoryChromeServer>
  )
}
