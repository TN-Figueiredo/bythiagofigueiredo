/**
 * Modelo da seção "Como o canal está" (spec 16.5, D12 e D13; mockup M/canal.js `painel()`). Puro: recebe o alcance JÁ lido (`resumir`, `alcancePorVideo`), a
 * posição JÁ calculada no servidor e as opções do formulário; não lê banco, não pede a prova de edição e não importa os leitores (uma varredura de teste
 * barra). O que sai daqui é o QUE VAI PARA O NAVEGADOR: sem permissão ou com a leitura falha, nenhum número, título de vídeo ou série está na view.
 *
 * Regra de ouro (este sistema falha em VERDE): cada frase diz só o que o dado sustenta. Dia não medido não entra como zero em soma nem em média; série curta
 * ou com buracos diz a base ("em 19 dos 29 dias"); coleta parada diz "parou em dd/mm"; sem relatório, sem permissão, leitura que falhou, nenhum dia lido
 * e todos os dias em zero são cinco frases diferentes, e só o último é zero medido.
 */
import { link } from '@/lib/youtube/observatorio/links'
import { foraDaLeituraFrase } from '@/lib/youtube/observatorio/proprio/vpd'
import { conjuntoTexto } from '@/lib/youtube/observatorio/posicao'
import { alcanceAntesDaPublicacao, alcancePorVideo, montarDias, resumir, type AlcanceVideo, type Periodo, type PublicacoesPorYtId, type ResumoAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import type { DadosDoCanal } from './dados'
import { nichoDoLink, type PosicaoItens, type PosicaoNoNicho } from './header-model'
import { BACK_DO_TOP_IMP } from '../_historico/origem-canal'
import { foraDosGuardadosFrase } from './extras'
import { POUCO_VOLUME } from './formato'
import { buildImpressoes, ERRO_ALCANCE, int, paradaEm, SEM_PERMISSAO, semRelatorioFrase, type ImpressoesView } from './impressoes-model'
import { antesDaPublicacaoFrase } from './header-model'
import { taxaDoCanal, viewsDoCanalPorDia } from './canal-agregados'
import { buildTaxaFaixa, pctUm, type TaxaFaixaView } from './taxa-faixa-model'
import { canalLargo } from '@/lib/youtube/observatorio/proprio/taxa'
import type { OpcaoConcorrente } from './posicao-do-site'

export { POUCO_VOLUME }
/** Quantos vídeos a lista mostra (spec 16.5). */
const TOP_N = 5
/** Altura da área de barras do gráfico de views por dia (a mesma do de impressões). */
const ALTURA_VIEWS = 180
/** Altura da área de barras do gráfico do canal (spec 16.6: 180 px para o dia de 71 impressões não apagar o de 1). */
const ALTURA_CANAL = 180

export interface ComoEstaTop { id: string; titulo: string; href: string; imp: string; cliques: string; dias: string; thumb: string | null }
export interface ComoEstaNicho {
  /** "Entre 14 canais de Viagem:" */
  intro: string
  /** Os itens da linha de posição do cabeçalho (uma fonte só): `href` = a lista de Canais já ordenada por ele; null = texto. */
  linhas: Array<{ texto: string; href: string | null }>
  /** O formulário "Comparar com…"; vazio = sem concorrente, o formulário não existe. */
  opcoes: Array<{ id: string; name: string }>
  /** A ação do formulário GET: `link.comparar()` (o canal vai em `a` oculto, o concorrente em `b`). */
  acao: string
  /** "Ver a lista de Canais", no nicho da posição. */
  listaHref: string
}
/** Um pedaço da frase: `b` = em negrito (o valor e os limites da taxa). */
export interface TrechoFrase { t: string; b?: boolean }

/** O bloco "Taxa de clique do canal" (mockup 1, rodada 12/10). Sem taxa: `vazio` diz por quê e nada mais do bloco existe. */
export interface TaxaBlocoView {
  titulo: string
  frase: TrechoFrase[] | null
  faixa: TaxaFaixaView | null
  vazio: string | null
  nota: string | null
}

export interface ComoEstaView {
  /** A linha de uma frase, sempre visível: o alcance e a posição em inscritos. */
  recolhida: string
  /** A frase única do topo da seção aberta, calculada do volume. */
  frase: string
  top: ComoEstaTop[]
  topVazio: string | null
  /** Vídeos com impressões no relatório que não estão entre os guardados do canal (não têm cartão): o fato dito, sem a causa, nunca somado em silêncio. */
  topNota: string | null
  noNicho: ComoEstaNicho | null
  /** "O que ainda não é medido": rótulo e frase. */
  naoMedido: Array<{ rotulo: string; texto: string }>
  taxa: TaxaBlocoView
}

export interface EntradaComoEsta {
  resumo: ResumoAlcance
  periodo: Periodo | null
  acesso: 'ok' | 'negado' | 'erro'
  porVideo: ReadonlyMap<string, AlcanceVideo>
  videos: ReadonlyArray<{ id: string; ytId: string; title: string; thumb?: string | null }>
  posicao: PosicaoNoNicho | null
  /** A linha de posição do cabeçalho em pedaços (`ProprioHeaderView.posicaoItens`). */
  posicaoItens: PosicaoItens | null
  concorrentes: ReadonlyArray<OpcaoConcorrente>
  canalId: string
  dm: (d: DiaYt) => string
  /** O dia de hoje (dia do YouTube). OBRIGATÓRIO: sem ele a coleta parada não seria dita (falha em verde por omissão). */
  hoje: DiaYt
  /** O dia do relatório mais novo do canal, sem janela (`AlcanceCanal.ultimoRelatorio`): com o período vazio, "parou em dd/mm" em vez de "ainda não há relatório". OBRIGATÓRIO pelo mesmo motivo. */
  parouEm: DiaYt | null
  /** Impressões do relatório de dias anteriores à publicação do vídeo, que o total do canal soma e o de cada vídeo não (`alcanceAntesDaPublicacao`). Ausente = nenhuma. */
  antesDaPublicacao?: { linhas: number; imp: number }
}

type Estado = 'negado' | 'erro' | 'sem-relatorio' | 'nada-lido' | 'zero' | 'ok'

function estadoDe(a: EntradaComoEsta): Estado {
  if (a.acesso === 'negado') return 'negado'
  if (a.acesso === 'erro') return 'erro'
  if (!a.periodo) return 'sem-relatorio'
  if (a.resumo.diasLidos === 0 || a.resumo.imp == null) return 'nada-lido'
  if (a.resumo.imp === 0) return 'zero'
  return 'ok'
}

const plural = (n: number, um: string, muitos: string): string => `${int(n)} ${n === 1 ? um : muitos}`

/** "29 dias" quando todos os dias do período foram medidos; "19 dos 29 dias" quando há buracos (o dia sem relatório não conta como medido). */
function diasTexto(r: ResumoAlcance, p: Periodo): string {
  return r.diasNaoMedidos > 0 ? `${int(r.diasLidos)} dos ${plural(p.dias, 'dia', 'dias')}` : plural(p.dias, 'dia', 'dias')
}

/** Os cliques estimados dentro da frase "N impressões e M cliques estimados em D dias." */
function alcanceFrase(r: ResumoAlcance, p: Periodo): string {
  const imp = plural(r.imp ?? 0, 'impressão', 'impressões')
  const dias = diasTexto(r, p)
  if (r.cliques == null) return `${imp} em ${dias}; cliques estimados não medidos em algum dia.`
  const c = r.cliques
  const cliques = c <= 0 ? 'nenhum clique estimado' : Math.round(c) === 0 ? 'menos de 1 clique estimado' : plural(Math.round(c), 'clique estimado', 'cliques estimados')
  return `${imp} e ${cliques} em ${dias}.`
}

/** "Nenhuma impressão em 10 dias lidos.": só vale quando houve dia lido, e fala só dos dias lidos. */
const zeroBase = (r: ResumoAlcance): string => `Nenhuma impressão em ${plural(r.diasLidos, 'dia medido', 'dias medidos')}.`

function fraseDoTopo(estado: Estado, a: EntradaComoEsta): string {
  const { resumo: r, periodo: p } = a
  switch (estado) {
    case 'negado': return SEM_PERMISSAO
    case 'erro': return ERRO_ALCANCE
    case 'sem-relatorio': return semRelatorioFrase(a.parouEm, a.dm)
    case 'nada-lido':
      return p && p.dias === 1
        ? 'Ainda não há dia medido: o dia do período não tem impressões nem cliques medidos.'
        : `Ainda não há dia medido: nenhum dos ${int(p?.dias ?? 0)} dias do período tem impressões ou cliques medidos.`
    case 'zero': {
      const base = zeroBase(r)
      if (r.diasNaoMedidos === 0) return base
      return `${base} ${r.diasNaoMedidos === 1 ? 'O 1 dia sem dado não entra' : `Os ${int(r.diasNaoMedidos)} dias sem dado não entram`} na conta.`
    }
    case 'ok': {
      const imp = plural(r.imp ?? 0, 'impressão', 'impressões')
      const dias = diasTexto(r, p!)
      return (r.imp ?? 0) < POUCO_VOLUME
        ? `Com ${imp} em ${dias}, ainda é pouco para dizer qual vídeo ou qual capa funciona melhor. O que já dá para ver é em que dias o canal apareceu, e em quais não há dado.`
        : `Com ${imp} em ${dias} dá para ver em que dias e em quais vídeos o canal apareceu. Nenhum vídeo sozinho diz que uma capa funciona melhor.`
    }
    default: { const nunca: never = estado; return nunca }
  }
}

/** A primeira metade da linha recolhida: o alcance, ou o motivo de não haver. */
function alcanceRecolhido(estado: Estado, a: EntradaComoEsta): string {
  switch (estado) {
    case 'negado': return 'Só quem edita o site vê as impressões e os cliques.'
    case 'erro': return ERRO_ALCANCE
    case 'sem-relatorio': return semRelatorioFrase(a.parouEm, a.dm)
    case 'nada-lido': return fraseDoTopo(estado, a)
    case 'zero': return zeroBase(a.resumo)
    case 'ok': return alcanceFrase(a.resumo, a.periodo!)
    default: { const nunca: never = estado; return nunca }
  }
}

/** "14º de 14 canais de Viagem em inscritos." (o conjunto é o da posição: nicho ou "no geral"); null = a posição não foi calculada. */
function posicaoRecolhida(p: PosicaoNoNicho | null): string | null {
  if (!p) return null
  const q = p.inscritos
  if (!q) return 'Sem posição em inscritos.'
  const c = p.conjunto
  const onde = c.tipo === 'nicho' ? `canais de ${c.label}` : `canais ${conjuntoTexto(c)}`
  return `${q.pos}º de ${q.de} ${onde} em inscritos${q.empate ? ' (empate)' : ''}.`
}

function cliquesDoVideo(c: number | null): string {
  if (c == null) return 'cliques não medidos'
  if (c <= 0) return 'nenhum clique'
  if (Math.round(c) === 0) return 'menos de 1 clique estimado'
  return plural(Math.round(c), 'clique estimado', 'cliques estimados')
}

const SEM_TOP_NEGADO = 'Só quem edita o site vê os vídeos que mais apareceram.'

function topDe(estado: Estado, a: EntradaComoEsta): { top: ComoEstaTop[]; topVazio: string | null; topNota: string | null } {
  const vazio = (topVazio: string) => ({ top: [], topVazio, topNota: null })
  switch (estado) {
    case 'negado': return vazio(SEM_TOP_NEGADO)
    case 'erro': return vazio(ERRO_ALCANCE)
    case 'sem-relatorio': return vazio('Sem relatório de alcance, não há vídeo para listar.')
    case 'nada-lido': return vazio('Nenhum dia do período foi medido ainda, então nenhum vídeo aparece aqui.')
    case 'zero': return vazio(`Nenhum vídeo teve impressão ${a.resumo.diasLidos === 1 ? 'em' : 'nos'} ${plural(a.resumo.diasLidos, 'dia medido', 'dias medidos')}.`)
    case 'ok': break
    default: { const nunca: never = estado; return nunca }
  }
  if (a.videos.length === 0) return vazio('Este canal não tem vídeos guardados.')
  const porYt = new Map(a.videos.map(v => [v.ytId, v]))
  const dentro: Array<{ v: (typeof a.videos)[number]; r: AlcanceVideo }> = []
  let fora = 0
  for (const [yt, r] of a.porVideo) {
    const v = porYt.get(yt)
    if (v) dentro.push({ v, r })
    else fora++
  }
  const titulo = (v: { title: string }) => (v.title.trim() ? v.title : 'Vídeo sem título')
  dentro.sort((x, y) => y.r.imp - x.r.imp || (y.r.cliques ?? -1) - (x.r.cliques ?? -1) || titulo(x.v).localeCompare(titulo(y.v), 'pt-BR') || (x.v.id < y.v.id ? -1 : x.v.id > y.v.id ? 1 : 0))
  const escolhidos = dentro.slice(0, TOP_N)
  if (escolhidos.length === 0) {
    return vazio(fora > 0 ? foraDosGuardadosFrase(fora, int) : 'Nenhum vídeo com impressão no período lido.')
  }
  const ids = escolhidos.map(e => e.v.id)
  const top = escolhidos.map(({ v, r }, i): ComoEstaTop => ({
    id: v.id, titulo: titulo(v),
    href: link.historico(v.id, { from: 'canais', canal: a.canalId, back: BACK_DO_TOP_IMP, ids, pos: i + 1, tot: ids.length }),
    imp: plural(r.imp, 'impressão', 'impressões'), cliques: cliquesDoVideo(r.cliques), dias: `em ${plural(r.diasComImpressao, 'dia', 'dias')} com impressão`,
    thumb: v.thumb ?? null,
  }))
  const partes = [fora === 0 ? null : foraDosGuardadosFrase(fora, int), a.antesDaPublicacao && a.antesDaPublicacao.imp > 0 ? antesDaPublicacaoFrase(a.antesDaPublicacao.imp) : null].filter((x): x is string => x != null)
  const topNota = partes.length === 0 ? null : partes.join(' ')
  return { top, topVazio: null, topNota }
}

/** O que ainda não é medido (A4 13.3): só a curva de retenção e a origem do tráfego; views por dia e % assistido já têm desenho. Não depende do dado privado. */
const NAO_MEDIDO: ComoEstaView['naoMedido'] = [
  { rotulo: 'Curva de retenção', texto: 'ainda não é coletada.' },
  { rotulo: 'Origem do tráfego', texto: 'ainda não aparece aqui.' },
]

const NOTA_TAXA = 'Compare com os seus próprios vídeos e períodos, não com outros canais: o YouTube só entrega a taxa de clique ao dono do canal.'

/** O bloco da taxa: o valor, "X de Y", o intervalo e a faixa; sem taxa, só a frase do motivo. */
function taxaBloco(estado: Estado, a: EntradaComoEsta): TaxaBlocoView {
  const titulo = 'Taxa de clique do canal'
  const sem = (vazio: string): TaxaBlocoView => ({ titulo, frase: null, faixa: null, vazio, nota: null })
  switch (estado) {
    case 'negado': return sem('Só quem edita o site vê a taxa de clique.')
    case 'erro': return sem(ERRO_ALCANCE)
    case 'sem-relatorio': return sem('Sem relatório de alcance não há como calcular a taxa.')
    case 'nada-lido': return sem('Nenhum dia do período foi medido ainda, então não há taxa.')
    case 'zero': return sem('Nenhuma impressão nos dias medidos, então não há taxa.')
    case 'ok': break
    default: { const nunca: never = estado; return nunca }
  }
  const t = taxaDoCanal(a.resumo)
  if (!t) return sem(`Não dá para calcular a taxa: o YouTube não informou a taxa de clique de ${plural(a.resumo.diasSemCtr, 'dia', 'dias')} com impressões.`)
  const frase: TrechoFrase[] = [
    { t: pctUm(t.taxa), b: true }, { t: ` das impressões viraram clique (${int(Math.round(t.cliques))} de ${int(t.imp)}). Com este volume, a taxa real fica entre ` },
    { t: pctUm(t.lo), b: true }, { t: ' e ' }, { t: pctUm(t.hi), b: true },
    { t: canalLargo(t) ? '. Ainda não dá para dizer se é alta ou baixa.' : '.' },
  ]
  const faixa = buildTaxaFaixa({ alvo: t, canal: null, alt: `Taxa de clique do canal: ${pctUm(t.taxa)}, intervalo de 95% de ${pctUm(t.lo)} a ${pctUm(t.hi)}` })
  return { titulo, frase, faixa, vazio: null, nota: NOTA_TAXA }
}

export function buildComoEsta(a: EntradaComoEsta): ComoEstaView {
  const estado = estadoDe(a)
  // sem permissão ou com a leitura falha, nada do que veio entra na view (nem o resumo, nem os vídeos)
  const parou = a.periodo && (estado === 'ok' || estado === 'zero' || estado === 'nada-lido') ? paradaEm(a.periodo, a.hoje) : null
  const pos = posicaoRecolhida(a.posicao)
  const recolhida = [alcanceRecolhido(estado, a), parou ? `A coleta parou em ${a.dm(parou)}.` : null, pos].filter((x): x is string => x != null).join(' ')
  return {
    recolhida,
    frase: fraseDoTopo(estado, a),
    ...topDe(estado, a),
    noNicho: a.posicaoItens
      ? {
        intro: a.posicaoItens.intro,
        linhas: a.posicaoItens.itens.map(i => ({ texto: i.texto, href: i.href })),
        opcoes: a.concorrentes.map(c => ({ id: c.id, name: c.acima ? `${c.name} (logo acima de você)` : c.name })),
        acao: link.comparar(),
        listaHref: link.canais({ niche: a.posicao ? nichoDoLink(a.posicao.conjunto) : 'todos' }),
      }
      : null,
    naoMedido: NAO_MEDIDO.map(x => ({ ...x })),
    taxa: taxaBloco(estado, a),
  }
}

/** A seção e o gráfico a partir do dado privado do canal (o mesmo `montarDias` alimenta os dois: um número só, uma regra só). */
export function montarComoEsta(a: {
  dados: DadosDoCanal; hoje: DiaYt; dm: (d: DiaYt) => string; posicao: PosicaoNoNicho | null; posicaoItens: PosicaoItens | null
  videos: EntradaComoEsta['videos']; concorrentes: ReadonlyArray<OpcaoConcorrente>; canalId: string
  /** O dia da publicação de cada vídeo do canal (`publicacoesDe`): o total de cada um começa nele. OBRIGATÓRIO: sem ele o corte seria esquecido em silêncio. */
  publicacoes: PublicacoesPorYtId
}): { view: ComoEstaView; grafico: ImpressoesView; graficoViews: ImpressoesView } {
  const al = a.dados.alcance
  const lido = al.acesso === 'ok' ? montarDias(al.dado, { hoje: a.hoje }) : null
  const dias = lido?.dias ?? []
  const periodo = lido?.periodo ?? null
  const porVideo = al.acesso === 'ok' ? alcancePorVideo(al.dado, a.publicacoes) : new Map<string, AlcanceVideo>()
  const parouEm = al.acesso === 'ok' ? al.dado.ultimoRelatorio : null
  const grafico = buildImpressoes(dias, periodo, { escopo: 'canal', alturaArea: ALTURA_CANAL, dm: a.dm, acesso: al.acesso, hoje: a.hoje, parouEm })
  // views por dia, soma dos vídeos longos acompanhados: do diário, que tem o seu próprio acesso (e o seu próprio "dia mais novo")
  const ytIds = a.videos.map(v => v.ytId)
  const vs = viewsDoCanalPorDia(a.dados.diario, ytIds)
  const graficoViews = buildImpressoes(vs.dias, vs.periodo, { escopo: 'canal', alturaArea: ALTURA_VIEWS, unidade: 'views', dm: a.dm, acesso: a.dados.diario.acesso, hoje: a.hoje })
  // o corte dos 50 longos mais novos do diário: a soma não é do canal inteiro e o gráfico diz
  if (vs.foraDoTeto > 0) graficoViews.avisos.push(foraDaLeituraFrase(vs.foraDoTeto))
  const view = buildComoEsta({
    resumo: resumir(dias), periodo, acesso: al.acesso, porVideo, videos: a.videos, posicao: a.posicao, posicaoItens: a.posicaoItens,
    concorrentes: a.concorrentes, canalId: a.canalId, dm: a.dm, hoje: a.hoje, parouEm,
    antesDaPublicacao: al.acesso === 'ok' ? alcanceAntesDaPublicacao(al.dado, a.publicacoes) : undefined,
  })
  return { view, grafico, graficoViews }
}
