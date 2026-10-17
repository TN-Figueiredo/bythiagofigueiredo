// A5 E5a, Tarefa 20: os formatos de texto da tela do Histórico do vídeo (mockup 13). Puro, em pt-BR, sem Intl (fuso de São Paulo fixo em UTC−3).
// Números grandes por extenso ("1,02 milhão", "2,4 milhões"; nunca "mi", que se confunde com "mil").
import { H, WD, spDateOf } from '@/lib/youtube/observatorio/time'

const SP_OFF = 3 * H
/** `AAAA-MM-DD` de São Paulo de um instante. */
export const spDateOfMs = spDateOf
const p2 = (n: number): string => (n < 10 ? '0' : '') + n
const WDS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

/** 108.000 */
export const milhar = (x: number): string => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
/** Vírgula decimal, casas fixas. */
export const dec = (x: number, casas: number): string => x.toFixed(casas).replace('.', ',')
const semZeros = (s: string): string => s.replace(/,0+$/, '').replace(/(,\d)0$/, '$1')

/** "94,3 mil", "120 mil", "1,02 milhão", "2,4 milhões"; abaixo de 10.000 o número inteiro com ponto de milhar. */
export function abrev(n: number): string {
  if (n >= 1e6) {
    const r = Number((n / 1e6).toFixed(n >= 1e7 ? 1 : 2))
    return semZeros(dec(r, n >= 1e7 ? 1 : 2)) + (r >= 2 ? ' milhões' : ' milhão')
  }
  if (n >= 1e5) return `${milhar(Math.round(n / 1000))} mil`
  if (n >= 1e4) return `${semZeros(dec(n / 1000, 1))} mil`
  return milhar(n)
}

/** "AAAA-MM-DD" para "dd/mm" e "dd/mm/aaaa". */
export const dm = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const dmy = (iso: string): string => `${dm(iso)}/${iso.slice(0, 4)}`
export const idadeTxt = (a: number): string => (a === 1 ? '1 dia' : `${a} dias`)
export const plural = (n: number, um: string, varios: string): string => `${milhar(n)} ${n === 1 ? um : varios}`

/** Junta "a, b e c". */
export function juntar(xs: readonly string[]): string {
  if (xs.length === 0) return ''
  if (xs.length === 1) return xs[0]!
  return `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`
}

const sp = (ms: number): Date => new Date(ms - SP_OFF)
/** "20:40" (São Paulo). */
export const horaSP = (ms: number): string => `${p2(sp(ms).getUTCHours())}:${p2(sp(ms).getUTCMinutes())}`
/** "qui" (São Paulo). */
export const diaSemanaSP = (ms: number): string => WDS[sp(ms).getUTCDay()] ?? ''
export const diaSemanaCompleto = (ms: number): string => WD[sp(ms).getUTCDay()] ?? ''
/** "09/10" (São Paulo). */
export const dataSP = (ms: number): string => dm(spDateOf(ms))
/** "qui 09/10" */
export const diaEDataSP = (ms: number): string => `${diaSemanaSP(ms)} ${dataSP(ms)}`
/** "09/10 01:00" */
export const dataEHoraSP = (ms: number): string => `${dataSP(ms)} ${horaSP(ms)}`

/** "4 h 20 min" a partir de minutos (sem Intl). */
export function duracaoHM(minutos: number): string {
  const m = Math.max(0, Math.round(minutos))
  return `${Math.floor(m / 60)} h ${p2(m % 60)} min`
}

/** Largura de uma barra: proporcional ao valor; piso de 4 px só para valor acima de zero. */
export function larguraDaBarra(valor: number, maximo: number, larguraPx: number): number {
  if (!(valor > 0) || !(maximo > 0)) return 0
  return Math.max(4, (valor / maximo) * larguraPx)
}
