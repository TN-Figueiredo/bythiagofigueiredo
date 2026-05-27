import { describe, it, expect, vi, afterEach } from 'vitest'
import { isInPostingWindow } from '@/lib/youtube/schedule-window'
import type { SyncScheduleEntry } from '@/lib/youtube/types'

describe('isInPostingWindow', () => {
  afterEach(() => { vi.useRealTimers() })

  const schedule: SyncScheduleEntry[] = [
    { day: 'wednesday', hour: 9, tz: 'America/Sao_Paulo', label: 'Quarta 9h' },
    { day: 'sunday', hour: 23, tz: 'America/Sao_Paulo', label: 'Domingo 23h' },
  ]

  it('returns true when within 45 min after posting window', () => {
    // Wednesday 9:30 AM São Paulo = within 45 min of 9:00
    vi.setSystemTime(new Date('2026-05-06T12:30:00Z')) // Wed 9:30 BRT (UTC-3)
    expect(isInPostingWindow(schedule)).toBe(true)
  })

  it('returns false when outside all windows', () => {
    // Monday 10:00 São Paulo — no posting window
    vi.setSystemTime(new Date('2026-05-04T13:00:00Z')) // Mon 10:00 BRT
    expect(isInPostingWindow(schedule)).toBe(false)
  })

  it('returns false when >45 min past window', () => {
    // Wednesday 10:00 São Paulo = 60 min past 9:00
    vi.setSystemTime(new Date('2026-05-06T13:00:00Z')) // Wed 10:00 BRT
    expect(isInPostingWindow(schedule)).toBe(false)
  })

  it('returns true at exact posting time', () => {
    // Wednesday 9:00 São Paulo exact
    vi.setSystemTime(new Date('2026-05-06T12:00:00Z')) // Wed 9:00 BRT
    expect(isInPostingWindow(schedule)).toBe(true)
  })

  it('returns true for sunday window', () => {
    // Sunday 23:20 São Paulo = Mon 02:20 UTC (BRT is UTC-3)
    vi.setSystemTime(new Date('2026-05-11T02:20:00Z')) // Sun 23:20 BRT
    expect(isInPostingWindow(schedule)).toBe(true)
  })

  it('returns false for empty schedule', () => {
    vi.setSystemTime(new Date('2026-05-06T12:30:00Z'))
    expect(isInPostingWindow([])).toBe(false)
  })

  it('returns true for midnight posting window (hour 0)', () => {
    const midnightSchedule: SyncScheduleEntry[] = [
      { day: 'tuesday', hour: 0, tz: 'America/Sao_Paulo', label: 'Terça 0h' },
    ]
    // Tuesday 00:15 São Paulo = Tue 03:15 UTC (BRT is UTC-3)
    vi.setSystemTime(new Date('2026-05-05T03:15:00Z'))
    expect(isInPostingWindow(midnightSchedule)).toBe(true)
  })

  it('returns false when past midnight posting window', () => {
    const midnightSchedule: SyncScheduleEntry[] = [
      { day: 'tuesday', hour: 0, tz: 'America/Sao_Paulo', label: 'Terça 0h' },
    ]
    // Tuesday 01:00 São Paulo = 60 min past midnight = outside 45 min window
    vi.setSystemTime(new Date('2026-05-05T04:00:00Z'))
    expect(isInPostingWindow(midnightSchedule)).toBe(false)
  })

  it('returns true at boundary — exactly 45 min after window', () => {
    // Wednesday 9:45 São Paulo = exactly 45 min after 9:00 (inclusive)
    vi.setSystemTime(new Date('2026-05-06T12:45:00Z'))
    expect(isInPostingWindow(schedule)).toBe(true)
  })

  it('returns false at boundary — 46 min after window', () => {
    // Wednesday 9:46 São Paulo = 46 min past 9:00 = outside window
    vi.setSystemTime(new Date('2026-05-06T12:46:00Z'))
    expect(isInPostingWindow(schedule)).toBe(false)
  })

  it('skips entry with corrupt timezone gracefully', () => {
    const badSchedule: SyncScheduleEntry[] = [
      { day: 'wednesday', hour: 9, tz: 'Invalid/Timezone_ZZZ', label: 'Bad' },
      { day: 'wednesday', hour: 9, tz: 'America/Sao_Paulo', label: 'Good' },
    ]
    // Wednesday 9:30 São Paulo
    vi.setSystemTime(new Date('2026-05-06T12:30:00Z'))
    expect(isInPostingWindow(badSchedule)).toBe(true)
  })

  it('returns false when all entries have corrupt timezone', () => {
    const badSchedule: SyncScheduleEntry[] = [
      { day: 'wednesday', hour: 9, tz: 'Invalid/Timezone_ZZZ', label: 'Bad' },
    ]
    vi.setSystemTime(new Date('2026-05-06T12:30:00Z'))
    expect(isInPostingWindow(badSchedule)).toBe(false)
  })

  it('handles multi-timezone schedules', () => {
    const multiTz: SyncScheduleEntry[] = [
      { day: 'wednesday', hour: 9, tz: 'America/New_York', label: 'NY 9h' },
      { day: 'wednesday', hour: 9, tz: 'America/Sao_Paulo', label: 'SP 9h' },
    ]
    // Wednesday 9:30 São Paulo = 8:30 New York → only São Paulo matches
    vi.setSystemTime(new Date('2026-05-06T12:30:00Z'))
    expect(isInPostingWindow(multiTz)).toBe(true)
  })

  it('skips entry with invalid hour (out of range)', () => {
    const badSchedule: SyncScheduleEntry[] = [
      { day: 'wednesday', hour: 25, tz: 'America/Sao_Paulo', label: 'Bad hour' },
    ]
    vi.setSystemTime(new Date('2026-05-06T12:30:00Z'))
    expect(isInPostingWindow(badSchedule)).toBe(false)
  })

  it('skips entry with fractional hour', () => {
    const badSchedule: SyncScheduleEntry[] = [
      { day: 'wednesday', hour: 9.5, tz: 'America/Sao_Paulo', label: 'Fractional' },
    ]
    vi.setSystemTime(new Date('2026-05-06T12:30:00Z'))
    expect(isInPostingWindow(badSchedule)).toBe(false)
  })
})
