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
})
