/**
 * A5 · E17 degrau 1, Tarefa 6d: o empacotador do Histórico do vídeo do concorrente. Puro: nada de banco, de relógio nem de conta; cada número é copiado do
 * campo do modelo, com o texto que o modelo já formatou, e cada célula leva a `origem` (o caminho do campo no modelo) para a prova de paridade.
 *
 * O MODELO daqui (`ModeloVideo`) é o `HistoricoView` da tela MAIS o objeto `derivado`, que só reescreve como a tela escreve:
 *  - `rico`: o texto do filtro de período (`range.text`) e a frase de contagem da lista (`compare.sum`), que a tela pinta a partir de partes;
 *  - `registros`: a tabela de registros diários (`chart.table`) com o nome de cada coluna;
 *  - `descricoes`: para cada comparação de descrição (`versions.descs.diffs[k]`), a linha da versão que ela leva (o rótulo depois da seta).
 * A geometria do gráfico e das faixas (horas, posições, cores) não entra: a tela as desenha, o pacote leva os registros e os textos.
 * O texto da descrição (linha a linha) é bloco citado ligado à linha da versão de descrição: sai com a linha no corte.
 * Nenhum texto daqui afirma causa: o painel de cada troca já escreve "Não prova causa" e o pacote repete isso nos avisos.
 */
