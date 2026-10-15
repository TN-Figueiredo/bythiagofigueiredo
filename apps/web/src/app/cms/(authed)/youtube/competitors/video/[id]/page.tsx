import { cache, Suspense } from 'react'
import * as Sentry from '@sentry/nextjs'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import { DIMENSOES_LIGADO_EM } from '@/lib/youtube/coleta/e11-config'
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
import { AssistidoPeriodos } from '../../_proprio/assistido-periodos'
import { acessoPrivado, lerDadosDoVideo, lerDiarioLongo, longosAcompanhadosDe } from '../../_proprio/dados'
import { lerOrigem } from '../../_proprio/dados-origem'
import { lerTermosESites } from '../../_proprio/dados-termos'
import { buildOrigem } from '../../_proprio/origem-model'
import { Origem } from '../../_proprio/origem'
import { OrigemEsqueleto } from '../../_proprio/origem-esqueleto'
import { dmDia } from '../../_proprio/extras'
import { ateDaOrigem, buildAssistidoDoVideo, type BlocoAssistido, buildVideoBlocos, contagensDeCobertura, janelaDaOrigemDoVideo, nivelDaOrigem, periodosDaOrigemDoVideo } from '../../_proprio/video-blocos-model'
import { AssistidoEsqueleto, VideoBlocos } from '../../_proprio/video-blocos'
import { publicacoesDe } from '@/lib/youtube/observatorio/proprio/dias'
import type { DetalheCanal } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { DiarioCanal, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
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

/**
 * Os três cartões de "% assistido por período" (tela B). Componente de servidor assíncrono dentro de um `Suspense` próprio: lê o diário de 90 dias e o
 * inteiro dos OUTROS vídeos do canal, que são muitas idas ao banco, DEPOIS de o primeiro HTML sair; `lerDadosDoVideo` não as faz. Sem diário no canal,
 * nada é lido. Só entra na página quem tem o token (a página só o monta com o dado privado `ok`).
 */
async function AssistidoDoVideo(p: { barra: BlocoAssistido | null; canalId: string; ytId: string; ytIds: readonly string[]; publicacoes: ReadonlyMap<string, string | null>; diario: DiarioCanal; agora: number; leitura: LeituraPrivadaDoSite | null }) {
  const outros = p.ytIds.filter(y => y !== p.ytId)
  const longo = p.diario.ultimoDia == null ? null : await lerDiarioLongo({ canalId: p.canalId, ytIds: outros, ultimoDia: p.diario.ultimoDia, publicacoes: p.publicacoes, agora: p.agora, leitura: p.leitura })
  return <AssistidoPeriodos view={buildAssistidoDoVideo({ ytId: p.ytId, ytIds: outros, diario: p.diario, longo })} barra={p.barra} />
}

/**
 * "De onde vêm as views" (tela do vídeo). Componente de servidor assíncrono dentro de um `Suspense` próprio: as leituras da origem (dimensões, dois diários e,
 * para quem edita, termos e sites) acontecem DEPOIS de o primeiro HTML sair. Sem prova de leitura nada é lido e o nível é "só o aviso" (nenhum número). O
 * nível, a janela e os períodos vêm de funções puras de `video-blocos-model`. Quem edita nunca lê "só para quem edita": termos em erro, ou negados para quem
 * a página sabe que edita, viram bloco de erro (o nível continua `tudo`) e um aviso ao Sentry.
 */
async function OrigemDoVideo(p: { canalId: string; ytId: string; publicadoEm: string | null; ultimoDia: string | null; agora: number; leitura: LeituraPrivadaDoSite | null; podeEditar: boolean; n: (x: number) => string }) {
  const hojePt = dayPt(new Date(p.agora))
  const ate = ateDaOrigem(p.ultimoDia, hojePt)
  const { de, diarioDesde } = janelaDaOrigemDoVideo({ ate, publicadoEm: p.publicadoEm, ligadoEm: DIMENSOES_LIGADO_EM })
  const publicacoes = new Map<string, string | null>([[p.ytId, p.publicadoEm]])
  const NEGADO = { acesso: 'negado' } as const
  const temLeitura = p.leitura != null
  const [origem, termos]: [Awaited<ReturnType<typeof lerOrigem>>, Privado<DetalheCanal>] = temLeitura
    ? await Promise.all([
      lerOrigem({ canalId: p.canalId, ytIds: [p.ytId], de, ate, diarioDesde, publicacoes, agora: p.agora, prova: p.leitura }),
      lerTermosESites({ canalId: p.canalId, ytIds: [p.ytId], de, ate, agora: p.agora, prova: p.leitura }),
    ])
    : [NEGADO, NEGADO]
  const nivel = nivelDaOrigem({ temLeitura, termos, podeEditar: p.podeEditar })
  if (temLeitura && p.podeEditar && termos.acesso !== 'ok') {
    Sentry.captureMessage('observatório: quem edita não leu os termos da origem do vídeo', { level: 'warning', tags: { component: 'observatorio-proprio', step: 'origem-termos' }, extra: { acesso: termos.acesso } })
  }
  const periodos = periodosDaOrigemDoVideo({ ate, publicadoEm: p.publicadoEm, diario: origem.acesso === 'ok' ? origem.dado.diario : null, diarioInteiro: origem.acesso === 'ok' ? origem.dado.diarioInteiro : null })
  const view = buildOrigem({
    tela: 'video', nivel, origem, termos, periodos, publicadoEm: p.publicadoEm, hojePt, ligadoEm: DIMENSOES_LIGADO_EM, publicacoes, podeEditar: p.podeEditar,
    dm: dmDia, dmy: d => `${dmDia(d)}/${d.slice(0, 4)}`, n: p.n,
  })
  const cobertura = contagensDeCobertura(view, periodos)
  if (cobertura) Sentry.captureMessage('observatório: a origem do vídeo tem vídeos fora, parados ou com a linha de contagem', { level: 'warning', tags: { component: 'observatorio-proprio', step: 'origem-cobertura' }, extra: cobertura })
  return <Origem view={view} />
}

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
    const acesso = await acessoPrivado(siteId)
    const leitura = acesso.leitura
    const dados = await lerDadosDoVideo({ canalId: proprio.id, ytId: base.header.ytId, longosAcompanhados: longosAcompanhadosDe(obs, proprio.id), agora: now, leitura })
    // os blocos nascem aqui, no servidor, já em texto: só a `View` desce ao cliente (quem só lê o site recebe `acesso: 'negado'` e nenhum número privado)
    const blocos = buildVideoBlocos({ obs, videoId: id, dados, hoje: dayPt(new Date(now)), dm: dmDia, hrefVideo: hrefDeOutroVideo(flat, proprio.id) })
    const barra = blocos.acesso === 'ok' ? blocos.assistido : null
    // os cartões de período vão em `Suspense` próprio (o bloco não espera a leitura); sem dado privado lido, não há o que ler
    const periodos = dados.acesso === 'ok' ? (
      <Suspense fallback={<AssistidoEsqueleto barra={barra} />}>
        <AssistidoDoVideo
          barra={barra}
          canalId={proprio.id} ytId={base.header.ytId} ytIds={longosAcompanhadosDe(obs, proprio.id)} publicacoes={publicacoesDe(obs.videos.filter(v => v.ch === proprio.id))}
          diario={dados.dado.diario} agora={now} leitura={leitura}
        />
      </Suspense>
    ) : undefined
    // a origem vai em `Suspense` próprio e entra para QUALQUER leitor do site: sem a prova de leitura ela mostra só o aviso, sem ler nada
    const origem = (
      <Suspense fallback={<OrigemEsqueleto />}>
        <OrigemDoVideo
          canalId={proprio.id} ytId={base.header.ytId} publicadoEm={publicacoesDe(obs.videos.filter(v => v.ytId === base.header.ytId)).get(base.header.ytId) ?? null}
          ultimoDia={dados.acesso === 'ok' ? dados.dado.diario.ultimoDia : null} agora={now} leitura={leitura} podeEditar={acesso.edita} n={obs.fmt.int}
        />
      </Suspense>
    )
    return (
      <TrailChrome crumbs={base.crumbs} owns={ownMenuOf(obs, meuCanalLembrado)} aside={<Pager pager={base.pager} naTrilha />}>
        <ProprioVideoScreen header={base.header} pager={base.pager} fromCanal={base.fromCanal}>
          <VideoBlocos view={blocos} periodos={periodos} origem={origem} />
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
