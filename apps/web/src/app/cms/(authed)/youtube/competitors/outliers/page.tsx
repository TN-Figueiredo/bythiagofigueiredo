/**
 * /cms/youtube/competitors/outliers — the Outliers screen inside the Observatório chrome. One engine for the
 * chrome and the screen; the URL carries the screen state (age=, fmt, min, topic, formula, channel, reading,
 * asof, sort, view) and the niche is the persisted one unless ?niche= says otherwise.
 */
import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { openObservatoryPage } from '../_chrome/page-data'
import { OutliersScreen } from '../_outliers/outliers-screen'
import { buildOutliersView } from '../_outliers/view-model'
import '../_outliers/outliers.css'

export const metadata = { title: 'Outliers dos competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function OutliersPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const { obs, savedNiche } = await openObservatoryPage()
  // The chrome persists a valid ?niche= (resolveNiche); here it is only read. An invalid one falls back to the saved niche.
  // parseNiche checks the form; the engine says whether the niche exists (an unknown ?niche= falls back to the saved niche, like a malformed one).
  const urlNiche = parseNiche(first(sp.niche) === 'all' ? 'todos' : first(sp.niche))
  const niche = urlNiche != null && obs.scopeOf(urlNiche) === urlNiche ? urlNiche : obs.scopeOf(savedNiche)
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