import type { HistoricoView, DiffRow, VersionView, ComparisonView } from '../_historico/view-model'
import type { Rich } from '../_mudancas/view-model'
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { BlocoCitado, Celula, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'

// ───────────────────────── o modelo
export interface DerivadoVideo {
  rico: { rangeText: string | null; compareSum: string | null }
  registros: Array<{ registro: string; acumuladas: string; porDia: string; esperado: string }>
  descricoes: Array<{ linha: number | null }>
}
export type ModeloVideo = HistoricoView & { derivado: DerivadoVideo }

const cap = (t: string): string => (t ? t[0]!.toUpperCase() + t.slice(1) : '')
const comCap = <T extends { span: string }>(xs: T[]): T[] => xs.map((x) => ({ ...x, span: cap(x.span) }))
const textoDoRico = (r: Rich): string => r.map((p) => (typeof p === 'string' ? p : 'num' in p ? p.num : p.b)).join('')

export function modeloDeVideo(view: HistoricoView): ModeloVideo {
  const rotulos = view.versions?.descs.rows.map((r) => r.label) ?? []
  // A tela escreve o período de cada versão com a primeira letra maiúscula (`cap`): o modelo do pacote traz o texto como a tela o mostra.
  const versions = view.versions
    ? { ...view.versions, titles: { ...view.versions.titles, items: comCap(view.versions.titles.items) }, thumbs: { ...view.versions.thumbs, cards: comCap(view.versions.thumbs.cards) }, descs: { ...view.versions.descs, rows: comCap(view.versions.descs.rows) } }
    : view.versions
  return {
    ...view,
    versions,
    derivado: {
      rico: { rangeText: view.range ? textoDoRico(view.range.text) : null, compareSum: view.compare.sum ? textoDoRico(view.compare.sum) : null },
      registros: (view.chart?.table ?? []).map(([registro, acumuladas, porDia, esperado]) => ({ registro, acumuladas, porDia, esperado })),
      descricoes: (view.versions?.descs.diffs ?? []).map((d) => {
        const m = /→\s*(\S+?):/.exec(d.sum)
        const i = m ? rotulos.indexOf(m[1]!) : -1
        return { linha: i >= 0 ? i + 1 : null }
      }),
    },
  }
}

// ───────────────────────── o inventário de folhas (item 160)
const CTRL = { descartado: 'controle de tela' } as const
const ID = { descartado: 'identificador' } as const
const END = { descartado: 'endereço' } as const
const APAR = { descartado: 'aparência' } as const
const REP = { descartado: 'repetido' } as const
const IMG = { descartado: 'imagem' } as const
// geometria do gráfico e das faixas: o destino `aparência` do contrato (inventario.ts); o pacote leva os registros e os textos
const GEO = { descartado: 'aparência' } as const

const VERSAO = (raiz: string): Inventario => ({
  [`${raiz}[].inRange`]: CTRL, [`${raiz}[].name`]: REP, [`${raiz}[].edge.*`]: REP, [`${raiz}[].id`]: ID, [`${raiz}[].label`]: 'rotulo',
  [`${raiz}[].from`]: REP, [`${raiz}[].to`]: REP, [`${raiz}[].atLeast`]: CTRL, [`${raiz}[].participle`]: REP, [`${raiz}[].changedParticiple`]: REP,
  [`${raiz}[].precision`]: CTRL, [`${raiz}[].fromH`]: GEO, [`${raiz}[].toH`]: GEO, [`${raiz}[].win`]: GEO, [`${raiz}[].win[]`]: GEO,
  [`${raiz}[].span`]: 'base', [`${raiz}[].dur`]: 'numero', [`${raiz}[].rate`]: 'base', [`${raiz}[].cur`]: CTRL, [`${raiz}[].aria`]: REP,
  [`${raiz}[].clipText`]: 'terceiros', [`${raiz}[].tag`]: CTRL, [`${raiz}[].tag.kind`]: CTRL, [`${raiz}[].tag.text`]: 'base',
  [`${raiz}[].thumb`]: IMG, [`${raiz}[].thumb.*`]: IMG, [`${raiz}[].reverted`]: CTRL, [`${raiz}[].noText`]: CTRL,
  [`${raiz}[].titleDiff`]: REP, [`${raiz}[].titleDiff.*`]: REP,
})

const RUNNOTE = (raiz: string): Inventario => ({
  [`${raiz}`]: CTRL, [`${raiz}.items[].strong`]: 'base', [`${raiz}.items[].text`]: 'base', [`${raiz}.def`]: 'base',
})

export const INVENTARIO_VIDEO: Inventario = {
  'video.id': ID, 'video.title': 'terceiros', 'video.channel': 'terceiros', 'video.niche': ID, 'video.age': REP, 'video.url': END,
  video: CTRL, range: CTRL, 'crumbs.*': CTRL, 'crumbs.sub.*': CTRL, 'crumbs.sub': CTRL,
  'derivado.rico.rangeText': 'base', 'derivado.rico.compareSum': 'base',

  // o cabeçalho
  header: CTRL, 'header.thumb.*': IMG, 'header.dur': 'numero', 'header.chan.*': REP, 'header.views.num': 'numero', 'header.views.text': REP,
  'header.pub.age': 'base', 'header.pub.full': 'base', 'header.fmt': 'rotulo', 'header.sync.text': 'base', 'header.sync.bad': CTRL, 'header.sync.title': REP,
  'header.mult.text': 'base', 'header.mult.title': REP, 'header.fallback': 'base', 'header.counts[].type': CTRL, 'header.counts[].text': 'base',

  // o gráfico: os registros diários e as frases; a geometria é desenho
  chart: CTRL, 'chart.points[]*': GEO, 'chart.expected[]*': GEO, 'chart.expectedMethod': 'base', 'chart.compressedBefore': GEO, 'chart.H': GEO, 'chart.fromH': GEO,
  'chart.B0': GEO, 'chart.few': CTRL, 'chart.src.bold': 'base', 'chart.src.text': 'base',
  'chart.empty': CTRL, 'chart.empty.title': 'base', 'chart.empty.text': 'base', 'chart.empty.tail': 'base', 'chart.empty.last': CTRL,
  'chart.empty.last.views': 'numero', 'chart.empty.last.at': 'base', 'chart.empty.link': CTRL, 'chart.empty.link.*': END,
  'chart.bins[]*': GEO, 'chart.expectedSteps[]*': GEO, 'chart.yTicks[]*': GEO, 'chart.pre': GEO, 'chart.pre.*': GEO, 'chart.pre.lines[]': 'base',
  'chart.hatch': GEO, 'chart.hatch.*': GEO, 'chart.firstNote': CTRL, 'chart.firstNote.toH': GEO, 'chart.firstNote.text': 'base',
  'chart.xTicks[]*': GEO, 'chart.aria': REP, 'chart.fewAxis': GEO, 'chart.fewAxis[]*': GEO, 'chart.stale': CTRL, 'chart.stale.fromH': GEO, 'chart.stale.title': 'base',
  'chart.table': REP, 'chart.table[][]': REP,
  'derivado.registros[].registro': 'rotulo', 'derivado.registros[].acumuladas': 'base', 'derivado.registros[].porDia': 'base', 'derivado.registros[].esperado': 'base',

  // as faixas do gráfico repetem as versões
  'lanes[]*': REP, 'lanes[].*': REP, 'lanes[].versions[]*': REP, 'lanes[].markers[]*': REP,
  'legends.*': REP, 'legends.*[]*': REP, 'legends[]*': REP,

  // as comparações, uma por troca
  'comparisons[].changeId': ID, 'comparisons[].before': 'numero', 'comparisons[].after': 'numero', 'comparisons[].scale': REP,
  'comparisons[].effect.status': CTRL, 'comparisons[].effect.demoted': CTRL, 'comparisons[].effect.noBase': 'base', 'comparisons[].effect.method': REP,
  'comparisons[].effect.fallback': 'base', 'comparisons[].effect.caveats[]': 'base', 'comparisons[].effect.notCause': 'base', 'comparisons[].effect.collected': CTRL,
  'comparisons[].effect.afterNeeded': CTRL, 'comparisons[].effect.icon': APAR, 'comparisons[].effect.label': 'base', 'comparisons[].effect.numbers': REP,
  'comparisons[].effect.pp': REP, 'comparisons[].effect.detail': 'base', 'comparisons[].effect.wait': 'base', 'comparisons[].effect.spark': GEO,
  'comparisons[].effect.spark.*': GEO, 'comparisons[].effect.spark.before[]': GEO, 'comparisons[].effect.spark.after[]': GEO,
  'comparisons[].effect.rows': CTRL, 'comparisons[].effect.rows.*': REP, 'comparisons[].effect.rows.iqr[]': REP, 'comparisons[].effect.footTitle': REP,
  'comparisons[].chip': 'base', 'comparisons[].ba': CTRL, 'comparisons[].ba[].thumb': IMG, 'comparisons[].ba[].thumb.*': IMG, 'comparisons[].ba[].title': 'terceiros',
  'comparisons[].ba[].label': 'rotulo', 'comparisons[].ba[].at': CTRL,
  'comparisons[].nobase': CTRL, 'comparisons[].nobase.strong': 'base', 'comparisons[].nobase.text': 'base',
  'comparisons[].full': CTRL, 'comparisons[].full.what': 'base', 'comparisons[].full.whatWhen': 'base', 'comparisons[].full.days': 'base',
  'comparisons[].full.verdictStrong': 'base', 'comparisons[].full.verdictText': 'base', 'comparisons[].full.pill': 'base', 'comparisons[].full.scale.*': REP,
  'comparisons[].full.scale.iqr': REP, 'comparisons[].full.scale.iqr.*': REP, 'comparisons[].full.src': 'base', 'comparisons[].full.second': CTRL,
  'comparisons[].full.second.strong': 'base', 'comparisons[].full.second.text': 'base', 'comparisons[].full.caveats[]': 'base',
  'comparisons[].descLink': CTRL, 'comparisons[].windows': GEO, 'comparisons[].windows.*': GEO, 'comparisons[].windows.*[]': GEO,
  'comparisons[].field': CTRL, 'comparisons[].situation': CTRL, 'comparisons[].label': 'base', 'comparisons[].when': 'base', 'comparisons[].statusLine': 'base',
  'comparisons[].runLines[]': 'base', 'comparisons[].inRange': CTRL,
  defaultPair: CTRL, arrival: CTRL, 'arrival.*': REP, compareEmpty: 'base',
  'compare.mode': CTRL, 'compare.sum': REP, 'compare.sum[]*': REP, 'compare.scope': REP, 'compare.total': REP, 'compare.fields[]*': CTRL, 'compare.situations[]*': CTRL,

  // as versões
  versions: CTRL,
  'versions.thumbs.src': 'base', ...VERSAO('versions.thumbs.cards'), 'versions.thumbs.notes[].kind': CTRL, 'versions.thumbs.notes[].text': 'base',
  ...RUNNOTE('versions.thumbs.runNote'), 'versions.thumbs.more': CTRL, 'versions.thumbs.more.keep': CTRL, 'versions.thumbs.more.open': REP, 'versions.thumbs.more.close': REP,
  'versions.thumbs.more.srcClosed': 'base', 'versions.thumbs.more.srcOpen': 'base', 'versions.thumbs.empty': 'base',
  'versions.titles.src': 'base', 'versions.titles.same': 'base', ...VERSAO('versions.titles.items'), ...RUNNOTE('versions.titles.runNote'),
  'versions.descs.src': 'base', 'versions.descs.same': 'base', ...VERSAO('versions.descs.rows'), 'versions.descs.notes[]': 'base',
  'versions.descs.diffs[].sum': 'base', 'versions.descs.diffs[].utm': 'numero', 'versions.descs.diffs[].utmNote': 'base',
  'versions.descs.diffs[].rows[].kind': CTRL, 'versions.descs.diffs[].rows[].text': 'terceiros', 'versions.descs.diffs[].rows[].noise': CTRL,
  'versions.descs.diffs[].rows[].from': 'terceiros', 'versions.descs.diffs[].rows[].extra': 'terceiros',
  'derivado.descricoes[].linha': CTRL,

  // a ordem entre os vídeos e o filtro de período
  'pager.*': CTRL, pager: CTRL, 'pager.position': 'base', 'pager.status': REP,
  'range.value': CTRL, 'range.fromH': GEO, 'range.cut': CTRL, 'range.why': 'base', 'range.options[]*': CTRL, 'range.text[]*': REP, 'range.text': REP,
  viewer: IMG, 'viewer.*': IMG, 'viewer.versions[]*': IMG, state: CTRL, untracked: CTRL, 'untracked.notice': 'base', 'untracked.href': END,
  lanesAxis: GEO, 'lanesAxis.*': GEO, 'lanesAxis.ticks[]*': GEO,
  pin: CTRL, 'pin.*': CTRL, 'pin.note': 'base', pinView: CTRL, 'pinView.*': CTRL, 'pinView.chips[]*': CTRL,
  notFound: CTRL, 'notFound.title': 'base', 'notFound.text': 'base', 'notFound.href': END, 'notFound.back': END,
  forja: CTRL, 'forja.*': CTRL, 'forja.machine.*': CTRL, 'forja.niches[]*': CTRL, 'forja.niches[].out[]': CTRL, 'forja.cancel[]': CTRL, 'forja.ask.*': CTRL, 'forja.ask.niches[]': CTRL,
  'forja.card.*': CTRL, 'forja.card.lines[]': CTRL, 'forja.button.*': CTRL, 'forja.machine': CTRL,
  forjaCard: CTRL, 'forjaCard.canalId': ID, 'forjaCard.situacao': CTRL, 'forjaCard.frase': 'base', 'forjaCard.etapas': CTRL, 'forjaCard.etapas[].id': ID,
  'forjaCard.etapas[].label': 'rotulo', 'forjaCard.etapas[].estado': CTRL, 'forjaCard.etapas[].texto': 'base', 'forjaCard.andamento': 'base', 'forjaCard.cancelar': CTRL,
  'forjaCard.acoes[]*': CTRL, 'forjaCard.explicacao.aberta': CTRL, 'forjaCard.explicacao.texto': REP, 'forjaCard.botao.*': CTRL, 'forjaCard.botao.label': REP, 'forjaCard.botao.motivo': 'base',
  'forjaCard.vazio': 'base', 'forjaCard.excluido': 'base', 'forjaCard.bloqueado': CTRL, 'forjaCard.bloqueado.text': 'base', 'forjaCard.bloqueado.title': REP, 'forjaCard.bloqueado.href': END,
  'forjaCard.doNicho': CTRL, 'forjaCard.doNicho.text': 'base', 'forjaCard.doNicho.items[].text': 'base', 'forjaCard.doNicho.items[].href': END, 'forjaCard.doNicho.items[].label': REP,
  'forjaCard.doNicho.foot': 'base',
  imageSummary: CTRL, 'imageSummary.src': 'base', 'imageSummary.note': 'base', 'imageSummary.rows[].segs[]*': GEO,
  'imageSummary.rows[].label': 'rotulo', 'imageSummary.rows[].thumb': IMG, 'imageSummary.rows[].thumb.*': IMG, 'imageSummary.rows[].now': REP,
  'imageSummary.rows[].dur': 'numero', 'imageSummary.rows[].passes': 'numero', 'imageSummary.rows[].rate': 'base', 'imageSummary.rows[].segsText': 'base',
  'imageSummary.rows[].rowName': REP, 'imageSummary.rows[].pinName': REP,
  'imageSummary.total.label': 'rotulo', 'imageSummary.total.dur': 'numero', 'imageSummary.total.passes': 'numero', 'imageSummary.total.rate': 'base',
  groupLegend: REP,
  ...Object.fromEntries(['leitura', 'anterior'].flatMap((k) => [
    [`forjaCard.${k}`, CTRL], [`forjaCard.${k}.id`, ID], [`forjaCard.${k}.selo`, 'rotulo'], [`forjaCard.${k}.seloInfo`, REP], [`forjaCard.${k}.leu`, 'base'],
    [`forjaCard.${k}.lead`, 'terceiros'], [`forjaCard.${k}.itens[].texto`, 'terceiros'], [`forjaCard.${k}.itens[].refs[]*`, END], [`forjaCard.${k}.itens[].refs[].label`, REP],
    [`forjaCard.${k}.doSite[]`, 'base'], [`forjaCard.${k}.rotulo`, 'rotulo'],
  ])),
}

/** Chaves do inventário cuja folha não aparece em nenhum estado da matriz do teste (o oráculo não tem vídeo com a forja em andamento, nem marcas de ruído, nem faixa agrupada). A forja da tela do vídeo é a do canal e tem a prova no teste do canal; o teste daqui só exige que a lista não cresça sem querer. */
export const SEM_FOLHA_NA_MATRIZ_VIDEO: readonly string[] = [
  'legends.*[]*',
  'imageSummary.rows[].thumb',
  'legends[]*',
  'comparisons[].ba[].thumb',
  'comparisons[].full.scale.iqr',
  'comparisons[].windows.*[]',
  'arrival.*',
  'compare.sum[]*',
  'versions.thumbs.cards[].win[]',
  'versions.thumbs.cards[].thumb',
  'versions.thumbs.cards[].titleDiff.*',
  'versions.thumbs.more.keep',
  'versions.thumbs.more.open',
  'versions.thumbs.more.close',
  'versions.thumbs.more.srcClosed',
  'versions.thumbs.more.srcOpen',
  'versions.titles.items[].thumb.*',
  'versions.descs.rows[].thumb.*',
  'versions.descs.rows[].titleDiff.*',
  'versions.descs.notes[]',
  'versions.descs.diffs[].rows[].noise',
  'range.text',
  'pinView.chips[]*',
  'forja.cancel[]',
  'forja.card.lines[]',
  'forja.machine',
  'forjaCard.etapas[].id',
  'forjaCard.etapas[].label',
  'forjaCard.etapas[].estado',
  'forjaCard.etapas[].texto',
  'forjaCard.acoes[]*',
  'forjaCard.bloqueado.text',
  'forjaCard.bloqueado.title',
  'forjaCard.bloqueado.href',
  'forjaCard.doNicho.items[].text',
  'forjaCard.doNicho.items[].href',
  'forjaCard.doNicho.items[].label',
  'forjaCard.anterior.id',
  'forjaCard.anterior.selo',
  'forjaCard.anterior.seloInfo',
  'forjaCard.anterior.leu',
  'forjaCard.anterior.lead',
  'forjaCard.anterior.itens[].texto',
  'forjaCard.anterior.itens[].refs[]*',
  'forjaCard.anterior.itens[].refs[].label',
  'forjaCard.anterior.doSite[]',
  'forjaCard.anterior.rotulo',
]

/** Folhas de número cru: nenhuma. Todo número desta tela já vem formatado pelo modelo (`obs.fmt`). */
export const SEM_PROVA_POR_IGUALDADE_DIRETA_VIDEO = [] as const

// ───────────────────────── textos do pacote que esta tela escreve
// Revisto pelo Logan (17/10): as frases de "o que esta tela não mede" e os títulos das tabelas abaixo.
const NAO_MEDE_CAUSA = 'se uma troca explica a mudança nas views: o efeito compara o vídeo com os outros do canal sem troca, e mostra o que veio junto, não a origem'
const NAO_MEDE_PRIVADO = 'o que só o dono do canal vê: impressões, taxa de clique, retenção e origem do tráfego de um concorrente'
const SEM_CAUSA = 'Não prova causa.'

// ───────────────────────── células
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const terceiros = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })
const medido = (texto: string, origem: string): Celula => (texto === '0' ? { papel: 'numero', estado: 'zero_medido', texto, x: 0, origem } : { papel: 'numero', estado: 'medido', texto, x: null, origem })
const naoMedido = (motivo: string | null, origem: string): Celula => ({ papel: 'numero', estado: 'nao_medido', motivo: motivo ?? A_TELA_NAO_INFORMA_O_MOTIVO, origem })
void naoMedido

