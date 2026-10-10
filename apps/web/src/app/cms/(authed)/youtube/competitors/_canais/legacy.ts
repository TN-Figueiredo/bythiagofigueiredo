import { redirect } from 'next/navigation'
import { link } from '@/lib/youtube/observatorio/links'
import type { Observatory } from '@/lib/youtube/observatorio'

/** Old dashboard links used ?tab=<name>; each tab is now its own route. "canais" and anything else stay on Canais. */
export function legacyTabRedirect(tab: string | undefined): void {
  if (tab === 'mudancas') redirect(link.mudancas())
  if (tab === 'outliers') redirect(link.outliers())
  if (tab === 'insights') redirect(link.insights())
}

/**
 * Old links to the side panel (?channel=<id>[&tab=…]): a competitor now has its own page, so they land there (on the Vídeos
 * tab: the panel's tab has no equivalent). An own channel keeps the panel, and an unknown id changes nothing (the panel just
 * does not open, as before).
 */
export function competitorChannelRedirect(obs: Pick<Observatory, 'channel'>, channel: string | undefined): void {
  if (!channel) return
  const c = obs.channel(channel)
  if (c && !c.own) redirect(link.canal(c.id))
}
