import { cache, Suspense } from 'react'
import { TrailChrome } from '../../_chrome/trail-chrome'
import { gerarPacoteIa } from '../../contexto-ia-actions'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import type { ObsSearchParams } from '../../_chrome/resolve-niche'
import { openObservatoryPage } from '../../_chrome/page-data'
import { ownMenuOf } from '../../_chrome/own-menu'
import { historicoTrail } from '../../_historico/view-model'
import { HistoricoScreen } from '../../_historico/historico-screen'
import { BlocosDoVideo } from '../../_historico/medidas/blocos-do-video'
import { assistidoDoVideo, montarVideo, origemDoVideo, type PropsAssistidoDoVideo, type PropsOrigemDoVideo } from '../../_historico/montar'
import { Pager } from '../../_historico/pager'
import { EstourouCarregando, EstourouEParou } from '../../_historico/estourou-e-parou'
import { leituraSemConsulta, lerLeituraDoVideo, type IObservatorioDaLeitura } from '../../_chrome/medidas/estourou-leitura'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import '../../_historico/historico.css'
import { acessoPrivado } from '../../_proprio/dados'
import type { ProvasDeQuemVe } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'
import { AssistidoPeriodos } from '../../_proprio/assistido-periodos'
import { Origem } from '../../_proprio/origem'
import { OrigemEsqueleto } from '../../_proprio/origem-esqueleto'
import type { BlocoAssistido } from '../../_proprio/video-blocos-model'
import { canalProprioDoVideo } from '../../_proprio/video-model'
import { ProprioVideoScreen } from '../../_proprio/video-screen'
import { AssistidoEsqueleto, VideoBlocos } from '../../_proprio/video-blocos'
import { LinhaDasTrocas, Trocas } from '../../_proprio/trocas'
import * as Sentry from '@sentry/nextjs'
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

/** Os cartões de período (tela B): componente de servidor assíncrono dentro de um `Suspense` próprio (o diário é lido DEPOIS do primeiro HTML). */
async function AssistidoDoVideo(p: PropsAssistidoDoVideo & { barra: BlocoAssistido | null }) {
  const { barra, ...entrada } = p
  return <AssistidoPeriodos view={await assistidoDoVideo(entrada)} barra={barra} />
}

/** A5 E5a T10a: o bloco "Estourou e parou", num `Suspense` próprio; a leitura do servidor nunca lança e devolve nulo para o vídeo que não é do site. */
async function EstourouDoVideo(p: { siteId: string; obs: IObservatorioDaLeitura; videoId: string; now: number }) {
  const leitura = await lerLeituraDoVideo({ sb: getSupabaseServiceClient(), ...p })
  return leitura ? <EstourouEParou leitura={leitura} /> : null
}

/** "De onde vêm as views" (tela do vídeo), num `Suspense` próprio. */
async function OrigemDoVideo(p: PropsOrigemDoVideo) {
  return <Origem view={await origemDoVideo(p)} />
}

