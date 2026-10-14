import { MEASURE_RULES } from './regras'

const DIA_SP = /^\d{4}-\d{2}-\d{2}$/

function exigeDia(dia: string): void {
  if (typeof dia !== 'string' || !DIA_SP.test(dia) || Number.isNaN(Date.parse(dia + 'T00:00:00Z')) || new Date(dia + 'T00:00:00Z').toISOString().slice(0, 10) !== dia) {
    throw new Error('dia_malformado')
  }
}

/** Qual regra de contagem de views valia no dia de São Paulo `AAAA-MM-DD` (mudança em `MEASURE_RULES.countChange`). */
export function countRuleOf(dia: string): 'ate_2026-08-23' | 'desde_2026-08-24' {
  exigeDia(dia)
  return dia < MEASURE_RULES.countChange ? 'ate_2026-08-23' : 'desde_2026-08-24'
}

/** Verdadeiro quando `de < 24/08/2026 <= ate` (a janela começa antes da mudança e termina no dia dela ou depois). */
export function cruzaMudancaDeContagem(de: string, ate: string): boolean {
  exigeDia(de)
  exigeDia(ate)
  return de < MEASURE_RULES.countChange && MEASURE_RULES.countChange <= ate
}
