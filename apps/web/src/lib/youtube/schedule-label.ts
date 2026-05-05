export type ScheduleInput = { day: string }

const DAY_NAMES_EN: Record<string, { full: string; short: string }> = {
  monday: { full: 'Monday', short: 'Mon' },
  tuesday: { full: 'Tuesday', short: 'Tue' },
  wednesday: { full: 'Wednesday', short: 'Wed' },
  thursday: { full: 'Thursday', short: 'Thu' },
  friday: { full: 'Friday', short: 'Fri' },
  saturday: { full: 'Saturday', short: 'Sat' },
  sunday: { full: 'Sunday', short: 'Sun' },
}

const DAY_NAMES_PT: Record<string, { full: string; short: string; masculine: boolean }> = {
  monday: { full: 'segunda', short: 'seg', masculine: false },
  tuesday: { full: 'terça', short: 'ter', masculine: false },
  wednesday: { full: 'quarta', short: 'qua', masculine: false },
  thursday: { full: 'quinta', short: 'qui', masculine: false },
  friday: { full: 'sexta', short: 'sex', masculine: false },
  saturday: { full: 'sábado', short: 'sáb', masculine: true },
  sunday: { full: 'domingo', short: 'dom', masculine: true },
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export function deriveScheduleLabel(
  schedules: ScheduleInput[],
  locale: 'pt-BR' | 'en',
): string | null {
  const uniqueDays = [...new Set(schedules.map(s => s.day.toLowerCase()))]
    .filter(d => DAY_ORDER.includes(d))
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))

  if (uniqueDays.length === 0) return null

  const prefix = locale === 'pt-BR' ? 'novidade' : 'new'
  const conjunction = locale === 'pt-BR' ? 'e' : '&'

  if (locale === 'pt-BR') {
    const names = DAY_NAMES_PT
    if (uniqueDays.length === 1) {
      const entry = names[uniqueDays[0]!]!
      const every = entry.masculine ? 'todo' : 'toda'
      return `${prefix} ${every} ${entry.full}`
    }
    const useFull = uniqueDays.length === 2
    const labels = uniqueDays.map(d => (useFull ? names[d]!.full : names[d]!.short))
    const last = labels.pop()!
    return `${prefix} ${labels.join(', ')} ${conjunction} ${last}`
  }

  const names = DAY_NAMES_EN
  if (uniqueDays.length === 1) {
    return `${prefix} every ${names[uniqueDays[0]!]!.full}`
  }
  const labels = uniqueDays.map(d => names[d]!.short)
  const last = labels.pop()!
  return `${prefix} ${labels.join(', ')} ${conjunction} ${last}`
}

export function resolveScheduleLabel(
  scheduleLabel: string | null,
  syncSchedules: ScheduleInput[] | null,
  locale: 'pt-BR' | 'en',
): string | null {
  if (scheduleLabel && scheduleLabel.trim()) return scheduleLabel.trim()
  if (!syncSchedules || syncSchedules.length === 0) return null
  return deriveScheduleLabel(syncSchedules, locale)
}
