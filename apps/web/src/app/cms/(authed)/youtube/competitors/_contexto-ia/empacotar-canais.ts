/**
 * A5 · E17 degrau 1, Tarefa 6b: o empacotador da lista de Canais. Puro: nada de banco, de relógio nem de conta; cada número é copiado do campo do
 * modelo, com o texto que o modelo já formatou, e cada célula leva a `origem` (o caminho do campo no modelo) para a prova de paridade.
 *
 * O MODELO daqui (`ModeloCanais`) é o `CanaisView` que `montarCanais` entrega à página (a MESMA função monta a tela e o pacote), mais o `RiView`
 * (Referências e Inscritos) e o objeto `derivado`, que só junta o que a tela escreve a partir de partes (a posição "2º", o nicho por extenso, as
 * frases curtas de "não carregou"), sem mudar valor.
 *
 * Dado privado (spec 8.1.3/4.4): vem do estado que o `montar…` entrega (`EstadoDoPrivado`), nunca de uma frase da tela. As views por dia de um canal
 * SEU vêm do diário privado: a linha inteira desse canal (todas as colunas, a posição nela) vai para a tabela privada quando o diário foi lido, e
 * a frase de posição dele (bloco "Seus canais" e linha do pé) vai em aviso privado.
 *
 * Ainda NÃO coberto (declarado na constante `NAO_COBERTO`, e o teste exige que a matriz não abra o painel): o painel do canal (`drawer`, ?channel=).
 */
