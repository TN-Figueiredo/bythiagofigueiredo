/**
 * A5 · E17 degrau 1, Tarefa 7a: o empacotador do canal PRÓPRIO. Puro: nada de banco, de relógio nem de conta; cada número é copiado do campo do
 * modelo, com o texto que o modelo já formatou, e cada célula leva a `origem` (o caminho do campo no modelo) para a prova de paridade.
 *
 * O MODELO daqui (`ModeloCanalProprio`) é o `ProprioView` da tela mais o que a seção "Como o canal está" lê (`comoEsta`, `grafico`, `graficoViews`).
 * Duas arrumações, ambas só de chave e de fallback, sem mudar valor (a mesma razão do `modeloDeComparar`):
 *  - cada vídeo da lista leva `pacote`: as colunas já resolvidas com a mesma palavra que a tela escreve quando falta o número (o componente faz
 *    `impText ?? (semImpressao ? 0 : impMissing)` em dois lugares; aqui isso vira UM par `texto`/`motivo` com exatamente um preenchido);
 *  - cada vídeo ganha uma `ordem` ("Vídeo 3"): as tabelas PRIVADAS identificam o vídeo por ela, nunca pelo título, para o título de terceiros
 *    não se repetir dentro de uma tabela privada (o pacote sem o direito tem o título na tabela pública).
 *
 * Dado privado (spec 8.1.3/4.4): vem do estado que o `montar…` entrega (`EstadoDoPrivado`), nunca de uma frase da tela. Duas leituras: o ALCANCE
 * (impressões, cliques, taxa de clique, vídeos com impressão) e o DIÁRIO (views por dia, % assistido). Cada uma só vai para tabela privada quando
 * foi lida (`ok`); senão o pacote diz o motivo UMA vez (`privado.excluido`) e carrega só as frases de "não medido" que o modelo já escreveu.
 */
