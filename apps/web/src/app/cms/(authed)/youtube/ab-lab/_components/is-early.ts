import type { AbTestDetailView, AbTestActiveView } from '@/lib/youtube/ab-types'

/**
 * Teste no começo: nenhum ciclo fechado e confiança < 5%. Pausado nunca é "começo" (D6): o ActiveDetail tem Retomar,
 * o EarlyDetail não.
 */
export function isEarly(view: AbTestDetailView): view is AbTestActiveView {
  if (view.status === 'completed') return false
  if (view.status === 'paused') return false
  const active = view as AbTestActiveView
  return active.cycles.done < 1 && (active.confirmedData.confidence === null || active.confirmedData.confidence < 5)
}
