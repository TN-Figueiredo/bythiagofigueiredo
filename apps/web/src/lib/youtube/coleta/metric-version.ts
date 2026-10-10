// A definição de "view" do YouTube mudou duas vezes; cada linha de métrica diz sob qual definição foi contada.
// Os cortes são por `day_pt` (spec, seção 1). Comparação de texto: AAAA-MM-DD ordena como data.

export type MetricVersion = 'views_ate_2025-03-30' | 'views_2025-03-31_a_2026-08-26' | 'views_desde_2026-08-27'

const DIA = /^\d{4}-\d{2}-\d{2}$/

export function metricVersion(dayPt: string): MetricVersion {
  if (!DIA.test(dayPt)) throw new Error(`dia inválido para metric_version: ${dayPt.slice(0, 20)}`)
  if (dayPt < '2025-03-31') return 'views_ate_2025-03-30'
  if (dayPt < '2026-08-27') return 'views_2025-03-31_a_2026-08-26'
  return 'views_desde_2026-08-27'
}