const tabelaFixa = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'fixa', nomeNoCorte, privada: false, colunas, linhas })
const tabelaLista = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'lista', nomeNoCorte, privada: false, colunas, linhas })
const unica = (id: string, titulo: string, nome: string, coluna: string, celula: Celula): Tabela => tabelaFixa(id, titulo, nome, [coluna], [[celula]])

// ───────────────────────── tabelas
function tabelasDoCabecalho(m: ModeloVideo): Tabela[] {
  const h = m.header
  if (!h) return []
  const saida: Tabela[] = [tabelaFixa('cabecalho', 'O vídeo', 'dados do vídeo', ['Publicado', 'Publicado em', 'Formato'],
    [[base(h.pub.age, 'modelo.header.pub.age'), base(h.pub.full, 'modelo.header.pub.full'), rotulo(h.fmt, 'modelo.header.fmt')]])]
  if (h.views.num !== null) saida.push(unica('cabecalho-views', 'As views do vídeo', 'views do vídeo', 'Views', medido(h.views.num, 'modelo.header.views.num')))
  // a duração só aparece sobre a miniatura: sem miniatura na tela, não há duração na tela
  if (h.dur !== null && h.thumb.src) saida.push(unica('cabecalho-duracao', 'A duração do vídeo', 'duração do vídeo', 'Duração', medido(h.dur, 'modelo.header.dur')))
  // a tela esconde o múltiplo no vídeo que não é acompanhado
  if (h.mult.text && !m.untracked) saida.push(unica('cabecalho-multiplo', 'O múltiplo do vídeo contra o canal', 'múltiplo do vídeo', 'Múltiplo', base(h.mult.text, 'modelo.header.mult.text')))
  return saida
}

