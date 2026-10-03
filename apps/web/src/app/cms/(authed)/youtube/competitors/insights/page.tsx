import { getSiteContext } from '@/lib/cms/site-context'
import { createObservatory } from '@/lib/youtube/observatorio'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { getUserNiche } from '../niche-actions'
import { buildInsightsView } from '../_insights/view-model'
import { InsightsScreen } from '../_insights/insights-screen'
import '../_insights/insights.css'

export const metadata = { title: 'Insights · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function InsightsPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { siteId } = await getSiteContext()
  const [obs, niche] = await Promise.all([
    loadDataset({ siteId, now: observatoryNow() }).then(ds => createObservatory(ds)),
    parseNiche(flat.niche) ?? getUserNiche(),
  ])
  const view = buildInsightsView(obs, { niche, fmt: flat.fmt })
  return (
    <ObservatoryChromeServer tab="insights" searchParams={sp} obs={obs}>
      <InsightsScreen view={view} heatMode={flat.heat === 'views' ? 'views' : 'uploads'} />
    </ObservatoryChromeServer>
  )
}
