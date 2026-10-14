import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { montarInsights } from '../_insights/montar'
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
  const { pagina: { obs, meuCanalLembrado }, view, heatMode } = await montarInsights(flat)
  return (
    <ObservatoryChromeServer tab="insights" searchParams={sp} obs={obs} forja={view.forja} meuCanalLembrado={meuCanalLembrado}
      readingCopy={view.hero?.reading ? readingCopyText([view.hero.themes, view.hero.reading], view.hero.noteLabel) : null}>
      <InsightsScreen view={view} heatMode={heatMode} />
    </ObservatoryChromeServer>
  )
}
