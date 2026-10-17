import * as Sentry from '@sentry/nextjs'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import { DIMENSOES_LIGADO_EM } from '@/lib/youtube/coleta/e11-config'
import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { publicacoesDe } from '@/lib/youtube/observatorio/proprio/dias'
import type { DetalheCanal } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { DiarioCanal, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { EstadoDoPrivado } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { openObservatoryPage, type ObservatoryPage } from '../_chrome/page-data'
import { loadSwipeRows, savedFromRows } from '../_mudancas/swipe-rows'
import { acessoPrivado, lerDadosDoVideo, lerDiarioLongo, longosAcompanhadosDe } from '../_proprio/dados'
import { lerOrigem } from '../_proprio/dados-origem'
import { lerTermosESites } from '../_proprio/dados-termos'
import { buildOrigem, type OrigemView } from '../_proprio/origem-model'
import { dmDia } from '../_proprio/extras'
import { ateDaOrigem, buildAssistidoDoVideo, buildVideoBlocos, contagensDeCobertura, janelaDaOrigemDoVideo, nivelDaOrigem, periodosDaOrigemDoVideo, type BlocoAssistido } from '../_proprio/video-blocos-model'
import type { AssistidoPeriodosView } from '../_proprio/assistido-periodo-model'
import { buildProprioVideoBase, canalProprioDoVideo, hrefDeOutroVideo } from '../_proprio/video-model'
import { lerTrocas } from '../_proprio/dados-trocas'
import { buildTrocas, trocasNoGrafico, type TrocasView } from '../_proprio/trocas-model'
import { buildHistoricoView } from './view-model'

/** Os três cartões de "% assistido por período" (tela B): lê o diário de 90 dias e o inteiro dos OUTROS vídeos do canal, DEPOIS do primeiro HTML. */
export type PropsAssistidoDoVideo = { canalId: string; ytId: string; ytIds: readonly string[]; publicacoes: ReadonlyMap<string, string | null>; diario: DiarioCanal; agora: number; leitura: LeituraPrivadaDoSite | null }
export async function assistidoDoVideo(p: PropsAssistidoDoVideo): Promise<AssistidoPeriodosView> {
  const outros = p.ytIds.filter(y => y !== p.ytId)
  const longo = p.diario.ultimoDia == null ? null : await lerDiarioLongo({ canalId: p.canalId, ytIds: outros, ultimoDia: p.diario.ultimoDia, publicacoes: p.publicacoes, agora: p.agora, leitura: p.leitura })
  return buildAssistidoDoVideo({ ytId: p.ytId, ytIds: outros, diario: p.diario, longo })
}

/** "De onde vêm as views" (tela do vídeo). Sem prova de leitura nada é lido e o nível é "só o aviso". */
export type PropsOrigemDoVideo = { canalId: string; ytId: string; publicadoEm: string | null; ultimoDia: string | null; agora: number; leitura: LeituraPrivadaDoSite | null; podeEditar: boolean; n: (x: number) => string }
export async function origemDoVideo(p: PropsOrigemDoVideo): Promise<OrigemView> {
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
  return view
}

type Flat = Record<string, string | undefined>
type Pagina = ObservatoryPage<undefined>
type Base = NonNullable<ReturnType<typeof buildProprioVideoBase>>
export type MontarVideo =
  | { tipo: 'proprio'; pagina: Pagina; proprio: { id: string }; base: Base; blocos: ReturnType<typeof buildVideoBlocos>; barra: BlocoAssistido | null
      periodosProps: PropsAssistidoDoVideo | null; origemProps: PropsOrigemDoVideo
      /** só com `{ trocas: true }` (a página); o pacote "Perguntar a uma IA" não o pede */
      trocas: TrocasView | null
      recente: string | null; estado: Flat; privado: EstadoDoPrivado }
  | { tipo: 'concorrente'; pagina: Pagina; view: ReturnType<typeof buildHistoricoView>; recente: string | null; estado: Flat }

/** Hora de São Paulo de um instante (dia dd/mm e hora hh:mm), para as frases das trocas. */
const quandoSp = (iso: string): { dia: string; hora: string } => {
  const f = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso))
  const p = (t: string): string => f.find(x => x.type === t)?.value ?? ''
  return { dia: `${p('day')}/${p('month')}`, hora: `${p('hour')}:${p('minute')}` }
}

/**
 * Do vídeo aberto ao modelo: a MESMA função monta a tela (a página) e o pacote "Perguntar a uma IA" (E17 degrau 1, Tarefa 8b). `id` é o do vídeo na
 * URL; a decisão própria/concorrente é do servidor, a partir do canal resolvido do vídeo. Vídeo desconhecido: `concorrente` com a vista "não encontrado"
 * do Histórico (`view.notFound`). O `siteId` não é parâmetro. Os cartões de período e a origem voltam como funções, para a página os pedir num `Suspense`.
 */
