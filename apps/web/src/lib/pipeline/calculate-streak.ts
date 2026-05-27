import { parseISO, getISOWeek, getISOWeekYear, subWeeks } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { StreakInput, StreakResult } from './up-next-types'

function isoWeekKey(date: Date): string {
  const week = getISOWeek(date)
  const year = getISOWeekYear(date)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function hasExpectedSlots(
  syncSchedules: StreakInput['syncSchedules'],
  blogCadence: StreakInput['blogCadence'],
): boolean {
  if (syncSchedules.length > 0) return true
  if (
    blogCadence !== null &&
    !blogCadence.cadence_paused &&
    (blogCadence.cadence_days ?? 0) > 0
  ) {
    return true
  }
  return false
}

export function calculateStreak(input: StreakInput): StreakResult {
  const { publishHistory, syncSchedules, blogCadence, siteTimezone } = input

  const publishedWeeks = new Set<string>()
  for (const dateStr of publishHistory) {
    const utcDate = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    const zonedDate = toZonedTime(utcDate, siteTimezone)
    publishedWeeks.add(isoWeekKey(zonedDate))
  }

  const now = input.now
  const nowZoned = toZonedTime(now, siteTimezone)
  const currentWeekKey = isoWeekKey(nowZoned)

  const isActive = publishedWeeks.has(currentWeekKey)

  let streak = 0
  let graceCount = 0
  let hasAnchor = false
  const MAX_CONSECUTIVE_GRACE = 4

  for (let i = 0; i < 52; i++) {
    const weekDate = subWeeks(nowZoned, i)
    const weekKey = isoWeekKey(weekDate)

    if (publishedWeeks.has(weekKey)) {
      streak += 1 + graceCount
      graceCount = 0
      hasAnchor = true
      continue
    }

    if (hasAnchor && !hasExpectedSlots(syncSchedules, blogCadence) && graceCount < MAX_CONSECUTIVE_GRACE) {
      graceCount++
      continue
    }

    break
  }

  return { currentStreak: streak, isActive }
}