import type { ProprioView } from '../_proprio/view-model'
import type { ProprioCell } from '../_proprio/header-model'
import type { ProprioVideoView } from '../_proprio/videos-model'
import type { LinhaVideo, RetencaoView } from '../_proprio/retencao-model'
import { METODO_ASSISTIDO } from '../_proprio/retencao-model'
import type { ComoEstaTop, ComoEstaView } from '../_proprio/como-esta-model'
import type { ImpressoesView } from '../_proprio/impressoes-model'
import { METODO_TAXA_CANAL } from '../_proprio/taxa-faixa-model'
import { AGUARDANDO } from '../_canal/videos-model'
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { Celula, EstadoDoPrivado, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'

// ───────────────────────── o modelo
/** Uma coluna já resolvida: exatamente um dos dois é texto. */
export interface MedidaDoVideo { texto: string | null; motivo: string | null }

export interface ColunasDoVideo {
  ordem: string
  publicado: string
  formato: string
  duracao: MedidaDoVideo
  views: MedidaDoVideo
  multiplo: MedidaDoVideo
  nivel: string | null
  curtidas: MedidaDoVideo
  comentarios: MedidaDoVideo
  /** Do ALCANCE (privado). */
  imp: MedidaDoVideo
  cliques: MedidaDoVideo
  terceira: string | null
  /** Do DIÁRIO (privado). */
  vpdDiario: MedidaDoVideo
}

export interface VideoDoModelo extends ProprioVideoView { pacote: ColunasDoVideo }
export interface LinhaDaRetencao extends LinhaVideo { ordem: string }
export interface TopDoModelo extends ComoEstaTop { ordem: string }

export interface ModeloCanalProprio extends Omit<ProprioView, 'videos' | 'retencao'> {
  videos: Omit<ProprioView['videos'], 'videos'> & { videos: VideoDoModelo[] }
  retencao: Omit<RetencaoView, 'videos'> & { videos: LinhaDaRetencao[] }
  comoEsta: Omit<ComoEstaView, 'top'> & { top: TopDoModelo[] }
  grafico: ImpressoesView
  graficoViews: ImpressoesView
}

const medida = (texto: string | null, motivo: string): MedidaDoVideo => (texto !== null ? { texto, motivo: null } : { texto: null, motivo })

/** A palavra que a Lista escreve quando não há views/dia nem múltiplo (`tabela.tsx`, função `semMedida`). */
const semMedidaDaLista = (v: ProprioVideoView): string =>
  v.aguardando ? AGUARDANDO : v.views == null ? 'sem contagem' : v.grupo === 'fixado-antigo' ? 'fixado antigo' : 'não medido'

const ordemDe = (i: number): string => `Vídeo ${i + 1}`

function colunasDe(v: ProprioVideoView, i: number): ColunasDoVideo {
  return {
    ordem: ordemDe(i),
    publicado: v.pub == null ? 'sem data' : v.ageText ?? 'sem data',
    formato: v.isShort == null ? 'formato não confirmado' : v.isShort ? 'Short' : 'longo',
    duracao: medida(v.isShort ? 'Short' : v.durText, 'sem duração'),
    views: medida(v.viewsText, v.viewsMissing ?? 'sem contagem'),
    multiplo: medida(v.multText, semMedidaDaLista(v)),
    nivel: v.multWord,
    curtidas: medida(v.likesText, 'não medido'),
    comentarios: medida(v.commentsText, 'não medido'),
    imp: v.impText !== null ? medida(v.impText, '') : v.semImpressao ? medida('0', '') : medida(null, v.impMissing ?? 'não medido'),
    cliques: v.cliquesText !== null ? medida(v.cliquesText, '') : v.semImpressao ? medida('0', '') : medida(null, v.cliquesMissing ?? 'não medido'),
    terceira: v.terceira === '' ? null : v.terceira,
    vpdDiario: medida(v.vpdDiarioText, 'não medido'),
  }
}

export function modeloDeCanalProprio(pv: ProprioView, ce: { view: ComoEstaView; grafico: ImpressoesView; graficoViews: ImpressoesView }): ModeloCanalProprio {
  const videos = pv.videos.videos.map((v, i): VideoDoModelo => ({ ...v, pacote: colunasDe(v, i) }))
  const ordemPorId = new Map(videos.map((v) => [v.id, v.pacote.ordem]))
  const ordem = (id: string): string => ordemPorId.get(id) ?? 'Vídeo fora da lista'
  return {
    ...pv,
    videos: { ...pv.videos, videos },
    retencao: { ...pv.retencao, videos: pv.retencao.videos.map((l): LinhaDaRetencao => ({ ...l, ordem: ordem(l.id) })) },
    comoEsta: { ...ce.view, top: ce.view.top.map((t): TopDoModelo => ({ ...t, ordem: ordem(t.id) })) },
    grafico: ce.grafico,
    graficoViews: ce.graficoViews,
  }
}

// ───────────────────────── o inventário de folhas (item 160)
const REP = { descartado: 'repetido' } as const
const CTRL = { descartado: 'controle de tela' } as const
const APAR = { descartado: 'aparência' } as const
const END = { descartado: 'endereço' } as const
const IDENT = { descartado: 'identificador' } as const
const IMG = { descartado: 'imagem' } as const

function inventarioDeColunasDeGrafico(p: 'grafico' | 'graficoViews'): Inventario {
  return {
    [`${p}.teto`]: APAR, [`${p}.ticks[]`]: APAR, [`${p}.alturaArea`]: APAR, [`${p}.escopo`]: CTRL, [`${p}.unidade`]: CTRL, [`${p}.faixaCliques`]: CTRL,
    [`${p}.colunas[].dia`]: REP, // a data escrita é `rotulo`
    [`${p}.colunas[].rotulo`]: 'rotulo',
    [`${p}.colunas[].situacao`]: CTRL,
    [`${p}.colunas[].dica`]: 'motivo', // a frase do dia: é o motivo de um número de cliques não medido
    [`${p}.colunas[].situacaoTexto`]: 'base', // a situação do dia por extenso: vai numa coluna própria da tabela
    [`${p}.colunas[].marca`]: APAR, [`${p}.colunas[].publicacao`]: CTRL, [`${p}.colunas[].alturaPx`]: APAR,
    [`${p}.colunas[].imp`]: 'serie',
    [`${p}.colunas[].cliques`]: 'serie',
    [`${p}.colunas[].cliquesFaixa`]: REP, // o mesmo valor de `cliques`, na forma curta da faixa sob as datas
    [`${p}.periodoTexto`]: 'base',
    [`${p}.vazio`]: 'base',
    [`${p}.legenda[].situacao`]: APAR, [`${p}.legenda[].texto`]: APAR, // a chave das cores e dos símbolos do desenho
    [`${p}.resumo`]: 'base',
    [`${p}.avisos[]`]: 'base',
    [`${p}.metodo[]`]: 'base', // o ⓘ do gráfico: vai nas definições
    [`${p}.rotuloEixo`]: 'rotulo', [`${p}.rotuloValor`]: 'rotulo', [`${p}.rotuloSituacao`]: 'rotulo',
  }
}

const MEDIDA = (c: string): Inventario => ({ [`${c}.texto`]: 'numero', [`${c}.motivo`]: 'motivo' })

export const INVENTARIO_CANAL_PROPRIO: Inventario = {
  // cabeçalho
  'header.id': IDENT, 'header.name': 'terceiros', 'header.handle': 'rotulo', 'header.url': END, 'header.avatar': IMG, 'header.ini': APAR, 'header.color': APAR,
  'header.lang.code': APAR, 'header.lang.title': APAR,
  ...Object.fromEntries(['faixa', 'todos'].flatMap((g) => [
    [`header.${g}[].key`, IDENT], [`header.${g}[].label`, 'rotulo'], [`header.${g}[].value`, 'numero'], [`header.${g}[].missing`, 'motivo'],
    [`header.${g}[].base`, 'base'], [`header.${g}[].sub`, 'base'], [`header.${g}[].n`, 'base'],
    [`header.${g}[].fraco`, APAR], [`header.${g}[].parado`, CTRL], [`header.${g}[].semNumero`, CTRL], [`header.${g}[].explicada`, CTRL],
  ])),
  'header.resumo.destaque': 'base', 'header.resumo.parado': CTRL, 'header.resumo.resto': 'base',
  'header.faixaMotivo': REP, 'header.todosMotivo': REP, // junta o `missing` de cada célula sem número, que a tabela já leva
  'header.sync': 'base',
  'header.posicaoLinha': REP, // é a junção de `posicaoItens`
  'header.posicaoItens.intro': 'base', 'header.posicaoItens.itens[].chave': IDENT, 'header.posicaoItens.itens[].href': END, 'header.posicaoItens.itens[].texto': 'base',
  // a lista de vídeos
  'videos.nota': 'base', 'videos.semVideos': 'base', 'videos.viewsPorDiaFrase': 'base', 'videos.motivoAlcance': 'base',
  'videos.videos[].id': IDENT, 'videos.videos[].ytId': IDENT, 'videos.videos[].url': END, 'videos.videos[].grupo': CTRL,
  'videos.videos[].title': 'terceiros',
  ...Object.fromEntries([
    'pub', 'views', 'vpd7', 'mult', 'isShort', 'pinned', 'tracked', 'dur', 'likes', 'comments', 'swaps', 'pubISO', 'pubTitle', 'multTier', 'aguardando',
    'semImpressao', 'imp', 'cliques', 'vpdDiario',
  ].map((k) => [`videos.videos[].${k}`, REP])), // os brutos para ordenar e filtrar no navegador; o texto escrito está em `pacote`
  ...Object.fromEntries([
    'thumbSrc', 'viewer.*', 'pin', 'pin.*',
  ].map((k) => [`videos.videos[].${k}`, k.startsWith('thumb') ? IMG : k.startsWith('viewer') ? IMG : CTRL])),
  ...Object.fromEntries([
    'durText', 'ageText', 'viewsText', 'viewsMissing', 'vpdText', 'multText', 'multWord', 'semMedida', 'likesText', 'commentsText', 'impText', 'impMissing',
    'cliquesText', 'cliquesMissing', 'terceira', 'vpdDiarioText', 'vpdDiarioMissing', 'notas[]', 'badges[]',
  ].map((k) => [`videos.videos[].${k}`, REP])), // o texto resolvido está em `pacote`
  'videos.videos[].pacote.ordem': 'rotulo', 'videos.videos[].pacote.publicado': 'base', 'videos.videos[].pacote.formato': 'rotulo',
  ...MEDIDA('videos.videos[].pacote.duracao'), ...MEDIDA('videos.videos[].pacote.views'), ...MEDIDA('videos.videos[].pacote.multiplo'),
  'videos.videos[].pacote.nivel': 'base',
  ...MEDIDA('videos.videos[].pacote.curtidas'), ...MEDIDA('videos.videos[].pacote.comentarios'),
  ...MEDIDA('videos.videos[].pacote.imp'), ...MEDIDA('videos.videos[].pacote.cliques'),
  'videos.videos[].pacote.terceira': 'base',
  'videos.videos[].pacote.vpdDiario.texto': 'numero', 'videos.videos[].pacote.vpdDiario.motivo': 'base',
  // a aba % assistido
  'retencao.estado': CTRL, 'retencao.titulo': 'rotulo', 'retencao.nota': 'base', 'retencao.vazio': 'base', 'retencao.semPercentual': 'base',
  'retencao.relance': REP, 'retencao.relance.negrito': 'base', 'retencao.relance.resto': 'base',
  'retencao.faixas[].rotulo': 'rotulo', 'retencao.faixas[].videos': 'numero', 'retencao.faixas[].normal': 'numero', 'retencao.faixas[].estado': CTRL, 'retencao.faixas[].texto': 'motivo',
  'retencao.videos[].id': IDENT, 'retencao.videos[].titulo': REP, 'retencao.videos[].href': END, 'retencao.videos[].ordem': 'rotulo',
  'retencao.videos[].faixa': 'base', 'retencao.videos[].views28': 'numero', 'retencao.videos[].cobertura': 'base', 'retencao.videos[].pct': 'numero',
  'retencao.videos[].barra': APAR, 'retencao.videos[].acimaDe100': CTRL, 'retencao.videos[].normalPos': APAR, 'retencao.videos[].nViews': 'base',
  'retencao.videos[].alt': REP, 'retencao.videos[].alvo': CTRL,
  'retencao.videos[].contra.leitura': CTRL, 'retencao.videos[].contra.sinal': APAR, 'retencao.videos[].contra.pontos': REP, 'retencao.videos[].contra.texto': 'base',
  // a tela
  'state.*': CTRL, compararHref: END, compararTitulo: CTRL,
  'abas.trocas': 'base', 'abas.leitura': 'base', 'abasNota.trocas': 'base', 'abasNota.leitura': 'base',
  // "Como o canal está"
  'comoEsta.recolhida': REP, // a primeira metade é a frase do topo e a segunda é a posição, que o cabeçalho já leva
  'comoEsta.frase': 'base', 'comoEsta.topVazio': 'base', 'comoEsta.topNota': 'base',
  'comoEsta.top[].id': IDENT, 'comoEsta.top[].titulo': REP, 'comoEsta.top[].href': END, 'comoEsta.top[].thumb': IMG, 'comoEsta.top[].ordem': 'rotulo',
  'comoEsta.top[].imp': 'numero', 'comoEsta.top[].cliques': 'numero', 'comoEsta.top[].dias': 'base',
  'comoEsta.noNicho.intro': REP, 'comoEsta.noNicho.linhas[].texto': REP, 'comoEsta.noNicho.linhas[].href': END, // as mesmas do cabeçalho
  'comoEsta.noNicho.opcoes[].id': IDENT, 'comoEsta.noNicho.opcoes[].name': CTRL, 'comoEsta.noNicho.acao': END, 'comoEsta.noNicho.listaHref': END,
  'comoEsta.naoMedido[].rotulo': 'rotulo', 'comoEsta.naoMedido[].texto': 'base',
  'comoEsta.taxa.titulo': 'rotulo', 'comoEsta.taxa.frase': REP, 'comoEsta.taxa.frase[].t': 'base', 'comoEsta.taxa.frase[].b': APAR,
  'comoEsta.taxa.faixa': REP, 'comoEsta.taxa.faixa.alt': REP, 'comoEsta.taxa.faixa.topo': APAR, 'comoEsta.taxa.faixa.eixo[].pos': APAR, 'comoEsta.taxa.faixa.eixo[].txt': APAR,
  'comoEsta.taxa.faixa.linhas[].rotulo': 'rotulo', 'comoEsta.taxa.faixa.linhas[].nota': 'base', 'comoEsta.taxa.faixa.linhas[].classe': APAR,
  'comoEsta.taxa.faixa.linhas[].inconclusiva': CTRL, 'comoEsta.taxa.faixa.linhas[].valor': 'numero', 'comoEsta.taxa.faixa.linhas[].loTxt': 'numero',
  'comoEsta.taxa.faixa.linhas[].hiTxt': 'numero', 'comoEsta.taxa.faixa.linhas[].lo': APAR, 'comoEsta.taxa.faixa.linhas[].p': APAR, 'comoEsta.taxa.faixa.linhas[].hi': APAR,
  'comoEsta.taxa.vazio': 'base', 'comoEsta.taxa.nota': 'base',
  ...inventarioDeColunasDeGrafico('grafico'),
  ...inventarioDeColunasDeGrafico('graficoViews'),
}

/** Folhas de número cru: o componente escreve, o empacotador usa o MESMO texto por nome. Nenhuma neste modelo: tudo o que a tela escreve já é texto no modelo. */
export const SEM_PROVA_POR_IGUALDADE_DIRETA_CANAL_PROPRIO = [] as const

// ───────────────────────── textos do pacote que esta tela escreve
// TEXTO-A-REVISAR (Logan/Naksu): as frases abaixo.
export const AVISO_PARCIAL_PROPRIO = 'Parte do dado privado do canal não foi lida agora.'
export const ITENS_PRIVADOS_PROPRIO = 'impressões, cliques estimados, taxa de clique, views por dia dos vídeos e % assistido'
const NAO_MEDE_CAUSA = 'a causa de uma mudança nos números: nada aqui prova que uma capa ou um título fez a diferença'
const NAO_MEDE_OUTROS = 'impressões, taxa de clique e % assistido de outros canais: o YouTube só os entrega ao dono do canal'
const TITULO_PRIVADO = ', dado privado do canal'

// ───────────────────────── células
const rot = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const bas = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const ter = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })
const ehZero = (texto: string): boolean => /^0(\s|$)/.test(texto)

