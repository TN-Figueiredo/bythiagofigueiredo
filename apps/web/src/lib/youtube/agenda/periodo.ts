import type { Periodo } from './tipos'

/** Tudo em São Paulo: UTC−3 fixo (sem horário de verão desde 2019), como `spDate`. */
const SP_OFFSET_MS = 3 * 3_600_000
const HORA_MS = 3_600_000
const FAIXA_MS = 6 * HORA_MS
const DIA_MS = 24 * HORA_MS

const dois = (n: number): string => String(n).padStart(2, '0')
/** O instante deslocado: seus campos UTC são os de São Paulo. */
const sp = (agoraMs: number): Date => new Date(agoraMs - SP_OFFSET_MS)

/** Hora do relógio de São Paulo, 0 a 23. */
export function horaSP(agoraMs: number): number { return sp(agoraMs).getUTCHours() }

/** '2026-10-12T21' (hora) | '2026-10-12#18' (faixa de 6 h) | '2026-10-12' (dia). */
export function chaveDoPeriodo(p: Periodo, agoraMs: number): string {
  // NaN, Infinity ou fora do alcance de Date: erro de mensagem fixa (nunca o RangeError cru do toISOString).
  if (!Number.isFinite(agoraMs) || !Number.isFinite(agoraMs - SP_OFFSET_MS) || Number.isNaN(sp(agoraMs).getTime())) {
    throw new RangeError('instante inválido para a chave do período')
  }
  const d = sp(agoraMs)
  const dia = d.toISOString().slice(0, 10)
  const h = d.getUTCHours()
  if (p === 'dia') return dia
  if (p === 'hora') return `${dia}T${dois(h)}`
  return `${dia}#${dois(Math.floor(h / 6) * 6)}`
}

/** ms (UTC) do começo do período corrente. */
export function inicioDoPeriodo(p: Periodo, agoraMs: number): number {
  const passo = p === 'hora' ? HORA_MS : p === 'faixa' ? FAIXA_MS : DIA_MS
  return Math.floor((agoraMs - SP_OFFSET_MS) / passo) * passo + SP_OFFSET_MS
}
