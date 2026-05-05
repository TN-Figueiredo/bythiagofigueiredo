import type { SyncScheduleEntry } from './types'

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

const WINDOW_MINUTES = 45

export function isInPostingWindow(schedule: SyncScheduleEntry[]): boolean {
  if (schedule.length === 0) return false

  const now = new Date()

  for (const entry of schedule) {
    const targetDay = DAY_MAP[entry.day]
    if (targetDay === undefined) continue

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: entry.tz,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    })

    const parts = formatter.formatToParts(now)
    const nowDay = parts.find((p) => p.type === 'weekday')?.value
    const nowHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
    const nowMinute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)

    const dayNames: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    }
    const currentDay = dayNames[nowDay ?? ''] ?? -1

    if (currentDay !== targetDay) continue

    const nowTotalMinutes = nowHour * 60 + nowMinute
    const targetTotalMinutes = entry.hour * 60

    const diff = nowTotalMinutes - targetTotalMinutes
    if (diff >= 0 && diff <= WINDOW_MINUTES) return true
  }

  return false
}