function numero(texto: string | null, motivo: string | null, origemTexto: string, origemMotivo: string): Celula {
  if (texto === null || texto === '') return { papel: 'numero', estado: 'nao_medido', motivo: motivo === null || motivo === '' ? A_TELA_NAO_INFORMA_O_MOTIVO : motivo, origem: origemMotivo }
  return ehZero(texto) ? { papel: 'numero', estado: 'zero_medido', texto, x: 0, origem: origemTexto } : { papel: 'numero', estado: 'medido', texto, x: null, origem: origemTexto }
}

const daMedida = (m: MedidaDoVideo, o: string): Celula => numero(m.texto, m.motivo, `${o}.texto`, `${o}.motivo`)

// ───────────────────────── as leituras privadas
type Acesso = 'ok' | 'negado' | 'erro'
const leituraDe = (e: EstadoDoPrivado, id: string): { diario: Acesso; alcance: Acesso } => {
  const x = e.acessoPorCanal[id]
  // leitura que o `montar…` não registrou conta como falha: nunca como "lida" nem como "sem direito"
  return { diario: x?.diario ?? 'erro', alcance: x?.alcance ?? 'erro' }
}

/** Quais células do cabeçalho vêm de qual leitura. As outras são públicas. */
const CHAVES_DO_ALCANCE = ['impressoes', 'diasComImpressao', 'cliques', 'taxaClique', 'videosComImpressao'] as const
const CHAVES_DO_DIARIO = ['vpdVideo', 'assistido'] as const
const daLeitura = (key: string): 'alcance' | 'diario' | null =>
  (CHAVES_DO_ALCANCE as readonly string[]).includes(key) ? 'alcance' : (CHAVES_DO_DIARIO as readonly string[]).includes(key) ? 'diario' : null

