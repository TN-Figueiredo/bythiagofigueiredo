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
import { EstourouEParou } from '../../_historico/estourou-e-parou'
import { alvoDoHistorico } from '../../_historico/medidas/ler-do-video'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import '../../_historico/historico.css'
import { acessoPrivado } from '../../_proprio/dados'
import { resolverProvas } from '../../_historico/comentarios-de-destaque'
import { AssistidoPeriodos } from '../../_proprio/assistido-periodos'
import { Origem } from '../../_proprio/origem'
import { OrigemEsqueleto } from '../../_proprio/origem-esqueleto'
import type { BlocoAssistido } from '../../_proprio/video-blocos-model'
import { canalProprioDoVideo } from '../../_proprio/video-model'
import { ProprioVideoScreen } from '../../_proprio/video-screen'
import { AssistidoEsqueleto, VideoBlocos } from '../../_proprio/video-blocos'
import { entradaDoProprio, semDadoDoVideo } from '../../_chrome/ab-entradas/modelo'
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
    // entrada do A/B: só quem edita; Short, restrito e falhou decidem dentro do modelo (reporter chega `null`)
    const ab = m.podeEditar ? entradaDoProprio({ podeEditar: true, videoUuid: base.header.id, dur: m.durSeg, abertos: m.abertos, semDado: semDadoDoVideo(blocos) }) : null
    return (
      <TrailChrome crumbs={base.crumbs} owns={ownMenuOf(obs, meuCanalLembrado)} aside={<Pager pager={base.pager} naTrilha />}
        perguntarIa={{ tela: 'video-proprio', id: id, nomeDaTela: TELAS_IA['video-proprio'].nome, exemplos: TELAS_IA['video-proprio'].exemplos, onGerar: gerarPacoteIa }}>
        <ProprioVideoScreen header={base.header} pager={base.pager} fromCanal={base.fromCanal} ab={ab}>
          <VideoBlocos view={blocos} periodos={periodos} origem={origem} linhaTrocas={trocas ? <LinhaDasTrocas view={trocas} /> : undefined} trocas={trocas ? <Trocas view={trocas} /> : undefined} />
        </ProprioVideoScreen>
      </TrailChrome>
    )
  }
  const { view } = m
  // A5 E5a T10a: o bloco "Estourou e parou" só existe para um vídeo acompanhado que achou o seu cartão (nunca "não encontrado" nem fora dos acompanhados).
  // Pronto sem consulta (antes da data em que a leitura existe): vai como elemento. Com leitura a fazer: `'ler'`, e o bloco sai do MESMO conjunto do canal
  // que a tela de medidas lê (uma leitura da base do canal por visita, plano E5a §4.8); o id é cruzado com o conjunto do site antes de qualquer consulta.
  const { doMotor, sincrona } = alvoDoHistorico(view, obs, m.pagina.now)
  const estourou = sincrona === null ? undefined : sincrona !== 'ler' ? <EstourouEParou leitura={sincrona} /> : undefined
  // A5 E5a T21c: um vídeo acompanhado, de canal de concorrente, ganha os blocos de medidas. A reserva do `Suspense` é o PRÓPRIO `HistoricoScreen`
  // (cabeçalho e botões de verdade, três cartões no lugar do resto); o `key` do vídeo faz a reserva voltar a cada troca de vídeo. As cinco ações de
  // servidor e `pagerNaTrilha` chegam ao bloco por prop daqui (servidor para servidor); o bloco não importa ação nenhuma.
  const acoes = { onAskForja: askForjaReading, onCancelForja: cancelForjaReading, onSyncChannel: syncCompetitorNow, onPin: pinVideo, onUnpin: unpinVideo, pagerNaTrilha: true }
  // C3: `acessoPrivado` depois da guarda, uma vez, SEM esperar: a promessa segue ao bloco e a seção espera dentro do `Suspense` dela, para o cabeçalho
  // sair na hora (portão Yannis I-1). As provas seguem de servidor a servidor; a página NÃO chama `provarEdicao` nem decide nível (quem decide é o leitor).
  const provas = doMotor ? resolverProvas(acessoPrivado(m.pagina.siteId)) : undefined
  const tela = doMotor ? (
    <Suspense key={doMotor.id} fallback={<HistoricoScreen view={view} carregando {...acoes} />}>
      <BlocosDoVideo obterSb={getSupabaseServiceClient} siteId={m.pagina.siteId} obs={obs} agoraMs={m.pagina.now} view={view} video={doMotor}
        estourou={sincrona === 'ler' ? 'ler' : estourou} linkSaiu={{ href: obs.link.saiu() }} provas={provas}
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