import type { CanaisRow, CanaisView } from '../_canais/view-model'
import type { RiView, RiPilula, RiLinhaRef, RiLinhaIns } from '../_canais/ri-tipos'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { Celula, EstadoDoPrivado, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { AVISO_PARCIAL } from './empacotar-comparar'

const JANELA = MEASURE_RULES.direction.windowDays

// ───────────────────────── o modelo
export interface DerivadoLinha {
  /** "2º" quando a linha tem posição; nulo quando não tem. */
  posicao: string | null
  /** O que a tela diz (para o leitor de tela) no lugar da posição; nulo quando a linha tem posição. */
  semPosicao: string | null
  /** O nome do nicho como a tela o escreve (o rótulo do seletor); nulo = sem nicho. */
  nicho: string | null
  /** Inscritos escondidos: a pastilha da tela (o texto que ela escreve no lugar do número); nulo = o número aparece. */
  subsOcultos: string | null
  /** O texto de "não carregou" da Direção (a tela não o escreve a partir de um campo do modelo); nulo = a direção veio. */
  direcaoNaoCarregou: string | null
  /** Em "Todos" a tela escreve a ressalva de dado velho sem a vírgula do começo; nulo = sem ressalva. */
  ressalva: string | null
  ressalva2: string | null
}
/** Das seções Referências e Inscritos: a pílula "sem medida" vira o motivo do número; a pílula "provisória" vira a situação da linha. */
export interface DerivadoRiLinha { motivo: string | null; situacao: string | null }
export interface DerivadoCanais {
  ranked: DerivadoLinha[]
  unranked: DerivadoLinha[]
  /** "Não carregou": o que a tela escreve quando o número do resumo não veio. */
  naoCarregou: string
  /** "de N" da base de cada filtro de estado (nulo quando o filtro não tem base). */
  filtros: Array<{ base: string | null; ainda: string | null }>
  ri: {
    referencias: DerivadoRiLinha[]
    inscritos: DerivadoRiLinha[]
    fraseReferencias: string | null
    fraseInscritos: string | null
  }
}
export type ModeloCanais = CanaisView & { ri: RiView | null; derivado: DerivadoCanais }

const NAO_CARREGOU = 'falhou'
const SEM_POSICAO = 'sem posição'

/** As linhas da lista, na ordem da tela: as com medida e, sob o divisor, as sem. */
export const linhasDaLista = (v: CanaisView): Array<{ r: CanaisRow; p: string }> => [
  ...v.list.ranked.map((r, i) => ({ r, p: `modelo.list.ranked[${i}]` })),
  ...v.list.unranked.map((r, i) => ({ r, p: `modelo.list.unranked[${i}]` })),
]

const fraseDe = (f: Array<{ t: string }>): string => f.map((x) => x.t).join('')

export function modeloDeCanais(view: CanaisView, ri: RiView | null): ModeloCanais {
  const nomeDoNicho = new Map(view.niches.map((n) => [n.id as string, n.label]))
  const deLinha = (r: CanaisRow): DerivadoLinha => ({
    posicao: r.numero ? `${r.numero.pos}º` : null,
    semPosicao: r.numero ? null : SEM_POSICAO,
    nicho: r.niche ? nomeDoNicho.get(r.niche) ?? null : null,
    subsOcultos: r.subsOculto ? r.subs : null,
    direcaoNaoCarregou: r.direcao.tipo === 'nao_carregou' ? NAO_CARREGOU : null,
    ressalva: r.cells.vpd.kind === 'ok' && r.cells.vpd.tail ? r.cells.vpd.tail.replace(/^,\s*/, '') : null,
    ressalva2: r.cells.vpd2?.kind === 'ok' && r.cells.vpd2.tail ? r.cells.vpd2.tail.replace(/^,\s*/, '') : null,
  })
  const dePilula = (p: RiPilula | null): DerivadoRiLinha => ({ motivo: p?.tipo === 'nm' ? p.texto : null, situacao: p?.tipo === 'prov' ? p.texto : null })
  const R = ri?.referencias.estado === 'ok' ? ri.referencias : null, I = ri?.inscritos.estado === 'ok' ? ri.inscritos : null
  return {
    ...view, ri,
    derivado: {
      ranked: view.list.ranked.map(deLinha), unranked: view.list.unranked.map(deLinha), naoCarregou: NAO_CARREGOU,
      filtros: view.resumo.filtros.map((f) => ({ base: f.base ? `de ${f.base.medidos}` : null, ainda: f.ainda ? `só a partir de ${f.ainda.slice(8, 10)}/${f.ainda.slice(5, 7)}` : null })),
      ri: { referencias: R ? R.linhas.map((l) => dePilula(l.pilula)) : [], inscritos: I ? I.linhas.map((l) => dePilula(l.pilula)) : [], fraseReferencias: R ? fraseDe(R.frase) : null, fraseInscritos: I ? fraseDe(I.frase) : null },
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

const LINHA = (r: string): Inventario => ({
  [`${r}.id`]: ID, [`${r}.name`]: 'terceiros', [`${r}.niche`]: REP, [`${r}.own`]: CTRL, [`${r}.href`]: END, [`${r}.semPagina`]: 'base',
  [`${r}.comparar`]: CTRL, [`${r}.comparar.*`]: END, [`${r}.lang`]: CTRL, [`${r}.lang.*`]: REP,
  [`${r}.pw`]: REP, [`${r}.vpd`]: REP, [`${r}.outliers.*`]: REP, [`${r}.changes.*`]: REP,
  [`${r}.growth`]: REP, [`${r}.growthTitle`]: REP, [`${r}.sync.*`]: REP,
  [`${r}.color`]: APAR, [`${r}.ini`]: APAR, [`${r}.avatar`]: IMG, [`${r}.subs`]: 'numero', [`${r}.subsTip`]: REP, [`${r}.url`]: END, [`${r}.handle`]: 'terceiros',
  [`${r}.backfill`]: CTRL, [`${r}.paused`]: CTRL,
  [`${r}.direcao.tipo`]: CTRL, [`${r}.direcao.pct`]: REP, [`${r}.direcao.simbolo`]: CTRL, [`${r}.direcao.texto`]: 'numero',
  [`${r}.direcao.ganhoRecente`]: REP, [`${r}.direcao.ganhoAnterior`]: REP, [`${r}.direcao.foraDaEscala`]: APAR, [`${r}.direcao.fracao`]: APAR,
  [`${r}.direcao.avisoDeContagem`]: REP, [`${r}.direcao.curta`]: REP, [`${r}.direcao.motivo`]: CTRL, [`${r}.direcao.longa`]: 'motivo',
  [`${r}.estado.*`]: CTRL, [`${r}.estado.linha`]: 'base', [`${r}.estado.apoio`]: 'base', [`${r}.estado.quedaLinha`]: 'base', [`${r}.estado.longa`]: REP,
  [`${r}.direcaoNumeros`]: CTRL, [`${r}.direcaoNumeros.recente`]: 'numero', [`${r}.direcaoNumeros.anterior`]: 'numero', [`${r}.subsOculto`]: CTRL,
  [`${r}.valor`]: CTRL, [`${r}.valor.*`]: REP, [`${r}.numero`]: CTRL, [`${r}.numero.*`]: REP, [`${r}.pos`]: CTRL, [`${r}.pos.*`]: REP,
  [`${r}.semMedida`]: CTRL, [`${r}.semMedidaTexto`]: 'base',
  [`${r}.dicas.*`]: 'base',
  
  [`${r}.cells.cadence.kind`]: CTRL, [`${r}.cells.cadence.weeks[].*`]: APAR,
  [`${r}.cells.cadence.label`]: REP, [`${r}.cells.cadence.pw`]: 'numero', [`${r}.cells.cadence.unit`]: 'rotulo', [`${r}.cells.cadence.sub`]: 'base', [`${r}.cells.cadence.paused`]: 'base',
  [`${r}.cells.cadence.text`]: 'motivo', [`${r}.cells.cadence.title`]: REP,
  [`${r}.cells.cadence2.kind`]: CTRL, [`${r}.cells.cadence2.weeks[].*`]: APAR,
  [`${r}.cells.cadence2.label`]: REP, [`${r}.cells.cadence2.pw`]: 'numero', [`${r}.cells.cadence2.unit`]: 'rotulo', [`${r}.cells.cadence2.sub`]: 'base', [`${r}.cells.cadence2.paused`]: 'base',
  [`${r}.cells.cadence2.text`]: 'motivo', [`${r}.cells.cadence2.title`]: REP,
  ...Object.fromEntries(['vpd', 'vpd2'].flatMap((k) => [
    [`${r}.cells.${k}`, CTRL], [`${r}.cells.${k}.kind`, CTRL], [`${r}.cells.${k}.big`, 'numero'], [`${r}.cells.${k}.abs`, 'numero'], [`${r}.cells.${k}.n`, 'numero'],
    [`${r}.cells.${k}.weak`, CTRL], [`${r}.cells.${k}.tail`, 'base'], [`${r}.cells.${k}.title`, REP], [`${r}.cells.${k}.text`, 'motivo'], [`${r}.cells.${k}.falta`, CTRL], [`${r}.cells.${k}.ausencia`, CTRL],
  ])),
  ...Object.fromEntries(['out', 'out2'].flatMap((k) => [
    [`${r}.cells.${k}`, CTRL], [`${r}.cells.${k}.kind`, CTRL], [`${r}.cells.${k}.title`, REP], [`${r}.cells.${k}.videoTitle`, 'terceiros'], [`${r}.cells.${k}.thumb`, IMG], [`${r}.cells.${k}.thumb.*`, IMG],
    [`${r}.cells.${k}.mult`, 'numero'], [`${r}.cells.${k}.tier`, CTRL], [`${r}.cells.${k}.vs`, 'base'], [`${r}.cells.${k}.n`, 'numero'], [`${r}.cells.${k}.published`, 'base'],
    [`${r}.cells.${k}.publishedTitle`, REP], [`${r}.cells.${k}.count`, 'base'], [`${r}.cells.${k}.text`, 'motivo'], [`${r}.cells.${k}.weak`, 'base'], [`${r}.cells.${k}.upnext`, 'base'], [`${r}.cells.${k}.falta`, CTRL],
  ])),
  [`${r}.cells.swap.kind`]: CTRL, [`${r}.cells.swap.n`]: 'numero', [`${r}.cells.swap.last`]: 'base', [`${r}.cells.swap.lastTitle`]: REP, [`${r}.cells.swap.text`]: 'motivo',
  [`${r}.cells.growth.kind`]: CTRL, [`${r}.cells.growth.big`]: 'numero', [`${r}.cells.growth.cap`]: 'base', [`${r}.cells.growth.text`]: 'motivo', [`${r}.cells.growth.title`]: REP,
  [`${r}.cells.growth.motivo`]: CTRL, [`${r}.cells.growth.fechaEm`]: CTRL, [`${r}.cells.growth.dias`]: CTRL, [`${r}.cells.growth.limite`]: REP, [`${r}.cells.growth.antes`]: REP, [`${r}.cells.growth.depois`]: REP,
  [`${r}.cells.growth.de`]: REP, [`${r}.cells.growth.ate`]: REP, [`${r}.cells.growth.atrasadoAte`]: REP, [`${r}.cells.growth.abs`]: REP, [`${r}.cells.growth.passo`]: REP, [`${r}.cells.growth.pct`]: REP,
  [`${r}.cells.sync.state`]: CTRL, [`${r}.cells.sync.label`]: 'base', [`${r}.cells.sync.labelTitle`]: REP, [`${r}.cells.sync.cov`]: 'base', [`${r}.cells.sync.covTitle`]: REP,
  [`${r}.cells.sync.msg`]: 'base', [`${r}.cells.sync.progress`]: CTRL, [`${r}.cells.sync.progress.*`]: CTRL, [`${r}.cells.sync.canRetry`]: CTRL, [`${r}.cells.sync.canRemove`]: CTRL,
  [`${r}.cells.sync.queued`]: CTRL, [`${r}.cells.sync.queued.*`]: REP,
  [`${r}.semFormato`]: CTRL, [`${r}.semFormato.label`]: 'base', [`${r}.semFormato.tip`]: 'base', [`${r}.semFormato.n`]: REP,
  [`${r}.cowork`]: CTRL, [`${r}.syncOneText.*`]: CTRL,
})

const DER = (r: string): Inventario => ({
  [`${r}.posicao`]: 'numero', [`${r}.semPosicao`]: 'motivo', [`${r}.nicho`]: 'rotulo', [`${r}.subsOcultos`]: 'motivo', [`${r}.direcaoNaoCarregou`]: 'motivo', [`${r}.ressalva`]: 'base', [`${r}.ressalva2`]: 'base',
})

const RI_SECAO = (r: string, linha: 'ref' | 'ins'): Inventario => ({
  [`${r}.estado`]: CTRL, [`${r}.n`]: REP, [`${r}.texto`]: 'base', [`${r}.ultimaBoa`]: 'base', [`${r}.titulo`]: 'base',
  [`${r}.frase[].t`]: 'base', [`${r}.frase[].b`]: CTRL,
  [`${r}.info.titulo`]: 'base', [`${r}.info.itens[]`]: 'base', [`${r}.legenda[]`]: 'base',
  [`${r}.ordens.${linha === 'ref' ? 'mediana' : 'pct'}.rotulo`]: CTRL, [`${r}.ordens.${linha === 'ref' ? 'mediana' : 'pct'}.ids[]`]: ID,
  [`${r}.ordens.${linha === 'ref' ? 'faixa' : 'abs'}.rotulo`]: CTRL, [`${r}.ordens.${linha === 'ref' ? 'faixa' : 'abs'}.ids[]`]: ID,
  ...(linha === 'ins' ? { [`${r}.ordens.pct.legendaBarra`]: 'base', [`${r}.ordens.abs.legendaBarra`]: 'base' } : {}),
  [`${r}.linhas[].id`]: ID, [`${r}.linhas[].nome`]: 'terceiros', [`${r}.linhas[].proprio`]: CTRL, [`${r}.linhas[].rank`]: REP, [`${r}.linhas[].ariaLabel`]: REP,
  [`${r}.linhas[].pilula`]: CTRL, [`${r}.linhas[].pilula.tipo`]: CTRL, [`${r}.linhas[].pilula.texto`]: REP,
  [`${r}.linhas[].sub`]: 'base',
  ...(linha === 'ref'
    ? { [`${r}.linhas[].valor`]: 'numero', [`${r}.linhas[].marca`]: APAR, [`${r}.linhas[].faixa`]: APAR, [`${r}.linhas[].faixa.de`]: APAR, [`${r}.linhas[].faixa.ate`]: APAR, [`${r}.linhas[].provisoria`]: CTRL }
    : { [`${r}.linhas[].pct`]: 'numero', [`${r}.linhas[].classe`]: CTRL, [`${r}.linhas[].barra`]: APAR, [`${r}.linhas[].barra.pct`]: APAR, [`${r}.linhas[].barra.abs`]: APAR, [`${r}.linhas[].nota`]: 'base' }),
})

export const INVENTARIO_CANAIS: Inventario = {
  ...LINHA('list.ranked[]'), ...LINHA('list.unranked[]'),
  'list.divisor': CTRL, 'list.divisor.titulo': 'base', 'list.divisor.nota': 'base',
  ...DER('derivado.ranked[]'), ...DER('derivado.unranked[]'), 'derivado.naoCarregou': 'motivo', 'derivado.filtros[].base': 'base', 'derivado.filtros[].ainda': 'motivo',
  'derivado.ri.referencias[].motivo': 'motivo', 'derivado.ri.referencias[].situacao': 'base', 'derivado.ri.inscritos[].motivo': 'motivo', 'derivado.ri.inscritos[].situacao': 'base',
  'derivado.ri.fraseReferencias': 'base', 'derivado.ri.fraseInscritos': 'base',
  // o topo do modelo da tela
  'slots.used': REP, 'slots.limit': REP, 'slots.free': REP, 'slots.text': 'base', 'slots.fullText': 'base', 'slots.tip': 'base', 'slots.nearFull': CTRL, 'slots.unlockText': CTRL, 'slots.unlockDone': CTRL,
  scale: CTRL, layout: CTRL, fmt: CTRL, fmtNaUrl: CTRL, fmtNota: 'base', 'fmtCab': CTRL, 'fmtCab.dois': 'base', 'fmtCab.ordenado': 'base',
  sort: CTRL, dir: CTRL, sortNote: 'base', vpdUnit: 'base', 'ordem.coluna': REP, 'ordem.sentido': REP, 'ordem.empate': REP,
  faixaSemPosicao: CTRL, 'faixaSemPosicao.linha1': 'base', 'faixaSemPosicao.linha2': 'base',
  compararColuna: CTRL, 'conjunto.tipo': CTRL, 'conjunto.niche': CTRL, 'conjunto.label': REP, conjuntoAviso: 'base', buscaNota: 'base', posicaoNota: 'base',
  pe: CTRL, 'pe.canalId': ID, 'pe.texto': 'base',
  'own.many': CTRL, 'own.block': CTRL, 'own.block.titulo': CTRL, 'own.block.linhas[].tipo': CTRL, 'own.block.linhas[].id': ID, 'own.block.linhas[].name': 'terceiros', 'own.block.linhas[].avatar': IMG,
  'own.block.linhas[].ini': APAR, 'own.block.linhas[].color': APAR, 'own.block.linhas[].pos': CTRL, 'own.block.linhas[].pos.pos': REP, 'own.block.linhas[].pos.de': REP, 'own.block.linhas[].pos.empate': REP,
  'own.block.linhas[].texto': 'base', 'own.block.linhas[].frase': 'base', 'own.block.linhas[].vizinhos': 'base', 'own.block.linhas[].abrirHref': END,
  'own.block.partes[].num': 'base', 'own.block.partes[].text': 'base', 'own.block.partes[].warn': CTRL,
  drawer: CTRL, drawerDropped: CTRL, drawerForja: CTRL,
  filter: CTRL, addOpen: CTRL, nicheEditorOpen: CTRL, niche: CTRL, nicheLabel: 'base',
  'problems.n': REP, 'problems.filterHref': END, 'problems.clearHref': END,
  emptyText: 'base', emptyLink: CTRL, 'emptyLink.text': CTRL, 'emptyLink.href': END,
  'legend.mid': APAR, 'legend.high': APAR, 'legend.top': APAR,
  'add.cap': CTRL, 'add.when': CTRL, 'add.defaultNiche': CTRL, 'add.limitMax': CTRL, 'add.defaultLimit': CTRL, 'add.niches[].id': CTRL, 'add.niches[].label': CTRL,
  'niches[].id': ID, 'niches[].label': 'rotulo', 'niches[].color': APAR, syncTip: CTRL, 'syncbar.text': CTRL, 'syncbar.meta': CTRL,
  'nicheRows[].id': ID, 'nicheRows[].name': CTRL, 'nicheRows[].niche': CTRL,
  'forja.*': CTRL, forjaBar: CTRL, 'forjaBar.lines': 'base', 'forjaBar.text': 'base',
  // o resumo
  'resumo.frase': 'base', 'resumo.carregou': CTRL, 'resumo.casas[].chave': CTRL, 'resumo.casas[].n': 'numero', 'resumo.casas[].palavra': 'rotulo', 'resumo.casas[].leitor': REP, 'resumo.casas[].pressed': CTRL, 'resumo.casas[].data': 'base',
  'resumo.filtros[].chave': CTRL, 'resumo.filtros[].rotulo': 'rotulo', 'resumo.filtros[].n': 'numero', 'resumo.filtros[].ainda': REP, 'resumo.filtros[].naoMedido': 'motivo', 'resumo.filtros[].pressed': CTRL,
  'resumo.filtros[].leitor': REP, 'resumo.filtros[].base': CTRL, 'resumo.filtros[].base.medidos': REP, 'resumo.filtros[].base.de': REP,
  'resumo.avisoDeContagem': CTRL, 'resumo.avisoDeContagem.ate': 'base', 'resumo.contagem.*': REP, 'resumo.direcao.*': REP, 'resumo.direcao.frase': REP, 'resumo.semRetrato': CTRL, 'resumo.semRetrato.desde': 'base',
  'resumo.vazio': CTRL, 'resumo.vazio.forma': CTRL, 'resumo.vazio.titulo': 'base', 'resumo.vazio.apoio': 'base', 'resumo.vazio.limpar.texto': CTRL, 'resumo.vazio.acaoDescendo': CTRL,
  // Referências e Inscritos
  'ri.aviso': 'base', 'ri.atalhos[].href': END, 'ri.atalhos[].rotulo': CTRL, 'ri.ticks[].pos': APAR, 'ri.ticks[].rotulo': APAR, 'ri.ordem.ref': CTRL, 'ri.ordem.ins': CTRL, 'ri.aba': CTRL,
  ...RI_SECAO('ri.referencias', 'ref'), ...RI_SECAO('ri.inscritos', 'ins'),
}

/** Chaves do inventário cuja folha não aparece em nenhum estado da matriz do teste (cada uma tem teste sintético próprio quando importa). */
export const SEM_FOLHA_NA_MATRIZ_CANAIS: readonly string[] = [
  'list.ranked[].valor',
  'list.ranked[].numero',
  'list.ranked[].cells.vpd',
  'list.ranked[].cells.vpd2',
  'list.ranked[].cells.out',
  'list.ranked[].cells.out.thumb',
  'list.ranked[].cells.out2',
  'list.ranked[].cells.out2.thumb',
  'list.unranked[].valor',
  'list.unranked[].numero.*',
  'list.unranked[].pos.*',
  'list.unranked[].cells.cadence2.weeks[].*',
  'list.unranked[].cells.vpd',
  'list.unranked[].cells.vpd2',
  'list.unranked[].cells.out',
  'list.unranked[].cells.out.thumb',
  'list.unranked[].cells.out.thumb.*',
  'list.unranked[].cells.out2',
  'list.unranked[].cells.out2.thumb',
  'list.unranked[].cells.out2.thumb.*',
  'list.ranked[].cells.vpd.falta',
  'list.ranked[].cells.vpd.ausencia',
  'list.ranked[].cells.vpd2.ausencia',
  'list.unranked[].cells.vpd2.ausencia',
  'list.ranked[].cells.out.falta',
  'list.ranked[].semFormato.label',
  'list.ranked[].semFormato.tip',
  'list.ranked[].semFormato.n',
  'list.unranked[].cells.cadence2.label',
  'list.unranked[].cells.cadence2.pw',
  'list.unranked[].cells.cadence2.unit',
  'list.unranked[].cells.cadence2.sub',
  'list.unranked[].cells.cadence2.paused',
  'list.unranked[].cells.vpd.falta',
  'list.unranked[].cells.vpd2.big',
  'list.unranked[].cells.vpd2.abs',
  'list.unranked[].cells.vpd2.n',
  'list.unranked[].cells.vpd2.weak',
  'list.unranked[].cells.vpd2.tail',
  'list.unranked[].cells.vpd2.falta',
  'list.unranked[].cells.out.title',
  'list.unranked[].cells.out.videoTitle',
  'list.unranked[].cells.out.mult',
  'list.unranked[].cells.out.tier',
  'list.unranked[].cells.out.vs',
  'list.unranked[].cells.out.n',
  'list.unranked[].cells.out.published',
  'list.unranked[].cells.out.publishedTitle',
  'list.unranked[].cells.out.count',
  'list.unranked[].cells.out.falta',
  'list.unranked[].cells.out2.title',
  'list.unranked[].cells.out2.videoTitle',
  'list.unranked[].cells.out2.mult',
  'list.unranked[].cells.out2.tier',
  'list.unranked[].cells.out2.vs',
  'list.unranked[].cells.out2.n',
  'list.unranked[].cells.out2.published',
  'list.unranked[].cells.out2.publishedTitle',
  'list.unranked[].cells.out2.count',
  'list.unranked[].cells.out2.falta',
  'list.unranked[].semFormato.label',
  'list.unranked[].semFormato.tip',
  'list.unranked[].semFormato.n',
  'own.block.linhas[].texto',
  'emptyLink.text',
  'emptyLink.href',
  'forjaBar.lines',
  'forjaBar.text',
  'resumo.filtros[].base.medidos',
  'resumo.filtros[].base.de',
  'resumo.avisoDeContagem.ate',
  'resumo.semRetrato.desde',
  'resumo.vazio.acaoDescendo',
  'ri.referencias.texto',
  'ri.referencias.ultimaBoa',
  'ri.referencias.titulo',
  'ri.inscritos.texto',
  'ri.inscritos.ultimaBoa',
  'ri.inscritos.titulo',
]

/** Folhas de número cru: a posição "2º" é montada pelo modelo (`derivado`) e já vem formatada. */
export const SEM_PROVA_POR_IGUALDADE_CANAIS_VAZIA = [] as const

// ───────────────────────── textos do pacote que esta tela escreve
// Revisto pelo Logan (17/10): as frases de "o que esta tela não mede" e os títulos das tabelas abaixo.
const NAO_MEDE_PRIVADO = 'o que só o dono do canal vê: impressões, taxa de clique, retenção e origem do tráfego de um concorrente'
const NAO_MEDE_CAUSA = 'por que um canal sobe ou cai: a direção compara os 28 dias com os 28 anteriores do próprio canal, e não diz a causa'
export const NAO_COBERTO = ['drawer'] as const

// ───────────────────────── células
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const terceiros = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })
const medido = (texto: string, origem: string): Celula => (texto === '0' ? { papel: 'numero', estado: 'zero_medido', texto, x: 0, origem } : { papel: 'numero', estado: 'medido', texto, x: null, origem })
const naoMedido = (motivo: string | null, origem: string): Celula => ({ papel: 'numero', estado: 'nao_medido', motivo: motivo ?? A_TELA_NAO_INFORMA_O_MOTIVO, origem })

const tabelaLista = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][], privada = false): Tabela => ({ id, titulo, tipo: 'lista', nomeNoCorte, privada, colunas, linhas })
const tabelaFixa = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][], privada = false): Tabela => ({ id, titulo, tipo: 'fixa', nomeNoCorte, privada, colunas, linhas })