export async function montarVideo(id: string, sp: Flat, abrir: () => Promise<Pagina> = () => openObservatoryPage(), opcoes: { trocas?: boolean } = {}): Promise<MontarVideo> {
  const pagina = await abrir()
  const { siteId, obs, savedNiche, now } = pagina
  const recente = obs.SYNC.last == null ? null : obs.SYNC.title
  const proprio = canalProprioDoVideo(obs, id)
  if (proprio) {
    // o modelo da página nasce ANTES de qualquer leitura privada: sem ele não há o que ler, e um vídeo próprio nunca cai no Histórico por acidente
    const base = buildProprioVideoBase(obs, id, sp)
    if (!base) throw new Error(`Vídeo próprio ${id}: o cartão não foi achado no conjunto do canal ${proprio.id}`)
    // UMA leitura do dado privado, depois da guarda de edição; erro de leitura LANÇA (D5)
    const acesso = await acessoPrivado(siteId)
    const leitura = acesso.leitura
    // as trocas (T16e): lidas DEPOIS da guarda de edição, com a mesma prova, em paralelo com o diário (não dependem dele); sem a opção (pacote da IA) nada é lido
    const [dados, lidas] = await Promise.all([
      lerDadosDoVideo({ canalId: proprio.id, ytId: base.header.ytId, longosAcompanhados: longosAcompanhadosDe(obs, proprio.id), agora: now, leitura }),
      opcoes.trocas ? lerTrocas({ canalId: proprio.id, ytId: base.header.ytId, videoUuid: id, agora: now, prova: leitura }) : Promise.resolve(null),
    ])
    const hoje = dayPt(new Date(now))
    let trocas: TrocasView | null = null
    if (lidas) {
      const pub = obs.video(id)
      trocas = buildTrocas({
        lidas, ytId: base.header.ytId, publicadoEm: pub ? dayPt(new Date(pub.pub)) : null, hojePt: hoje, podeEditar: acesso.edita,
        dm: dmDia, dmy: d => `${dmDia(d)}/${d.slice(0, 4)}`, quandoSp, diaPt: iso => dayPt(new Date(iso)), n: obs.fmt.int,
      })
    }
    const blocos = buildVideoBlocos({ obs, videoId: id, dados, hoje, dm: dmDia, hrefVideo: hrefDeOutroVideo(sp, proprio.id), trocasNoGrafico: trocas && trocas.estado !== 'privado' ? trocasNoGrafico(trocas) : null })
    const barra = blocos.acesso === 'ok' ? blocos.assistido : null
    const diario = dados.acesso === 'ok' ? dados.dado.diario : null
    const ytIds = longosAcompanhadosDe(obs, proprio.id)
    const periodosProps = diario
      ? { canalId: proprio.id, ytId: base.header.ytId, ytIds, publicacoes: publicacoesDe(obs.videos.filter(v => v.ch === proprio.id)), diario, agora: now, leitura }
      : null
    const origemProps = {
      canalId: proprio.id, ytId: base.header.ytId, publicadoEm: publicacoesDe(obs.videos.filter(v => v.ytId === base.header.ytId)).get(base.header.ytId) ?? null,
      ultimoDia: diario ? diario.ultimoDia : null, agora: now, leitura, podeEditar: acesso.edita, n: obs.fmt.int,
    }
    // `negativa` vem da MESMA resposta que decidiu a leitura (nunca de uma segunda chamada)
    const privado: EstadoDoPrivado = { acessoPorCanal: { [proprio.id]: { diario: dados.acesso, alcance: dados.acesso } }, negativa: acesso.negativa }
    return { tipo: 'proprio', pagina, proprio, base, blocos, barra, periodosProps, origemProps, trocas, recente, estado: sp, privado }
  }
  const formParam = parseNiche(sp.niche) ?? undefined
  // parseNiche checks the form; the engine says whether the niche exists (an unknown one is ignored: the saved niche, else Todos)
  const niche = formParam != null && obs.scopeOf(formParam) === formParam ? formParam : obs.scopeOf(savedNiche)
  // The pager rebuilds a "Só salvas" Mudanças list with the same swipe rows the Mudanças screen reads.
  const saved = sp.from !== 'outliers' && sp.from !== 'canais' && /(^|[?&])saved=1(&|$)/.test(sp.back ?? '')
    ? savedFromRows(obs, await loadSwipeRows(siteId)).saved : undefined
  const view = buildHistoricoView(obs, id, { ...sp, niche }, { savedChangeIds: saved })
  return { tipo: 'concorrente', pagina, view, recente, estado: { ...sp, niche } }
}
