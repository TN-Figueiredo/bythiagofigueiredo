/** Rótulo "Dia N/teto" contado de 1: os dias passados (0 nas primeiras 24 h) viram o dia corrente. A conta de decisão não muda. */
export function rotuloDoDia(diasPassados: number, teto: number): string {
  if (!Number.isFinite(teto) || teto < 1) return ''
  const passados = Number.isFinite(diasPassados) ? Math.max(0, Math.floor(diasPassados)) : 0
  return `Dia ${Math.min(passados + 1, teto)}/${Math.floor(teto)}`
}

/** Andamento contado de 1, a partir dos dias passados (a conta de decisão não muda). */
export function andamentoDoDia(diasPassados: number, teto: number): { atual: number; faltam: number; ultimo: boolean; passou: boolean } {
  const p = Number.isFinite(diasPassados) ? Math.max(0, Math.floor(diasPassados)) : 0
  const atual = p + 1
  return { atual, faltam: Math.max(0, teto - atual), ultimo: atual >= teto && p <= teto, passou: p > teto }
}

/** Texto "dia N de T" (ou "Dia N de T") montado dos números, sem depender do formato de `rotuloDoDia`. Vazio com teto < 1. */
export function rotuloDoDiaExtenso(diasPassados: number, teto: number, opcoes: { minusculo?: boolean } = {}): string {
  if (!Number.isFinite(teto) || teto < 1) return ''
  const { atual } = andamentoDoDia(diasPassados, teto)
  return `${opcoes.minusculo ? 'dia' : 'Dia'} ${Math.min(atual, Math.floor(teto))} de ${Math.floor(teto)}`
}
