import type { SyncScheduleEntry } from './types'

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

const SHORT_DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

const WINDOW_MINUTES = 45

export function isInPostingWindow(schedule: SyncScheduleEntry[]): boolean {
  if (schedule.length === 0) return false

  const now = new Date()

  for (const entry of schedule) {
    const targetDay = DAY_MAP[entry.day]
    if (targetDay === undefined) continue

    if (!Number.isInteger(entry.hour) || entry.hour < 0 || entry.hour > 23) continue

    let formatter: Intl.DateTimeFormat
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: entry.tz,
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      })
    } catch {
      continue
    }

    const parts = formatter.formatToParts(now)
    const nowDay = parts.find((p) => p.type === 'weekday')?.value
    const hourPart = parts.find((p) => p.type === 'hour')?.value
    const minutePart = parts.find((p) => p.type === 'minute')?.value
    if (hourPart === undefined || minutePart === undefined) continue
    const nowHour = parseInt(hourPart, 10)
    const nowMinute = parseInt(minutePart, 10)

    const currentDay = SHORT_DAY_MAP[nowDay ?? ''] ?? -1

    if (currentDay !== targetDay) continue

    const nowTotalMinutes = nowHour * 60 + nowMinute
    const targetTotalMinutes = entry.hour * 60

    const diff = nowTotalMinutes - targetTotalMinutes
    if (diff >= 0 && diff <= WINDOW_MINUTES) return true
  }

  return false
}
