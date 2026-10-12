// Dias do alcance do canal próprio: três estados por dia (com impressões, zero medido,
// não medido), cliques estimados e resumo. Puro, sem banco.
// Nulo nunca vira zero: dia não medido tem imp/cliques null e fica fora de toda soma.

import { addDays, diffDias } from '@/lib/youtube/coleta/day-pt'
import type { AlcanceCanal, AlcanceLinha, DiaYt, RelatorioDia } from './tipos'

export const JANELA_ALCANCE_DIAS = 30

export type Situacao = 'com-impressoes' | 'zero-medido' | 'nao-medido'
export type MotivoDia = 'sem-relatorio' | 'nao-baixado' | 'erro' | 'expirado'

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

/** Sem `ytId`: o canal. Com `ytId`: só aquele vídeo (dia medido em que ele não veio é zero medido). */
export function montarDias(a: AlcanceCanal, ytId?: string): { periodo: Periodo | null; dias: DiaAlcance[]; avisos: string[] } {
  const periodo = periodoDoAlcance(a.relatorios)
  if (!periodo) return { periodo: null, dias: [], avisos: [] }

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
      if (!temMedido) avisos.push(`${dia}: há impressões sem relatório lido nesse dia`)
      let imp = 0
      for (const l of linhas) imp += l.imp ?? 0
      dias.push({ dia, situacao: 'com-impressoes', motivo: null, imp, cliques: cliquesDe(linhas) })
    } else if (temMedido) {
      dias.push({ dia, situacao: 'zero-medido', motivo: null, imp: 0, cliques: 0 })
    } else {
      dias.push({ dia, situacao: 'nao-medido', motivo: motivoDoDia(rels), imp: null, cliques: null })
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
  for (const d of dias) {
    if (d.situacao === 'nao-medido') {
      diasNaoMedidos++
      continue
    }
    diasLidos++
    imp += d.imp ?? 0
    if (d.situacao === 'com-impressoes') {
      diasComImpressao++
      if (d.cliques == null) cliquesNaoMedidos = true
      else cliques += d.cliques
    }
  }
  if (diasLidos === 0) return { imp: null, cliques: null, diasComImpressao, diasLidos, diasNaoMedidos }
  return { imp, cliques: cliquesNaoMedidos ? null : cliques, diasComImpressao, diasLidos, diasNaoMedidos }
}

/** Só vídeos com alguma impressão no período. */
export function alcancePorVideo(a: AlcanceCanal): Map<string, AlcanceVideo> {
  const periodo = periodoDoAlcance(a.relatorios)
  const saida = new Map<string, AlcanceVideo>()
  if (!periodo) return saida
  const cliquesNulos = new Set<string>()
  for (const l of a.linhas) {
    if (l.dia < periodo.de || l.dia > periodo.ate) continue
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
    default: {
      const _nunca: never = m
      return _nunca
    }
  }
}
