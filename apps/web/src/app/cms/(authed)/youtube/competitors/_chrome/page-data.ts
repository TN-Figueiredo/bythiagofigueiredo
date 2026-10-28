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
import type { AcessoPrivado, LeituraPrivadaDoSite, MotivoSemLeitura } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { acessoPrivado, longosAcompanhadosDe } from '../_proprio/dados'
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
  /** Quem abriu a página (só `openObservatoryPage` preenche): quem precisa da pessoa não repete a checagem de sessão. */
  userId?: string
}

/**
 * O corpo de `openObservatoryPage` DEPOIS da guarda (E17 degrau 2, plano 4.7): sem sessão, sem cookie, sem redirect. Quem chama decide de onde
 * vêm o site e a pessoa. `userIdDaPreferencia: null` = a preferência de nicho não é lida (`savedNiche` é `todos`). NÃO tem guarda: só
 * `openObservatoryPage` (abaixo) e o abridor da chave (`_acesso-ia/abrir-por-chave.ts`) a chamam, e um teste de varredura tranca isso.
 * `meuCanalLembrado` pode vir como promessa, para o corpo continuar lendo o cookie em paralelo com o conjunto.
 */
export async function carregarObservatorio<T>(a: {
  siteId: string; now: number; userIdDaPreferencia: string | null; meuCanalLembrado: string | null | Promise<string | null>; extra?: (siteId: string) => Promise<T>
}): Promise<ObservatoryPage<T>> {
  const { siteId, now } = a
  const [rows, pref, more, meuCanalLembrado] = await Promise.all([
    loadPageRows(siteId, now),
    a.userIdDaPreferencia === null
      ? Promise.resolve(null)
      : getSupabaseServiceClient().from('competitor_user_prefs').select('niche').eq('user_id', a.userIdDaPreferencia).eq('site_id', siteId).maybeSingle(),
    a.extra ? a.extra(siteId) : Promise.resolve(undefined as T),
    a.meuCanalLembrado,
  ])
  return { siteId, now, rows, obs: createObservatory(rowsToDataset(rows, now)), meuCanalLembrado, savedNiche: parseNiche(pref?.data?.niche) ?? 'todos', extra: more }
}

/** `extra`: a page's own read (swipe file, unlock permission), run in parallel with the dataset, after the guard. */
export async function openObservatoryPage<T = undefined>(extra?: (siteId: string) => Promise<T>): Promise<ObservatoryPage<T>> {
  const { siteId } = await getSiteContext()
  const access = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  // the same two exits as the CMS layout
  if (!access.ok) redirect(access.reason === 'unauthenticated' ? '/cms/login' : '/?error=insufficient_access')
  return { ...(await carregarObservatorio({ siteId, now: observatoryNow(), userIdDaPreferencia: access.user.id, meuCanalLembrado: lerMeuCanalLembrado(), extra })), userId: access.user.id }
}

export interface ChannelPage {
  siteId: string; now: number; obs: Observatory | null; canEdit: boolean
  /** A prova de que o visitante pode LER o desempenho privado do site (edita, ou tem o direito concedido), ou null. É a única chave do dado privado do canal próprio: objeto de servidor, nunca vai para um componente cliente. Não autoriza escrita. */
  leitura: LeituraPrivadaDoSite | null
  /** Por que não há leitura (`sem_direito` ou `nao_foi_possivel_conferir`); null se há leitura. Só para a frase do pacote "Perguntar a uma IA": nunca libera dado. */
  negativa: MotivoSemLeitura | null
  /** Os ytIds dos longos acompanhados do canal, se ele for próprio (mais novo primeiro); [] para concorrente e para canal não encontrado. */
  ownYtIds: string[]
  /** A escolha do dono para "o meu canal" (cookie `obs-meu-canal`), ou null. */
  meuCanalLembrado: string | null
  /** Os canais próprios do site para o atalho "Meu canal": o conjunto de um canal lança em `ownChannels`, então vêm de uma leitura leve. Existe também quando o canal não foi encontrado. */
  owns: OwnMenu
}

/**
 * Entry of the channel page. The access check comes FIRST (same two exits as openObservatoryPage); only then is the
 * one-channel dataset read. `obs` null = the id is not a channel of this site (unknown, removed, another site's): the page
 * says so inside its frame, with status 200, and nothing is thrown or sent to Sentry. A failed read still throws.
 * `canEdit` is the edit permission of the site, taken from `acesso.edita` (the page asks the admin permission on top of it for what only admins do); it is a hint for the screen, every write action asks its own edit guard. `leitura` is the token of private reading (who edits, or who holds the granted right). A failing guard is fail-closed: no token, canEdit false, the error goes to Sentry.
 * `owns`: the own channels of the site (light read, same guard, in parallel with the channel's set); a failed read throws, it never becomes an empty menu.
 */
export async function openChannelPage(channelId: string): Promise<ChannelPage> {
  const { siteId } = await getSiteContext()
  const access = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!access.ok) redirect(access.reason === 'unauthenticated' ? '/cms/login' : '/?error=insufficient_access')
  return carregarCanal({ siteId, now: observatoryNow(), channelId, acesso: acessoPrivado(siteId), meuCanalLembrado: lerMeuCanalLembrado() })
}

/**
 * O corpo de `openChannelPage` DEPOIS da guarda (E17 degrau 2, plano 4.7). `acesso` e `meuCanalLembrado` podem vir como promessas, para a
 * página continuar pedindo o direito privado e o cookie EM PARALELO com o conjunto do canal. NÃO tem guarda: ver `carregarObservatorio`.
 */
export async function carregarCanal(a: {
  siteId: string; now: number; channelId: string; acesso: AcessoPrivado | Promise<AcessoPrivado>; meuCanalLembrado: string | null | Promise<string | null>
}): Promise<ChannelPage> {
  const { siteId, now, channelId } = a
  const [ds, acesso, ownRows, meuCanalLembrado] = await Promise.all([
    loadChannelDataset(siteId, channelId, now),
    a.acesso,
    loadOwnMenuRows(siteId),
    a.meuCanalLembrado,
  ])
  const obs = ds ? createObservatory(ds) : null
  // o carregador casa o id sem distinguir maiúsculas (uuid): o canal próprio é achado do mesmo jeito
  const proprio = obs ? (obs.channel(channelId.toLowerCase()) ?? obs.channel(channelId)) : undefined
  return { siteId, now, obs, canEdit: acesso.edita, leitura: acesso.leitura, negativa: acesso.negativa, ownYtIds: obs && proprio?.own ? longosAcompanhadosDe(obs, proprio.id) : [], meuCanalLembrado, owns: ownMenuFromRows(ownRows, obs ? obs.fmt : createFmt(createClock(now, now, now)), { lembrado: meuCanalLembrado, agora: now }) }
}