// ───────────────────────── a lista de canais
type Linha = { r: CanaisRow; p: string; dl: DerivadoLinha; dp: string }

const textos = (xs: ReadonlyArray<[string | null | undefined, string]>): Array<[string, string]> => xs.filter((x): x is [string, string] => typeof x[0] === 'string' && x[0] !== '')

/** A linha com as colunas fixas: o que a tela não mostra naquele caso vira "não medido" com o motivo que a tela escreve. */
function celulasDaLinha(l: Linha): Celula[] {
  const { r, p, dl, dp } = l, c = r.cells, d = dp
  const dir = r.direcao
  const ritmo = c.cadence.kind === 'ok' ? medido(c.cadence.pw, `${p}.cells.cadence.pw`) : naoMedido(c.cadence.text, `${p}.cells.cadence.text`)
  return [
    dl.posicao !== null ? medido(dl.posicao, `${d}.posicao`) : naoMedido(dl.semPosicao, `${d}.semPosicao`),
    terceiros(r.name, `${p}.name`),
    dl.subsOcultos !== null ? naoMedido(dl.subsOcultos, `${d}.subsOcultos`) : medido(r.subs, `${p}.subs`),
    dir.tipo === 'medido' ? medido(dir.texto, `${p}.direcao.texto`) : dir.tipo === 'nao_carregou' ? naoMedido(dl.direcaoNaoCarregou, `${d}.direcaoNaoCarregou`) : naoMedido(dir.longa, `${p}.direcao.longa`),
    ritmo,
    c.vpd.kind === 'ok' ? medido(c.vpd.big, `${p}.cells.vpd.big`) : naoMedido(c.vpd.text, `${p}.cells.vpd.text`),
    c.out.kind === 'ok' ? medido(c.out.mult, `${p}.cells.out.mult`) : naoMedido(c.out.text, `${p}.cells.out.text`),
    c.swap.kind === 'ok' ? medido(String(c.swap.n), `${p}.cells.swap.n`) : naoMedido(c.swap.text, `${p}.cells.swap.text`),
    c.growth.kind === 'na' ? naoMedido(c.growth.text, `${p}.cells.growth.text`) : medido(c.growth.big, `${p}.cells.growth.big`),
    base(c.sync.label, `${p}.cells.sync.label`),
  ]
}
/** G-4 (Gio): os rótulos de Ritmo e Views/dia são os da tela, com a unidade dela (a coluna de views/dia é por mil inscritos ou a mediana, conforme a escala). */
export const VPD_POR_MIL = 'Views/dia por mil inscritos'
export const VPD_MEDIANA = 'Views/dia, mediana dos vídeos'
export const RITMO_COM_UNIDADE = 'Ritmo (uploads por semana, 13 semanas)'
const colunasDaLista = (vpdUnit: string): string[] => ['Posição', 'Canal', 'Inscritos', 'Direção', RITMO_COM_UNIDADE, vpdUnit.startsWith('por mil inscritos') ? VPD_POR_MIL : VPD_MEDIANA, 'Outliers', 'Trocas', 'Crescimento', 'Sincronização']

