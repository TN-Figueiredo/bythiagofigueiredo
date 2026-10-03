import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { ObservatoryChrome } from '../../_chrome/observatory-chrome'
import { buildChromeView, coworkText } from '../../_chrome/view-model'
import { resolveNiche, type ObsSearchParams } from '../../_chrome/resolve-niche'
import { setUserNiche } from '../../niche-actions'
import { syncCompetitorsNow } from '../../actions'
import { buildHistoricoView } from '../../_historico/view-model'
import { HistoricoScreen } from '../../_historico/historico-screen'
import '../../_historico/historico.css'

export const metadata = { title: 'Histórico do vídeo · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Saved changes (swipe file), only when the origin list was filtered by "só salvas" (back=…saved=1). */
async function savedChangeIds(siteId: string, obs: Observatory): Promise<Set<string>> {
  const { data, error } = await getSupabaseServiceClient()
    .from('competitor_changes').select('id, to_version_id').eq('site_id', siteId).eq('bookmarked', true).limit(1000)
  if (error || !data) return new Set()
  const keys = new Set<string>()
  for (const r of data) { keys.add(r.id); if (r.to_version_id) keys.add(r.to_version_id) }
  return new Set(obs.changes.filter(c => keys.has(c.toId)).map(c => c.id))
}

const decode = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }

export default async function HistoricoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ObsSearchParams> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { siteId } = await getSiteContext()
  const [{ niche, dropParam }, obs] = await Promise.all([
    resolveNiche(sp),
    loadDataset({ siteId, now: observatoryNow() }).then(createObservatory),
  ])
  const saved = /(^|[?&])saved=1(&|$)/.test(flat.back ?? '') ? await savedChangeIds(siteId, obs) : undefined
  // An unknown id renders the not-found state inside the chrome (never a 500).
  const view = buildHistoricoView(obs, decode(id), { ...flat, niche, nicheParam: parseNiche(flat.niche) ?? undefined }, { savedChangeIds: saved })
  // In Histórico the current tab is the origin (?from=, default Mudanças); a video of another niche shows its niche
  // for this view only (chromeNiche), nothing is persisted.
  const chrome = { ...buildChromeView(obs, { tab: view.crumbs.from, niche: view.chromeNiche }), cowork: coworkText('historico', view.chromeNiche) }
  return (
    <ObservatoryChrome view={chrome} dropNicheParam={dropParam} onSetNiche={setUserNiche} onSyncNow={syncCompetitorsNow}>
      <HistoricoScreen view={view} />
    </ObservatoryChrome>
  )
}