export default async function HistoricoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ObsSearchParams> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  // O dono do canal do vídeo decide a tela (spec 17); a decisão é do servidor, a partir do canal resolvido do vídeo.
  const m = await montarVideo(id, flat, abrirPagina, { trocas: true })
  const { obs, meuCanalLembrado } = m.pagina
  if (m.tipo === 'proprio') {
    const { base, blocos, barra, trocas } = m
    // diagnóstico das trocas: UM evento só com contagens e o ytId (nunca título, imagem nem data); `diagnostico` não segue para nenhum componente
    if (trocas) {
      const d = trocas.diagnostico
      // só o caso sem causa conhecida: fim não registrado e origem cms são estados conhecidos e repetiriam o aviso a cada visita (portão L5, Phil M-1)
      if (d.foraDaJanelaSemCausa + d.estadoInesperado > 0) {
        Sentry.captureMessage('observatório: trocas do vídeo com caso sem causa conhecida', { level: 'warning', tags: { component: 'observatorio-proprio', step: 'trocas-modelo' }, extra: { ...d, ytId: base.header.ytId } })
      }
    }
    // os cartões de período vão em `Suspense` próprio (o bloco não espera a leitura); sem dado privado lido, não há o que ler
    const periodos = m.periodosProps ? (
      <Suspense fallback={<AssistidoEsqueleto barra={barra} />}>
        <AssistidoDoVideo barra={barra} {...m.periodosProps} />
      </Suspense>
    ) : undefined
    // a origem entra para QUALQUER leitor do site: sem a prova de leitura ela mostra só o aviso, sem ler nada
    const origem = (
      <Suspense fallback={<OrigemEsqueleto />}>
        <OrigemDoVideo {...m.origemProps} />
      </Suspense>
    )
    return (
      <TrailChrome crumbs={base.crumbs} owns={ownMenuOf(obs, meuCanalLembrado)} aside={<Pager pager={base.pager} naTrilha />}
        perguntarIa={{ tela: 'video-proprio', id: id, nomeDaTela: TELAS_IA['video-proprio'].nome, exemplos: TELAS_IA['video-proprio'].exemplos, onGerar: gerarPacoteIa }}>
        <ProprioVideoScreen header={base.header} pager={base.pager} fromCanal={base.fromCanal}>
          <VideoBlocos view={blocos} periodos={periodos} origem={origem} linhaTrocas={trocas ? <LinhaDasTrocas view={trocas} /> : undefined} trocas={trocas ? <Trocas view={trocas} /> : undefined} />
        </ProprioVideoScreen>
      </TrailChrome>
    )
  }
  const { view } = m
  // A5 E5a T10a: o bloco "Estourou e parou" só existe para um vídeo acompanhado que achou o seu cartão (nunca "não encontrado" nem fora dos acompanhados);
  // vai num Suspense próprio, para o resto do Histórico não esperar a leitura. O id é cruzado com o conjunto do site dentro do bloco, antes de qualquer consulta.
  const sincrona = !view.notFound && !view.untracked && view.video ? leituraSemConsulta(obs, view.video.id, m.pagina.now) : null
  const estourou = sincrona === null ? undefined : sincrona !== 'ler' ? <EstourouEParou leitura={sincrona} /> : (
    <Suspense key={view.video!.id} fallback={<EstourouCarregando />}>
      <EstourouDoVideo siteId={m.pagina.siteId} obs={obs} videoId={view.video!.id} now={m.pagina.now} />
    </Suspense>
  )
  // A5 E5a T21c: um vídeo acompanhado, de canal de concorrente, ganha os blocos de medidas. A reserva do `Suspense` é o PRÓPRIO `HistoricoScreen`
  // (cabeçalho e botões de verdade, três cartões no lugar do resto); o `key` do vídeo faz a reserva voltar a cada troca de vídeo. As cinco ações de
  // servidor e `pagerNaTrilha` chegam ao bloco por prop daqui (servidor para servidor); o bloco não importa ação nenhuma.
  const doMotor = !view.notFound && !view.untracked && view.video ? obs.videos.find((x) => x.id === view.video!.id) : undefined
  const acoes = { onAskForja: askForjaReading, onCancelForja: cancelForjaReading, onSyncChannel: syncCompetitorNow, onPin: pinVideo, onUnpin: unpinVideo, pagerNaTrilha: true }
  // C3: `acessoPrivado` depois da guarda, uma vez; que lance (não deveria) é nível contagem com a faixa de permissão, nunca texto. As provas
  // seguem de servidor a servidor ao bloco; a página NÃO chama `provarEdicao` (a varredura do token) nem decide nível (quem decide é o leitor).
  let provas: ProvasDeQuemVe | null = null
  let permissaoFalhou = false
  if (doMotor) {
    try {
      const acesso = await acessoPrivado(m.pagina.siteId)
      // `edicao` é o campo do pedido P11 (passo 0 da E17); sem ele, no máximo texto
      const edicao = (acesso as typeof acesso & { edicao?: EdicaoDoSite | null }).edicao ?? null
      provas = { leitura: acesso.leitura, edicao }
      permissaoFalhou = acesso.negativa === 'nao_foi_possivel_conferir'
    } catch {
      permissaoFalhou = true
    }
  }
  const tela = doMotor ? (
    <Suspense key={doMotor.id} fallback={<HistoricoScreen view={view} carregando {...acoes} />}>
      <BlocosDoVideo obterSb={getSupabaseServiceClient} siteId={m.pagina.siteId} obs={obs} agoraMs={m.pagina.now} view={view} video={doMotor}
        estourou={estourou} linkSaiu={{ href: obs.link.saiu() }} provas={provas} permissaoFalhou={permissaoFalhou}
        canaisDoSite={new Map(obs.channels.map((x) => [x.id, { nome: x.name }]))} {...acoes} />
    </Suspense>
  ) : (
    <HistoricoScreen view={view} {...acoes} estourou={estourou} />
  )
  // The frame is only the trail (spec A2.6, emenda 25): no section tabs, no niche bar, in every origin. The trail is the way back for whoever
  // came from Mudanças, Outliers, Insights or a channel page. A video of another niche shows it only beside the channel, in the header.
  return (
    <TrailChrome crumbs={historicoTrail(view.crumbs)} owns={ownMenuOf(obs, meuCanalLembrado)} aside={view.pager ? <Pager pager={view.pager} naTrilha /> : undefined}
      perguntarIa={view.notFound ? undefined : { tela: 'video', id, nomeDaTela: TELAS_IA['video'].nome, exemplos: TELAS_IA['video'].exemplos, onGerar: gerarPacoteIa }}>
      {tela}
    </TrailChrome>
  )
}
