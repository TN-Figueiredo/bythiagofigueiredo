import type { SyncScheduleEntry } from './types'

export type ScheduleInput = { day: SyncScheduleEntry['day'] }

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

const DAY_NAMES_EN: Record<DayKey, { full: string; short: string }> = {
  monday: { full: 'Monday', short: 'Mon' },
  tuesday: { full: 'Tuesday', short: 'Tue' },
  wednesday: { full: 'Wednesday', short: 'Wed' },
  thursday: { full: 'Thursday', short: 'Thu' },
  friday: { full: 'Friday', short: 'Fri' },
  saturday: { full: 'Saturday', short: 'Sat' },
  sunday: { full: 'Sunday', short: 'Sun' },
}

const DAY_NAMES_PT: Record<DayKey, { full: string; short: string; masculine: boolean }> = {
  monday: { full: 'segunda', short: 'seg', masculine: false },
  tuesday: { full: 'terça', short: 'ter', masculine: false },
  wednesday: { full: 'quarta', short: 'qua', masculine: false },
  thursday: { full: 'quinta', short: 'qui', masculine: false },
  friday: { full: 'sexta', short: 'sex', masculine: false },
  saturday: { full: 'sábado', short: 'sáb', masculine: true },
  sunday: { full: 'domingo', short: 'dom', masculine: true },
}

const DAY_ORDER: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const WEEKDAY_SET = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
const WEEKEND_SET = new Set(['saturday', 'sunday'])

export function deriveScheduleLabel(
  schedules: ScheduleInput[],
  locale: 'pt-BR' | 'pt' | 'en',
): string | null {
  const uniqueDays = [...new Set(schedules.map(s => s.day.toLowerCase()))]
    .filter(d => DAY_ORDER.includes(d as DayKey))
    .sort((a, b) => DAY_ORDER.indexOf(a as DayKey) - DAY_ORDER.indexOf(b as DayKey))

  if (uniqueDays.length === 0) return null

  const isPT = locale === 'pt-BR' || locale === 'pt'

  // Collapsed labels for common patterns
  if (uniqueDays.length === 7) {
    return isPT ? 'novidade todo dia' : 'new every day'
  }

  if (
    uniqueDays.length === 5 &&
    uniqueDays.every(d => WEEKDAY_SET.has(d))
  ) {
    return isPT ? 'novidade de segunda a sexta' : 'new weekdays'
  }

  if (
    uniqueDays.length === 2 &&
    uniqueDays.every(d => WEEKEND_SET.has(d))
  ) {
    return isPT ? 'novidade nos fins de semana' : 'new weekends'
  }

  const prefix = isPT ? 'novidade' : 'new'
  const conjunction = isPT ? 'e' : '&'

  if (isPT) {
    const names = DAY_NAMES_PT
    if (uniqueDays.length === 1) {
      const entry = names[uniqueDays[0]! as DayKey]!
      const every = entry.masculine ? 'todo' : 'toda'
      return `${prefix} ${every} ${entry.full}`
    }
    const useFull = uniqueDays.length === 2
    const labels = uniqueDays.map(d => (useFull ? names[d as DayKey]!.full : names[d as DayKey]!.short))
    const last = labels[labels.length - 1]!
    const rest = labels.slice(0, -1)
    return `${prefix} ${rest.join(', ')} ${conjunction} ${last}`
  }

  const names = DAY_NAMES_EN
  if (uniqueDays.length === 1) {
    return `${prefix} every ${names[uniqueDays[0]! as DayKey]!.full}`
  }
  const labels = uniqueDays.map(d => names[d as DayKey]!.short)
  const last = labels[labels.length - 1]!
  const rest = labels.slice(0, -1)
  return `${prefix} ${rest.join(', ')} ${conjunction} ${last}`
}

export function resolveScheduleLabel(
  scheduleLabel: string | null,
  syncSchedules: ScheduleInput[] | null,
  locale: 'pt-BR' | 'pt' | 'en',
): string | null {
  if (scheduleLabel && scheduleLabel.trim()) return scheduleLabel.trim()
  if (!syncSchedules || syncSchedules.length === 0) return null
  return deriveScheduleLabel(syncSchedules, locale)
}
