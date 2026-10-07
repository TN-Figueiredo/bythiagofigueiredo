// The one entry of the Observatório pages to their data. The access check comes FIRST: the dataset is read with the
// service client (no RLS) and its heavy rows are cached per site, so nothing is read, or warmed, for a request that
// may not see the site. `siteId` comes from the middleware (host → site), never from the URL.
import 'server-only'
import { redirect } from 'next/navigation'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import { rowsToDataset, type ObservatoryRows } from '@/lib/youtube/observatorio/load'
import { loadPageRows } from '@/lib/youtube/observatorio/load-page'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { parseNiche, type NicheScope } from '@/lib/youtube/observatorio/niche'

export interface ObservatoryPage<T> {
  siteId: string; now: number; rows: ObservatoryRows; obs: Observatory
  /** The viewer's saved niche (form only; the page applies obs.scopeOf). A missing or unreadable preference is 'todos'. */
  savedNiche: NicheScope
  extra: T
}

/** `extra`: a page's own read (swipe file, unlock permission), run in parallel with the dataset, after the guard. */
export async function openObservatoryPage<T = undefined>(extra?: (siteId: string) => Promise<T>): Promise<ObservatoryPage<T>> {
  const { siteId } = await getSiteContext()
  const access = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  // the same two exits as the CMS layout
  if (!access.ok) redirect(access.reason === 'unauthenticated' ? '/cms/login' : '/?error=insufficient_access')
  const now = observatoryNow()
  const [rows, pref, more] = await Promise.all([
    loadPageRows(siteId, now),
    getSupabaseServiceClient().from('competitor_user_prefs').select('niche').eq('user_id', access.user.id).eq('site_id', siteId).maybeSingle(),
    extra ? extra(siteId) : Promise.resolve(undefined as T),
  ])
  return { siteId, now, rows, obs: createObservatory(rowsToDataset(rows, now)), savedNiche: parseNiche(pref.data?.niche) ?? 'todos', extra: more }
}