// ───────────────────────── tabelas
function linhaDoCabecalho(c: ProprioCell, o: string): Celula[] {
  return [rot(c.label, `${o}.label`), numero(c.value, c.missing, `${o}.value`, c.missing ? `${o}.missing` : `${o}.value`), bas(c.base, `${o}.base`)]
}

function tabelasDoCabecalho(m: ModeloCanalProprio, privada: boolean, leitura: 'alcance' | 'diario' | null): Tabela[] {
  const p = privada ? 'privado-' : ''
  const sufixo = privada ? TITULO_PRIVADO : ''
  const todas: Array<{ c: ProprioCell; o: string }> = [
    ...m.header.faixa.map((c, i) => ({ c, o: `modelo.header.faixa[${i}]` })),
    ...m.header.todos.map((c, i) => ({ c, o: `modelo.header.todos[${i}]` })),
  ]
  const dela = todas.filter(({ c }) => (privada ? daLeitura(c.key) === leitura : daLeitura(c.key) === null))
  if (dela.length === 0) return []
  const idDe = leitura ?? 'publico'
  const saida: Tabela[] = [{
    id: `${p}cabecalho-${idDe}`, titulo: `Números do cabeçalho do canal${sufixo}`, tipo: 'fixa', nomeNoCorte: privada ? `tabela do cabeçalho (${leitura})` : 'tabela do cabeçalho', privada,
    colunas: ['Medida', 'Valor', 'Base'], linhas: dela.map(({ c, o }) => linhaDoCabecalho(c, o)),
  }]
  const notas: Celula[][] = []
  for (const { c, o } of dela) {
    if (c.sub) notas.push([rot(c.label, `${o}.label`), bas(c.sub, `${o}.sub`)])
    if (c.n) notas.push([rot(c.label, `${o}.label`), bas(String(c.n), `${o}.n`)])
  }
  if (notas.length) {
    saida.push({
      id: `${p}cabecalho-${idDe}-notas`, titulo: `Nota de cada número do cabeçalho${sufixo}`, tipo: 'fixa', nomeNoCorte: privada ? `tabela de notas do cabeçalho (${leitura})` : 'tabela de notas do cabeçalho',
      privada, colunas: ['Medida', 'Nota'], linhas: notas,
    })
  }
  return saida
}

