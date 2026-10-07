/**
 * Server entry of the chrome: each Observatório page wraps its screen with it (App Router layouts do not receive
 * searchParams, so the niche/tab-dependent chrome is rendered per page). Server actions go down as props.
 */
import type { ReactNode } from 'react'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import { openObservatoryPage } from './page-data'
import { setUserNiche } from '../niche-actions'
import { syncCompetitorsNow } from '../actions'
import { askForjaReading } from '../forja-actions'
import type { ForjaView } from './forja-view-model'
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
  /** The screen's forja view (Task 35): header button, status and heartbeat. */
  forja?: ForjaView | null
  /** Insights: the shown reading as plain text for the menu's "Copiar texto da leitura". */
  readingCopy?: string | null
}) {
  const resolved = await resolveNiche(searchParams)
  const engine = obs ?? (await openObservatoryPage()).obs
  // resolveNiche only knows the FORM; the engine knows the site's niches. A niche that does not exist (a saved one that was
  // removed, a stale link) shows Todos, without error, and a ?niche= naming it is dropped from the URL like an invalid one.
  const wanted = nicheOverride ?? resolved.niche, niche = engine.scopeOf(wanted)
  const dropParam = resolved.dropParam || (nicheOverride == null && niche !== wanted && resolved.fromParam)
  const view = buildChromeView(engine, { tab, niche, forja })
  return (
    <ObservatoryChrome view={{ ...view, ...(coworkFor ? { cowork: coworkText(coworkFor, niche, view.nicheLabel) } : {}) }} dropNicheParam={dropParam} onSetNiche={setUserNiche} onSyncNow={syncCompetitorsNow}
      onAskForja={askForjaReading} readingCopy={readingCopy}>
      {children}
    </ObservatoryChrome>
  )
}
