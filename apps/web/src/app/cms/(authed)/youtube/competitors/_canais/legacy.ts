import { redirect } from 'next/navigation'
import { link } from '@/lib/youtube/observatorio/links'

/** Old dashboard links used ?tab=<name>; each tab is now its own route. "canais" and anything else stay on Canais. */
export function legacyTabRedirect(tab: string | undefined): void {
  if (tab === 'mudancas') redirect(link.mudancas())
  if (tab === 'outliers') redirect(link.outliers())
  if (tab === 'insights') redirect(link.insights())
}