function tabelasDasLinhas(modelo: ModeloCanais, ls: Linha[], privada: boolean): Tabela[] {
  if (!ls.length) return []
  const pre = privada ? 'privado-' : '', suf = privada ? ', canal seu com views por dia' : ''
  const nome = (n: string) => (privada ? `${n} (dado privado)` : n)
  const out: Tabela[] = [tabelaLista(`${pre}canais`, `Os canais acompanhados${suf}`, nome('tabela de canais'), colunasDaLista(modelo.vpdUnit), ls.map(celulasDaLinha), privada)]

  const nicho = ls.filter(({ dl }) => dl.nicho !== null)
  if (nicho.length) out.push(tabelaLista(`${pre}canais-nicho`, `O nicho de cada canal${suf}`, nome('tabela de nichos'), ['Canal', 'Nicho'], nicho.map(({ r, p, dl, dp }) => [terceiros(r.name, `${p}.name`), rotulo(dl.nicho!, `${dp}.nicho`)]), privada))

  const dirN = ls.filter(({ r }) => r.direcaoNumeros)
  if (dirN.length) out.push(tabelaLista(`${pre}canais-direcao-numeros`, `Views da direção: ${JANELA} dias contra os ${JANELA} anteriores${suf}`, nome('tabela dos números da direção'), ['Canal', `Views nos últimos ${JANELA} dias`, `Views nos ${JANELA} dias anteriores`],
    dirN.map(({ r, p }) => [terceiros(r.name, `${p}.name`), medido(r.direcaoNumeros!.recente, `${p}.direcaoNumeros.recente`), medido(r.direcaoNumeros!.anterior, `${p}.direcaoNumeros.anterior`)]), privada))

  const vpdN = ls.filter(({ r }) => r.cells.vpd.kind === 'ok' && r.cells.vpd.abs !== null)
  if (vpdN.length) out.push(tabelaLista(`${pre}canais-views-por-dia`, `A base das views por dia${suf}`, nome('tabela da base das views por dia'), ['Canal', 'Views por dia, valor absoluto', 'Vídeos na base'],
    vpdN.map(({ r, p }) => { const v = r.cells.vpd; return v.kind === 'ok' ? [terceiros(r.name, `${p}.name`), medido(v.abs!, `${p}.cells.vpd.abs`), medido(String(v.n), `${p}.cells.vpd.n`)] : [] }), privada))

  const outN = ls.filter(({ r }) => r.cells.out.kind === 'ok')
  if (outN.length && modelo.fmt !== 'todos') out.push(tabelaLista(`${pre}canais-maior-outlier`, `O maior outlier de cada canal${suf}`, nome('tabela do maior outlier'), ['Canal', 'Vídeo', 'Vídeos comparados', 'Publicado', 'Contagem'],
    outN.map(({ r, p }) => { const o = r.cells.out; return o.kind === 'ok' ? [terceiros(r.name, `${p}.name`), terceiros(o.videoTitle, `${p}.cells.out.videoTitle`), medido(String(o.n), `${p}.cells.out.n`), base(o.published, `${p}.cells.out.published`), base(o.count, `${p}.cells.out.count`)] : [] }), privada))
  if (outN.length && modelo.fmt === 'todos') out.push(tabelaLista(`${pre}canais-outliers-contagem`, `Quantos outliers tem cada canal${suf}`, nome('tabela da contagem de outliers'), ['Canal', 'Contagem'],
    outN.map(({ r, p }) => { const o = r.cells.out; return o.kind === 'ok' ? [terceiros(r.name, `${p}.name`), base(o.count, `${p}.cells.out.count`)] : [] }), privada))

  if (modelo.fmt === 'todos') {
    const sh = ls.filter(({ r }) => r.cells.cadence2 && r.cells.vpd2 && r.cells.out2)
    if (sh.length) out.push(tabelaLista(`${pre}canais-shorts`, `A medida dos Shorts de cada canal${suf}`, nome('tabela dos Shorts'), ['Canal', 'Ritmo dos Shorts', 'Views por dia dos Shorts', 'Outliers dos Shorts'],
      sh.map(({ r, p }) => {
        const k = r.cells.cadence2!, v = r.cells.vpd2!, o = r.cells.out2!
        return [terceiros(r.name, `${p}.name`),
          k.kind === 'ok' ? medido(k.pw, `${p}.cells.cadence2.pw`) : naoMedido(k.text, `${p}.cells.cadence2.text`),
          v.kind === 'ok' ? medido(v.big, `${p}.cells.vpd2.big`) : naoMedido(v.text, `${p}.cells.vpd2.text`),
          o.kind === 'ok' ? medido(o.mult, `${p}.cells.out2.mult`) : naoMedido(o.text, `${p}.cells.out2.text`)]
      }), privada))
    const shV = ls.filter(({ r }) => r.cells.vpd2?.kind === 'ok' && r.cells.vpd2.abs !== null)
    if (shV.length) out.push(tabelaLista(`${pre}canais-shorts-views-por-dia`, `A base das views por dia dos Shorts${suf}`, nome('tabela da base dos Shorts'), ['Canal', 'Views por dia dos Shorts, valor absoluto', 'Vídeos na base dos Shorts'],
      shV.map(({ r, p }) => { const v = r.cells.vpd2; return v?.kind === 'ok' ? [terceiros(r.name, `${p}.name`), medido(v.abs!, `${p}.cells.vpd2.abs`), medido(String(v.n), `${p}.cells.vpd2.n`)] : [] }), privada))
  }

  const estado: Celula[][] = []
  for (const { r, p } of ls) for (const [t, o] of textos([[r.estado.linha, 'linha'], [r.estado.apoio, 'apoio'], [r.estado.quedaLinha, 'quedaLinha']])) estado.push([terceiros(r.name, `${p}.name`), base(t, `${p}.estado.${o}`)])
  if (estado.length) out.push(tabelaLista(`${pre}canais-estado`, `O estado de cada canal${suf}`, nome('tabela de estados'), ['Canal', 'Estado'], estado, privada))

  const notas: Celula[][] = []
  const todos = modelo.fmt === 'todos'
  for (const { r, p, dl, dp } of ls) {
    const c = r.cells, c2 = c.cadence2, v2 = c.vpd2, o2 = c.out2
    const itens: Array<[string | null | undefined, string]> = [
      [r.semPagina, `${p}.semPagina`], [r.semMedidaTexto, `${p}.semMedidaTexto`],
      [c.cadence.kind === 'ok' ? c.cadence.sub : null, `${p}.cells.cadence.sub`], [c.cadence.kind === 'ok' ? c.cadence.paused : null, `${p}.cells.cadence.paused`],
      [c.vpd.kind === 'ok' && !todos ? c.vpd.tail : null, `${p}.cells.vpd.tail`], [c.vpd.kind === 'ok' && todos ? dl.ressalva : null, `${dp}.ressalva`],
      [c.out.kind === 'na' ? c.out.weak : null, `${p}.cells.out.weak`], [c.out.kind === 'na' ? c.out.upnext : null, `${p}.cells.out.upnext`],
      [c.growth.kind === 'na' ? null : c.growth.cap, `${p}.cells.growth.cap`], [c.out.kind === 'ok' && !todos ? c.out.vs : null, `${p}.cells.out.vs`], [c.swap.kind === 'ok' ? c.swap.last : null, `${p}.cells.swap.last`],
      [c.sync.cov, `${p}.cells.sync.cov`], [c.sync.msg, `${p}.cells.sync.msg`], [r.semFormato?.label, `${p}.semFormato.label`], [r.semFormato?.tip, `${p}.semFormato.tip`],
      ...(todos ? [
        [c2 && c2.kind === 'ok' ? c2.sub : null, `${p}.cells.cadence2.sub`], [c2 && c2.kind === 'ok' ? c2.paused : null, `${p}.cells.cadence2.paused`],
        [v2 && v2.kind === 'ok' ? dl.ressalva2 : null, `${dp}.ressalva2`],
        [o2 && o2.kind === 'na' ? o2.weak : null, `${p}.cells.out2.weak`], [o2 && o2.kind === 'na' ? o2.upnext : null, `${p}.cells.out2.upnext`],
      ] as Array<[string | null | undefined, string]> : []),
    ]
    for (const [t, o] of itens) if (typeof t === 'string' && t !== '') notas.push([terceiros(r.name, `${p}.name`), base(t, o)])
  }
  if (notas.length) out.push(tabelaLista(`${pre}canais-notas`, `Notas de cada canal${suf}`, nome('tabela de notas dos canais'), ['Canal', 'Nota'], notas, privada))

  const dicas: Celula[][] = []
  for (const { r, p } of ls) {
    for (const [k, t] of Object.entries(r.dicas)) if (typeof t === 'string' && t !== '') dicas.push([terceiros(r.name, `${p}.name`), base(t, `${p}.dicas.${k}`)])
  }
  if (dicas.length) out.push(tabelaLista(`${pre}canais-dicas`, `A dica de cada medida${suf}`, nome('tabela das dicas das medidas'), ['Canal', 'Dica'], dicas, privada))
  return out
}