function tabelaDeRegistros(m: ModeloVideo): Tabela[] {
  if (!m.derivado.registros.length) return []
  return [tabelaLista('registros-diarios', 'Os registros diários de views', 'tabela de registros diários', ['Registro', 'Views acumuladas', 'Views por dia desde o anterior', 'Esperado (n)'],
    m.derivado.registros.map((_, i) => {
      const p = `modelo.derivado.registros[${i}]`, r = m.derivado.registros[i]!
      return [rotulo(r.registro, `${p}.registro`), base(r.acumuladas, `${p}.acumuladas`), base(r.porDia, `${p}.porDia`), base(r.esperado, `${p}.esperado`)]
    }))]
}

function tabelasDeVersoes(m: ModeloVideo, id: string, titulo: string, nome: string, lista: VersionView[], raiz: string, comTitulo: boolean): Tabela[] {
  const itens = lista.map((v, i) => ({ v, p: `${raiz}[${i}]` })).filter(({ v }) => v.inRange)
  if (!itens.length) return []
  void m
  // a lista de descrições da tela não mostra a média de views/dia (a de títulos e a de miniaturas, sim)
  const saida: Tabela[] = [id === 'versoes-descricoes'
    ? tabelaLista(id, titulo, nome, ['Versão', 'Período', 'No ar por'], itens.map(({ v, p }) => [rotulo(v.label, `${p}.label`), base(v.span, `${p}.span`), medido(v.dur, `${p}.dur`)]))
    : tabelaLista(id, titulo, nome, ['Versão', 'Período', 'No ar por', 'Média de views/dia'],
      itens.map(({ v, p }) => [rotulo(v.label, `${p}.label`), base(v.span, `${p}.span`), medido(v.dur, `${p}.dur`), base(v.rate, `${p}.rate`)]))]
  if (comTitulo) {
    const comTexto = itens.filter(({ v }) => v.clipText !== null)
    if (comTexto.length) saida.push(tabelaLista(`${id}-texto`, `${titulo}: o texto`, `${nome} (texto)`, ['Versão', 'Texto'], comTexto.map(({ v, p }) => [rotulo(v.label, `${p}.label`), terceiros(v.clipText!, `${p}.clipText`)])))
  }
  const marcas = itens.filter(({ v }) => v.tag !== null)
  if (marcas.length) saida.push(tabelaLista(`${id}-marca`, `${titulo}: marcas`, `${nome} (marcas)`, ['Versão', 'Marca'], marcas.map(({ v, p }) => [rotulo(v.label, `${p}.label`), base(v.tag!.text, `${p}.tag.text`)])))
  return saida
}

