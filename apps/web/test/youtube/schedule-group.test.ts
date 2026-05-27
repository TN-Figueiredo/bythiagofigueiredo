import { describe, it, expect } from 'vitest'
import { groupSchedules, explodeGroups } from '@/lib/youtube/schedule-group'
import type { SyncScheduleEntry } from '@/lib/youtube/types'

// Monotonically increasing ID generator for tests
function makeId() {
  let n = 0
  return () => ++n
}

describe('groupSchedules', () => {
  it('returns empty array for empty input', () => {
    expect(groupSchedules([], makeId())).toEqual([])
  })

  it('produces one group with one day for a single entry', () => {
    const entries: SyncScheduleEntry[] = [
      { day: 'monday', hour: 10, tz: 'America/Sao_Paulo', label: 'Morning' },
    ]
    const groups = groupSchedules(entries, makeId())
    expect(groups).toHaveLength(1)
    expect(groups[0].days).toEqual(['monday'])
    expect(groups[0].hour).toBe(10)
    expect(groups[0].tz).toBe('America/Sao_Paulo')
    expect(groups[0].label).toBe('Morning')
  })

  it('merges three entries sharing same hour+tz into one group with sorted days', () => {
    const entries: SyncScheduleEntry[] = [
      { day: 'friday', hour: 18, tz: 'UTC', label: 'Evening' },
      { day: 'wednesday', hour: 18, tz: 'UTC', label: 'Evening' },
      { day: 'monday', hour: 18, tz: 'UTC', label: 'Evening' },
    ]
    const groups = groupSchedules(entries, makeId())
    expect(groups).toHaveLength(1)
    expect(groups[0].days).toEqual(['monday', 'wednesday', 'friday'])
    expect(groups[0].hour).toBe(18)
  })

  it('produces two groups for two different hours (same tz)', () => {
    const entries: SyncScheduleEntry[] = [
      { day: 'monday', hour: 8, tz: 'UTC', label: 'A' },
      { day: 'tuesday', hour: 20, tz: 'UTC', label: 'B' },
    ]
    const groups = groupSchedules(entries, makeId())
    expect(groups).toHaveLength(2)
    const hours = groups.map(g => g.hour).sort((a, b) => a - b)
    expect(hours).toEqual([8, 20])
  })

  it('produces two groups for same hour but different timezones', () => {
    const entries: SyncScheduleEntry[] = [
      { day: 'monday', hour: 10, tz: 'UTC', label: 'A' },
      { day: 'monday', hour: 10, tz: 'America/New_York', label: 'B' },
    ]
    const groups = groupSchedules(entries, makeId())
    expect(groups).toHaveLength(2)
    const tzs = groups.map(g => g.tz).sort()
    expect(tzs).toEqual(['America/New_York', 'UTC'])
  })

  it('deduplicates same day+hour+tz appearing twice — one day in the group', () => {
    const entries: SyncScheduleEntry[] = [
      { day: 'thursday', hour: 12, tz: 'UTC', label: 'Noon' },
      { day: 'thursday', hour: 12, tz: 'UTC', label: 'Noon' },
    ]
    const groups = groupSchedules(entries, makeId())
    expect(groups).toHaveLength(1)
    expect(groups[0].days).toEqual(['thursday'])
  })

  it('first non-empty label wins even when later entries differ', () => {
    const entries: SyncScheduleEntry[] = [
      { day: 'tuesday', hour: 9, tz: 'UTC', label: 'First' },
      { day: 'wednesday', hour: 9, tz: 'UTC', label: 'Second' },
      { day: 'thursday', hour: 9, tz: 'UTC', label: 'Third' },
    ]
    const groups = groupSchedules(entries, makeId())
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('First')
  })

  it('first non-empty label wins — skips empty string labels', () => {
    const entries: SyncScheduleEntry[] = [
      { day: 'tuesday', hour: 9, tz: 'UTC', label: '' },
      { day: 'wednesday', hour: 9, tz: 'UTC', label: 'Found' },
    ]
    const groups = groupSchedules(entries, makeId())
    expect(groups[0].label).toBe('Found')
  })

  it('sorts days in calendar order (mon→sun) regardless of input order', () => {
    const entries: SyncScheduleEntry[] = [
      { day: 'sunday', hour: 0, tz: 'UTC', label: '' },
      { day: 'saturday', hour: 0, tz: 'UTC', label: '' },
      { day: 'friday', hour: 0, tz: 'UTC', label: '' },
      { day: 'thursday', hour: 0, tz: 'UTC', label: '' },
      { day: 'wednesday', hour: 0, tz: 'UTC', label: '' },
      { day: 'tuesday', hour: 0, tz: 'UTC', label: '' },
      { day: 'monday', hour: 0, tz: 'UTC', label: '' },
    ]
    const groups = groupSchedules(entries, makeId())
    expect(groups[0].days).toEqual([
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    ])
  })

  it('assigns unique _id to each group', () => {
    const entries: SyncScheduleEntry[] = [
      { day: 'monday', hour: 8, tz: 'UTC', label: '' },
      { day: 'tuesday', hour: 20, tz: 'UTC', label: '' },
    ]
    const groups = groupSchedules(entries, makeId())
    expect(groups[0]._id).not.toBe(groups[1]._id)
  })
})