// ───────────────────────── resumo, Referências e Inscritos
function tabelasDoResumo(m: ModeloCanais): Tabela[] {
  const out: Tabela[] = []
  const { casas, filtros } = m.resumo
  const num = (n: number | null, origem: string): Celula => (n === null ? naoMedido(m.derivado.naoCarregou, 'modelo.derivado.naoCarregou') : medido(String(n), origem))
  if (casas.length) out.push(tabelaFixa('canais-resumo-direcao', 'Quantos canais sobem, ficam como estão ou descem', nome0('tabela do resumo da direção'), ['Direção', 'Canais'],
    casas.map((c, i) => [rotulo(c.palavra, `modelo.resumo.casas[${i}].palavra`), num(c.n, `modelo.resumo.casas[${i}].n`)])))
  if (filtros.length) out.push(tabelaFixa('canais-resumo-estado', 'Quantos canais em cada estado', nome0('tabela do resumo do estado'), ['Estado', 'Canais'],
    filtros.map((f, i) => {
      const o = `modelo.resumo.filtros[${i}]`
      return [rotulo(f.rotulo, `${o}.rotulo`), f.ainda ? naoMedido(f.ainda ? m.derivado.filtros[i]!.ainda : null, `modelo.derivado.filtros[${i}].ainda`) : f.naoMedido ? naoMedido(f.naoMedido, `${o}.naoMedido`) : num(f.n, `${o}.n`)]
    })))
  const comBase = filtros.map((f, i) => ({ f, i })).filter(({ i }) => m.derivado.filtros[i]!.base !== null)
  if (comBase.length) out.push(tabelaFixa('canais-resumo-base', 'A base dos filtros de estado', nome0('tabela da base dos filtros'), ['Estado', 'Base'],
    comBase.map(({ f, i }) => [rotulo(f.rotulo, `modelo.resumo.filtros[${i}].rotulo`), base(m.derivado.filtros[i]!.base!, `modelo.derivado.filtros[${i}].base`)])))
  return out
}
const nome0 = (n: string): string => n

