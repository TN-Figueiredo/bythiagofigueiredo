import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { TrailChrome } from '../../_chrome/trail-chrome'
import type { ObsSearchParams } from '../../_chrome/resolve-niche'
import { openObservatoryPage } from '../../_chrome/page-data'
import { ownMenuOf } from '../../_chrome/own-menu'
import { loadSwipeRows, savedFromRows } from '../../_mudancas/swipe-rows'
import { buildHistoricoView, historicoTrail } from '../../_historico/view-model'
import { HistoricoScreen } from '../../_historico/historico-screen'
import { Pager } from '../../_historico/pager'
import '../../_historico/historico.css'
import { lerDadosDoCanal, longosAcompanhadosDe, podeVerPrivado } from '../../_proprio/dados'
import { buildProprioVideoPage, canalProprioDoVideo } from '../../_proprio/video-model'
import { ProprioVideoScreen } from '../../_proprio/video-screen'
import { askForjaReading, cancelForjaReading } from '../../forja-actions'
import { pinVideo, unpinVideo, syncCompetitorNow } from '../../actions'

export const metadata = { title: 'Histórico do vídeo · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function HistoricoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ObsSearchParams> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { siteId, obs, savedNiche, meuCanalLembrado, now } = await openObservatoryPage()
  // O dono do canal do vídeo decide a tela (spec 17): vídeo de canal próprio abre a tela do vídeo próprio; o resto continua no Histórico, como sempre.
  // A decisão é do servidor, a partir do canal resolvido do vídeo; nenhum parâmetro da URL entra nela.
  const proprio = canalProprioDoVideo(obs, id)
  if (proprio) {
    // o dado privado do canal INTEIRO (as réguas precisam de todos os vídeos), depois da guarda de edição; erro de leitura LANÇA (D5)
    const edicao = await podeVerPrivado(siteId)
    const dados = await lerDadosDoCanal({ canalId: proprio.id, longosAcompanhados: longosAcompanhadosDe(obs, proprio.id), agora: now, edicao })
    const pv = buildProprioVideoPage(obs, id, flat, dados)
    if (pv) {
      return (
        <TrailChrome crumbs={pv.crumbs} owns={ownMenuOf(obs, meuCanalLembrado)} aside={<Pager pager={pv.pager} naTrilha />}>
          <ProprioVideoScreen header={pv.header} pager={pv.pager} alcanceNota={pv.alcanceNota} fromCanal={pv.fromCanal} />
        </TrailChrome>
      )
    }
  }
  const formParam = parseNiche(flat.niche) ?? undefined
  // parseNiche checks the form; the engine says whether the niche exists (an unknown one is ignored: the saved niche, else Todos)
  const niche = formParam != null && obs.scopeOf(formParam) === formParam ? formParam : obs.scopeOf(savedNiche)
  // The pager rebuilds a "Só salvas" Mudanças list with the same swipe rows the Mudanças screen reads.
  const saved = flat.from !== 'outliers' && flat.from !== 'canais' && /(^|[?&])saved=1(&|$)/.test(flat.back ?? '')
    ? savedFromRows(obs, await loadSwipeRows(siteId)).saved : undefined
  // An unknown id renders the not-found state inside the chrome (never a 500).
  const view = buildHistoricoView(obs, id, { ...flat, niche }, { savedChangeIds: saved })
  // The frame is only the trail (spec A2.6, emenda 25): no section tabs, no niche bar, in every origin. The trail is the way back for whoever
  // came from Mudanças, Outliers, Insights or a channel page. A video of another niche shows it only beside the channel, in the header.
  return (
    <TrailChrome crumbs={historicoTrail(view.crumbs)} owns={ownMenuOf(obs, meuCanalLembrado)} aside={view.pager ? <Pager pager={view.pager} naTrilha /> : undefined}>
      <HistoricoScreen view={view} onAskForja={askForjaReading} onCancelForja={cancelForjaReading} onSyncChannel={syncCompetitorNow} onPin={pinVideo} onUnpin={unpinVideo} pagerNaTrilha />
    </TrailChrome>
  )
}