// G-1 (Gio, portão N3): o "Resumo por imagem" da tela, uma linha por imagem mais o total; os números são os que o modelo já formatou.
function tabelaResumoPorImagem(m: ModeloVideo): Tabela[] {
  const r = m.imageSummary
  if (!r) return []
  const linhas: Celula[][] = r.rows.map((x, i) => {
    const p = `modelo.imageSummary.rows[${i}]`
    return [rotulo(x.label, `${p}.label`), medido(x.dur, `${p}.dur`), medido(String(x.passes), `${p}.passes`), base(x.rate, `${p}.rate`), base(x.segsText, `${p}.segsText`)]
  })
  const t = 'modelo.imageSummary.total'
  return [
    tabelaLista('resumo-por-imagem', 'Resumo por imagem', 'resumo por imagem', ['Imagem', 'No ar', 'Passagens', 'Média de views/dia', 'Quando esteve no ar'], linhas),
    tabelaFixa('resumo-por-imagem-total', 'Resumo por imagem: o total', 'total do resumo por imagem', ['Total', 'No ar', 'Passagens', 'Média de views/dia'],
      [[rotulo(r.total.label, `${t}.label`), medido(r.total.dur, `${t}.dur`), medido(String(r.total.passes), `${t}.passes`), base(r.total.rate, `${t}.rate`)]]),
  ]
}