/** A ordem em que a tela mostra as linhas: os ids da ordem escolhida e depois as que ficaram fora dela. */
const naOrdem = <L extends { id: string }>(linhas: L[], ids: string[]): Array<{ l: L; k: number }> => {
  const dentro = ids.flatMap((id) => { const k = linhas.findIndex((l) => l.id === id); return k < 0 ? [] : [{ l: linhas[k]!, k }] })
  const usados = new Set(dentro.map((x) => x.k))
  return [...dentro, ...linhas.flatMap((l, k) => (usados.has(k) ? [] : [{ l, k }]))]
}

function tabelasDeReferenciasEInscritos(m: ModeloCanais): Tabela[] {
  const ri = m.ri
  if (!ri) return []
  const out: Tabela[] = []
  const R = ri.referencias, I = ri.inscritos
  if (R.estado === 'ok') {
    const ordem = naOrdem<RiLinhaRef>(R.linhas, R.ordens[ri.ordem.ref].ids)
    out.push(tabelaLista('canais-referencias', 'Referências: o vídeo típico em 90 dias', 'tabela de referências', ['Canal', 'Views do vídeo típico'],
      ordem.map(({ l, k }) => [terceiros(l.nome, `modelo.ri.referencias.linhas[${k}].nome`),
        l.valor !== null ? medido(l.valor, `modelo.ri.referencias.linhas[${k}].valor`) : naoMedido(m.derivado.ri.referencias[k]!.motivo, `modelo.derivado.ri.referencias[${k}].motivo`)])))
    const notas: Celula[][] = []
    for (const { l, k } of ordem) {
      const d = m.derivado.ri.referencias[k]!
      if (l.marca != null && !l.pilula && l.sub) notas.push([terceiros(l.nome, `modelo.ri.referencias.linhas[${k}].nome`), base(l.sub, `modelo.ri.referencias.linhas[${k}].sub`)])
      if (d.situacao !== null) notas.push([terceiros(l.nome, `modelo.ri.referencias.linhas[${k}].nome`), base(d.situacao, `modelo.derivado.ri.referencias[${k}].situacao`)])
    }
    if (notas.length) out.push(tabelaLista('canais-referencias-notas', 'Referências: nota de cada canal', 'tabela de notas das referências', ['Canal', 'Nota'], notas))
  }
  if (I.estado === 'ok') {
    const ordem = naOrdem<RiLinhaIns>(I.linhas, I.ordens[ri.ordem.ins].ids)
    const medida = (l: RiLinhaIns) => l.classe != null && l.barra != null
    out.push(tabelaLista('canais-inscritos', 'Inscritos: o ganho de cada canal em 28 dias', 'tabela de inscritos', ['Canal', 'Ganho em 28 dias'],
      ordem.map(({ l, k }) => [terceiros(l.nome, `modelo.ri.inscritos.linhas[${k}].nome`),
        medida(l) && l.pct !== null ? medido(l.pct, `modelo.ri.inscritos.linhas[${k}].pct`) : naoMedido(m.derivado.ri.inscritos[k]!.motivo, `modelo.derivado.ri.inscritos[${k}].motivo`)])))
    const notas: Celula[][] = []
    for (const { l, k } of ordem) {
      const d = m.derivado.ri.inscritos[k]!
      const t = medida(l) ? l.sub : l.nota ?? l.sub
      const o = medida(l) ? 'sub' : l.nota ? 'nota' : 'sub'
      if (t) notas.push([terceiros(l.nome, `modelo.ri.inscritos.linhas[${k}].nome`), base(t, `modelo.ri.inscritos.linhas[${k}].${o}`)])
      if (d.situacao !== null) notas.push([terceiros(l.nome, `modelo.ri.inscritos.linhas[${k}].nome`), base(d.situacao, `modelo.derivado.ri.inscritos[${k}].situacao`)])
    }
    if (notas.length) out.push(tabelaLista('canais-inscritos-notas', 'Inscritos: nota de cada canal', 'tabela de notas dos inscritos', ['Canal', 'Nota'], notas))
  }
  return out
}

