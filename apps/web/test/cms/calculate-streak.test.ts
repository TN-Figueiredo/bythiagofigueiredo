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

  // Grace accumulation: gap week counts toward streak when no expected slots
  it('accumulates grace week into streak count — 1 gap + 1 published = streak 3', () => {
    // now = 2026-06-02 (W23).
    // W23: published (current week) → streak starts at 1
    // W22 (2026-05-25): no publication → grace (no expected slots)
    // W21 (2026-05-19): published → streak += 1 + 1 grace = 2 more → total 3
    // W20: nothing → loop ends (grace already consumed)
    const result = calculateStreak(makeInput({
      now: new Date('2026-06-02T12:00:00Z'),
      publishHistory: [
        '2026-06-02T10:00:00Z',  // W23
        '2026-05-19T10:00:00Z',  // W21
      ],
      syncSchedules: [],
      blogCadence: null,
    }))
    expect(result.currentStreak).toBe(3)
    expect(result.isActive).toBe(true)
  })

  it('does not count grace weeks before any published week', () => {
    // now = 2026-06-02 (W23). No expected slots.
    // W23: no pub → no anchor yet, grace NOT allowed → break
    // Single publication at W20 never reached because loop breaks at W23.
    // But let's test with publication at W20 (3 weeks back):
    // W23: no pub, no anchor → break immediately → streak = 0
    const result = calculateStreak(makeInput({
      now: new Date('2026-06-02T12:00:00Z'),
      publishHistory: [
        '2026-05-11T10:00:00Z',  // W20 — 3 weeks before now
      ],
      syncSchedules: [],
      blogCadence: null,
    }))
    // Without the fix, grace would accumulate W23/W22/W21 → streak = 1+3 = 4
    // With the fix, no anchor before grace → break at W23 → streak = 0
    expect(result.currentStreak).toBe(0)
  })

  it('correctly handles single-digit ISO weeks', () => {
    // 2026-01-05 (Mon) = W01, 2026-01-12 (Mon) = W02
    // now = 2026-01-12 → current week is W02
    const result = calculateStreak(makeInput({
      publishHistory: ['2026-01-05T12:00:00Z', '2026-01-12T12:00:00Z'],
      siteTimezone: 'UTC',
      now: new Date('2026-01-12T12:00:00Z'),
    }))
    expect(result.currentStreak).toBe(2)
  })

  it('breaks streak after exceeding MAX_CONSECUTIVE_GRACE cap', () => {
    // now = 2026-06-02 (W23). No expected slots.
    // W23: published → streak = 1, hasAnchor = true
    // W22: grace (1)
    // W21: grace (2)
    // W20: grace (3)
    // W19: grace (4) — at MAX_CONSECUTIVE_GRACE
    // W18: no pub, graceCount(4) === MAX_CONSECUTIVE_GRACE → break
    // Publication at W17 is never reached.
    const result = calculateStreak(makeInput({
      now: new Date('2026-06-02T12:00:00Z'),
      publishHistory: [
        '2026-06-02T10:00:00Z',  // W23
        '2026-04-20T10:00:00Z',  // W17 — 6 weeks back, past the 4-week grace cap
      ],
      syncSchedules: [],
      blogCadence: null,
    }))
    // Grace cap is 4, so after W23 (published) + 4 grace weeks (W22-W19),
    // W18 exceeds the cap → break. W17 publication never counted.
    expect(result.currentStreak).toBe(1)
  })

  it('accepts Date objects in publishHistory', () => {
    const result = calculateStreak(makeInput({
      publishHistory: [
        new Date('2026-06-02T10:00:00Z'),
        new Date('2026-05-26T10:00:00Z'),
      ] as unknown as string[],
    }))
    expect(result.currentStreak).toBe(2)
    expect(result.isActive).toBe(true)
  })

  // Multiple grace weeks: 2 consecutive grace weeks followed by a published week
  it('accumulates 2 consecutive grace weeks — published + 2 grace + current = streak 4', () => {
    // now = 2026-06-02 (W23).
    // W23: published → streak 1, graceCount reset to 0
    // W22 (2026-05-25): no pub → grace, graceCount = 1
    // W21 (2026-05-18): no pub → grace, graceCount = 2
    // W20 (2026-05-11): published → streak += 1 + 2 = 3 more → total 4
    // W19: nothing → loop ends
    const result = calculateStreak(makeInput({
      now: new Date('2026-06-02T12:00:00Z'),
      publishHistory: [
        '2026-06-02T10:00:00Z',  // W23
        '2026-05-11T10:00:00Z',  // W20
      ],
      syncSchedules: [],
      blogCadence: null,
    }))
    expect(result.currentStreak).toBe(4)
    expect(result.isActive).toBe(true)
  })
})
