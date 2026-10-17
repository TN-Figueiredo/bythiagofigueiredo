// A5 E5a, Tarefa 14b: a barra de progresso de um "não medido" com data ("50 de 112 dias"). Puro.
const MS_DIA = 86_400_000
const diasEntre = (de: string, ate: string): number => Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / MS_DIA)

/**
 * `feitos = total − dias de hoje até fechaEm`, entre 0 e `total`. `fechaEm` nulo devolve nulo: a tela escreve o motivo sem barra e
 * SEM data. `fechaEm` vem da medida da E4 ou do calendário da Tarefa 1, nunca de conta própria.
 */
export function progresso(total: number, fechaEm: string | null, hojeSP: string): { feitos: number; total: number; fechaEm: string } | null {
  if (fechaEm === null) return null
  const feitos = Math.min(total, Math.max(0, total - diasEntre(hojeSP, fechaEm)))
  return { feitos, total, fechaEm }
}