const presentes = (xs: ReadonlyArray<string | null | undefined>): string[] => xs.filter((x): x is string => typeof x === 'string' && x !== '')

/** Os avisos públicos e os que citam o dado privado de um canal seu (a posição dele depende do diário). */
function avisosDe(m: ModeloCanais, privados: ReadonlySet<string>): { publicos: string[]; privados: string[] } {
  const pub: string[] = [], priv: string[] = []
  pub.push(...presentes([
    m.slots.text, m.slots.fullText, m.slots.tip, m.fmtNota, m.fmtCab?.dois, m.fmtCab?.ordenado, m.sortNote, m.vpdUnit, m.faixaSemPosicao?.linha1, m.faixaSemPosicao?.linha2,
    m.conjuntoAviso, m.buscaNota, m.posicaoNota, m.resumo.frase, m.resumo.avisoDeContagem?.ate, m.resumo.semRetrato?.desde, m.forjaBar?.lines, m.forjaBar?.text,
    m.list.divisor?.titulo, m.list.divisor?.nota, m.derivado.ri.fraseReferencias, m.derivado.ri.fraseInscritos, m.ri?.aviso,
  ]))
  for (const c of m.resumo.casas) pub.push(...presentes([c.data]))
  for (const x of m.own.block?.partes ?? []) pub.push(...presentes([x.text]))
  if (m.pe) (privados.has(m.pe.canalId) ? priv : pub).push(...presentes([m.pe.texto]))
  for (const l of m.own.block?.linhas ?? []) (privados.has(l.id) ? priv : pub).push(...presentes(l.tipo === 'fina' ? [l.texto] : [l.frase, l.vizinhos]))
  const ri = m.ri
  if (ri) {
    for (const sec of [ri.referencias, ri.inscritos]) {
      if (sec.estado === 'erro') pub.push(...presentes([sec.texto, sec.ultimaBoa]))
      else if (sec.estado === 'vazio') pub.push(...presentes([sec.titulo, sec.texto]))
      else pub.push(...sec.legenda)
    }
    if (ri.inscritos.estado === 'ok') pub.push(ri.inscritos.ordens[ri.ordem.ins].legendaBarra ?? '')
  }
  return { publicos: pub.filter((x) => x !== ''), privados: priv }
}