function tabelasDeComparacoes(m: ModeloVideo): Tabela[] {
  const itens = m.comparisons.map((c, i) => ({ c, p: `modelo.comparisons[${i}]` })).filter(({ c }) => c.inRange)
  if (!itens.length) return []
  // o nome da troca é o que a tela escreve: o `label` na lista, o `chip` nas fichas
  const nome = (c: ComparisonView, p: string): Celula => (m.compare.mode === 'list' ? base(c.label, `${p}.label`) : base(c.chip, `${p}.chip`))
  // A tela mostra uma coisa de cada vez: em poucas trocas, uma ficha por troca (`chip`); em muitas, a lista (troca, quando e situação).
  const saida: Tabela[] = [m.compare.mode === 'list'
    ? tabelaLista('trocas', 'As trocas do vídeo', 'tabela de trocas', ['Troca', 'Quando', 'Situação'],
      itens.map(({ c, p }) => [base(c.label, `${p}.label`), base(c.when, `${p}.when`), base(c.statusLine, `${p}.statusLine`)]))
    : tabelaLista('trocas', 'As trocas do vídeo', 'tabela de trocas', ['Troca'], itens.map(({ c, p }) => [base(c.chip, `${p}.chip`)]))]
  // nas fichas, o nome inteiro da troca só aparece na legenda das janelas do gráfico, que só existe quando a troca tem as janelas medidas
  const comJanelas = itens.filter(({ c }) => c.windows)
  if (m.compare.mode !== 'list' && comJanelas.length) {
    saida.push(tabelaLista('trocas-nome', 'O nome completo de cada troca', 'tabela de nomes das trocas', ['Troca', 'Nome completo'], comJanelas.map(({ c, p }) => [nome(c, p), base(c.label, `${p}.label`)])))
  }
  const comMedias = itens.filter(({ c }) => c.before !== '—' && c.after !== '—')
  if (comMedias.length) {
    saida.push(tabelaLista('trocas-medias', 'As médias de views por dia antes e depois', 'tabela de médias antes e depois', ['Troca', 'Antes (views/dia)', 'Depois (views/dia)'],
      comMedias.map(({ c, p }) => [nome(c, p), medido(c.before, `${p}.before`), medido(c.after, `${p}.after`)])))
  }
  const comEfeito = itens.filter(({ c }) => c.effect.label)
  if (comEfeito.length) {
    saida.push(tabelaLista('trocas-efeito', 'O veredito de cada troca', 'tabela de vereditos', ['Troca', 'Veredito'],
      comEfeito.map(({ c, p }) => [nome(c, p), base(c.effect.label, `${p}.effect.label`)])))
  }
  const notas: Celula[][] = []
  for (const { c, p } of itens) {
    const nota = (t: string | null | undefined, origem: string): void => { if (t) notas.push([nome(c, p), base(t, origem)]) }
    nota(c.nobase?.strong, `${p}.nobase.strong`)
    nota(c.nobase?.text, `${p}.nobase.text`)
    nota(c.full?.what, `${p}.full.what`)
    nota(c.full?.whatWhen, `${p}.full.whatWhen`)
    nota(c.full?.days, `${p}.full.days`)
    nota(c.full?.verdictStrong, `${p}.full.verdictStrong`)
    nota(c.full?.verdictText, `${p}.full.verdictText`)
    nota(c.full?.src, `${p}.full.src`)
    nota(c.full?.second?.strong, `${p}.full.second.strong`)
    nota(c.full?.second?.text, `${p}.full.second.text`)
    c.full?.caveats.forEach((x, k) => nota(x, `${p}.full.caveats[${k}]`))
    c.runLines.forEach((x, k) => nota(x, `${p}.runLines[${k}]`))
  }
  if (notas.length) saida.push(tabelaLista('trocas-notas', 'Notas de cada troca', 'tabela de notas das trocas', ['Troca', 'Nota'], notas))
  return saida
}

