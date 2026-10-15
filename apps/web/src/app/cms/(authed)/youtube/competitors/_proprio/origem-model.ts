/**
 * Modelo de tela da origem das views (plano E5b, Tarefa 10; mockup 12). PURO: não importa React, `server-only`, leitor nem banco.
 * Recebe o que as entradas leram (`OrigemLida`, `DetalheCanal`) como TIPOS e devolve só texto e números prontos.
 * Regras de ouro: "não medido" nunca vira zero; nível `so-aviso` não leva NENHUM número nem termo privado na vista; termos e sites
 * só existem no nível `tudo`; a soma das origens mais o omitido mais o que o catálogo não conhece fecha o total medido.
 * Toda frase marcada `TEXTO-A-REVISAR` é texto novo, fora da tabela de frases do mockup, para o revisor de UX.
 */
import type { BlocoAgregado, Cobertura, LinhaBloco } from '@/lib/youtube/observatorio/proprio/origem-agregar'
import { MARCA_DE_CONTAGEM, agregarBloco, diasMedidosEmComum, pctTexto } from '@/lib/youtube/observatorio/proprio/origem-agregar'
import type { ConjuntoLido, DetalheCanal, LinhaDetalhe } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { LinhaBasica } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'
import type { MotivoNaoMedido } from '@/lib/youtube/observatorio/proprio/motivos-nao-medido'
import { nomeDoPais } from '@/lib/youtube/observatorio/proprio/pais-pt'
import {
  ORDEM_APARELHO, ORDEM_ORIGEM, ROTULO_APARELHO, ROTULO_ORIGEM, grupoDaOrigem, grupoDeInscrito, grupoDoAparelho,
  type GrupoAparelho, type GrupoOrigem,
} from '@/lib/youtube/observatorio/proprio/origem-grupos'
import type { DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { diffDias } from '@/lib/youtube/coleta/day-pt'
import type { OrigemLida } from './dados-origem'

export type PeriodoCanal = '7' | '28' | '90' | 'tudo'
export type PeriodoVideo = '7' | 'tudo'
export type Nivel = 'tudo' | 'sem-termos' | 'so-aviso'
export type TelaOrigem = 'video' | 'canal'
export type IdBloco = 'origem' | 'impressoes' | 'termos' | 'aparelho' | 'pais' | 'inscritos'
export type EstadoView = 'medido' | 'zero' | 'nao_medido' | 'ainda_nao_existe' | 'em_revisao' | 'erro' | 'bloqueado'

export { CHAVE_ORIGEM, PARAM_ORIGEM } from './origem-constantes'
/** Quantos dias de vida tem um vídeo "novo demais" para a origem existir. */
export const DIAS_VIDEO_NOVO = 3
const MAX_PAISES = 6

export interface VideosDoTotal { naConta: number; fora: number; parados: number; paradosDesde: DiaYt | null; comBuraco: number }
export interface PeriodoEntrada { id: string; rotulo: string; de: DiaYt; ate: DiaYt; totalDoPeriodo: number | null; videosDoTotal: VideosDoTotal | null }
export interface EntradaOrigem {
  tela: TelaOrigem
  nivel: Nivel
  origem: Privado<OrigemLida>
  termos: Privado<DetalheCanal>
  periodos: PeriodoEntrada[]
  publicadoEm: DiaYt | null
  hojePt: DiaYt
  ligadoEm: DiaYt
  publicacoes: ReadonlyMap<string, DiaYt | null>
  /** quem a página sabe que edita o site: termos em erro ou negados lêem erro, nunca "Você não vê este dado" */
  podeEditar: boolean
  dm(d: DiaYt): string
  dmy(d: DiaYt): string
  n(x: number): string
}

export interface LinhaView {
  chave: string
  rotulo: string
  valor: number
  valorTexto: string
  pct: number
  pctTexto: string
  semNumero: boolean
  tipo: 'valor' | 'omitido' | 'nao_catalogado'
  /** rótulo de leitor de tela: "Pesquisa do YouTube: sem número do YouTube, pode estar no omitido" quando não há número */
  rotuloLeitor: string
}
export interface SubListaView { id: 'termos' | 'sites'; titulo: string; estado: EstadoView; frase: string; linhas: LinhaView[]; comparacao: string | null }
export interface BlocoView {
  id: IdBloco
  titulo: string
  estado: EstadoView
  frase: string
  linhas: LinhaView[]
  cobertura: string
  /** a régua: dias medidos de M, de/até, e se há marca de 24/08 */
  regua: { medidos: number; dias: number; de: DiaYt; ate: DiaYt; parcial: boolean; marca: boolean; rotuloLeitor: string } | null
  metodo: string[]
  aviso: string | null
  bloqueio: string | null
  erro: string | null
  rodape: string | null
  linhasDeContagem: string[]
  subListas: SubListaView[] | null
}
export interface CelulaFaixaOrigem { rotulo: string; valor: string; sub: string }
/** A faixa de duas células do topo da aba Origem do canal (mockup 12): o total do período e quantos dias têm a origem medida. */
export interface FaixaOrigem { views: CelulaFaixaOrigem; dias: CelulaFaixaOrigem }
export interface GrupoView { total: string; blocos: BlocoView[]; /** só na aba do canal */ faixa?: FaixaOrigem | null }
export interface SemAcessoView { titulo: string; frases: string[]; blocos: string[] }
export interface OrigemView {
  nivel: Nivel
  periodos: Array<{ id: string; rotulo: string; grupo: GrupoView }>
  padrao: string
  lembranca: string
  dica: string
  semAcesso: SemAcessoView | null
}

/** Os ytIds do conjunto da pergunta 20: todo vídeo do canal que o Observatório traz (Short e vídeo não acompanhado inclusive), do mais novo ao mais velho. */
export function videosDaOrigem(obs: { videos: ReadonlyArray<{ ytId: string; ch: string; pub: number }> }, canalId: string): string[] {
  return obs.videos.filter(v => v.ch === canalId)
    .sort((a, b) => b.pub - a.pub || (a.ytId < b.ytId ? -1 : 1))
    .map(v => v.ytId)
}

/** O vídeo é novo demais para a origem existir (menos de 3 dias de vida). */
export const videoNovo = (publicadoEm: DiaYt | null, hojePt: DiaYt): boolean => publicadoEm != null && diffDias(publicadoEm, hojePt) < DIAS_VIDEO_NOVO

const BLOCOS_NOMEADOS = ['De onde vêm as views', 'O que pesquisaram', 'De que sites vieram', 'Aparelho', 'País', 'Inscritos e não inscritos', 'Impressões por origem']

const SUBSTANTIVO: Record<'origem' | 'aparelho' | 'pais' | 'inscritos', string> = { origem: 'a origem', aparelho: 'o aparelho', pais: 'o país', inscritos: 'quem é inscrito' }
const TITULO: Record<IdBloco, string> = {
  origem: 'De onde vêm as views', impressoes: 'Impressões por origem', termos: 'O que pesquisaram e de que sites vieram',
  aparelho: 'Em que aparelho', pais: 'De que país', inscritos: 'Inscritos e não inscritos',
}
const METODO_ORIGEM = [
  'Fonte: YouTube Analytics do seu canal, views de cada dia por tipo de origem. Cálculo do Observatório, somando só os dias medidos do período.',
  'Cores: valem só dentro destes blocos; em outras telas as mesmas cores indicam faixas de desempenho, aqui o símbolo e a ordem fixa dizem qual é a origem.',
  'Porcentagem: views da origem ÷ views desses mesmos dias (as do dia a dia do vídeo ou do canal). O total sempre fecha: a soma das origens mais o omitido é igual ao total.',
  'Omitido pelo YouTube: o YouTube não informa origens com poucas views. A diferença entre o total e a soma das origens aparece como barra própria e nunca é repartida entre as outras.',
]
const LINHA_DIAS_MEDIDOS = (dmy: string) => `Dias medidos: a coleta começou em ${dmy} e vai para a frente; os dias antes disso ficam como não medido, nunca como zero.`
const LINHA_MARCA = (dmy: string) => `${dmy}: o YouTube mudou como conta views. Períodos que cruzam essa data não se comparam direto.`
const METODO_NAO_MEDIDO = 'Quando a coleta começar, a soma das origens mais o omitido será igual ao total.'
const METODO_REVISAO = 'Aqui a soma das origens passou do total, por isso a divisão não aparece até conferir.'
const METODO_TERMOS = [
  'Quem vê: só quem edita o site. Nada disto sai do painel.',
  'Barras: aqui a barra cheia é o termo ou o site com mais views; em aparelho, país e inscritos a barra é a fatia do total.',
  'Endereços: guardamos o site sem o que vem depois do “?”.',
  'Termos: uma busca pode ser o nome de uma pessoa. Por isso ficam só aqui, nunca somados numa tela de leitura.',
]
const MSG_REVISAO_FRASE = 'Não mostramos de onde vêm as views por enquanto: a origem está em revisão.'
const MSG_REVISAO_AVISO = 'Em revisão: as origens somaram mais views do que o total do dia a dia, então não mostramos a divisão até conferir. Não é zero.'
const MSG_ERRO = 'Não conseguimos ler agora.'

// ---------------------------------------------------------------------------------------------------------------------------------
// Linhas

function linhaView(l: LinhaBloco<string>, rotulo: string, n: (x: number) => string): LinhaView {
  return {
    chave: l.chave, rotulo, valor: l.valor, valorTexto: l.semNumero ? '—' : n(l.valor), pct: l.pct, pctTexto: l.semNumero ? '—' : pctTexto(l.pct, l.valor),
    semNumero: l.semNumero, tipo: 'valor',
    rotuloLeitor: l.semNumero ? `${rotulo}: sem número do YouTube, pode estar no omitido` : `${rotulo}: ${pctTexto(l.pct, l.valor)}, ${n(l.valor)}`,
  }
}
function linhasDoBloco(b: BlocoAgregado<string>, rotulo: (k: string) => string, n: (x: number) => string): LinhaView[] {
  const out = b.linhas.map(l => linhaView(l, rotulo(l.chave), n))
  out.push({ chave: 'omitido', rotulo: 'Omitido pelo YouTube', valor: b.omitido, valorTexto: n(b.omitido), pct: b.pctOmitido, pctTexto: pctTexto(b.pctOmitido, b.omitido), semNumero: false, tipo: 'omitido', rotuloLeitor: `Omitido pelo YouTube: ${pctTexto(b.pctOmitido, b.omitido)}, ${n(b.omitido)}` })
  if (b.valorNaoCatalogado > 0) {
    // TEXTO-A-REVISAR
    out.push({ chave: 'nao_catalogado', rotulo: 'Origem que ainda não sabemos nomear', valor: b.valorNaoCatalogado, valorTexto: n(b.valorNaoCatalogado), pct: b.pctNaoCatalogado, pctTexto: pctTexto(b.pctNaoCatalogado, b.valorNaoCatalogado), semNumero: false, tipo: 'nao_catalogado', rotuloLeitor: `Origem que ainda não sabemos nomear: ${pctTexto(b.pctNaoCatalogado, b.valorNaoCatalogado)}, ${n(b.valorNaoCatalogado)}` })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Texto de "não medido" e cobertura

function textoNaoMedido(b: BlocoAgregado<string>, id: 'origem' | 'aparelho' | 'pais' | 'inscritos', e: EntradaOrigem): string {
  const coisa = SUBSTANTIVO[id]
  const desde = b.cobertura.desde
  switch (b.motivo) {
    case 'coleta_comeca_em': return `A coleta começa em ${desde ? e.dm(desde) : e.dm(e.ligadoEm)}. Antes dessa data não guardamos ${coisa}; não é zero.`
    case 'coleta_nao_comecou': return `A coleta ainda não começou. Antes dela não guardamos ${coisa}; não é zero.`
    case 'relatorio_nao_chegou': return 'Ainda não coletado: o relatório do YouTube ainda não chegou. Quando chegar, esta lista aparece sozinha.'
    case 'busca_falhou': return 'A última busca falhou e nenhum dia do período foi medido. Não é zero.' // TEXTO-A-REVISAR
    case 'coleta_desligada': return 'A coleta da origem está desligada.'
    case 'cobertura_parcial': return `Não medido: nenhum dia do período tem todos os vídeos medidos. Não é zero.` // TEXTO-A-REVISAR
    case 'ainda_nao_existe': return 'Ainda não existe nenhum vídeo medido neste período.' // TEXTO-A-REVISAR
    default: return 'Não medido neste período. Não é zero.'
  }
}

function avisoDeConjunto(b: BlocoAgregado<string>, e: EntradaOrigem): string | null {
  if (b.cobertura.medidos === 0) return null
  const est = b.conjunto
  const ate = b.cobertura.ultimoMedido
  if (est.tipo === 'coleta_em_erro') return `A última busca falhou. A tela mostra os dias medidos${ate ? ` até ${e.dm(ate)}` : ''}.` // TEXTO-A-REVISAR (sem a data da falha)
  if (est.tipo === 'passo_desligado') {
    if (est.ultimoErro?.dia) return `A última busca falhou em ${e.dm(est.ultimoErro.dia)}. A tela mostra os dias medidos${ate ? ` até ${e.dm(ate)}` : ''}.`
    return 'A coleta da origem está desligada.'
  }
  return null
}

function coberturaTexto(c: Cobertura, diasDoPeriodo: number, e: EntradaOrigem): { texto: string; regua: BlocoView['regua'] } {
  const parcial = c.medidos < diasDoPeriodo
  const marca = c.cruzaMarca
  let texto = parcial
    ? `${e.n(c.medidos)} de ${e.n(diasDoPeriodo)} dias com a origem medida`
    : `${e.n(c.medidos)} de ${e.n(diasDoPeriodo)} dias com a origem medida, de ${e.dm(c.primeiroMedido ?? c.de)} a ${e.dm(c.ultimoMedido ?? c.ate)}`
  if (parcial && c.desde) texto += ` · Não medido: a coleta começou em ${e.dmy(c.desde)}`
  if (marca) texto += ` · ${e.dmy(MARCA_DE_CONTAGEM)}: o YouTube mudou como conta views`
  const regua = c.medidos === 0 ? null : {
    medidos: c.medidos, dias: diasDoPeriodo, de: c.primeiroMedido ?? c.de, ate: c.ultimoMedido ?? c.ate, parcial, marca,
    rotuloLeitor: `Origem medida em ${e.n(c.medidos)} de ${e.n(diasDoPeriodo)} dias, de ${e.dm(c.primeiroMedido ?? c.de)} a ${e.dm(c.ultimoMedido ?? c.ate)}.`,
  }
  return { texto, regua }
}

function prefixo(c: Cobertura, diasDoPeriodo: number, e: EntradaOrigem): string {
  return c.medidos < diasDoPeriodo ? `Nos ${e.n(c.medidos)} dias medidos (${e.dm(c.primeiroMedido ?? c.de)} a ${e.dm(c.ultimoMedido ?? c.ate)}), ` : ''
}
const cap = (s: string): string => (s === '' ? s : s[0]!.toUpperCase() + s.slice(1))
const comPrefixo = (pre: string, resto: string): string => (pre === '' ? cap(resto) : pre + resto)

/** As linhas de contagem de vídeos do bloco (vídeos fora e parados). */
function contagemDeVideos(b: BlocoAgregado<string>, e: EntradaOrigem): string[] {
  const m = b.videosNaConta + b.videosFora
  const out: string[] = []
  if (b.videosFora > 0) out.push(`${e.n(b.videosFora)} de ${e.n(m)} vídeos fora desta conta: sem leitura no período.`) // TEXTO-A-REVISAR
  if (b.videosParados > 0) {
    out.push(e.tela === 'video'
      ? `Sem leitura depois de ${e.dm(b.paradosDesde as DiaYt)}.`
      : `${e.n(b.videosParados)} de ${e.n(m)} vídeos sem leitura depois de ${e.dm(b.paradosDesde as DiaYt)}: os dias seguintes contam só os outros.`) // TEXTO-A-REVISAR
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Blocos de dimensão (origem, aparelho, país, inscritos, impressões)

interface Ctx { e: EntradaOrigem; de: DiaYt; ate: DiaYt; dias: number; total: PeriodoEntrada }

function blocoBase(id: IdBloco, b: BlocoAgregado<string>, c: Ctx): BlocoView {
  const { texto, regua } = coberturaTexto(b.cobertura, c.dias, c.e)
  const dimId = id === 'termos' || id === 'impressoes' ? 'origem' : id
  const nm = b.estado === 'nao_medido' && b.motivo !== 'em_revisao'
  const metodo = id === 'origem' || id === 'impressoes' ? [...METODO_ORIGEM] : [METODO_ORIGEM[2]!, METODO_ORIGEM[3]!]
  if (nm) metodo.push(METODO_NAO_MEDIDO)
  if (b.estado === 'em_revisao') metodo.push(METODO_REVISAO)
  if (b.cobertura.desde) metodo.push(LINHA_DIAS_MEDIDOS(c.e.dmy(b.cobertura.desde)))
  if (b.cobertura.cruzaMarca) metodo.push(LINHA_MARCA(c.e.dmy(MARCA_DE_CONTAGEM)))
  const base: BlocoView = {
    id, titulo: TITULO[id], estado: b.estado, frase: '', linhas: [], cobertura: texto, regua, metodo,
    aviso: avisoDeConjunto(b, c.e), bloqueio: null, erro: null, rodape: null, linhasDeContagem: contagemDeVideos(b, c.e), subListas: null,
  }
  if (b.estado === 'nao_medido') {
    const so = c.e.tela === 'video' && b.motivo === 'cobertura_parcial' && b.videosNaConta === 0 && b.videosFora > 0
    base.frase = so ? 'Este vídeo não tem nenhum dia medido no período.' : textoNaoMedido(b, dimId, c.e)
    if (so) base.linhasDeContagem = []
  }
  if (b.estado === 'em_revisao') { base.frase = MSG_REVISAO_FRASE; base.aviso = MSG_REVISAO_AVISO }
  return base
}

function rodapeDoBloco(c: Ctx, viewsMedidas: number): string {
  const t = c.total
  const v = t.videosDoTotal
  const segunda = `A divisão acima usa só as ${c.e.n(viewsMedidas)} views dos dias medidos.`
  return t.totalDoPeriodo == null
    ? segunda
    : `Views no período todo: ${c.e.n(t.totalDoPeriodo)}${v && v.fora + v.parados > 0 ? ` de ${c.e.n(v.naConta)} dos ${c.e.n(v.naConta + v.fora)} vídeos` : ''}. ${segunda}`
}

function pctOmitidoClausula(b: BlocoAgregado<string>, e: EntradaOrigem): string {
  void e
  const nc = b.valorNaoCatalogado > 0 ? `; ${pctTexto(b.pctNaoCatalogado, b.valorNaoCatalogado)} de valores que ainda não sabemos nomear` : '' // TEXTO-A-REVISAR
  return (b.omitido > 0 ? `; ${pctTexto(b.pctOmitido, b.omitido)} omitido pelo YouTube` : '') + nc
}

function blocoOrigem(conj: ConjuntoLido<LinhaBasica>, c: Ctx): { view: BlocoView; agregado: BlocoAgregado<GrupoOrigem> } {
  const b = agregarBloco<GrupoOrigem>({
    conjunto: conj, de: c.de, ate: c.ate, hoje: c.e.hojePt, publicacoes: c.e.publicacoes, ordem: ORDEM_ORIGEM,
    chaveDe: v => { const g = grupoDaOrigem(v.split('|')[0] ?? ''); return { chave: g.grupo, catalogado: g.catalogado } },
  })
  const view = blocoBase('origem', b, c)
  const rotulo = (k: string) => ROTULO_ORIGEM[k as GrupoOrigem].nome
  if (b.estado === 'medido' || b.estado === 'zero') {
    view.linhas = b.estado === 'zero' ? [] : linhasDoBloco(b, rotulo, c.e.n)
    view.rodape = rodapeDoBloco(c, b.total)
    const pre = prefixo(b.cobertura, c.dias, c.e)
    if (b.estado === 'zero') view.frase = `Nenhuma view nos ${c.e.n(b.cobertura.medidos)} dias medidos (${c.e.dm(b.cobertura.primeiroMedido ?? c.de)} a ${c.e.dm(b.cobertura.ultimoMedido ?? c.ate)}): não há o que repartir.`
    else if (b.omitido * 2 > b.total) {
      const dito = b.soma
      view.frase = comPrefixo(pre, `o YouTube disse a origem de só ${c.e.n(dito)} views das ${c.e.n(b.total)}, e ${c.e.n(b.omitido)} foram omitidas: com poucas views por origem ele esconde quase tudo.`)
    } else {
      const dois = b.linhas.filter(l => l.valor > 0).sort((x, y) => y.valor - x.valor).slice(0, 2)
      const de = (l: LinhaBloco<GrupoOrigem>) => ROTULO_ORIGEM[l.chave].de
      let f = ''
      if (dois.length === 1) f = `${pctTexto(dois[0]!.pct, dois[0]!.valor)} das views vieram ${de(dois[0]!)}`
      else if (dois.length === 2) f = `${pctTexto(dois[0]!.pct, dois[0]!.valor)} das views vieram ${de(dois[0]!)} e ${pctTexto(dois[1]!.pct, dois[1]!.valor)} ${de(dois[1]!)}`
      else f = 'Nenhuma origem teve número do YouTube'
      f += pctOmitidoClausula(b, c.e)
      view.frase = comPrefixo(pre, f + '.')
    }
  }
  return { view, agregado: b }
}

function blocoImpressoes(conj: ConjuntoLido<LinhaBasica>, c: Ctx): BlocoView {
  const ordem = ORDEM_ORIGEM.filter(g => g !== 'externa')
  const b = agregarBloco<GrupoOrigem>({
    conjunto: conj, de: c.de, ate: c.ate, hoje: c.e.hojePt, publicacoes: c.e.publicacoes, ordem,
    // não existe miniatura fora do YouTube: o que chegar em "externa" entra em "outras" e a soma fecha
    chaveDe: v => { const g = grupoDaOrigem(v.split('|')[0] ?? ''); return { chave: g.grupo === 'externa' ? 'outras' : g.grupo, catalogado: g.catalogado } },
  })
  const view = blocoBase('impressoes', b, c)
  const rotulo = (k: string) => ROTULO_ORIGEM[k as GrupoOrigem].nome
  const quem = c.e.tela === 'video' ? 'este vídeo foi mostrado' : 'seus vídeos foram mostrados'
  if (b.estado === 'medido') {
    view.linhas = linhasDoBloco(b, rotulo, c.e.n).map(l => (l.tipo === 'omitido' ? { ...l, rotulo: 'Impressões que o relatório não separou por origem' } : l))
    const lider = b.linhas.filter(l => l.valor > 0).sort((x, y) => y.valor - x.valor)[0]
    const pre = prefixo(b.cobertura, c.dias, c.e)
    view.frase = comPrefixo(pre, `${quem} ${c.e.n(b.total)} vezes${lider ? `; ${pctTexto(lider.pct, lider.valor)} ${ROTULO_ORIGEM[lider.chave].de}` : ''}.`)
  } else if (b.estado === 'zero') {
    view.frase = c.e.tela === 'video'
      ? `Zero medido. O YouTube mandou os ${c.e.n(b.cobertura.medidos)} dias e o vídeo não foi mostrado a ninguém: 0 impressões.`
      : `Zero medido. O YouTube mandou os ${c.e.n(b.cobertura.medidos)} dias e nenhum vídeo foi mostrado: 0 impressões.`
  }
  return view
}

function frasePorLider(b: BlocoAgregado<string>, c: Ctx, texto: (k: string) => string): string {
  const pre = prefixo(b.cobertura, c.dias, c.e)
  const lider = b.linhas.filter(l => l.valor > 0).sort((x, y) => y.valor - x.valor)[0]
  const f = lider ? `${pctTexto(lider.pct, lider.valor)} das views vieram ${texto(lider.chave)}${pctOmitidoClausula(b, c.e)}.` : 'Nenhuma dimensão teve número do YouTube.'
  return comPrefixo(pre, f)
}

function blocoAparelho(conj: ConjuntoLido<LinhaBasica>, c: Ctx): BlocoView {
  const b = agregarBloco<GrupoAparelho>({ conjunto: conj, de: c.de, ate: c.ate, hoje: c.e.hojePt, publicacoes: c.e.publicacoes, ordem: ORDEM_APARELHO, chaveDe: v => { const g = grupoDoAparelho(v); return { chave: g.grupo, catalogado: g.catalogado } } })
  const view = blocoBase('aparelho', b, c)
  if (b.estado === 'medido') {
    view.linhas = linhasDoBloco(b, k => ROTULO_APARELHO[k as GrupoAparelho], c.e.n)
    view.frase = frasePorLider(b, c, k => (k === 'tv' ? 'de TV' : `de ${ROTULO_APARELHO[k as GrupoAparelho].toLowerCase()}`))
    view.rodape = rodapeDoBloco(c, b.total)
  } else if (b.estado === 'zero') view.frase = zeroPequeno(b, c)
  return view
}
function zeroPequeno(b: BlocoAgregado<string>, c: Ctx): string { return `Zero medido. Nenhuma view nos ${c.e.n(b.cobertura.medidos)} dias medidos.` }

function blocoPais(conj: ConjuntoLido<LinhaBasica>, c: Ctx): BlocoView {
  const b = agregarBloco<string>({
    conjunto: conj, de: c.de, ate: c.ate, hoje: c.e.hojePt, publicacoes: c.e.publicacoes, ordem: 'por-valor', maxLinhas: MAX_PAISES, resto: 'outros',
    chaveDe: v => ({ chave: v.trim(), catalogado: /^[A-Z]{2}$/.test(v.trim()) && v.trim() !== 'ZZ' }),
  })
  const view = blocoBase('pais', b, c)
  const nome = (k: string) => (k === 'outros' ? 'Outros países' : nomeDoPais(k).nome)
  if (b.estado === 'medido') {
    view.linhas = linhasDoBloco(b, nome, c.e.n)
    const pre = prefixo(b.cobertura, c.dias, c.e)
    const dois = b.linhas.filter(l => l.valor > 0 && l.chave !== 'outros').sort((x, y) => y.valor - x.valor).slice(0, 2)
    const de = (k: string) => nomeDoPais(k).de
    const f = dois.length === 0 ? 'Nenhum país teve número do YouTube'
      : dois.length === 1 ? `${pctTexto(dois[0]!.pct, dois[0]!.valor)} das views vieram ${de(dois[0]!.chave)}`
        : `${pctTexto(dois[0]!.pct, dois[0]!.valor)} das views vieram ${de(dois[0]!.chave)} e ${pctTexto(dois[1]!.pct, dois[1]!.valor)} ${de(dois[1]!.chave)}`
    view.frase = comPrefixo(pre, f + pctOmitidoClausula(b, c.e) + '.')
    view.rodape = rodapeDoBloco(c, b.total)
  } else if (b.estado === 'zero') view.frase = zeroPequeno(b, c)
  return view
}

function blocoInscritos(conj: ConjuntoLido<LinhaBasica>, c: Ctx): BlocoView {
  const b = agregarBloco<'inscritos' | 'nao_inscritos'>({
    conjunto: conj, de: c.de, ate: c.ate, hoje: c.e.hojePt, publicacoes: c.e.publicacoes, ordem: ['inscritos', 'nao_inscritos'],
    chaveDe: v => { const g = grupoDeInscrito(v); return g == null ? null : { chave: g, catalogado: true } },
  })
  const view = blocoBase('inscritos', b, c)
  if (b.estado === 'medido') {
    view.linhas = linhasDoBloco(b, k => (k === 'inscritos' ? 'Inscritos' : 'Não inscritos'), c.e.n)
    view.frase = frasePorLider(b, c, k => (k === 'inscritos' ? 'de inscritos' : 'de quem não é inscrito'))
    view.rodape = rodapeDoBloco(c, b.total)
  } else if (b.estado === 'zero') view.frase = zeroPequeno(b, c)
  return view
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Termos e sites

function sublista(id: 'termos' | 'sites', conj: ConjuntoLido<LinhaDetalhe>, tipo: '5' | '9', c: Ctx, pesquisa: BlocoAgregado<GrupoOrigem> | null, orig: Cobertura | null): SubListaView {
  const texto = new Map<string, string>()
  const filtrado: ConjuntoLido<LinhaDetalhe> = {
    ...conj,
    videos: conj.videos.map(v => ({
      ytId: v.ytId,
      dias: v.dias.map(d => ({ ...d, linhas: d.linhas.filter(l => l.sourceType === tipo && l.detail.trim() !== '') })),
    })),
  }
  for (const v of filtrado.videos) for (const d of v.dias) for (const l of d.linhas) texto.set(l.valor, l.detail)
  const b = agregarBloco<string>({
    conjunto: filtrado as ConjuntoLido<LinhaBasica>, de: c.de, ate: c.ate, hoje: c.e.hojePt, publicacoes: c.e.publicacoes,
    ordem: 'por-valor', maxLinhas: 10, resto: 'outros', chaveDe: v => ({ chave: v, catalogado: true }),
  })
  const titulo = id === 'termos' ? 'O que pesquisaram' : 'De que sites vieram'
  const out: SubListaView = { id, titulo, estado: b.estado, frase: '', linhas: [], comparacao: null }
  const nome = id === 'termos' ? 'termo' : 'site'
  const viewsPesq = pesquisa ? pesquisa.linhas.find(l => l.chave === 'pesquisa')?.valor ?? 0 : 0
  const viewsExt = pesquisa ? pesquisa.linhas.find(l => l.chave === 'externa')?.valor ?? 0 : 0
  const base = id === 'termos' ? viewsPesq : viewsExt
  const comparavel = pesquisa != null && orig != null && pesquisa.estado === 'medido' && diasMedidosEmComum(orig, b.cobertura)
  if (b.estado === 'nao_medido') {
    out.frase = 'Ainda não temos termos nem sites: o relatório do YouTube não chegou. Quando chegar, esta lista aparece sozinha.'
    return out
  }
  if (b.estado === 'zero' || (b.linhas.length === 0)) {
    out.frase = pesquisa && pesquisa.omitido > 0 && base > 0
      ? `Nenhum ${nome} apareceu. O YouTube só mostra ${id === 'termos' ? 'termos' : 'sites'} que trouxeram várias views${id === 'termos' ? `; as ${c.e.n(base)} views da pesquisa ficaram sem termo (omitido pelo YouTube)` : ''}.`
      : b.total === 0 && b.omitido === 0 ? 'Zero medido.' : `Nenhum ${nome} apareceu. O YouTube só mostra ${id === 'termos' ? 'termos' : 'sites'} que trouxeram várias views.`
    return out
  }
  out.linhas = linhasDoBloco(b, k => (k === 'outros' ? 'Outros' : texto.get(k) ?? k), c.e.n).filter(l => l.tipo !== 'omitido')
  const lider = b.linhas.filter(l => l.valor > 0 && l.chave !== 'outros').sort((x, y) => y.valor - x.valor)[0]
  out.frase = lider
    ? (id === 'termos' ? `A busca que mais trouxe gente foi “${texto.get(lider.chave) ?? ''}”, com ${c.e.n(lider.valor)} views.` : `O site que mais trouxe gente foi ${texto.get(lider.chave) ?? ''}, com ${c.e.n(lider.valor)} views.`)
    : ''
  if (comparavel) {
    out.comparacao = id === 'termos'
      ? `Das ${c.e.n(base)} views da pesquisa: ${c.e.n(b.soma)} com termo, ${c.e.n(Math.max(0, base - b.soma))} omitidas pelo YouTube.`
      : `Das ${c.e.n(base)} views de sites de fora: ${c.e.n(b.soma)} com endereço, ${c.e.n(Math.max(0, base - b.soma))} omitidas pelo YouTube.`
  } else if (pesquisa && pesquisa.estado === 'em_revisao') {
    out.comparacao = 'Sem comparar com o total da pesquisa: a origem está em revisão.'
  } else if (orig) {
    out.comparacao = `Sem comparar com o total da pesquisa: a origem foi medida em ${c.e.n(orig.medidos)} dos ${c.e.n(b.cobertura.medidos)} dias desta lista.`
  }
  return out
}

function blocoTermos(det: DetalheCanal, origem: BlocoAgregado<GrupoOrigem>, c: Ctx): BlocoView {
  // o detalhe foi lido numa janela própria (o relatório em lote começa antes da coleta da origem): o período corta pela dele
  const deDet = det.de > c.total.de ? det.de : c.total.de
  const cd: Ctx = { ...c, de: deDet > c.ate ? c.ate : deDet }
  const listas = [sublista('termos', det.conjunto, '5', cd, origem, origem.cobertura), sublista('sites', det.conjunto, '9', cd, origem, origem.cobertura)]
  const b0 = agregarBloco<string>({ conjunto: det.conjunto as ConjuntoLido<LinhaBasica>, de: c.de, ate: c.ate, hoje: c.e.hojePt, publicacoes: c.e.publicacoes, ordem: 'por-valor', chaveDe: () => null })
  const view = blocoBase('termos', b0, c)
  view.estado = listas.every(l => l.estado === 'nao_medido') ? 'nao_medido' : 'medido'
  view.frase = ''
  view.subListas = listas
  view.metodo = [...METODO_TERMOS]
  view.rodape = null
  return view
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Montagem

function blocoErro(id: IdBloco, mensagem: string): BlocoView {
  return { id, titulo: TITULO[id], estado: 'erro', frase: '', linhas: [], cobertura: '', regua: null, metodo: [], aviso: null, bloqueio: null, erro: mensagem, rodape: null, linhasDeContagem: [], subListas: null }
}

function ainda(id: IdBloco, e: EntradaOrigem): BlocoView {
  const pub = e.publicadoEm as DiaYt
  const prim = new Date(pub + 'T00:00:00Z'); prim.setUTCDate(prim.getUTCDate() + DIAS_VIDEO_NOVO)
  const dia = prim.toISOString().slice(0, 10)
  return { ...blocoErro(id, ''), estado: 'ainda_nao_existe', erro: null, frase: `Ainda não existe. O YouTube entrega a origem das views 2 a 3 dias depois da publicação. Primeira leitura em ${e.dm(dia)}.` }
}

function totalDoGrupo(p: PeriodoEntrada, e: EntradaOrigem): string {
  const v = p.videosDoTotal
  if (p.totalDoPeriodo == null) {
    // o diário inteiro não veio (Phil I2): teto é permanente, erro é passageiro, e a célula diz qual dos dois
    const motivo = p.id === 'tudo' && e.origem.acesso === 'ok' ? e.origem.dado.motivoInteiro : undefined
    if (motivo === 'teto') return 'não medido: o canal passou do tamanho que esta tela lê de uma vez' // TEXTO-A-REVISAR
    if (motivo === 'erro') return `${MSG_ERRO} Tente de novo.` // TEXTO-A-REVISAR
    if (v && v.comBuraco > 0) return `não medido: ${e.n(v.naConta - v.comBuraco)} de ${e.n(v.naConta + v.fora)} vídeos com o período inteiro medido`
    return 'não medido'
  }
  return `${e.n(p.totalDoPeriodo)}${v && v.fora + v.parados > 0 ? ` de ${e.n(v.naConta)} dos ${e.n(v.naConta + v.fora)} vídeos` : ''}`
}

/**
 * A faixa de duas células (T17): "views no período" e "dias com origem medida". Quatro estados da segunda: "{N} de {M}"; "0 de {M} · a coleta começa em dd/mm";
 * "— de {M} · não conseguimos ler agora"; "{N} de {M} · origem em revisão". Os textos não estão fixados no plano. // TEXTO-A-REVISAR (Logan)
 */
function faixaDoGrupo(p: PeriodoEntrada, e: EntradaOrigem, total: string, agregado: BlocoAgregado<GrupoOrigem> | null): FaixaOrigem {
  const v = p.videosDoTotal
  const intervalo = `${e.dm(p.de)} a ${e.dm(p.ate)}`
  const views: CelulaFaixaOrigem = p.totalDoPeriodo == null
    ? { rotulo: 'views no período', valor: 'não medido', sub: total === 'não medido' ? intervalo : total }
    : { rotulo: 'views no período', valor: e.n(p.totalDoPeriodo), sub: intervalo + (v && v.fora + v.parados > 0 ? ` · de ${e.n(v.naConta)} dos ${e.n(v.naConta + v.fora)} vídeos` : '') }
  const rotulo = 'dias com origem medida'
  const de = `de ${e.n(diffDias(p.de, p.ate) + 1)}`
  if (agregado == null) return { views, dias: { rotulo, valor: '—', sub: `${de} · não conseguimos ler agora` } }
  const medidos = e.n(agregado.cobertura.medidos)
  if (agregado.estado === 'em_revisao') return { views, dias: { rotulo, valor: medidos, sub: `${de} · origem em revisão` } }
  if (agregado.estado === 'nao_medido' && (agregado.motivo === 'coleta_comeca_em' || agregado.motivo === 'coleta_nao_comecou')) {
    return { views, dias: { rotulo, valor: '0', sub: `${de} · a coleta começa em ${e.dm(agregado.cobertura.desde ?? e.ligadoEm)}` } }
  }
  return { views, dias: { rotulo, valor: medidos, sub: de } }
}

function grupoDoPeriodo(p: PeriodoEntrada, e: EntradaOrigem): GrupoView {
  const total = totalDoGrupo(p, e)
  const comFaixa = e.tela === 'canal'
  // um bloco só, com um alerta e um botão (Yannis m5); origem negada com nível que a libera é divergência das duas provas: também erro, nunca o grupo mudo (m4)
  if (e.origem.acesso !== 'ok') return { total, blocos: [blocoErro('origem', MSG_ERRO)], ...(comFaixa ? { faixa: faixaDoGrupo(p, e, total, null) } : {}) }
  if (e.tela === 'video' && videoNovo(e.publicadoEm, e.hojePt)) return { total, blocos: (['origem', 'impressoes', 'termos', 'aparelho', 'pais', 'inscritos'] as const).map(id => ainda(id, e)) }
  const dims = e.origem.dado.dimensoes
  const de = p.de > dims.de ? p.de : dims.de
  const c: Ctx = { e, de: de > p.ate ? p.ate : de, ate: p.ate, dias: diffDias(p.de, p.ate) + 1, total: p }
  const o = blocoOrigem(dims.conjuntos.trafego, c)
  const blocos: BlocoView[] = [o.view, blocoImpressoes(dims.conjuntos.alcance_dim, c)]
  if (e.nivel === 'sem-termos') {
    const b: BlocoView = { ...blocoErro('termos', ''), estado: 'bloqueado', erro: null, subListas: null }
    b.bloqueio = 'Você não vê este dado. Termos de pesquisa e sites de fora só aparecem para quem edita o site.'
    b.frase = 'Aqui há duas listas que você não vê: o que pesquisaram e de que sites vieram. O resto desta página continua à sua vista.'
    blocos.push(b)
  } else if (e.termos.acesso === 'ok') {
    blocos.push(blocoTermos(e.termos.dado, o.agregado, c))
  } else if (e.termos.acesso === 'erro' || e.podeEditar) {
    blocos.push(blocoErro('termos', `${MSG_ERRO} Tentar de novo.`))
  } else {
    const b: BlocoView = { ...blocoErro('termos', ''), estado: 'bloqueado', erro: null }
    b.bloqueio = 'Você não vê este dado. Termos de pesquisa e sites de fora só aparecem para quem edita o site.'
    b.frase = 'Aqui há duas listas que você não vê: o que pesquisaram e de que sites vieram. O resto desta página continua à sua vista.'
    blocos.push(b)
  }
  blocos.push(blocoAparelho(dims.conjuntos.dispositivo, c), blocoPais(dims.conjuntos.pais, c), blocoInscritos(dims.conjuntos.inscrito, c))
  return { total, blocos, ...(comFaixa ? { faixa: faixaDoGrupo(p, e, total, o.agregado) } : {}) }
}

export function buildOrigem(e: EntradaOrigem): OrigemView {
  const base = { nivel: e.nivel, lembranca: 'Escolha salva neste navegador.', dica: '' }
  if (e.nivel === 'so-aviso') {
    return {
      ...base, periodos: [], padrao: '',
      semAcesso: {
        titulo: 'Dado que você não vê',
        frases: ['Você não vê este dado. De onde vêm as views, o que pesquisaram, aparelho, país, inscritos e impressões por origem são do dono do canal.', `São ${BLOCOS_NOMEADOS.length} blocos nesta página: ${BLOCOS_NOMEADOS.join(', ')}. O total acima continua à sua vista.`],
        blocos: BLOCOS_NOMEADOS,
      },
    }
  }
  const periodos = e.periodos.map(p => ({ id: p.id, rotulo: p.rotulo, grupo: grupoDoPeriodo(p, e) }))
  const ultimo = e.periodos[0]?.ate
  return { ...base, periodos, padrao: e.periodos[0]?.id ?? '', dica: ultimo ? `Dados até ${e.dm(ultimo)}: o YouTube entrega com 2 a 3 dias de atraso.` : '', semAcesso: null }
}
