import { Suspense, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'
import { canAdminSiteUsers } from '@/lib/youtube/competitor-admin'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import { DIMENSOES_LIGADO_EM } from '@/lib/youtube/coleta/e11-config'
import { link } from '@/lib/youtube/observatorio/links'
import { canalTemVideos } from '../../_chrome/own-channels'
import { openChannelPage, openObservatoryPage } from '../../_chrome/page-data'
import type { ObsSearchParams } from '../../_chrome/resolve-niche'
import { TrailChrome } from '../../_chrome/trail-chrome'
import { CanalScreen, CanalNotFound } from '../../_canal/canal-screen'
import { LeituraDoNicho } from '../../_canal/leitura'
import { buildCanalView } from '../../_canal/view-model'
import { nicheOptions } from '../../_canais/view-model'
import { removeCompetitorChannel, syncCompetitorNow, pinVideo, unpinVideo, getCompetitorRemovalImpactAction } from '../../actions'
import { setChannelNiche } from '../../niche-actions'
import { carregarExtrasProprio } from '../../_proprio/carregar-extras'
import { lerDadosDoCanal, lerDiarioLongo } from '../../_proprio/dados'
import { lerOrigem } from '../../_proprio/dados-origem'
import { lerTermosESites } from '../../_proprio/dados-termos'
import { AssistidoPeriodos } from '../../_proprio/assistido-periodos'
import { AssistidoEsqueleto } from '../../_proprio/video-blocos'
import { buildOrigem, videosDaOrigem } from '../../_proprio/origem-model'
import { Origem } from '../../_proprio/origem'
import { OrigemEsqueleto } from '../../_proprio/origem-esqueleto'
import { contagensDeCobertura, nivelDaOrigem } from '../../_proprio/video-blocos-model'
import { ComoEsta } from '../../_proprio/como-esta'
import { montarComoEsta } from '../../_proprio/como-esta-model'
import { dmDia } from '../../_proprio/extras'
import { publicacoesDe } from '@/lib/youtube/observatorio/proprio/dias'
import type { DiarioCanal, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { DetalheCanal } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { concorrentesDoSite, posicaoDoSite } from '../../_proprio/posicao-do-site'
import { ProprioScreen, ProprioSemVideos } from '../../_proprio/proprio-screen'
import { buildAssistidoDoCanal, buildProprioView, janelaDaOrigemDoCanal, periodosDaOrigemDoCanal, publicacaoMaisAntiga } from '../../_proprio/view-model'
import { buildMudancasView } from '../../_mudancas/view-model'
import { ReadingCard } from '../../_mudancas/reading-card'
// As classes do cartão de leitura moram em mudancas.css, presas a [data-obs-screen="mudancas"]; a A2 troca o cartão e promove as classes.
import '../../_mudancas/mudancas.css'

export const metadata = { title: 'Canal · Competidores' }
export const dynamic = 'force-dynamic'
/** As páginas do Observatório ficam em 60 s. */
export const maxDuration = 60

/**
 * Os três cartões de "% assistido por período" da aba Retenção. Componente de servidor assíncrono dentro de um `Suspense` próprio: o diário de 90 dias e o
 * inteiro dos longos acompanhados são muitas idas ao banco e acontecem DEPOIS do primeiro HTML. Sem diário no canal nada é lido.
 */
async function AssistidoDoCanal(p: { canalId: string; ytIds: readonly string[]; videos: ReadonlyArray<{ ytId: string; dur: number | null }>; publicacoes: ReadonlyMap<string, string | null>; diario: DiarioCanal; agora: number; leitura: LeituraPrivadaDoSite | null }) {
  const longo = p.diario.ultimoDia == null ? null : await lerDiarioLongo({ canalId: p.canalId, ytIds: p.ytIds, ultimoDia: p.diario.ultimoDia, publicacoes: p.publicacoes, agora: p.agora, leitura: p.leitura })
  return <AssistidoPeriodos view={buildAssistidoDoCanal({ ytIds: p.ytIds, videos: p.videos, diario: p.diario, longo })} />
}

/**
 * A aba Origem: a origem das views de TODOS os vídeos do canal (Shorts e não acompanhados inclusive), em 7, 28, 90 dias e "Desde {ano}". Lida em toda abertura do
 * canal próprio, num `Suspense` próprio, e entregue à tela como nó pronto. Sem prova de leitura nada é lido e o nível é "só o aviso". Os totais vêm do diário
 * dos mesmos vídeos (`totalDoPeriodo`), nunca do contador público. Quem edita nunca lê "só para quem edita": termos em erro ou negados viram bloco de erro.
 */
async function OrigemDoCanal(p: { canalId: string; ytIds: readonly string[]; publicacoes: ReadonlyMap<string, string | null>; maisAntiga: string | null; diaFinal: string | null; agora: number; leitura: LeituraPrivadaDoSite | null; podeEditar: boolean; n: (x: number) => string }) {
  const hojePt = dayPt(new Date(p.agora))
  const ate = p.diaFinal ?? addDays(hojePt, -3)
  const { ytIds, publicacoes, maisAntiga } = p
  const { de, diarioDesde } = janelaDaOrigemDoCanal({ ate, maisAntiga, ligadoEm: DIMENSOES_LIGADO_EM })
  const NEGADO = { acesso: 'negado' } as const
  const temLeitura = p.leitura != null
  const [origem, termos]: [Awaited<ReturnType<typeof lerOrigem>>, Privado<DetalheCanal>] = temLeitura
    ? await Promise.all([
      lerOrigem({ canalId: p.canalId, ytIds, de, ate, diarioDesde, publicacoes, agora: p.agora, prova: p.leitura }),
      lerTermosESites({ canalId: p.canalId, ytIds, de, ate, agora: p.agora, prova: p.leitura }),
    ])
    : [NEGADO, NEGADO]
  const nivel = nivelDaOrigem({ temLeitura, termos, podeEditar: p.podeEditar })
  if (temLeitura && p.podeEditar && termos.acesso !== 'ok') {
    Sentry.captureMessage('observatório: quem edita não leu os termos da origem do canal', { level: 'warning', tags: { component: 'observatorio-proprio', step: 'origem-termos' }, extra: { acesso: termos.acesso } })
  }
  const periodos = periodosDaOrigemDoCanal({ ate, maisAntiga, diario: origem.acesso === 'ok' ? origem.dado.diario : null, diarioInteiro: origem.acesso === 'ok' ? origem.dado.diarioInteiro : null })
  const view = buildOrigem({
    tela: 'canal', nivel, origem, termos, periodos, publicadoEm: null, hojePt, ligadoEm: DIMENSOES_LIGADO_EM, publicacoes, podeEditar: p.podeEditar,
    dm: dmDia, dmy: d => `${dmDia(d)}/${d.slice(0, 4)}`, n: p.n,
  })
  const cobertura = contagensDeCobertura(view, periodos)
  if (cobertura) Sentry.captureMessage('observatório: a origem do canal tem vídeos fora, parados ou com a linha de contagem', { level: 'warning', tags: { component: 'observatorio-proprio', step: 'origem-cobertura' }, extra: cobertura })
  return <Origem view={view} />
}


/**
 * A página de um canal (spec 5 e 16): ramifica pelo dono do canal. Concorrente: a página do spec 5. Canal próprio com vídeos: a página própria
 * (cabeçalho com alcance, abas, cartões com impressões). Canal próprio sem vídeos: sem página (16.8), a moldura diz isso. Moldura só com a
 * trilha: sem abas de seção e sem barra de nicho.
 */
export default async function CanalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ObsSearchParams> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { obs, siteId, owns, now, leitura: leituraPrivada, ownYtIds, canEdit } = await openChannelPage(id)
  // o carregador casa o id sem distinguir maiúsculas; o canal é achado do mesmo jeito, e a partir daqui só vale o id RESOLVIDO dele
  const proprio = obs ? (obs.channel(id.toLowerCase()) ?? obs.channel(id)) : undefined
  if (obs && proprio?.own) {
    const crumbs = [{ text: 'Canais', href: link.canais() }, { text: proprio.name }]
    // canal próprio sem vídeos é resolvido ANTES de qualquer leitura privada: nenhuma tabela de alcance é consultada para ele
    if (!canalTemVideos(obs, proprio.id)) {
      return (
        <TrailChrome crumbs={crumbs} owns={owns} atual={proprio.id}>
          <ProprioSemVideos nome={proprio.name} canaisHref={link.canais()} />
        </TrailChrome>
      )
    }
    // erro de leitura LANÇA (D5): a error.tsx da rota aparece, nunca um canal sem número
    const dados = await lerDadosDoCanal({ canalId: proprio.id, longosAcompanhados: ownYtIds, agora: now, leitura: leituraPrivada })
    // as posições precisam do conjunto do site: lido só neste ramo, com o diário do próprio canal já lido (sem segunda guarda, sem segunda leitura)
    const site = await openObservatoryPage()
    const extras = await carregarExtrasProprio(site.obs, site.siteId, now, undefined, { leitura: leituraPrivada, canalId: proprio.id, diario: dados.diario })
    const { posicao, concorrenteAcima } = posicaoDoSite(site.obs, proprio.id, extras)
    const hoje = dayPt(new Date(now))
    const pv = buildProprioView(obs, proprio.id, flat, dados, { hoje, dm: dmDia, posicao, concorrenteAcima, muitosProprios: owns.itens.length > 1 })
    if (pv) {
      // "Como o canal está" (16.5): o MESMO dado que o cabeçalho leu; a posição é a linha do cabeçalho (uma fonte só); os concorrentes do formulário vêm do conjunto do site
      const doCanal = obs.videos.filter(v => v.ch === proprio.id)
      const publicacoes = publicacoesDe(doCanal)
      const { view, grafico, graficoViews } = montarComoEsta({
        dados, hoje, dm: dmDia, posicao, posicaoItens: pv.header.posicaoItens, canalId: proprio.id,
        videos: pv.videos.videos.map(v => ({ id: v.id, ytId: v.ytId, title: v.title, thumb: v.thumbSrc })),
        concorrentes: concorrentesDoSite(site.obs, proprio.id),
        publicacoes,
      })
      // as duas chaves existem porque o React 19 em dev avisa de chave ausente em elemento vindo do servidor (Gio F1)
      // os cartões de período da aba Retenção e a aba Origem vão cada um num `Suspense` próprio (o primeiro HTML não espera a leitura); sem dado privado lido, não há o que ler
      const duracoes = new Map(doCanal.map(v => [v.ytId, v.dur ?? null]))
      const videosLongos = ownYtIds.map(ytId => ({ ytId, dur: duracoes.get(ytId) ?? null }))
      const periodos = dados.diario.acesso === 'ok' ? (
        <Suspense key="assistido-periodos" fallback={<AssistidoEsqueleto />}>
          <AssistidoDoCanal canalId={proprio.id} ytIds={ownYtIds} videos={videosLongos} publicacoes={publicacoes} diario={dados.diario.dado} agora={now} leitura={leituraPrivada} />
        </Suspense>
      ) : undefined
      const origem = (
        <Suspense key="origem-do-canal" fallback={<OrigemEsqueleto />}>
          <OrigemDoCanal canalId={proprio.id} ytIds={videosDaOrigem(obs, proprio.id)} publicacoes={publicacoes} maisAntiga={publicacaoMaisAntiga(obs, proprio.id, ms => dayPt(new Date(ms)))} n={obs.fmt.int} diaFinal={dados.diario.acesso === 'ok' ? dados.diario.dado.ultimoDia : null} agora={now} leitura={leituraPrivada} podeEditar={canEdit} />
        </Suspense>
      )
      return (
        <TrailChrome crumbs={crumbs} owns={owns} atual={proprio.id}>
          <ProprioScreen view={pv} periodos={periodos} origem={origem} comoEsta={<ComoEsta key={proprio.id} view={view} grafico={grafico} graficoViews={graficoViews} painel={painelDe(flat.painel)} canalId={proprio.id} />} />
        </TrailChrome>
      )
    }
  }
  const view = obs ? buildCanalView(obs, id, flat) : null
  if (!obs || !view) {
    return (
      <TrailChrome crumbs={[{ text: 'Canais', href: link.canais() }, { text: 'Canal não encontrado' }]} owns={owns}>
        <CanalNotFound canaisHref={link.canais()} />
      </TrailChrome>
    )
  }
  const canAdmin = await canAdminSiteUsers(siteId)
  // Só a aba Leitura lê o conjunto do site (o do canal não tem o que agrega entre canais, como forja.niches); as outras abas não pagam por isso.
  const leitura = view.state.tab === 'leitura' ? await leituraDoNicho(view.header.niche, view.header.nicheLabel) : null
  return (
    <TrailChrome crumbs={[{ text: view.origemText, href: view.canaisHref }, { text: view.header.name }]} owns={owns}>
      <CanalScreen view={view} niches={nicheOptions(obs)} canAdmin={canAdmin} leitura={leitura} compararHref={owns.principal ? link.comparar(owns.principal.id, id) : null}
        actions={{ onSyncOne: syncCompetitorNow, onRemove: removeCompetitorChannel, onRemovalImpact: getCompetitorRemovalImpactAction, onSetNiche: setChannelNiche, onPin: pinVideo, onUnpin: unpinVideo }} />
    </TrailChrome>
  )
}

/** `?painel=1` abre e `?painel=0` fecha "Como o canal está"; qualquer outro valor (ou nenhum) deixa valer o que a pessoa deixou. */
function painelDe(v: string | undefined): '1' | '0' | null {
  return v === '1' ? '1' : v === '0' ? '0' : null
}

/**
 * A leitura do nicho do canal, com os filtros padrão de Mudanças e sem `onAsk`: o pedido do nicho continua em Mudanças. Sem nicho não há leitura
 * a mostrar nem conjunto a ler (o motor já anula o nicho que o site não conhece).
 */
async function leituraDoNicho(niche: string | null, nicheLabel: string | null): Promise<ReactNode> {
  if (!niche || !nicheLabel) return <LeituraDoNicho key="leitura-do-nicho" nicheLabel={null}>{null}</LeituraDoNicho>
  const site = await openObservatoryPage()
  const mv = buildMudancasView(site.obs, { niche }, new Set())
  return (
    <LeituraDoNicho key={niche} nicheLabel={nicheLabel}>
      <div data-obs-screen="mudancas"><section className="forja"><ReadingCard view={mv} /></section></div>
    </LeituraDoNicho>
  )
}