function tabelaDoResumo(m: ModeloCanalProprio): Tabela[] {
  const r = m.header.resumo
  if (!r) return []
  return [{
    id: 'resumo-do-canal', titulo: 'Resumo do canal', tipo: 'fixa', nomeNoCorte: 'resumo do canal', privada: false, colunas: ['Resumo'],
    linhas: [[bas(r.destaque, 'modelo.header.resumo.destaque')]],
  }]
}

function tabelaDaPosicao(m: ModeloCanalProprio): Tabela[] {
  const pos = m.header.posicaoItens
  if (!pos) return []
  return [{
    id: 'posicao-no-nicho', titulo: 'Posição entre os canais do site', tipo: 'fixa', nomeNoCorte: 'tabela de posição', privada: false, colunas: ['Posição'],
    linhas: [[bas(pos.intro, 'modelo.header.posicaoItens.intro')], ...pos.itens.map((x, i): Celula[] => [bas(x.texto, `modelo.header.posicaoItens.itens[${i}].texto`)])],
  }]
}

function tabelasDosVideos(m: ModeloCanalProprio): Tabela[] {
  const vs = m.videos.videos
  if (vs.length === 0) return []
  const linhas = vs.map((v, i): Celula[] => {
    const o = `modelo.videos.videos[${i}]`
    const p = `${o}.pacote`
    return [
      rot(v.pacote.ordem, `${p}.ordem`), ter(v.title, `${o}.title`), bas(v.pacote.publicado, `${p}.publicado`), rot(v.pacote.formato, `${p}.formato`),
      daMedida(v.pacote.duracao, `${p}.duracao`), daMedida(v.pacote.views, `${p}.views`), daMedida(v.pacote.multiplo, `${p}.multiplo`),
      daMedida(v.pacote.curtidas, `${p}.curtidas`), daMedida(v.pacote.comentarios, `${p}.comentarios`),
    ]
  })
  const niveis = vs.flatMap((v, i): Celula[][] => (v.pacote.nivel === null ? [] : [[rot(v.pacote.ordem, `modelo.videos.videos[${i}].pacote.ordem`), bas(v.pacote.nivel, `modelo.videos.videos[${i}].pacote.nivel`)]]))
  const saida: Tabela[] = [{
    id: 'videos-do-canal', titulo: 'Vídeos do canal', tipo: 'lista', nomeNoCorte: 'tabela de vídeos do canal', privada: false,
    colunas: ['Vídeo', 'Título', 'Publicado', 'Formato', 'Duração', 'Views', 'Múltiplo', 'Curtidas', 'Comentários'], linhas,
  }]
  if (niveis.length) {
    saida.push({
      id: 'videos-do-canal-nivel', titulo: 'Vídeos do canal, nível do múltiplo', tipo: 'lista', nomeNoCorte: 'tabela de nível do múltiplo', privada: false,
      colunas: ['Vídeo', 'Nível'], linhas: niveis,
    })
  }
  return saida
}

function tabelasDeAlcanceDosVideos(m: ModeloCanalProprio): Tabela[] {
  const vs = m.videos.videos
  if (vs.length === 0) return []
  const linhas = vs.map((v, i): Celula[] => {
    const p = `modelo.videos.videos[${i}].pacote`
    return [rot(v.pacote.ordem, `${p}.ordem`), daMedida(v.pacote.imp, `${p}.imp`), daMedida(v.pacote.cliques, `${p}.cliques`)]
  })
  const terceiras = vs.flatMap((v, i): Celula[][] => (v.pacote.terceira === null ? [] : [[rot(v.pacote.ordem, `modelo.videos.videos[${i}].pacote.ordem`), bas(v.pacote.terceira, `modelo.videos.videos[${i}].pacote.terceira`)]]))
  const saida: Tabela[] = [{
    id: 'privado-alcance-dos-videos', titulo: `Alcance de cada vídeo${TITULO_PRIVADO}`, tipo: 'lista', nomeNoCorte: 'tabela de alcance dos vídeos', privada: true,
    colunas: ['Vídeo', 'Impressões', 'Cliques estimados'], linhas,
  }]
  if (terceiras.length) {
    saida.push({
      id: 'privado-alcance-dos-videos-nota', titulo: `O que as impressões permitem afirmar de cada vídeo${TITULO_PRIVADO}`, tipo: 'lista', nomeNoCorte: 'tabela de notas de alcance dos vídeos', privada: true,
      colunas: ['Vídeo', 'Nota'], linhas: terceiras,
    })
  }
  return saida
}

