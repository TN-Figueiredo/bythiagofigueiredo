import { RULES } from '../rules'

export type PassoDaRemocao = 'esperar' | 'exportar' | 'conferir' | 'copiar_e_confirmar' | 'remover'

export interface EstadoDaRemocao {
  pausadoEm: string | null
  lote: { exportadoEm: string; conferidoEm: string | null; confirmadoEm: string | null; fechadoEm: string | null } | null
}

/**
 * Regra única do passo de uma remoção pedida (o comando `pedidos` e a tela importam esta mesma função).
 * Um lote só vale se não foi fechado e foi exportado depois da pausa; senão conta como "sem lote".
 */
export function passoDaRemocao(e: EstadoDaRemocao, agoraMs: number): { passo: PassoDaRemocao; minutos?: number } {
  const pausadoMs = e.pausadoEm === null ? NaN : Date.parse(e.pausadoEm)
  if (!Number.isFinite(pausadoMs)) return { passo: 'esperar', minutos: RULES.pause.minMinutesBeforeExport }
  const esperaMs = RULES.pause.minMinutesBeforeExport * 60_000
  const decorrido = agoraMs - pausadoMs
  if (decorrido < esperaMs) return { passo: 'esperar', minutos: Math.ceil((esperaMs - decorrido) / 60_000) }
  const l = e.lote
  const vale = l !== null && l.fechadoEm === null && Date.parse(l.exportadoEm) >= pausadoMs
  if (!l || !vale) return { passo: 'exportar' }
  if (l.conferidoEm === null) return { passo: 'conferir' }
  if (l.confirmadoEm === null) return { passo: 'copiar_e_confirmar' }
  return { passo: 'remover' }
}
