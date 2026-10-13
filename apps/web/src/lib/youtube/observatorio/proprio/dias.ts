// Dias do alcance do canal próprio: três estados por dia (com impressões, zero medido,
// não medido), cliques estimados e resumo. Puro, sem banco.
// Nulo nunca vira zero: dia não medido tem imp/cliques null e fica fora de toda soma.

import { addDays, dayPt, diffDias } from '@/lib/youtube/coleta/day-pt'
import type { AlcanceCanal, AlcanceLinha, DiaYt, RelatorioDia } from './tipos'

export const JANELA_ALCANCE_DIAS = 30
/** Quantos dias para trás, contando de hoje, o leitor do alcance procura relatório (a janela de 30 dias mais 5 de folga). Sem relatório aqui dentro, a tela diz desde quando a coleta parou. */
export const JANELA_LEITURA_ALCANCE_DIAS = JANELA_ALCANCE_DIAS + 5

export type Situacao = 'com-impressoes' | 'zero-medido' | 'nao-medido'
export type MotivoDia = 'sem-relatorio' | 'nao-baixado' | 'erro' | 'expirado' | 'recente'

/**
 * Quantos dias, contando de hoje para trás, o YouTube ainda está entregando (hoje = D e ontem = D-1): o relatório de um dia chega com
 * atraso e pode vir vazio ou parcial, então a AUSÊNCIA de linha nesses dois dias nunca é zero medido. Linha com valor é mostrada.
 */
export const DIAS_RECENTES = 2

/**
 * Menos que isto de vida (hoje menos o dia da publicação) e o vídeo é NOVO: o alcance dele chega com 2 a 3 dias de atraso, então ainda não há
 * dia fechado e a ausência de linha nunca é zero. UM limite só, para a página do vídeo, o cartão, a lista e a régua.
 */
export const DIAS_DE_VIDA_MIN = 3

/** O vídeo é novo (menos de DIAS_DE_VIDA_MIN dias de vida)? Sem data de publicação (`null`) nunca é novo. */
export function videoNovo(publicadoEm: DiaYt | null | undefined, hoje: DiaYt): boolean {
  return publicadoEm != null && diffDias(publicadoEm, hoje) < DIAS_DE_VIDA_MIN
}

/** O dia é hoje (D) ou ontem (D-1)? `hoje` é o dia do YouTube (Pacífico), o mesmo das datas dos relatórios. */
export function diaRecente(dia: DiaYt, hoje: DiaYt): boolean {
  return dia >= addDays(hoje, -(DIAS_RECENTES - 1))
}

/**
 * A regra única de "os dias que valem para este vídeo": o primeiro é o da publicação (ou o início da janela, se for depois). O dia anterior à
 * publicação NÃO existe para o vídeo: não é zero, não é "não medido", não entra em total, denominador nem frase. Publicação sem data
 * (`null`): nenhum corte, vale a janela inteira (o que as séries do vídeo já faziam).
 */
export function inicioDoVideo(inicioJanela: DiaYt, publicadoEm: DiaYt | null | undefined): DiaYt {
  return publicadoEm != null && publicadoEm > inicioJanela ? publicadoEm : inicioJanela
}

/** O dia da publicação de cada vídeo, por `ytId` (o dia do YouTube). Vídeo ausente ou `null` = sem data: nenhum corte. */
export type PublicacoesPorYtId = ReadonlyMap<string, DiaYt | null>

/** Monta as publicações a partir dos vídeos do canal (`pub` em milissegundos, como o motor guarda). Sem `pub` finito: sem data. */
export function publicacoesDe(videos: Iterable<{ ytId: string; pub: number | null | undefined }>): PublicacoesPorYtId {
  const m = new Map<string, DiaYt | null>()
  for (const v of videos) m.set(v.ytId, v.pub != null && Number.isFinite(v.pub) ? dayPt(new Date(v.pub)) : null)
  return m
}

export interface DiaAlcance {
  dia: DiaYt
  situacao: Situacao
  motivo: MotivoDia | null
  imp: number | null
  cliques: number | null
}

export interface Periodo {
  de: DiaYt
  ate: DiaYt
  dias: number
}

export interface ResumoAlcance {
  imp: number | null
  cliques: number | null
  diasComImpressao: number
  diasLidos: number
  diasNaoMedidos: number
  /** Dias com impressões cujo CTR não veio (um só deles derruba os cliques e a taxa do período inteiro): a frase diz quantos foram. */
  diasSemCtr: number
}

export interface AlcanceVideo {
  imp: number
  cliques: number | null
  diasComImpressao: number
}