function tabelaDeViewsDosVideos(m: ModeloCanalProprio): Tabela[] {
  const vs = m.videos.videos
  if (vs.length === 0) return []
  return [{
    id: 'privado-views-por-dia-dos-videos', titulo: `Views por dia de cada vídeo${TITULO_PRIVADO}`, tipo: 'lista', nomeNoCorte: 'tabela de views por dia dos vídeos', privada: true,
    colunas: ['Vídeo', 'Views por dia'],
    linhas: vs.map((v, i): Celula[] => [rot(v.pacote.ordem, `modelo.videos.videos[${i}].pacote.ordem`), v.pacote.vpdDiario.texto === null ? bas(v.pacote.vpdDiario.motivo ?? 'não medido', `modelo.videos.videos[${i}].pacote.vpdDiario.motivo`) : daMedida(v.pacote.vpdDiario, `modelo.videos.videos[${i}].pacote.vpdDiario`)]),
  }]
}

/** O gráfico dia a dia: uma linha por dia. `comCliques` só no de impressões. */
function tabelaDoGrafico(g: ImpressoesView, chave: 'grafico' | 'graficoViews', id: string, titulo: string, comCliques: boolean): Tabela[] {
  if (g.colunas.length === 0) return []
  const linhas = g.colunas.map((c, i): Celula[] => {
    const o = `modelo.${chave}.colunas[${i}]`
    const linha: Celula[] = [rot(c.rotulo, `${o}.rotulo`), numero(c.imp, c.dica, `${o}.imp`, `${o}.dica`)]
    if (comCliques) linha.push(numero(c.cliques, c.dica, `${o}.cliques`, `${o}.dica`))
    linha.push(bas(c.situacaoTexto, `${o}.situacaoTexto`))
    return linha
  })
  return [{
    id, titulo: `${titulo}${TITULO_PRIVADO}`, tipo: 'dia_a_dia', nomeNoCorte: chave === 'grafico' ? 'impressões por dia' : 'views por dia', privada: true,
    colunas: comCliques ? ['Dia', g.rotuloValor, 'Cliques estimados', g.rotuloSituacao] : ['Dia', g.rotuloValor, g.rotuloSituacao], linhas,
  }]
}

function tabelaDeProsa(id: string, titulo: string, linhas: Array<[string, string]>): Tabela[] {
  return linhas.length === 0 ? [] : [{ id, titulo: `${titulo}${TITULO_PRIVADO}`, tipo: 'fixa', nomeNoCorte: titulo.toLowerCase(), privada: true, colunas: ['Texto'], linhas: linhas.map(([t, o]) => [bas(t, o)]) }]
}

const naoVazio = (t: string | null): t is string => t !== null && t !== ''

/** As frases do alcance em prosa (a frase do topo, o resumo do gráfico, os avisos), todas do ALCANCE lido. */
function prosaDoAlcance(m: ModeloCanalProprio): Tabela[] {
  const linhas: Array<[string, string]> = []
  const r = m.header.resumo
  if (r && naoVazio(r.resto)) linhas.push([r.resto, 'modelo.header.resumo.resto'])
  const c = m.comoEsta
  if (naoVazio(c.frase)) linhas.push([c.frase, 'modelo.comoEsta.frase'])
  if (naoVazio(c.topVazio)) linhas.push([c.topVazio, 'modelo.comoEsta.topVazio'])
  if (naoVazio(c.topNota)) linhas.push([c.topNota, 'modelo.comoEsta.topNota'])
  c.taxa.faixa?.linhas.forEach((l, i) => { if (naoVazio(l.nota)) linhas.push([l.nota, `modelo.comoEsta.taxa.faixa.linhas[${i}].nota`]) })
  if (naoVazio(c.taxa.vazio)) linhas.push([c.taxa.vazio, 'modelo.comoEsta.taxa.vazio'])
  c.taxa.frase?.forEach((x, i) => { if (naoVazio(x.t)) linhas.push([x.t, `modelo.comoEsta.taxa.frase[${i}].t`]) })
  if (naoVazio(c.taxa.nota)) linhas.push([c.taxa.nota, 'modelo.comoEsta.taxa.nota'])
  const g = m.grafico
  if (naoVazio(g.vazio)) linhas.push([g.vazio, 'modelo.grafico.vazio'])
  if (naoVazio(g.periodoTexto)) linhas.push([g.periodoTexto, 'modelo.grafico.periodoTexto'])
  if (naoVazio(g.resumo)) linhas.push([g.resumo, 'modelo.grafico.resumo'])
  g.avisos.forEach((a, i) => linhas.push([a, `modelo.grafico.avisos[${i}]`]))
  if (naoVazio(m.videos.motivoAlcance)) linhas.push([m.videos.motivoAlcance, 'modelo.videos.motivoAlcance'])
  return tabelaDeProsa('privado-alcance-em-frases', 'Alcance do canal, em frases', linhas)
}

function prosaDoDiario(m: ModeloCanalProprio): Tabela[] {
  const linhas: Array<[string, string]> = []
  const g = m.graficoViews
  if (naoVazio(g.vazio)) linhas.push([g.vazio, 'modelo.graficoViews.vazio'])
  if (naoVazio(g.periodoTexto)) linhas.push([g.periodoTexto, 'modelo.graficoViews.periodoTexto'])
  if (naoVazio(g.resumo)) linhas.push([g.resumo, 'modelo.graficoViews.resumo'])
  g.avisos.forEach((a, i) => linhas.push([a, `modelo.graficoViews.avisos[${i}]`]))
  if (naoVazio(m.videos.viewsPorDiaFrase)) linhas.push([m.videos.viewsPorDiaFrase, 'modelo.videos.viewsPorDiaFrase'])
  return tabelaDeProsa('privado-views-em-frases', 'Views por dia do canal, em frases', linhas)
}

