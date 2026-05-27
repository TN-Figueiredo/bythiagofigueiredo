import type { SyncScheduleEntry } from './types'

type DayKey = SyncScheduleEntry['day']

export interface ScheduleGroup {
  _id: number
  days: DayKey[]
  hour: number
  tz: string
  label: string
}

const DAY_ORDER: DayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/**
 * Groups flat SyncScheduleEntry[] into schedule groups by hour+tz.
 * Entries sharing the same hour and timezone become one group with multiple days.
 * First non-empty label in the group wins.
 * Days are sorted in calendar order (mon-sun).
 */
export function groupSchedules(
  entries: SyncScheduleEntry[],
  nextId: () => number,
): ScheduleGroup[] {
  const map = new Map<string, ScheduleGroup>()

  for (const entry of entries) {
    const key = `${entry.hour}:${entry.tz}`

    if (!map.has(key)) {
      map.set(key, {
        _id: nextId(),
        days: [],
        hour: entry.hour,
        tz: entry.tz,
        label: '',
      })
    }

    const group = map.get(key)!

    // Deduplicate days
    if (!group.days.includes(entry.day)) {
      group.days.push(entry.day)
    }

    // First non-empty label wins
    if (!group.label && entry.label) {
      group.label = entry.label
    }
  }

  // Sort days in calendar order for every group
  for (const group of map.values()) {
    group.days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
  }

  return Array.from(map.values())
}

/**
 * Explodes schedule groups back into flat SyncScheduleEntry[].
 * Each group produces one entry per checked day.
 * Groups with no days are silently dropped.
 */
export function explodeGroups(groups: ScheduleGroup[]): SyncScheduleEntry[] {
  const result: SyncScheduleEntry[] = []

  for (const group of groups) {
    if (group.days.length === 0) continue

    for (const day of group.days) {
      result.push({
        day,
        hour: group.hour,
        tz: group.tz,
        label: group.label,
      })
    }
  }

  return result
}
