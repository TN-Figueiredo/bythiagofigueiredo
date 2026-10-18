import { addDays, boundsAnalytics, dayPt, diffDias, type DiaPt } from '../coleta/day-pt'
import { calcularAbDoDia, type AbCycle, type AbTest, type MotivoNulo } from '../coleta/ab-seconds'
import type { MetaDoDia, MotivoSemVariante } from './tipos'

export type { MetaDoDia, MotivoSemVariante } from './tipos'

export interface Atribuicao {
  variant_id: string | null
  motivo_sem_variante: MotivoSemVariante | null
  motivo_nulo_meta: MotivoNulo | null
  segundos_no_ar: number | null
  segundos_do_dia: number
}

function segundosDoDia(day: DiaPt): number {
  const b = boundsAnalytics(day)
  return (b.end - b.start) / 1000
}

/** Atribui o dia a uma variante pela meta do dia; sem meta legível nunca se adivinha pela linha do ciclo (C-4). */
export function atribuirDia(i: { testId: string; day: DiaPt; meta: MetaDoDia | null; teste: AbTest; ciclos: AbCycle[] }): Atribuicao {
  const segundos_do_dia = segundosDoDia(i.day)
  const sem = (motivo: MotivoSemVariante, segundos_no_ar: number | null, motivo_nulo_meta: MotivoNulo | null = null): Atribuicao =>
    ({ variant_id: null, motivo_sem_variante: motivo, motivo_nulo_meta, segundos_no_ar, segundos_do_dia })
  const m = i.meta
  if (!m) return sem('meta_ausente', null)
  const segundos = m.seconds_on_air_analytics
  if (m.ab_test_id !== null && m.ab_test_id !== i.testId) return sem('dia_de_outro_teste', segundos)
  if (m.ab_test_id === null || m.ab_variant_id === null || segundos === null) {
    const motivo = calcularAbDoDia({ day: i.day, tests: [i.teste], cycles: i.ciclos, capturedAt: Date.parse(m.captured_at), titleAtCapture: null }).motivoNulo
    return sem('meta_nula', segundos, motivo)
  }
  if (segundos < 0.9 * segundos_do_dia) return sem('menos_de_90', segundos)
  return { variant_id: m.ab_variant_id, motivo_sem_variante: null, motivo_nulo_meta: null, segundos_no_ar: segundos, segundos_do_dia }
}

/**
 * Dias do Pacífico com sobreposição > 0 de algum ciclo, entre `desde` e `ontem` (nunca hoje, nunca antes de `desde`).
 * Ciclo aberto segue fimEfetivo (depende do status do teste); sem nenhum dos dois, até `ontem`.
 */
export function diasDoTeste(ciclos: AbCycle[], teste: AbTest, ontem: DiaPt, desde: DiaPt): DiaPt[] {
  // Mesma regra de fimEfetivo (ab-seconds.ts): teste ativo não para no paused_at; sem data de parada, vai até ontem.
  const parou = teste.status === 'active' ? null
    : teste.status === 'completed' || teste.status === 'archived'
      ? (teste.completed_at ?? teste.paused_at) : (teste.paused_at ?? teste.completed_at)
  const faixas = ciclos.map(c => {
    const ini = Date.parse(c.started_at)
    return { ini, fim: c.ended_at ? Date.parse(c.ended_at) : parou ? Math.max(ini, Date.parse(parou)) : Number.POSITIVE_INFINITY }
  }).filter(f => Number.isFinite(f.ini))
  if (faixas.length === 0) return []
  const primeiro = dayPt(new Date(Math.min(...faixas.map(f => f.ini))))
  let d = diffDias(primeiro, desde) > 0 ? desde : primeiro
  const dias: DiaPt[] = []
  for (; diffDias(d, ontem) >= 0; d = addDays(d, 1)) {
    const b = boundsAnalytics(d)
    if (faixas.some(f => f.ini < b.end && f.fim > b.start)) dias.push(d)
  }
  return dias
}