function tabelaDoTop(m: ModeloCanalProprio): Tabela[] {
  const top = m.comoEsta.top
  if (top.length === 0) return []
  return [{
    id: 'privado-videos-que-mais-apareceram', titulo: `Vídeos que mais apareceram${TITULO_PRIVADO}`, tipo: 'fixa', nomeNoCorte: 'tabela dos vídeos que mais apareceram', privada: true,
    colunas: ['Vídeo', 'Impressões', 'Cliques estimados', 'Dias'],
    linhas: top.map((t, i): Celula[] => {
      const o = `modelo.comoEsta.top[${i}]`
      return [rot(t.ordem, `${o}.ordem`), numero(t.imp, null, `${o}.imp`, `${o}.imp`), numero(t.cliques, null, `${o}.cliques`, `${o}.cliques`), bas(t.dias, `${o}.dias`)]
    }),
  }]
}

function tabelaDaTaxa(m: ModeloCanalProprio): Tabela[] {
  const f = m.comoEsta.taxa.faixa
  if (!f || f.linhas.length === 0) return []
  return [{
    id: 'privado-taxa-de-clique-do-canal', titulo: `Taxa de clique do canal${TITULO_PRIVADO}`, tipo: 'fixa', nomeNoCorte: 'tabela da taxa de clique', privada: true,
    colunas: ['Taxa', 'Intervalo de 95%, de', 'Intervalo de 95%, até'],
    linhas: f.linhas.map((l, i): Celula[] => {
      const o = `modelo.comoEsta.taxa.faixa.linhas[${i}]`
      return [numero(l.valor, null, `${o}.valor`, `${o}.valor`), numero(l.loTxt, null, `${o}.loTxt`, `${o}.loTxt`), numero(l.hiTxt, null, `${o}.hiTxt`, `${o}.hiTxt`)]
    }),
  }]
}

function tabelasDaRetencao(m: ModeloCanalProprio): Tabela[] {
  const r = m.retencao
  const saida: Tabela[] = []
  if (r.faixas.length) {
    saida.push({
      id: 'privado-assistido-faixas', titulo: `% assistido normal de cada faixa de duração${TITULO_PRIVADO}`, tipo: 'fixa', nomeNoCorte: 'tabela das faixas do % assistido', privada: true,
      colunas: ['Faixa', 'Vídeos', 'Normal'],
      linhas: r.faixas.map((f, i): Celula[] => {
        const o = `modelo.retencao.faixas[${i}]`
        return [rot(f.rotulo, `${o}.rotulo`), numero(String(f.videos), null, `${o}.videos`, `${o}.videos`), numero(f.normal, f.texto, `${o}.normal`, f.texto ? `${o}.texto` : `${o}.normal`)]
      }),
    })
  }
  if (r.videos.length) {
    saida.push({
      id: 'privado-assistido-por-video', titulo: `% assistido de cada vídeo${TITULO_PRIVADO}`, tipo: 'lista', nomeNoCorte: 'tabela do % assistido por vídeo', privada: true,
      colunas: ['Vídeo', 'Faixa de duração', 'Views em 28 dias', '% assistido', 'Contra o normal da faixa'],
      linhas: r.videos.map((v, i): Celula[] => {
        const o = `modelo.retencao.videos[${i}]`
        return [rot(v.ordem, `${o}.ordem`), bas(v.faixa, `${o}.faixa`), numero(v.views28, null, `${o}.views28`, `${o}.views28`), numero(v.pct, null, `${o}.pct`, `${o}.pct`), bas(v.contra.texto, `${o}.contra.texto`)]
      }),
    })
    const notas = r.videos.flatMap((v, i): Celula[][] => {
      const o = `modelo.retencao.videos[${i}]`
      return [
        ...(naoVazio(v.cobertura) ? [[rot(v.ordem, `${o}.ordem`), bas(v.cobertura, `${o}.cobertura`)]] : []),
        ...(naoVazio(v.nViews) ? [[rot(v.ordem, `${o}.ordem`), bas(v.nViews, `${o}.nViews`)]] : []),
      ]
    })
    if (notas.length) {
      saida.push({
        id: 'privado-assistido-por-video-notas', titulo: `Nota do % assistido de cada vídeo${TITULO_PRIVADO}`, tipo: 'lista', nomeNoCorte: 'tabela de notas do % assistido', privada: true,
        colunas: ['Vídeo', 'Nota'], linhas: notas,
      })
    }
  }
  const frases: Array<[string, string]> = []
  if (naoVazio(r.nota)) frases.push([r.nota, 'modelo.retencao.nota'])
  if (naoVazio(r.vazio)) frases.push([r.vazio, 'modelo.retencao.vazio'])
  if (r.relance) { frases.push([r.relance.negrito, 'modelo.retencao.relance.negrito']); if (naoVazio(r.relance.resto)) frases.push([r.relance.resto, 'modelo.retencao.relance.resto']) }
  if (naoVazio(r.semPercentual)) frases.push([r.semPercentual, 'modelo.retencao.semPercentual'])
  return [...saida, ...tabelaDeProsa('privado-assistido-em-frases', '% assistido, em frases', frases)]
}

