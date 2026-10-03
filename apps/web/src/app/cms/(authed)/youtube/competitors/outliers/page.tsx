/**
 * /cms/youtube/competitors/outliers — the Outliers screen inside the Observatório chrome. One engine for the
 * chrome and the screen; the URL carries the screen state (age=, fmt, min, topic, formula, channel, reading,
 * asof, sort, view) and the niche is the persisted one unless ?niche= says otherwise.
 */
import { getSiteContext } from '@/lib/cms/site-context'
import { createObservatory } from '@/lib/youtube/observatorio'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { getUserNiche } from '../niche-actions'
import { OutliersScreen } from '../_outliers/outliers-screen'
import { buildOutliersView } from '../_outliers/view-model'
import '../_outliers/outliers.css'

export const metadata = { title: 'Outliers dos competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function OutliersPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const { siteId } = await getSiteContext()
  const obs = createObservatory(await loadDataset({ siteId, now: observatoryNow() }))
  // The chrome persists a valid ?niche= (resolveNiche); here it is only read. An invalid one falls back to the saved niche.
  const niche = parseNiche(first(sp.niche) === 'all' ? 'todos' : first(sp.niche)) ?? (await getUserNiche())
  const params: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) params[k] = first(v)
  params.niche = niche
  const view = buildOutliersView(obs, params)
  return (
    <ObservatoryChromeServer tab="outliers" searchParams={sp} obs={obs} nicheOverride={view.query.niche !== niche ? view.query.niche : undefined} forja={view.forja}>
      <OutliersScreen view={view} />
    </ObservatoryChromeServer>
  )
}
