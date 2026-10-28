// F2b, núcleo puro: janelas do par, prontidão de fecho por fonte e soma da janela com o estado do dia.
import { addDays, diffDias } from '../../../coleta/day-pt'
import type { EstadoValor } from '../../proprio/dimensoes-estado'
import { FONTE_DA_METRICA, REGRA_D2, type MetricaD2, type Par } from './regra-d2'

/** Os dias de cada janela; o dia da publicação não pertence a nenhuma. */
export function janelasDoPar(pubDia: string): { pre: string[]; pos: string[] } {
  const faixa = (de: number, n: number): string[] => Array.from({ length: n }, (_, i) => addDays(pubDia, de + i))
  return { pre: faixa(-REGRA_D2.preDias, REGRA_D2.preDias), pos: faixa(1, REGRA_D2.posDias) }
}

/** Até onde cada família de fonte está coberta no canal: reporting (`end_time`) e Analytics (`covered_to`). */
export interface CoberturaDeFecho { ateReporting: string | null; ateAnalytics: string | null }

export type Prontidao = 'aguarda' | 'fecha' | 'desiste'

/**
 * Por métrica/fonte (E-b9): uma fonte atrasada não segura as outras. Reporting (R2/R3/R5): `end_time >= pub+31` e `hoje >= pub+34`.
 * Analytics (R1/R4): `hoje >= pub+41` e `covered_to >= pub+30`; buraco dentro da janela vira `dias_sem_cobertura`, não espera.
 * Em `pub+60` sem condição cumprida: `desiste`.
 */
export function prontoParaFechar(par: Pick<Par, 'pubDia'>, metrica: MetricaD2, hoje: string, cobertura: CoberturaDeFecho): Prontidao {
  const idade = diffDias(par.pubDia, hoje)
  const fonte = FONTE_DA_METRICA[metrica]
  const analytics = fonte === 'R1' || fonte === 'R4'
  let ok: boolean
  if (analytics) {
    ok = idade >= REGRA_D2.fechaAnalyticsEmDias && cobertura.ateAnalytics !== null && diffDias(par.pubDia, cobertura.ateAnalytics) >= REGRA_D2.posDias
  } else {
    ok = idade >= REGRA_D2.fechaReportingEmDias && cobertura.ateReporting !== null && diffDias(par.pubDia, cobertura.ateReporting) >= REGRA_D2.posDias + 1
  }
  if (ok) return 'fecha'
  return idade >= REGRA_D2.desisteEmDias ? 'desiste' : 'aguarda'
}

export type MotivoSoma = 'cobertura' | 'limiar' | 'em_revisao' | 'sem_valor'
export type SomaJanela = { soma: number } | { nao_medido: MotivoSoma; diasSemCobertura: number }

/**
 * Só `valor` e `zero_medido` somam. Cada dia que não soma conta em `diasSemCobertura`; o motivo é o mais forte (R3-2):
 * `cobertura` (fora da cobertura, base não medida, antes do início) > `em_revisao` (soma de origens > base) > `sem_valor` (linha
 * existe e o número não veio: nulo não é zero) > `limiar` (sem linha e soma < base). Sem linha nunca é zero.
 */
export function somarJanela(serie: Map<string, number>, dias: string[], estadoDe: (dia: string) => EstadoValor): SomaJanela {
  let soma = 0
  let cobertura = 0
  let revisao = 0
  let semValor = 0
  let limiar = 0
  for (const dia of dias) {
    const e = estadoDe(dia)
    if (e.tipo === 'zero_medido') continue
    if (e.tipo === 'valor') {
      const v = serie.get(dia) ?? e.views
      if (v === null || v === undefined || !Number.isFinite(v)) semValor++
      else soma += v
    } else if (e.tipo === 'zero_ou_abaixo_do_limiar') limiar++
    else if (e.tipo === 'em_revisao') revisao++
    else cobertura++
  }
  const falhas = cobertura + revisao + semValor + limiar
  if (falhas === 0) return { soma }
  const nao_medido: MotivoSoma = cobertura > 0 ? 'cobertura' : revisao > 0 ? 'em_revisao' : semValor > 0 ? 'sem_valor' : 'limiar'
  return { nao_medido, diasSemCobertura: falhas }
}