/** As frases de "não medido" que o modelo escreveu no lugar do dado privado: texto do site, sem número do canal. Distintas, na ordem em que aparecem. */
function motivosDoModelo(m: ModeloCanalProprio, leitura: 'alcance' | 'diario'): string[] {
  const todos: Array<string | null> = []
  if (leitura === 'alcance') {
    for (const c of [...m.header.faixa, ...m.header.todos]) if (daLeitura(c.key) === 'alcance') todos.push(c.value === null ? c.missing : null)
    todos.push(m.comoEsta.frase, m.comoEsta.topVazio, m.comoEsta.taxa.vazio, m.grafico.vazio, m.videos.motivoAlcance)
    todos.push(...m.videos.videos.flatMap((v) => [v.impMissing, v.cliquesMissing]))
    todos.push(m.header.resumo?.resto ?? null)
  } else {
    for (const c of [...m.header.faixa, ...m.header.todos]) if (daLeitura(c.key) === 'diario') todos.push(c.value === null ? c.missing : null)
    todos.push(m.graficoViews.vazio, m.videos.viewsPorDiaFrase, m.retencao.vazio, m.retencao.nota)
  }
  return [...new Set(todos.filter(naoVazio))]
}

// ───────────────────────── o empacotador
export function empacotarCanalProprio(m: ModeloCanalProprio, privado: EstadoDoPrivado): PacoteModelo {
  const { alcance, diario } = leituraDe(privado, m.header.id)
  const falhou = alcance === 'erro' || diario === 'erro'

  const publicas: Tabela[] = [
    ...tabelasDoCabecalho(m, false, null), ...tabelaDoResumo(m), ...tabelaDaPosicao(m), ...tabelasDosVideos(m),
  ]
  const privadas: Tabela[] = []
  const avisos: string[] = []
  const avisosPrivados: string[] = []
  const definicoes: PacoteModelo['definicoes'] = []

  if (alcance === 'ok') {
    privadas.push(
      ...tabelasDoCabecalho(m, true, 'alcance'), ...prosaDoAlcance(m), ...tabelaDaTaxa(m), ...tabelaDoTop(m), ...tabelasDeAlcanceDosVideos(m),
      ...tabelaDoGrafico(m.grafico, 'grafico', 'privado-impressoes-por-dia', 'Impressões por dia do canal', true),
    )
    for (const [i, p] of m.grafico.metodo.entries()) definicoes.push({ medida: `Como ler o gráfico de impressões (${i + 1})`, frase: p, limiares: [], privado: true })
    for (const p of METODO_TAXA_CANAL) definicoes.push({ medida: 'Como a taxa de clique é calculada', frase: p, limiares: [], privado: true })
  } else {
    avisos.push(...motivosDoModelo(m, 'alcance'))
  }
  if (diario === 'ok') {
    privadas.push(
      ...tabelasDoCabecalho(m, true, 'diario'), ...prosaDoDiario(m), ...tabelaDeViewsDosVideos(m), ...tabelasDaRetencao(m),
      ...tabelaDoGrafico(m.graficoViews, 'graficoViews', 'privado-views-por-dia', 'Views por dia, soma dos vídeos', false),
    )
    for (const [i, p] of m.graficoViews.metodo.entries()) definicoes.push({ medida: `Como ler o gráfico de views (${i + 1})`, frase: p, limiares: [], privado: true })
    for (const p of METODO_ASSISTIDO) definicoes.push({ medida: 'De onde vem o % assistido', frase: p, limiares: [], privado: true })
  } else {
    avisos.push(...motivosDoModelo(m, 'diario'))
  }

  // o estado do dado privado (seção 4.4): só o que o `montar…` entregou, nunca uma frase da tela
  let estadoPrivado: PacoteModelo['privado']
  if (privadas.length > 0) {
    estadoPrivado = { estado: 'incluido', itens: ITENS_PRIVADOS_PROPRIO }
    if (falhou) avisos.push(AVISO_PARCIAL_PROPRIO)
  } else if (falhou) estadoPrivado = { estado: 'excluido', motivo: 'leitura_falhou', itens: ITENS_PRIVADOS_PROPRIO }
  else if (privado.negativa === 'sem_direito') estadoPrivado = { estado: 'excluido', motivo: 'sem_direito', itens: ITENS_PRIVADOS_PROPRIO }
  else estadoPrivado = { estado: 'excluido', motivo: 'nao_conferido', itens: ITENS_PRIVADOS_PROPRIO }

  if (naoVazio(m.videos.nota)) avisos.push(m.videos.nota)
  if (naoVazio(m.videos.semVideos)) avisos.push(m.videos.semVideos)

  const naoMede = [NAO_MEDE_CAUSA, NAO_MEDE_OUTROS, ...m.comoEsta.naoMedido.map((x) => `${x.rotulo}: ${x.texto}`), `Trocas: ${m.abas.trocas} ${m.abasNota.trocas}`, `Leitura: ${m.abas.leitura} ${m.abasNota.leitura}`]

  return {
    tela: 'canal-proprio',
    janela: m.header.sync,
    foco: [{ nome: m.header.name, oQueE: 'seu canal', detalhe: m.header.handle }],
    tabelas: [...publicas, ...privadas],
    citados: [],
    definicoes,
    avisos,
    ...(avisosPrivados.length ? { avisosPrivados } : {}),
    naoMede,
    privado: estadoPrivado,
    comentarios: { estado: 'na' },
    vazio: null,
    motivoDoMagro: null,
    listasCompletas: true,
  }
}
