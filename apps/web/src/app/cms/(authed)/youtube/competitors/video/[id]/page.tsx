import { cache } from 'react'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
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
import { lerDadosDoVideo, longosAcompanhadosDe, podeVerPrivado } from '../../_proprio/dados'
import { dmDia } from '../../_proprio/extras'
import { buildVideoBlocos } from '../../_proprio/video-blocos-model'
import { VideoBlocos } from '../../_proprio/video-blocos'
import { buildProprioVideoBase, canalProprioDoVideo, hrefDeOutroVideo } from '../../_proprio/video-model'
import { ProprioVideoScreen } from '../../_proprio/video-screen'
import { askForjaReading, cancelForjaReading } from '../../forja-actions'
import { pinVideo, unpinVideo, syncCompetitorNow } from '../../actions'

/** A página e o título pedem o mesmo conjunto: `cache` do React junta as duas chamadas da MESMA requisição em uma leitura só. */
const abrirPagina = cache(() => openObservatoryPage())

/** O dono do canal do vídeo decide também a aba do navegador: "Vídeo" para o próprio, "Histórico do vídeo" para o resto (o título do concorrente não mudou). */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { obs }] = await Promise.all([params, abrirPagina()])
  return { title: canalProprioDoVideo(obs, id) ? 'Vídeo · Competidores' : 'Histórico do vídeo · Competidores' }
}
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function HistoricoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ObsSearchParams> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { siteId, obs, savedNiche, meuCanalLembrado, now } = await abrirPagina()
  // O dono do canal do vídeo decide a tela (spec 17): vídeo de canal próprio abre a tela do vídeo próprio; o resto continua no Histórico, como sempre.
  // A decisão é do servidor, a partir do canal resolvido do vídeo; nenhum parâmetro da URL entra nela.
  const proprio = canalProprioDoVideo(obs, id)
  if (proprio) {
    // o modelo da página nasce ANTES de qualquer leitura privada: sem ele não há o que ler, e um vídeo próprio nunca cai no Histórico por acidente
    const base = buildProprioVideoBase(obs, id, flat)
    if (!base) throw new Error(`Vídeo próprio ${id}: o cartão não foi achado no conjunto do canal ${proprio.id}`)
    // UMA leitura do dado privado (alcance e diário do canal: as réguas e o normal da faixa precisam dos outros vídeos), depois da guarda de edição; erro de leitura LANÇA (D5)
    const leitura = await podeVerPrivado(siteId)
    const dados = await lerDadosDoVideo({ canalId: proprio.id, ytId: base.header.ytId, longosAcompanhados: longosAcompanhadosDe(obs, proprio.id), agora: now, leitura })
    // os blocos nascem aqui, no servidor, já em texto: só a `View` desce ao cliente (quem só lê o site recebe `acesso: 'negado'` e nenhum número privado)
    const blocos = buildVideoBlocos({ obs, videoId: id, dados, hoje: dayPt(new Date(now)), dm: dmDia, hrefVideo: hrefDeOutroVideo(flat, proprio.id) })
    return (
      <TrailChrome crumbs={base.crumbs} owns={ownMenuOf(obs, meuCanalLembrado)} aside={<Pager pager={base.pager} naTrilha />}>
        <ProprioVideoScreen header={base.header} pager={base.pager} fromCanal={base.fromCanal}>
          <VideoBlocos view={blocos} />
        </ProprioVideoScreen>
      </TrailChrome>
    )
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
