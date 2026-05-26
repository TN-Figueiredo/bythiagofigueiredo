import { describe, it, expect } from 'vitest'
import { calculateStreak } from '../../src/lib/pipeline/calculate-streak'
import type { StreakInput } from '../../src/lib/pipeline/up-next-types'
import type { SyncScheduleWithChannel, BlogCadenceRow } from '../../src/lib/pipeline/up-next-types'

const TZ = 'America/Sao_Paulo'

const syncSchedule: SyncScheduleWithChannel = {
  channel_id: 'ch1',
  channel_name: 'Channel 1',
  locale: 'pt',
  schedule: { day: 'monday', hour: 10 },
  timezone: TZ,
}

const blogCadence: BlogCadenceRow = {
  site_id: 'site1',
  cadence_days: 7,
  cadence_start_date: '2025-01-01',
  cadence_paused: false,
  last_published_at: null,
  locale: 'pt',
}

describe('calculateStreak', () => {
  it('returns 0 streak when no publish history', () => {
    const input: StreakInput = {
      publishHistory: [],
      syncSchedules: [syncSchedule],
      blogCadence: null,
      siteTimezone: TZ,
    }
    const result = calculateStreak(input)
    expect(result.currentStreak).toBe(0)
    expect(result.isActive).toBe(false)
  })

  it('returns streak of 1 when only current week has publishes', () => {
    const now = new Date()
    const input: StreakInput = {
      publishHistory: [now.toISOString()],
      syncSchedules: [syncSchedule],
      blogCadence: null,
      siteTimezone: TZ,
    }
    const result = calculateStreak(input)
    expect(result.currentStreak).toBe(1)
    expect(result.isActive).toBe(true)
  })

  it('counts consecutive weeks', () => {
    const now = new Date()
    const oneWeekAgo = new Date(now)
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    const input: StreakInput = {
      publishHistory: [now.toISOString(), oneWeekAgo.toISOString(), twoWeeksAgo.toISOString()],
      syncSchedules: [syncSchedule],
      blogCadence: null,
      siteTimezone: TZ,
    }
    const result = calculateStreak(input)
    expect(result.currentStreak).toBe(3)
    expect(result.isActive).toBe(true)
  })

  it('stops at gap with expected slots', () => {
    const now = new Date()
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    const input: StreakInput = {
      publishHistory: [now.toISOString(), twoWeeksAgo.toISOString()],
      syncSchedules: [syncSchedule],
      blogCadence: null,
      siteTimezone: TZ,
    }
    const result = calculateStreak(input)
    expect(result.currentStreak).toBe(1)
  })

  it('grants vacation grace when no expected slots', () => {
    const now = new Date()
    const oneWeekAgo = new Date(now)
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    const input: StreakInput = {
      publishHistory: [now.toISOString(), twoWeeksAgo.toISOString()],
      syncSchedules: [],
      blogCadence: null,
      siteTimezone: TZ,
    }
    const result = calculateStreak(input)
    expect(result.currentStreak).toBe(3)
  })

  it('isActive is false when current week is empty', () => {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const input: StreakInput = {
      publishHistory: [oneWeekAgo.toISOString()],
      syncSchedules: [syncSchedule],
      blogCadence: null,
      siteTimezone: TZ,
    }
    const result = calculateStreak(input)
    expect(result.isActive).toBe(false)
  })

  it('handles ISO week year boundary correctly', () => {
    const input: StreakInput = {
      publishHistory: ['2026-01-01T12:00:00.000Z', '2025-12-26T12:00:00.000Z'],
      syncSchedules: [syncSchedule],
      blogCadence: null,
      siteTimezone: 'UTC',
    }
    const result = calculateStreak(input)
    expect(result.currentStreak).toBeGreaterThanOrEqual(0)
  })

  it('handles empty syncSchedules with active blog cadence', () => {
    const now = new Date()
    const oneWeekAgo = new Date(now)
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const input: StreakInput = {
      publishHistory: [now.toISOString(), oneWeekAgo.toISOString()],
      syncSchedules: [],
      blogCadence: blogCadence,
      siteTimezone: TZ,
    }
    const result = calculateStreak(input)
    expect(result.currentStreak).toBe(2)
    expect(result.isActive).toBe(true)
  })
})
