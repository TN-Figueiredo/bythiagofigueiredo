/**
 * YouTube CMS — Formatting helpers (PT-BR locale)
 */

const BR = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Format a number in PT-BR with 2 decimal places.
 * Example: 1234.56 -> "1.234,56"
 */
export function fmtBR(n: number): string {
  return BR.format(n)
}

/**
 * Compact number format for PT-BR.
 * Examples: 1500 -> "1,5 mil" | 2_800_000 -> "2,8 mi" | 42 -> "42"
 */
export function fmtC(n: number): string {
  if (n < 0) return `-${fmtC(-n)}`
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    const formatted = v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)
    return `${formatted.replace('.', ',')} mi`
  }
  if (n >= 1_000) {
    const v = n / 1_000
    const formatted = v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)
    return `${formatted.replace('.', ',')} mil`
  }
  return n.toFixed(0)
}

/**
 * Format a number with a specific number of decimal places, using comma as separator.
 * Example: brDec(6.234, 1) -> "6,2"
 */
export function brDec(n: number, decimals: number): string {
  return n.toFixed(decimals).replace('.', ',')
}

const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Relative time in PT-BR.
 * Examples: "agora" | "há 2h" | "há 3 dias"
 */
export function fmtRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()

  if (diff < MINUTE) return 'agora'
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE)
    return `há ${m}min`
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR)
    return `há ${h}h`
  }
  const days = Math.floor(diff / DAY)
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}
