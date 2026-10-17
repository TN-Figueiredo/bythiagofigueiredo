import { Suspense, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { carregarMedidasDoCanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import { contaComoTroca } from '@/lib/youtube/observatorio/changes'
import type { ProvasDeQuemVe } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import { link } from '@/lib/youtube/observatorio/links'
import type { ObsSearchParams } from '../../_chrome/resolve-niche'
import { TrailChrome } from '../../_chrome/trail-chrome'
import { gerarPacoteIa } from '../../contexto-ia-actions'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import { CanalScreen, CanalNotFound } from '../../_canal/canal-screen'
import { LeituraDoNicho } from '../../_canal/leitura'
import { BlocosDoCanal, CelulasDoCanal, TopoDoCanal, type ContextoDoCanal } from '../../_canal/medidas/blocos-do-canal'
import { canalNaoCarregou } from '../../_canal/medidas/canal-derivado-async'
import { EsqueletoDasCelulas, EsqueletoDosBlocos, EsqueletoDoTopo } from '../../_canal/medidas/esqueleto'
import { assistidoDoCanal, montarCanal, origemDoCanal, type PropsAssistidoDoCanal, type PropsOrigemDoCanal } from '../../_canal/montar'
import { nicheOptions } from '../../_canais/view-model'
import { removeCompetitorChannel, syncCompetitorNow, pinVideo, unpinVideo, getCompetitorRemovalImpactAction } from '../../actions'
import { setChannelNiche } from '../../niche-actions'
import { AssistidoPeriodos } from '../../_proprio/assistido-periodos'
import { AssistidoEsqueleto } from '../../_proprio/video-blocos'
import { Origem } from '../../_proprio/origem'
import { OrigemEsqueleto } from '../../_proprio/origem-esqueleto'
import { ComoEsta } from '../../_proprio/como-esta'
import { ProprioScreen, ProprioSemVideos } from '../../_proprio/proprio-screen'
import { ReadingCard } from '../../_mudancas/reading-card'
// As classes do cartão de leitura moram em mudancas.css, presas a [data-obs-screen="mudancas"]; a A2 troca o cartão e promove as classes.
import '../../_mudancas/mudancas.css'

export const metadata = { title: 'Canal · Competidores' }
export const dynamic = 'force-dynamic'
/** As páginas do Observatório ficam em 60 s. */
export const maxDuration = 60

/** Os três cartões de "% assistido por período" da aba Retenção: componente de servidor assíncrono dentro de um `Suspense` próprio (o diário é lido DEPOIS do primeiro HTML). */
async function AssistidoDoCanal(p: PropsAssistidoDoCanal) {
  return <AssistidoPeriodos view={await assistidoDoCanal(p)} />
}

/** A aba Origem do canal próprio, num `Suspense` próprio e entregue à tela como nó pronto. */
async function OrigemDoCanal(p: PropsOrigemDoCanal) {
  return <Origem view={await origemDoCanal(p)} />
}

/**
 * A página de um canal (spec 5 e 16): ramifica pelo dono do canal. Concorrente: a página do spec 5. Canal próprio com vídeos: a página própria
 * (cabeçalho com alcance, abas, cartões com impressões). Canal próprio sem vídeos: sem página (16.8), a moldura diz isso. Moldura só com a
 * trilha: sem abas de seção e sem barra de nicho. O modelo vem de `montarCanal`, a mesma função que monta o pacote "Perguntar a uma IA".
 */
export default async function CanalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ObsSearchParams> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const m = await montarCanal(id, flat, {
    // a leitura das medidas nasce depois de `view` existir e antes de `canAdminSiteUsers` (dentro de `montarCanal`): corre em paralelo com ele e com a leitura do nicho
    iniciarMedidas: async ({ pagina, obs, view }) => {
      // `async`: o corpo roda até o primeiro `await` na hora da chamada (a promessa nasce aqui, antes de `canAdminSiteUsers`) e nada lança para fora dela
      try {
        return await carregarMedidasDoCanalInteiro(getSupabaseServiceClient(), {
          siteId: pagina.siteId, obs, channelId: view.header.id, agoraMs: pagina.now, pedir: { serie: true, mudancas: true, horas: true },
        })
      } catch (err) {
        Sentry.captureException(err, { tags: { component: 'observatorio-canal', step: 'medidas' } })
        return canalNaoCarregou()
      }
    },
  })
  const { owns } = m.pagina
  if (m.tipo === 'proprio_sem_videos') {
    return (
      <TrailChrome crumbs={[{ text: 'Canais', href: link.canais() }, { text: m.proprio.name }]} owns={owns} atual={m.proprio.id}>
        <ProprioSemVideos nome={m.proprio.name} canaisHref={link.canais()} />
      </TrailChrome>
    )
  }
  if (m.tipo === 'proprio') {
    const { proprio, pv, comoEsta: { view, grafico, graficoViews } } = m
    // as duas chaves existem porque o React 19 em dev avisa de chave ausente em elemento vindo do servidor (Gio F1)
    const periodos = m.periodosProps ? (
      <Suspense key="assistido-periodos" fallback={<AssistidoEsqueleto />}>
        <AssistidoDoCanal {...m.periodosProps} />
      </Suspense>
    ) : undefined
    const origem = (
      <Suspense key="origem-do-canal" fallback={<OrigemEsqueleto />}>
        <OrigemDoCanal {...m.origemProps} />
      </Suspense>
    )
    return (
      <TrailChrome crumbs={[{ text: 'Canais', href: link.canais() }, { text: proprio.name }]} owns={owns} atual={proprio.id}
        perguntarIa={{ tela: 'canal-proprio', id: id, nomeDaTela: TELAS_IA['canal-proprio'].nome, exemplos: TELAS_IA['canal-proprio'].exemplos, onGerar: gerarPacoteIa }}>
        <ProprioScreen view={pv} periodos={periodos} origem={origem} comoEsta={<ComoEsta key={proprio.id} view={view} grafico={grafico} graficoViews={graficoViews} painel={painelDe(m.flat.painel)} canalId={proprio.id} />} />
      </TrailChrome>
    )
  }
  if (m.tipo === 'nao_encontrado') {
    return (
      <TrailChrome crumbs={[{ text: 'Canais', href: link.canais() }, { text: 'Canal não encontrado' }]} owns={owns}>
        <CanalNotFound canaisHref={link.canais()} />
      </TrailChrome>
    )
  }
  const { view, obs, canAdmin, medidas } = m
  const leitura = view.state.tab === 'leitura' ? leituraDoNicho(view.header.niche, view.header.nicheLabel, m.leituraMv) : null
  // as medidas chegam depois do primeiro HTML: três elementos de servidor, cada um no seu Suspense, com a MESMA promessa
  const contexto = contextoDoCanal(obs, view, m.pagina.now, { siteId: m.pagina.siteId, provas: { leitura: m.pagina.leitura, edicao: null }, permissaoFalhou: m.pagina.negativa === 'nao_foi_possivel_conferir' })
  const promessa = medidas ?? Promise.resolve(canalNaoCarregou())
  const topo = <Suspense key="topo-do-canal" fallback={<EsqueletoDoTopo />}><TopoDoCanal medidas={promessa} contexto={contexto} /></Suspense>
  const celulas = <Suspense key="celulas-do-canal" fallback={<EsqueletoDasCelulas />}><CelulasDoCanal medidas={promessa} contexto={contexto} /></Suspense>
  const blocos = <Suspense key="blocos-do-canal" fallback={<EsqueletoDosBlocos />}><BlocosDoCanal medidas={promessa} contexto={contexto} /></Suspense>
  return (
    <TrailChrome crumbs={[{ text: view.origemText, href: view.canaisHref }, { text: view.header.name }]} owns={owns}
      perguntarIa={{ tela: 'canal', id: id, nomeDaTela: TELAS_IA['canal'].nome, exemplos: TELAS_IA['canal'].exemplos, onGerar: gerarPacoteIa }}>
      <CanalScreen view={view} niches={nicheOptions(obs)} canAdmin={canAdmin} leitura={leitura} compararHref={owns.principal ? link.comparar(owns.principal.id, id) : null}
        topo={topo} celulas={celulas} blocos={blocos}
        actions={{ onSyncOne: syncCompetitorNow, onRemove: removeCompetitorChannel, onRemovalImpact: getCompetitorRemovalImpactAction, onSetNiche: setChannelNiche, onPin: pinVideo, onUnpin: unpinVideo }} />
    </TrailChrome>
  )
}

/** `?painel=1` abre e `?painel=0` fecha "Como o canal está"; qualquer outro valor (ou nenhum) deixa valer o que a pessoa deixou. */
function painelDe(v: string | undefined): '1' | '0' | null {
  return v === '1' ? '1' : v === '0' ? '0' : null
}

/** A leitura do nicho do canal, com os filtros padrão de Mudanças e sem `onAsk`. Sem nicho não há leitura a mostrar. */
function leituraDoNicho(niche: string | null, nicheLabel: string | null, mv: Parameters<typeof ReadingCard>[0]['view'] | null): ReactNode {
  if (!nicheLabel || !mv) return <LeituraDoNicho key="leitura-do-nicho" nicheLabel={null}>{null}</LeituraDoNicho>
  return (
    <LeituraDoNicho key={niche ?? 'todos'} nicheLabel={nicheLabel}>
      <div data-obs-screen="mudancas"><section className="forja"><ReadingCard view={mv} /></section></div>
    </LeituraDoNicho>
  )
}

/** O que a página já sabe, sem esperar medida: os títulos dos vídeos, as trocas do motor (90 dias), a sincronização e os inscritos. */
function contextoDoCanal(obs: NonNullable<Extract<Awaited<ReturnType<typeof montarCanal>>, { tipo: 'concorrente' }>['obs']>, view: Extract<Awaited<ReturnType<typeof montarCanal>>, { tipo: 'concorrente' }>['view'], agoraMs: number, quem: { siteId: string; provas: ProvasDeQuemVe; permissaoFalhou: boolean }): ContextoDoCanal {
  const ch = obs.channel(view.header.id)
  return {
    comentarios: { siteId: quem.siteId, channelId: view.header.id, nome: view.header.name, provas: quem.provas, permissaoFalhou: quem.permissaoFalhou },
    F: obs.fmt, subs: ch?.subs ?? null,
    sync: { state: ch?.sync.state ?? 'ok', last: ch?.sync.last ?? null, errorSince: ch?.sync.errorSince ?? null },
    hojeSP: dayPt(new Date(agoraMs)), agoraMs, primeiraBusca: ch?.sync.state === 'backfill', semVideos: view.videos.videos.length === 0,
    titulos: view.videos.videos.map(v => [v.id, v.title] as const),
    trocas: obs.changesIn({ days: 90, channel: view.header.id }).filter(contaComoTroca).map(c => ({ videoId: c.video, campo: c.type === 'title' ? 'titulo' as const : 'miniatura' as const, emMs: c.at })),
  }
}
