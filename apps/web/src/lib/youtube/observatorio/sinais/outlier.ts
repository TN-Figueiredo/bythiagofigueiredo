// Maior outlier da evidência de um sinal (movido de `_sugestoes/view-model.ts`: a lib não importa da pasta da tela). F4 T2.
import type { Evidence } from './oportunidades'

export type Outlier = Evidence['outliers'][number]
/** Maior `mult_vpd7`, desempate por `video_id`. `null` se a evidência não traz outlier. */
export function outlierMaisForte(e: Evidence): Outlier | null {
  const lista = Array.isArray(e?.outliers) ? e.outliers.filter((o) => Number.isFinite(o.mult_vpd7)) : []
  if (lista.length === 0) return null
  return [...lista].sort((a, b) => b.mult_vpd7 - a.mult_vpd7 || a.video_id.localeCompare(b.video_id))[0]!
}