function tabelaDeDescricoes(m: ModeloVideo): Tabela[] {
  const d = m.versions?.descs.diffs ?? []
  if (!d.length) return []
  return [tabelaLista('descricoes-trocas', 'As trocas de descrição', 'tabela de trocas de descrição', ['Resumo da troca'], d.map((x, k) => [base(x.sum, `modelo.versions.descs.diffs[${k}].sum`)]))]
}

// ───────────────────────── os blocos citados
const sinal = (r: DiffRow): string => (r.kind === 'add' ? '+ ' : r.kind === 'rem' ? '- ' : r.kind === 'utm' ? '~ ' : r.kind === 'fold' ? '… ' : '  ')
const textoDaLinha = (r: DiffRow): string => (r.kind === 'utm' ? r.from + r.extra : r.text)

/** O texto de cada descrição trocada, linha a linha, preso à linha da tabela de trocas de descrição. */
function citadosDeDescricoes(m: ModeloVideo): BlocoCitado[] {
  return (m.versions?.descs.diffs ?? []).flatMap((df, k): BlocoCitado[] => {
    if (!df.rows.length) return []
    return [{ rotulo: `descrição da troca ${k + 1}`, texto: df.rows.map((r) => sinal(r) + textoDaLinha(r)).join('\n'), origem: `modelo.versions.descs.diffs[${k}].rows`, linha: { tabela: 'descricoes-trocas', posicao: k + 1 } }]
  })
}

