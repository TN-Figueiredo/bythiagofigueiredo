import type { ReactNode } from 'react'
import { canAdminSiteUsers } from '@/lib/youtube/competitor-admin'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
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
import { lerDadosDoCanal } from '../../_proprio/dados'
import { ComoEsta } from '../../_proprio/como-esta'
import { montarComoEsta } from '../../_proprio/como-esta-model'
import { dmDia } from '../../_proprio/extras'
import { publicacoesDe } from '@/lib/youtube/observatorio/proprio/dias'
import { concorrentesDoSite, posicaoDoSite } from '../../_proprio/posicao-do-site'
import { ProprioScreen, ProprioSemVideos } from '../../_proprio/proprio-screen'
import { buildProprioView } from '../../_proprio/view-model'
import { buildMudancasView } from '../../_mudancas/view-model'
import { ReadingCard } from '../../_mudancas/reading-card'
// As classes do cartão de leitura moram em mudancas.css, presas a [data-obs-screen="mudancas"]; a A2 troca o cartão e promove as classes.
import '../../_mudancas/mudancas.css'

export const metadata = { title: 'Canal · Competidores' }
export const dynamic = 'force-dynamic'
/** As páginas do Observatório ficam em 60 s. */
export const maxDuration = 60

/**
 * A página de um canal (spec 5 e 16): ramifica pelo dono do canal. Concorrente: a página do spec 5. Canal próprio com vídeos: a página própria
 * (cabeçalho com alcance, abas, cartões com impressões). Canal próprio sem vídeos: sem página (16.8), a moldura diz isso. Moldura só com a
 * trilha: sem abas de seção e sem barra de nicho.
 */
export default async function CanalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ObsSearchParams> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { obs, siteId, owns, now, leitura: leituraPrivada, ownYtIds } = await openChannelPage(id)
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
      const { view, grafico, graficoViews } = montarComoEsta({
        dados, hoje, dm: dmDia, posicao, posicaoItens: pv.header.posicaoItens, canalId: proprio.id,
        videos: pv.videos.videos.map(v => ({ id: v.id, ytId: v.ytId, title: v.title, thumb: v.thumbSrc })),
        concorrentes: concorrentesDoSite(site.obs, proprio.id),
        publicacoes: publicacoesDe(obs.videos.filter(v => v.ch === proprio.id)),
      })
      return (
        <TrailChrome crumbs={crumbs} owns={owns} atual={proprio.id}>
          <ProprioScreen view={pv} comoEsta={<ComoEsta key={proprio.id} view={view} grafico={grafico} graficoViews={graficoViews} painel={painelDe(flat.painel)} canalId={proprio.id} />} />
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
