import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

export function buildScheduledAt(slotDay: string, slotHour: string | null, timezone: string): string {
  const localDateStr = `${slotDay}T${slotHour || '00:00'}:00`
  const utcDate = fromZonedTime(localDateStr, timezone)
  return formatInTimeZone(utcDate, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX")
}
