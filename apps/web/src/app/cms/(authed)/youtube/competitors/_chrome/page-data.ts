// The one entry of the Observatório pages to their data. The access check comes FIRST: the dataset is read with the
// service client (no RLS) and its heavy rows are cached per site, so nothing is read, or warmed, for a request that
// may not see the site. `siteId` comes from the middleware (host → site), never from the URL.
import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import { rowsToDataset, type ObservatoryRows } from '@/lib/youtube/observatorio/load'
import { loadChannelDataset, loadPageRows } from '@/lib/youtube/observatorio/load-page'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { parseNiche, type NicheScope } from '@/lib/youtube/observatorio/niche'
import { loadOwnMenuRows } from '@/lib/youtube/observatorio/own-menu'
import { createFmt } from '@/lib/youtube/observatorio/fmt'
import { createClock } from '@/lib/youtube/observatorio/time'
import { ownMenuFromRows, type OwnMenu } from './own-menu'
import { COOKIE_MEU_CANAL, parseMeuCanal } from './meu-canal-lembrado'

/**
 * O canal que o dono escolheu como "o meu canal" (cookie `obs-meu-canal`, design D-C.2), ou `null`: sem cookie, valor que não é uuid e falha de
 * leitura viram `null` sem erro (é só uma preferência; a regra de recência cobre). Lido no servidor porque os links "Comparar" são montados aqui.
 * Só vale como candidato se for canal próprio com vídeos do site: quem usa o valor (`escolherPrincipal`) ignora o resto.
 */
export async function lerMeuCanalLembrado(): Promise<string | null> {
  try { return parseMeuCanal((await cookies()).get(COOKIE_MEU_CANAL)?.value) } catch { return null }
}

export interface ObservatoryPage<T> {
  siteId: string; now: number; rows: ObservatoryRows; obs: Observatory
  /** A escolha do dono para "o meu canal" (cookie `obs-meu-canal`), ou null. */
  meuCanalLembrado: string | null
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
  const [rows, pref, more, meuCanalLembrado] = await Promise.all([
    loadPageRows(siteId, now),
    getSupabaseServiceClient().from('competitor_user_prefs').select('niche').eq('user_id', access.user.id).eq('site_id', siteId).maybeSingle(),
    extra ? extra(siteId) : Promise.resolve(undefined as T),
    lerMeuCanalLembrado(),
  ])
  return { siteId, now, rows, obs: createObservatory(rowsToDataset(rows, now)), meuCanalLembrado, savedNiche: parseNiche(pref.data?.niche) ?? 'todos', extra: more }
}

export interface ChannelPage {
  siteId: string; now: number; obs: Observatory | null; canEdit: boolean
  /** A escolha do dono para "o meu canal" (cookie `obs-meu-canal`), ou null. */
  meuCanalLembrado: string | null
  /** Os canais próprios do site para o atalho "Meu canal": o conjunto de um canal lança em `ownChannels`, então vêm de uma leitura leve. Existe também quando o canal não foi encontrado. */
  owns: OwnMenu
}

/**
 * Entry of the channel page. The access check comes FIRST (same two exits as openObservatoryPage); only then is the
 * one-channel dataset read. `obs` null = the id is not a channel of this site (unknown, removed, another site's): the page
 * says so inside its frame, with status 200, and nothing is thrown or sent to Sentry. A failed read still throws.
 * `canEdit` is the edit permission of the site (the page asks the admin permission on top of it for what only admins do).
 * `owns`: the own channels of the site (light read, same guard, in parallel with the channel's set); a failed read throws, it never becomes an empty menu.
 */
export async function openChannelPage(channelId: string): Promise<ChannelPage> {
  const { siteId } = await getSiteContext()
  const access = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!access.ok) redirect(access.reason === 'unauthenticated' ? '/cms/login' : '/?error=insufficient_access')
  const now = observatoryNow()
  const [ds, edit, ownRows, meuCanalLembrado] = await Promise.all([
    loadChannelDataset(siteId, channelId, now),
    requireSiteScope({ area: 'cms', siteId, mode: 'edit' }),
    loadOwnMenuRows(siteId),
    lerMeuCanalLembrado(),
  ])
  const obs = ds ? createObservatory(ds) : null
  return { siteId, now, obs, canEdit: edit.ok, meuCanalLembrado, owns: ownMenuFromRows(ownRows, obs ? obs.fmt : createFmt(createClock(now, now, now)), { lembrado: meuCanalLembrado, agora: now }) }
}
