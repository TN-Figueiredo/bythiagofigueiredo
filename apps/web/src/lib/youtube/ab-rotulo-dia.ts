/** Rótulo "Dia N/teto" contado de 1: os dias passados (0 nas primeiras 24 h) viram o dia corrente. A conta de decisão não muda. */
export function rotuloDoDia(diasPassados: number, teto: number): string {
  if (!Number.isFinite(teto) || teto < 1) return ''
  const passados = Number.isFinite(diasPassados) ? Math.max(0, Math.floor(diasPassados)) : 0
  return `Dia ${Math.min(passados + 1, teto)}/${Math.floor(teto)}`
}
