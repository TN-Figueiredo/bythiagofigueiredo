/**
 * Server entry of the chrome: each Observatório page wraps its screen with it (App Router layouts do not receive
 * searchParams, so the niche/tab-dependent chrome is rendered per page). Server actions go down as props.
 */
import type { ReactNode } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { setUserNiche } from '../niche-actions'
import { syncCompetitorsNow } from '../actions'
import { ObservatoryChrome } from './observatory-chrome'
import { buildChromeView, type ChromeTab } from './view-model'
import { resolveNiche, type ObsSearchParams } from './resolve-niche'

export async function ObservatoryChromeServer({ tab, searchParams, obs, nicheOverride, children }: {
  tab: ChromeTab; searchParams: ObsSearchParams | undefined
  /** A page that already built the engine passes it to avoid a second load. */
  obs?: Observatory; children: ReactNode
  /** Display-only niche of this screen (e.g. Outliers showing a channel or reading of another niche); never persisted. */
  nicheOverride?: NicheScope
}) {
  const resolved = await resolveNiche(searchParams)
  const niche = nicheOverride ?? resolved.niche, dropParam = resolved.dropParam
  const engine = obs ?? createObservatory(await loadDataset({ siteId: (await getSiteContext()).siteId, now: observatoryNow() }))
  return (
    <ObservatoryChrome view={buildChromeView(engine, { tab, niche })} dropNicheParam={dropParam} onSetNiche={setUserNiche} onSyncNow={syncCompetitorsNow}>
      {children}
    </ObservatoryChrome>
  )
}