function citadosDaLeitura(m: ModeloVideo): BlocoCitado[] {
  const fc = m.forjaCard
  if (!fc) return []
  return (['leitura', 'anterior'] as const).flatMap((k): BlocoCitado[] => {
    const l = fc[k]
    if (!l) return []
    return [{ rotulo: l.selo, texto: [l.lead, ...l.itens.map((i) => `- ${i.texto}`)].join('\n'), origem: `modelo.forjaCard.${k}` }]
  })
}

// ───────────────────────── avisos e definições (frases do próprio modelo)
const presentes = (xs: ReadonlyArray<string | null | undefined>): string[] => xs.filter((x): x is string => typeof x === 'string' && x !== '')

function avisosDe(m: ModeloVideo): string[] {
  const out: string[] = []
  if (m.notFound) return presentes([m.notFound.title, m.notFound.text])
  const h = m.header, c = m.chart, v = m.versions, fc = m.forjaCard
  out.push(SEM_CAUSA)
  if (h) out.push(...presentes([h.sync.text, h.fallback, ...h.counts.map((x) => x.text)]))
  if (c) {
    out.push(...presentes([c.src.bold, c.src.text, c.expectedMethod, c.firstNote?.text, c.stale?.title, c.empty?.title, c.empty?.text, c.empty?.tail, ...(c.pre?.lines ?? [])]))
    if (c.empty?.last) out.push(c.empty.last.at)
  }
  out.push(...presentes([m.derivado.rico.rangeText, m.derivado.rico.compareSum, m.range?.why, m.untracked?.notice, m.compareEmpty, m.pin?.note, m.pager?.position, m.imageSummary?.src, m.imageSummary?.note]))
  if (v) {
    out.push(...presentes([v.thumbs.src, v.thumbs.empty, v.thumbs.more?.srcClosed, v.thumbs.more?.srcOpen, v.titles.src, v.titles.same, v.descs.src, v.descs.same]))
    out.push(...v.thumbs.notes.map((n) => n.text), ...v.descs.notes)
    for (const r of [v.thumbs.runNote, v.titles.runNote]) if (r) out.push(...r.items.flatMap((i) => [i.strong, i.text]), r.def)
    for (const d of v.descs.diffs) out.push(...presentes([d.utmNote]))
  }
  if (fc) {
    out.push(...presentes([fc.frase, fc.andamento, fc.vazio, fc.excluido, fc.botao.motivo, fc.bloqueado?.text, fc.doNicho?.text, fc.doNicho?.foot, ...(fc.doNicho?.items.map((i) => i.text) ?? []), ...(fc.etapas?.map((e) => e.texto) ?? [])]))
    for (const k of ['leitura', 'anterior'] as const) if (fc[k]) out.push(...presentes([fc[k]!.leu, ...fc[k]!.doSite]))
  }
  return out
}

// ───────────────────────── o empacotador
export function empacotarVideo(modelo: ModeloVideo): PacoteModelo {
  const v = modelo.versions
  const tabelas: Tabela[] = modelo.notFound ? [] : [
    ...tabelasDoCabecalho(modelo), ...tabelaDeRegistros(modelo),
    ...(v ? [
      ...tabelasDeVersoes(modelo, 'versoes-titulos', 'As versões do título', 'tabela de versões do título', v.titles.items, 'modelo.versions.titles.items', true),
      ...tabelasDeVersoes(modelo, 'versoes-thumbs', 'As versões da thumbnail', 'tabela de versões da thumbnail', v.thumbs.cards, 'modelo.versions.thumbs.cards', false),
      ...tabelasDeVersoes(modelo, 'versoes-descricoes', 'As versões da descrição', 'tabela de versões da descrição', v.descs.rows, 'modelo.versions.descs.rows', false),
    ] : []),
    ...tabelaResumoPorImagem(modelo), ...tabelasDeComparacoes(modelo), ...tabelaDeDescricoes(modelo),
  ]
  return {
    tela: 'video',
    janela: modelo.video ? `${modelo.video.title}${modelo.range ? `, período de ${modelo.range.value} dias` : ''}` : 'vídeo não encontrado',
    foco: modelo.video ? [{ nome: modelo.video.title, oQueE: 'vídeo', detalhe: modelo.video.channel }] : [],
    tabelas,
    citados: modelo.notFound ? [] : [...citadosDeDescricoes(modelo), ...citadosDaLeitura(modelo)],
    definicoes: [],
    avisos: avisosDe(modelo),
    naoMede: [NAO_MEDE_CAUSA, NAO_MEDE_PRIVADO],
    privado: { estado: 'na' },
    comentarios: { estado: 'na' },
    vazio: modelo.notFound ? `${modelo.notFound.title}. ${modelo.notFound.text}` : null,
    motivoDoMagro: null,
    listasCompletas: true,
  }
}
