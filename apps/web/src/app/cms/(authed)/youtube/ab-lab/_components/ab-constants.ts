import type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'
import { brDec } from '@/lib/youtube/format'
export type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'

export const VARIANT_COLORS = {
  A: '#8A8F98',
  B: '#E8823C',
  C: '#3FA9C0',
  D: '#A77CE8',
} as const satisfies Record<DisplayLabel, string>

export const TYPE_META: Record<TestType, { icon: string; label: string; hint: string }> = {
  thumbnail: { icon: 'Image', label: 'Thumbnail', hint: 'Test different thumbnail images' },
  title:     { icon: 'Type', label: 'Title', hint: 'Test different video titles' },
  description: { icon: 'FileText', label: 'Description', hint: 'Test different descriptions' },
  combo:     { icon: 'Layers', label: 'Combo', hint: 'Test thumbnail + title combinations' },
} as const

export function toDisplayLabel(dbLabel: string, isOriginal?: boolean): DisplayLabel {
  if (isOriginal || dbLabel === 'original') return 'A'
  if (dbLabel === 'B' || dbLabel === 'C' || dbLabel === 'D') return dbLabel
  return 'B'
}

export function variantColor(dbLabel: string, isOriginal?: boolean): string {
  return VARIANT_COLORS[toDisplayLabel(dbLabel, isOriginal)]
}

const DASH = '—'

const numberFmt = new Intl.NumberFormat('pt-BR')
const dateFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return DASH
  return numberFmt.format(n)
}

export function formatPercent(n: number | null | undefined, decimals = 1): string {
  if (n == null || Number.isNaN(n)) return DASH
  return `${brDec(n, decimals)}%`
}

export function formatDate(d: string | Date | null | undefined): string {
  if (d == null) return DASH
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return DASH
  return dateFmt.format(date)
}

export function formatCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs < 1_000) return String(n)
  if (abs < 1_000_000) return `${sign}${brDec(abs / 1_000, 1)}k`
  if (abs < 1_000_000_000) return `${sign}${brDec(abs / 1_000_000, 1)}M`
  return `${sign}${brDec(abs / 1_000_000_000, 1)}B`
}