describe('explodeGroups', () => {
  it('returns empty array for empty input', () => {
    expect(explodeGroups([])).toEqual([])
  })

  it('roundtrip: explodeGroups(groupSchedules(entries)) produces equivalent set', () => {
    const entries: SyncScheduleEntry[] = [
      { day: 'monday', hour: 10, tz: 'UTC', label: 'A' },
      { day: 'wednesday', hour: 10, tz: 'UTC', label: 'A' },
      { day: 'friday', hour: 10, tz: 'UTC', label: 'A' },
      { day: 'tuesday', hour: 20, tz: 'America/Sao_Paulo', label: 'B' },
    ]
    const groups = groupSchedules(entries, makeId())
    const exploded = explodeGroups(groups)
    // Order may differ — compare as sorted sets
    const sort = (arr: SyncScheduleEntry[]) =>
      [...arr].sort((a, b) => `${a.day}${a.hour}${a.tz}`.localeCompare(`${b.day}${b.hour}${b.tz}`))
    expect(sort(exploded)).toEqual(sort(entries))
  })

  it('silently drops groups with no days', () => {
    const groups = [
      { _id: 1, days: [] as SyncScheduleEntry['day'][], hour: 10, tz: 'UTC', label: 'Empty' },
      { _id: 2, days: ['friday'] as SyncScheduleEntry['day'][], hour: 18, tz: 'UTC', label: 'Full' },
    ]
    const result = explodeGroups(groups)
    expect(result).toHaveLength(1)
    expect(result[0].day).toBe('friday')
  })

  it('preserves the group label on all exploded entries', () => {
    const groups = [
      {
        _id: 1,
        days: ['monday', 'wednesday', 'friday'] as SyncScheduleEntry['day'][],
        hour: 9,
        tz: 'UTC',
        label: 'MWF',
      },
    ]
    const result = explodeGroups(groups)
    expect(result).toHaveLength(3)
    expect(result.every(e => e.label === 'MWF')).toBe(true)
  })

  it('produces correct hour and tz on every exploded entry', () => {
    const groups = [
      {
        _id: 1,
        days: ['tuesday', 'thursday'] as SyncScheduleEntry['day'][],
        hour: 15,
        tz: 'America/Sao_Paulo',
        label: 'Afternoon',
      },
    ]
    const result = explodeGroups(groups)
    expect(result).toHaveLength(2)
    expect(result.every(e => e.hour === 15 && e.tz === 'America/Sao_Paulo')).toBe(true)
  })
})
