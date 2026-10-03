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
import { askForjaReading, cancelForjaReading } from '../forja-actions'
import { buildForjaDrawerView, type ForjaView } from './forja-view-model'
import { ObservatoryChrome } from './observatory-chrome'
import { buildChromeView, coworkText, type ChromeTab } from './view-model'
import { resolveNiche, type ObsSearchParams } from './resolve-niche'

export async function ObservatoryChromeServer({ tab, searchParams, obs, nicheOverride, coworkFor, forja, readingCopy, children }: {
  tab: ChromeTab; searchParams: ObsSearchParams | undefined
  /** A page that already built the engine passes it to avoid a second load. */
  obs?: Observatory; children: ReactNode
  /** Display-only niche of this screen (e.g. Outliers showing a channel or reading of another niche); never persisted. */
  nicheOverride?: NicheScope
  /** Screen outside the tabs whose "Copiar pedido para o Cowork" text differs from its tab's (Histórico). */
  coworkFor?: 'historico'
  /** The screen's forja view (Task 35): header button, status and heartbeat; the drawer is built here from it. */
  forja?: ForjaView | null
  /** Insights: the shown reading as plain text for the menu's "Copiar texto da leitura". */
  readingCopy?: string | null
}) {
  const resolved = await resolveNiche(searchParams)
  const niche = nicheOverride ?? resolved.niche, dropParam = resolved.dropParam
  const engine = obs ?? createObservatory(await loadDataset({ siteId: (await getSiteContext()).siteId, now: observatoryNow() }))
  const view = buildChromeView(engine, { tab, niche, forja })
  // Histórico keeps its request in the screen (header without button): no drawer there
  const drawer = view.forja && view.forja.headerVariant !== 'none' ? buildForjaDrawerView(engine, { niche: view.forja.niche, type: view.forja.type }) : null
  return (
    <ObservatoryChrome view={{ ...view, ...(coworkFor ? { cowork: coworkText(coworkFor, niche) } : {}) }} dropNicheParam={dropParam} onSetNiche={setUserNiche} onSyncNow={syncCompetitorsNow}
      forjaDrawer={drawer} onAskForja={askForjaReading} onCancelForja={cancelForjaReading} readingCopy={readingCopy}>
      {children}
    </ObservatoryChrome>
  )
}