function definicoesDe(m: ModeloCanais): PacoteModelo['definicoes'] {
  const ri = m.ri
  if (!ri) return []
  return [ri.referencias, ri.inscritos].flatMap((s) => (s.estado === 'ok' ? [{ medida: s.info.titulo, frase: s.info.itens.join(' '), limiares: [] as string[] }] : []))
}

export function empacotarCanais(modelo: ModeloCanais, privado: EstadoDoPrivado): PacoteModelo {
  const nR = modelo.list.ranked.length
  const ls: Linha[] = linhasDaLista(modelo).map((x, i) => (i < nR
    ? { ...x, dl: modelo.derivado.ranked[i]!, dp: `modelo.derivado.ranked[${i}]` }
    : { ...x, dl: modelo.derivado.unranked[i - nR]!, dp: `modelo.derivado.unranked[${i - nR}]` }))
  const leitura = (id: string) => privado.acessoPorCanal[id]?.diario ?? 'erro' // leitura que o `montar…` não registrou conta como falha
  const proprias = ls.filter(({ r }) => r.own)
  const privadas = proprias.filter(({ r }) => leitura(r.id) === 'ok')
  const publicas = ls.filter((x) => !privadas.includes(x))
  const tabelas = [...tabelasDasLinhas(modelo, publicas, false), ...tabelasDasLinhas(modelo, privadas, true), ...tabelasDoResumo(modelo), ...tabelasDeReferenciasEInscritos(modelo)]
  let estadoPrivado: PacoteModelo['privado']
  const avisos: string[] = []
  if (proprias.length === 0) estadoPrivado = { estado: 'na' }
  else if (privadas.length > 0) {
    estadoPrivado = { estado: 'incluido', itens: ITENS_PRIVADOS }
    if (proprias.some(({ r }) => leitura(r.id) === 'erro')) avisos.push(AVISO_PARCIAL)
  } else if (proprias.some(({ r }) => leitura(r.id) === 'erro')) estadoPrivado = { estado: 'excluido', motivo: 'leitura_falhou', itens: ITENS_PRIVADOS }
  else if (privado.negativa === 'sem_direito') estadoPrivado = { estado: 'excluido', motivo: 'sem_direito', itens: ITENS_PRIVADOS }
  else estadoPrivado = { estado: 'excluido', motivo: 'nao_conferido', itens: ITENS_PRIVADOS }
  const a = avisosDe(modelo, new Set(privadas.map(({ r }) => r.id)))
  avisos.push(...a.publicos)
  const vazio = ls.length === 0 ? modelo.emptyText : modelo.resumo.vazio ? `${modelo.resumo.vazio.titulo}. ${modelo.resumo.vazio.apoio}` : null
  return {
    tela: 'canais', janela: modelo.nicheLabel, foco: [], tabelas, citados: [], definicoes: definicoesDe(modelo), avisos,
    ...(a.privados.length && estadoPrivado.estado === 'incluido' ? { avisosPrivados: a.privados } : {}),
    naoMede: [NAO_MEDE_PRIVADO, NAO_MEDE_CAUSA],
    privado: estadoPrivado, comentarios: { estado: 'na' }, vazio, motivoDoMagro: null, listasCompletas: true,
  }
}
const ITENS_PRIVADOS = 'views por dia do seu canal'
export { AVISO_PARCIAL }
export type { RiPilula }