/** Termina no relatório mais novo (qualquer status); começa no mais antigo se houver menos de 30 dias. */
export function periodoDoAlcance(relatorios: readonly RelatorioDia[]): Periodo | null {
  const primeiro = relatorios[0]
  if (!primeiro) return null
  let menor = primeiro.dia
  let maior = primeiro.dia
  for (const r of relatorios) {
    if (r.dia < menor) menor = r.dia
    if (r.dia > maior) maior = r.dia
  }
  const janela = addDays(maior, -(JANELA_ALCANCE_DIAS - 1))
  const de = janela > menor ? janela : menor
  return { de, ate: maior, dias: diffDias(de, maior) + 1 }
}

/** Relatório lido de verdade: baixado ou vazio, e normalizado. */
function medido(r: RelatorioDia): boolean {
  return (r.status === 'baixado' || r.status === 'vazio') && r.normalizado
}

function motivoDe(r: RelatorioDia): MotivoDia {
  switch (r.status) {
    case 'erro':
      return 'erro'
    case 'expirado_sem_baixar':
      return 'expirado'
    case 'listado':
    case 'baixado':
    case 'vazio':
    case 'desconhecido':
      return 'nao-baixado'
    default: {
      const _nunca: never = r.status
      return _nunca
    }
  }
}

/**
 * Vários relatórios no mesmo dia, nenhum medido: vale o motivo mais recuperável
 * (algo ainda por baixar), depois erro, depois expirado.
 */
function motivoDoDia(relatorios: readonly RelatorioDia[]): MotivoDia {
  if (relatorios.length === 0) return 'sem-relatorio'
  const motivos = relatorios.map(motivoDe)
  if (motivos.includes('nao-baixado')) return 'nao-baixado'
  if (motivos.includes('erro')) return 'erro'
  return 'expirado'
}

/** Soma impressões × CTR sem arredondar; null se alguma linha com impressão não tem CTR. */
function cliquesDe(linhas: readonly AlcanceLinha[]): number | null {
  let total = 0
  for (const l of linhas) {
    if (l.imp == null || l.imp <= 0) continue
    if (l.ctr == null) return null
    total += l.imp * l.ctr
  }
  return total
}

function comImpressao(l: AlcanceLinha): boolean {
  return l.imp != null && l.imp > 0
}

export interface OpcoesDias {
  /** Hoje (D) no dia do YouTube: obrigatório, para a regra de D e D-1 nunca depender do relógio da máquina. */
  hoje: DiaYt
  /** Sem `ytId`: o canal. Com `ytId`: só aquele vídeo (dia medido em que ele não veio é zero medido). */
  ytId?: string
  /** O dia da publicação do vídeo (só com `ytId`); null/ausente = sem corte. */
  publicadoEm?: DiaYt | null
}

/**
 * O ponto ÚNICO em que o dia do alcance é classificado. Zero medido = relatório lido, dia que já valia para o vídeo e que não é D nem D-1;
 * D e D-1 sem linha são "não medido", com relatório lido ou não. Linha com valor, em qualquer dia, é sempre mostrada.
 */
export function montarDias(a: AlcanceCanal, o: OpcoesDias): { periodo: Periodo | null; dias: DiaAlcance[]; avisos: string[] } {
  const { hoje, ytId } = o
  const base = periodoDoAlcance(a.relatorios)
  if (!base) return { periodo: null, dias: [], avisos: [] }
  const de = ytId !== undefined ? inicioDoVideo(base.de, o.publicadoEm) : base.de
  if (de > base.ate) return { periodo: null, dias: [], avisos: [] }
  const periodo: Periodo = de === base.de ? base : { de, ate: base.ate, dias: diffDias(de, base.ate) + 1 }

  const relPorDia = new Map<DiaYt, RelatorioDia[]>()
  for (const r of a.relatorios) {
    const l = relPorDia.get(r.dia)
    if (l) l.push(r)
    else relPorDia.set(r.dia, [r])
  }
  const linhasPorDia = new Map<DiaYt, AlcanceLinha[]>()
  for (const l of a.linhas) {
    if (ytId !== undefined && l.ytId !== ytId) continue
    if (!comImpressao(l)) continue
    const lista = linhasPorDia.get(l.dia)
    if (lista) lista.push(l)
    else linhasPorDia.set(l.dia, [l])
  }

  const dias: DiaAlcance[] = []
  const avisos: string[] = []
  for (let i = 0; i < periodo.dias; i++) {
    const dia = addDays(periodo.de, i)
    const rels = relPorDia.get(dia) ?? []
    const linhas = linhasPorDia.get(dia) ?? []
    const temMedido = rels.some(medido)
    if (linhas.length > 0) {
      if (!temMedido) avisos.push(`${dia}: há impressões sem relatório nesse dia`)
      let imp = 0
      for (const l of linhas) imp += l.imp ?? 0
      dias.push({ dia, situacao: 'com-impressoes', motivo: null, imp, cliques: cliquesDe(linhas) })
    } else if (temMedido && !diaRecente(dia, hoje)) {
      dias.push({ dia, situacao: 'zero-medido', motivo: null, imp: 0, cliques: 0 })
    } else {
      dias.push({ dia, situacao: 'nao-medido', motivo: temMedido ? 'recente' : motivoDoDia(rels), imp: null, cliques: null })
    }
  }
  return { periodo, dias, avisos }
}

