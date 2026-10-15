import * as Sentry from '@sentry/nextjs'
import { canAdminSiteUsers } from '@/lib/youtube/competitor-admin'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import { DIMENSOES_LIGADO_EM } from '@/lib/youtube/coleta/e11-config'
import { publicacoesDe } from '@/lib/youtube/observatorio/proprio/dias'
import type { DiarioCanal, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { DetalheCanal } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { EstadoDoPrivado } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { canalTemVideos } from '../_chrome/own-channels'
import { openChannelPage, openObservatoryPage, type ChannelPage } from '../_chrome/page-data'
import { buildMudancasView } from '../_mudancas/view-model'
import { carregarExtrasProprio } from '../_proprio/carregar-extras'
import { lerDadosDoCanal, lerDiarioLongo } from '../_proprio/dados'
import { lerOrigem } from '../_proprio/dados-origem'
import { lerTermosESites } from '../_proprio/dados-termos'
import { buildOrigem, videosDaOrigem, type OrigemView } from '../_proprio/origem-model'
import { contagensDeCobertura, nivelDaOrigem } from '../_proprio/video-blocos-model'
import { montarComoEsta } from '../_proprio/como-esta-model'
import { dmDia } from '../_proprio/extras'
import { concorrentesDoSite, posicaoDoSite } from '../_proprio/posicao-do-site'
import { buildAssistidoDoCanal, buildProprioView, janelaDaOrigemDoCanal, periodosDaOrigemDoCanal, publicacaoMaisAntiga } from '../_proprio/view-model'
import type { AssistidoPeriodosView } from '../_proprio/assistido-periodo-model'
import { buildCanalView } from './view-model'

type Obs = NonNullable<ChannelPage['obs']>
type Dados = Awaited<ReturnType<typeof lerDadosDoCanal>>

/** Os cartões de "% assistido por período" do canal: o diário de 90 dias e o inteiro dos longos são muitas idas ao banco, por isso a página os pede DEPOIS do primeiro HTML. */
export type PropsAssistidoDoCanal = { canalId: string; ytIds: readonly string[]; videos: ReadonlyArray<{ ytId: string; dur: number | null }>; publicacoes: ReadonlyMap<string, string | null>; diario: DiarioCanal; agora: number; leitura: LeituraPrivadaDoSite | null }
export async function assistidoDoCanal(p: PropsAssistidoDoCanal): Promise<AssistidoPeriodosView> {
  const longo = p.diario.ultimoDia == null ? null : await lerDiarioLongo({ canalId: p.canalId, ytIds: p.ytIds, ultimoDia: p.diario.ultimoDia, publicacoes: p.publicacoes, agora: p.agora, leitura: p.leitura })
  return buildAssistidoDoCanal({ ytIds: p.ytIds, videos: p.videos, diario: p.diario, longo })
}

/** A aba Origem do canal próprio (E5b T15/T17): a origem das views de TODOS os vídeos do canal. Sem prova de leitura nada é lido e o nível é "só o aviso". */
export type PropsOrigemDoCanal = { canalId: string; ytIds: readonly string[]; publicacoes: ReadonlyMap<string, string | null>; maisAntiga: string | null; diaFinal: string | null; agora: number; leitura: LeituraPrivadaDoSite | null; podeEditar: boolean; n: (x: number) => string }
export async function origemDoCanal(p: PropsOrigemDoCanal): Promise<OrigemView> {
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
  return view
}

/**
 * O acesso cru de cada leitura do canal próprio e o motivo da negação (Tarefa 8b). `negativa` é a que a MESMA resposta de acesso que decidiu a leitura
 * já trouxe (`openChannelPage`), nunca uma segunda chamada. Negado sem motivo (página que não o expõe) fica nulo: o empacotador lê "não conferido".
 */
export function privadoDoCanalProprio(canalId: string, dados: Dados, negativa: EstadoDoPrivado['negativa']): EstadoDoPrivado {
  return { acessoPorCanal: { [canalId]: { diario: dados.diario.acesso, alcance: dados.alcance.acesso } }, negativa: negativa ?? null }
}

type Flat = Record<string, string | undefined>
type Canal = { id: string; name: string }
export type MontarCanal =
  | { tipo: 'proprio'; pagina: ChannelPage; obs: Obs; proprio: Canal; flat: Flat
      pv: NonNullable<ReturnType<typeof buildProprioView>>; comoEsta: ReturnType<typeof montarComoEsta>
      periodosProps: PropsAssistidoDoCanal | null; origemProps: PropsOrigemDoCanal
      recente: string | null; estado: Flat; privado: EstadoDoPrivado }
  | { tipo: 'proprio_sem_videos'; pagina: ChannelPage; obs: Obs; proprio: Canal; recente: string | null }
  | { tipo: 'concorrente'; pagina: ChannelPage; obs: Obs; view: NonNullable<ReturnType<typeof buildCanalView>>; canAdmin: boolean
      leituraMv: ReturnType<typeof buildMudancasView> | null; recente: string | null; estado: Flat }
  | { tipo: 'nao_encontrado'; pagina: ChannelPage; recente: null }

const recenteDe = (obs: Obs): string | null => (obs.SYNC.last == null ? null : obs.SYNC.title)

/**
 * Do canal aberto ao modelo: a MESMA função monta a tela (a página) e o pacote "Perguntar a uma IA" (E17 degrau 1, Tarefa 8b). `sp` são os
 * parâmetros planos da URL. Canal próprio sem vídeos é resolvido ANTES de qualquer leitura privada. O `siteId` não é parâmetro: vem da guarda.
 * Os cartões de período e a origem voltam como funções, para a página continuar a pedi-los num `Suspense` próprio.
 */
export async function montarCanal(id: string, sp: Flat): Promise<MontarCanal> {
  const pagina = await openChannelPage(id)
  const { obs, siteId, now, leitura: leituraPrivada, ownYtIds, canEdit, owns } = pagina
  if (!obs) return { tipo: 'nao_encontrado', pagina, recente: null }
  // o carregador casa o id sem distinguir maiúsculas; o canal é achado do mesmo jeito, e a partir daqui só vale o id RESOLVIDO dele
  const proprio = obs.channel(id.toLowerCase()) ?? obs.channel(id)
  if (proprio?.own) {
    if (!canalTemVideos(obs, proprio.id)) return { tipo: 'proprio_sem_videos', pagina, obs, proprio, recente: recenteDe(obs) }
    // erro de leitura LANÇA (D5): a error.tsx da rota aparece, nunca um canal sem número
    const dados = await lerDadosDoCanal({ canalId: proprio.id, longosAcompanhados: ownYtIds, agora: now, leitura: leituraPrivada })
    // as posições precisam do conjunto do site: lido só neste ramo, com o diário do próprio canal já lido (sem segunda guarda, sem segunda leitura)
    const site = await openObservatoryPage()
    const extras = await carregarExtrasProprio(site.obs, site.siteId, now, undefined, { leitura: leituraPrivada, canalId: proprio.id, diario: dados.diario })
    const { posicao, concorrenteAcima } = posicaoDoSite(site.obs, proprio.id, extras)
    const hoje = dayPt(new Date(now))
    const pv = buildProprioView(obs, proprio.id, sp, dados, { hoje, dm: dmDia, posicao, concorrenteAcima, muitosProprios: owns.itens.length > 1 })
    if (pv) {
      const doCanal = obs.videos.filter(v => v.ch === proprio.id)
      const publicacoes = publicacoesDe(doCanal)
      const comoEsta = montarComoEsta({
        dados, hoje, dm: dmDia, posicao, posicaoItens: pv.header.posicaoItens, canalId: proprio.id,
        videos: pv.videos.videos.map(v => ({ id: v.id, ytId: v.ytId, title: v.title, thumb: v.thumbSrc })),
        concorrentes: concorrentesDoSite(site.obs, proprio.id),
        publicacoes,
      })
      const duracoes = new Map(doCanal.map(v => [v.ytId, v.dur ?? null]))
      const videosLongos = ownYtIds.map(ytId => ({ ytId, dur: duracoes.get(ytId) ?? null }))
      // os cartões de período e a origem: só as ENTRADAS, a página as lê num `Suspense` próprio e o pacote as espera; sem diário lido, não há o que ler
      const diarioOk = dados.diario.acesso === 'ok' ? dados.diario.dado : null
      const periodosProps = diarioOk ? { canalId: proprio.id, ytIds: ownYtIds, videos: videosLongos, publicacoes, diario: diarioOk, agora: now, leitura: leituraPrivada } : null
      const origemProps = {
        canalId: proprio.id, ytIds: videosDaOrigem(obs, proprio.id), publicacoes, maisAntiga: publicacaoMaisAntiga(obs, proprio.id, ms => dayPt(new Date(ms))), n: obs.fmt.int,
        diaFinal: diarioOk ? diarioOk.ultimoDia : null, agora: now, leitura: leituraPrivada, podeEditar: canEdit,
      }
      return { tipo: 'proprio', pagina, obs, proprio, flat: sp, pv, comoEsta, periodosProps, origemProps, recente: recenteDe(obs), estado: sp, privado: privadoDoCanalProprio(proprio.id, dados, pagina.negativa) }
    }
  }
  const view = buildCanalView(obs, id, sp)
  if (!view) return { tipo: 'nao_encontrado', pagina, recente: null }
  const canAdmin = await canAdminSiteUsers(siteId)
  // Só a aba Leitura lê o conjunto do site (o do canal não tem o que agrega entre canais, como forja.niches); as outras abas não pagam por isso.
  let leituraMv: ReturnType<typeof buildMudancasView> | null = null
  if (view.state.tab === 'leitura' && view.header.niche && view.header.nicheLabel) {
    const site = await openObservatoryPage()
    leituraMv = buildMudancasView(site.obs, { niche: view.header.niche }, new Set())
  }
  return { tipo: 'concorrente', pagina, obs, view, canAdmin, leituraMv, recente: recenteDe(obs), estado: sp }
}
