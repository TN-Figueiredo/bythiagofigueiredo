// O "dia" das duas fontes do YouTube.
//  - Analytics API: dia do Pacífico COM horário de verão (UTC-7 ou UTC-8) → boundsAnalytics.
//  - Reporting API: UTC-8 fixo → boundsReporting.
// Nunca deslocamento fixo para achar o dia do Pacífico, nunca toISOString(): só Intl.

const FORMATO_PT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const DIA_MS = 86_400_000

/** O dia (`YYYY-MM-DD`) em que este instante cai em America/Los_Angeles. */
export function dayPt(instante: Date): string {
  const partes = FORMATO_PT.formatToParts(instante)
  const valor = (tipo: string) => partes.find(p => p.type === tipo)!.value
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

function partesDe(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) throw new Error(`dia inválido: ${day}`)
  return [y, m, d]
}

const dois = (n: number) => String(n).padStart(2, '0')

function formatarUtc(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`
}

/** Soma dias de calendário a um `YYYY-MM-DD` (aritmética em UTC: não há troca de horário). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = partesDe(day)
  return formatarUtc(Date.UTC(y, m - 1, d + n))
}

/** Dias de calendário de `de` até `ate`. */
export function diffDias(de: string, ate: string): number {
  const [y1, m1, d1] = partesDe(de)
  const [y2, m2, d2] = partesDe(ate)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DIA_MS)
}

/** Ontem no Pacífico: o dia fechado que o passo de metadados grava. */
export function ontemPt(agora: Date): string {
  return addDays(dayPt(agora), -1)
}

/** A data UTC da execução (`attempt_day`). Nunca se junta a `day_pt`. */
export function utcDay(agora: Date): string {
  return formatarUtc(agora.getTime())
}

export interface Intervalo {
  /** epoch ms, inclusivo */
  start: number
  /** epoch ms, exclusivo */
  end: number
}

/** A meia-noite do Pacífico que abre o dia: 07:00 UTC no verão, 08:00 UTC no inverno. */
function meiaNoitePt(day: string): number {
  const [y, m, d] = partesDe(day)
  for (const hora of [7, 8]) {
    const t = Date.UTC(y, m - 1, d, hora)
    if (dayPt(new Date(t)) === day && dayPt(new Date(t - 1)) !== day) return t
  }
  throw new Error(`não achei a meia-noite do Pacífico de ${day}`)
}

/** Dia do Pacífico com horário de verão: 23, 24 ou 25 horas. */
export function boundsAnalytics(day: string): Intervalo {
  return { start: meiaNoitePt(day), end: meiaNoitePt(addDays(day, 1)) }
}

/** Dia em UTC-8 fixo, como a Reporting API documenta: sempre 24 horas. */
export function boundsReporting(day: string): Intervalo {
  const [y, m, d] = partesDe(day)
  const start = Date.UTC(y, m - 1, d, 8)
  return { start, end: start + DIA_MS }
}