export function resumir(dias: readonly DiaAlcance[]): ResumoAlcance {
  let imp = 0
  let cliques = 0
  let cliquesNaoMedidos = false
  let diasComImpressao = 0
  let diasLidos = 0
  let diasNaoMedidos = 0
  let diasSemCtr = 0
  for (const d of dias) {
    if (d.situacao === 'nao-medido') {
      diasNaoMedidos++
      continue
    }
    diasLidos++
    imp += d.imp ?? 0
    if (d.situacao === 'com-impressoes') {
      diasComImpressao++
      if (d.cliques == null) { cliquesNaoMedidos = true; diasSemCtr++ }
      else cliques += d.cliques
    }
  }
  if (diasLidos === 0) return { imp: null, cliques: null, diasComImpressao, diasLidos, diasNaoMedidos, diasSemCtr }
  return { imp, cliques: cliquesNaoMedidos ? null : cliques, diasComImpressao, diasLidos, diasNaoMedidos, diasSemCtr }
}

/**
 * Só vídeos com alguma impressão no período. O total de cada vídeo começa no primeiro dia que vale para ELE (`inicioDoVideo`, a mesma regra de
 * `montarDias` com `ytId`): linha anterior à publicação não existe, em lugar nenhum. `publicacoes` é obrigatório para ninguém esquecer o corte.
 */
export function alcancePorVideo(a: AlcanceCanal, publicacoes: PublicacoesPorYtId): Map<string, AlcanceVideo> {
  const periodo = periodoDoAlcance(a.relatorios)
  const saida = new Map<string, AlcanceVideo>()
  if (!periodo) return saida
  const cliquesNulos = new Set<string>()
  for (const l of a.linhas) {
    if (l.dia < inicioDoVideo(periodo.de, publicacoes.get(l.ytId)) || l.dia > periodo.ate) continue
    if (l.imp == null || l.imp <= 0) continue
    const atual = saida.get(l.ytId) ?? { imp: 0, cliques: 0 as number | null, diasComImpressao: 0 }
    atual.imp += l.imp
    atual.diasComImpressao++
    if (l.ctr == null) cliquesNulos.add(l.ytId)
    else if (atual.cliques != null) atual.cliques += l.imp * l.ctr
    saida.set(l.ytId, atual)
  }
  for (const id of cliquesNulos) {
    const v = saida.get(id)
    if (v) v.cliques = null
  }
  return saida
}

/**
 * O que o corte por vídeo (`inicioDoVideo`) descarta: as linhas de alcance com impressão de um dia ANTERIOR à publicação do vídeo, dentro do período. Só conta, nunca
 * muda um total por vídeo (`alcancePorVideo` segue cortando igual). O total do CANAL soma essas linhas, então fica maior que a soma dos vídeos; a tela diz isso, e só quando
 * este número é maior que zero. Mesmo filtro de `alcancePorVideo`: se um mudar, o outro muda junto.
 */
export function alcanceAntesDaPublicacao(a: AlcanceCanal, publicacoes: PublicacoesPorYtId): { linhas: number; imp: number } {
  const periodo = periodoDoAlcance(a.relatorios)
  if (!periodo) return { linhas: 0, imp: 0 }
  let linhas = 0
  let imp = 0
  for (const l of a.linhas) {
    if (l.dia > periodo.ate || l.dia < periodo.de) continue
    if (l.dia >= inicioDoVideo(periodo.de, publicacoes.get(l.ytId))) continue
    if (l.imp == null || l.imp <= 0) continue
    linhas++
    imp += l.imp
  }
  return { linhas, imp }
}

export function motivoDiaTexto(m: MotivoDia): string {
  switch (m) {
    case 'sem-relatorio':
      return 'sem relatório deste dia (não medido)'
    case 'nao-baixado':
      return 'relatório ainda não baixado (não medido)'
    case 'erro':
      return 'o relatório deste dia deu erro (não medido)'
    case 'expirado':
      return 'o relatório deste dia expirou sem ser baixado (não medido)'
    case 'recente':
      return 'dia recente: o YouTube ainda está entregando; não medido'
    default: {
      const _nunca: never = m
      return _nunca
    }
  }
}
