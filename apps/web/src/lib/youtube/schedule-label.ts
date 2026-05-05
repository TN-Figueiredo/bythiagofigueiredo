type ScheduleEntry = { day: string; hour: number; tz: string; label: string }

const DAY_NAMES_EN: Record<string, { full: string; short: string }> = {
  monday: { full: 'Monday', short: 'Mon' },
  tuesday: { full: 'Tuesday', short: 'Tue' },
  wednesday: { full: 'Wednesday', short: 'Wed' },
  thursday: { full: 'Thursday', short: 'Thu' },
  friday: { full: 'Friday', short: 'Fri' },
  saturday: { full: 'Saturday', short: 'Sat' },
  sunday: { full: 'Sunday', short: 'Sun' },
}

const DAY_NAMES_PT: Record<string, { full: string; short: string }> = {
  monday: { full: 'segunda', short: 'seg' },
  tuesday: { full: 'terça', short: 'terça' },
  wednesday: { full: 'quarta', short: 'qua' },
  thursday: { full: 'quinta', short: 'quinta' },
  friday: { full: 'sexta', short: 'sex' },
  saturday: { full: 'sábado', short: 'sáb' },
  sunday: { full: 'domingo', short: 'dom' },
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export function deriveScheduleLabel(
  schedules: ScheduleEntry[],
  locale: 'pt-BR' | 'en',
): string | null {
  const uniqueDays = [...new Set(schedules.map(s => s.day.toLowerCase()))]
    .filter(d => DAY_ORDER.includes(d))
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))

  if (uniqueDays.length === 0) return null

  const names = locale === 'pt-BR' ? DAY_NAMES_PT : DAY_NAMES_EN
  const prefix = locale === 'pt-BR' ? 'novidade' : 'new'
  const conjunction = locale === 'pt-BR' ? 'e' : '&'

  if (uniqueDays.length === 1) {
    const full = names[uniqueDays[0]!]!.full
    const every = locale === 'pt-BR' ? 'toda' : 'every'
    return `${prefix} ${every} ${full}`
  }

  // PT-BR with exactly 2 days reads more naturally with full names (e.g. "terça e sexta")
  const useFull = locale === 'pt-BR' && uniqueDays.length === 2
  const labels = uniqueDays.map(d => (useFull ? names[d]!.full : names[d]!.short))
  const last = labels.pop()!
  return `${prefix} ${labels.join(', ')} ${conjunction} ${last}`
}

export function resolveScheduleLabel(
  scheduleLabel: string | null,
  syncSchedules: ScheduleEntry[] | null,
  locale: 'pt-BR' | 'en',
): string | null {
  if (scheduleLabel && scheduleLabel.trim()) return scheduleLabel.trim()
  if (!syncSchedules || syncSchedules.length === 0) return null
  return deriveScheduleLabel(syncSchedules, locale)
}
