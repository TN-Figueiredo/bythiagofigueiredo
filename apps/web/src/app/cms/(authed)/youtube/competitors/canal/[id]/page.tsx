import { redirect } from 'next/navigation'
import { canAdminSiteUsers } from '@/lib/youtube/competitor-admin'
import { link } from '@/lib/youtube/observatorio/links'
import { openChannelPage } from '../../_chrome/page-data'
import type { ObsSearchParams } from '../../_chrome/resolve-niche'
import { TrailChrome } from '../../_chrome/trail-chrome'
import { CanalScreen, CanalNotFound } from '../../_canal/canal-screen'
import { buildCanalView } from '../../_canal/view-model'
import { nicheOptions } from '../../_canais/view-model'
import { removeCompetitorChannel, syncCompetitorNow, pinVideo, unpinVideo, getCompetitorRemovalImpactAction } from '../../actions'
import { setChannelNiche } from '../../niche-actions'

export const metadata = { title: 'Canal · Competidores' }
export const dynamic = 'force-dynamic'
/** As páginas do Observatório ficam em 60 s. */
export const maxDuration = 60

/** A página de um canal do concorrente (spec 5). Moldura só com a trilha: sem abas de seção e sem barra de nicho. */
export default async function CanalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ObsSearchParams> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { obs, siteId } = await openChannelPage(id)
  const view = obs ? buildCanalView(obs, id, flat) : null
  if (!obs || !view) {
    return (
      <TrailChrome crumbs={[{ text: 'Canais', href: link.canais() }, { text: 'Canal não encontrado' }]}>
        <CanalNotFound canaisHref={link.canais()} />
      </TrailChrome>
    )
  }
  // Canal próprio continua no painel lateral de Canais até a A4 (emenda 26).
  if (view.own) redirect(link.canais({ channel: id }))
  const canAdmin = await canAdminSiteUsers(siteId)
  return (
    <TrailChrome crumbs={[{ text: view.origemText, href: view.canaisHref }, { text: view.header.name }]}>
      <CanalScreen view={view} niches={nicheOptions(obs)} canAdmin={canAdmin} leitura={null}
        actions={{ onSyncOne: syncCompetitorNow, onRemove: removeCompetitorChannel, onRemovalImpact: getCompetitorRemovalImpactAction, onSetNiche: setChannelNiche, onPin: pinVideo, onUnpin: unpinVideo }} />
    </TrailChrome>
  )
}
