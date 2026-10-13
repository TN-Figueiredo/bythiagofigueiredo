import { redirect } from 'next/navigation'
import { link } from '@/lib/youtube/observatorio/links'
import type { Observatory } from '@/lib/youtube/observatorio'
import { canalTemVideos } from '../_chrome/own-channels'

/** Old dashboard links used ?tab=<name>; each tab is now its own route. "canais" and anything else stay on Canais. */
export function legacyTabRedirect(tab: string | undefined): void {
  if (tab === 'mudancas') redirect(link.mudancas())
  if (tab === 'outliers') redirect(link.outliers())
  if (tab === 'insights') redirect(link.insights())
}

/**
 * Old links to the side panel (?channel=<id>[&tab=…]): a channel now has its own page, so they land there (on the Vídeos tab: the
 * panel's tab has no equivalent). That is the case for a competitor and, since A4, for an OWN channel WITH videos. An own channel
 * without videos has no page (spec 16.8): the list just opens, without the panel. An unknown id changes nothing, as before.
 */
export function competitorChannelRedirect(obs: Pick<Observatory, 'channel' | 'videos'>, channel: string | undefined): void {
  if (!channel) return
  const c = obs.channel(channel)
  if (!c) return
  if (!c.own) redirect(link.canal(c.id))
  if (canalTemVideos(obs, c.id)) redirect(link.canal(c.id))
}

/**
 * O `?channel=` que a lista de Canais recebe. O painel lateral não abre mais para canal nenhum que o site conheça: o concorrente e o próprio com vídeos
 * já foram redirecionados para a página; o próprio sem vídeos (sem página, 16.8) abre a lista SEM painel. Um id desconhecido segue como antes (não abre).
 */
export function canalDoPainel(obs: Pick<Observatory, 'channel'>, channel: string | undefined): string | undefined {
  return channel && !obs.channel(channel) ? channel : undefined
}
