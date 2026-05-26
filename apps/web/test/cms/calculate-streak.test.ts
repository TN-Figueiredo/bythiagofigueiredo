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

const FIXED_NOW = new Date('2026-06-02T12:00:00Z')

function makeInput(overrides: Partial<StreakInput> = {}): StreakInput {
  return {
    publishHistory: [],
    syncSchedules: [syncSchedule],
    blogCadence: null,
    siteTimezone: TZ,
    now: FIXED_NOW,
    ...overrides,
  }
}

describe('calculateStreak', () => {
  it('returns 0 streak when no publish history', () => {
    const result = calculateStreak(makeInput())
    expect(result.currentStreak).toBe(0)
    expect(result.isActive).toBe(false)
  })

  it('returns streak of 1 when only current week has publishes', () => {
    const result = calculateStreak(makeInput({
      publishHistory: ['2026-06-02T10:00:00Z'],
    }))
    expect(result.currentStreak).toBe(1)
    expect(result.isActive).toBe(true)
  })

  it('counts consecutive weeks', () => {
    // 2026-06-02 (W23), 2026-05-26 (W22), 2026-05-19 (W21)
    const result = calculateStreak(makeInput({
      publishHistory: ['2026-06-02T10:00:00Z', '2026-05-26T10:00:00Z', '2026-05-19T10:00:00Z'],
    }))
    expect(result.currentStreak).toBe(3)
    expect(result.isActive).toBe(true)
  })

  it('stops at gap with expected slots', () => {
    // current week (W23) + two weeks ago (W21) — gap at W22 with expected slots → streak=1
    const result = calculateStreak(makeInput({
      publishHistory: ['2026-06-02T10:00:00Z', '2026-05-19T10:00:00Z'],
    }))
    expect(result.currentStreak).toBe(1)
  })

  it('grants vacation grace when no expected slots', () => {
    // current week (W23) + two weeks ago (W21) — gap at W22 but no expected slots → grace
    const result = calculateStreak(makeInput({
      publishHistory: ['2026-06-02T10:00:00Z', '2026-05-19T10:00:00Z'],
      syncSchedules: [],
      blogCadence: null,
    }))
    expect(result.currentStreak).toBe(3)
  })

  it('isActive is false when current week is empty', () => {
    // Only W22 has a publish, current is W23
    const result = calculateStreak(makeInput({
      publishHistory: ['2026-05-26T10:00:00Z'],
    }))
    expect(result.isActive).toBe(false)
  })

  it('handles ISO week year boundary correctly', () => {
    // 2026-01-01 (Thu) = ISO W1-2026, 2025-12-26 (Fri) = ISO W52-2025
    // now = 2026-01-01 → current week is W1, one week back is W52
    const result = calculateStreak(makeInput({
      publishHistory: ['2026-01-01T12:00:00.000Z', '2025-12-26T12:00:00.000Z'],
      siteTimezone: 'UTC',
      now: new Date('2026-01-01T12:00:00Z'),
    }))
    expect(result.currentStreak).toBe(2)
  })

  it('handles empty syncSchedules with active blog cadence', () => {
    const result = calculateStreak(makeInput({
      publishHistory: ['2026-06-02T10:00:00Z', '2026-05-26T10:00:00Z'],
      syncSchedules: [],
      blogCadence: blogCadence,
    }))
    expect(result.currentStreak).toBe(2)
    expect(result.isActive).toBe(true)
  })
})
