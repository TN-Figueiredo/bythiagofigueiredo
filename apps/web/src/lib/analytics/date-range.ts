import type { PeriodInput } from '@/app/cms/(authed)/analytics/types'

export function resolveDateRange(period: PeriodInput): { start: Date; end: Date } {
  const end = new Date()
  if (period.type === 'custom') {
    return { start: new Date(period.start), end: new Date(period.end) }
  }
  const days = period.value === '7d' ? 7 : period.value === '30d' ? 30 : period.value === '90d' ? 90 : 365
  const start = new Date()
  start.setDate(start.getDate() - days)
  return { start, end }
}

export function resolvePrevDateRange(period: PeriodInput): { start: Date; end: Date } | null {
  if (period.type === 'custom') return null
  if (period.value === 'all') return null
  const days = period.value === '7d' ? 7 : period.value === '30d' ? 30 : 90
  const end = new Date()
  end.setDate(end.getDate() - days)
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return { start, end }
}

export function getDaysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}
