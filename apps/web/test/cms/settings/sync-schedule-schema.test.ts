import { describe, it, expect, vi } from 'vitest'

// -- Module-level mocks required to import the 'use server' actions module --
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn(),
}))

vi.mock('@/lib/youtube/api-client', () => ({
  lookupChannelByHandle: vi.fn(),
}))

const { syncScheduleSchema } = await import(
  '@/app/cms/(authed)/settings/actions'
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SCHEDULE = {
  day: 'monday' as const,
  hour: 10,
  tz: 'America/Sao_Paulo',
  label: 'Weekly',
}

const VALID_INPUT = {
  channel_id: '550e8400-e29b-41d4-a716-446655440000',
  sync_enabled: true,
  sync_schedules: [VALID_SCHEDULE],
  schedule_label: null,
}

function parse(input: unknown) {
  return syncScheduleSchema.safeParse(input)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncScheduleSchema', () => {
  describe('top-level fields', () => {
    it('accepts valid input', () => {
      expect(parse(VALID_INPUT).success).toBe(true)
    })

    it('rejects non-UUID channel_id', () => {
      expect(parse({ ...VALID_INPUT, channel_id: 'not-a-uuid' }).success).toBe(false)
    })

    it('rejects missing channel_id', () => {
      const { channel_id: _omit, ...rest } = VALID_INPUT
      expect(parse(rest).success).toBe(false)
    })

    it('rejects non-boolean sync_enabled', () => {
      expect(parse({ ...VALID_INPUT, sync_enabled: 'yes' }).success).toBe(false)
    })
  })

  describe('sync_schedules — field validation', () => {
    it('accepts empty array', () => {
      expect(parse({ ...VALID_INPUT, sync_schedules: [] }).success).toBe(true)
    })

    it('rejects invalid day value', () => {
      const result = parse({
        ...VALID_INPUT,
        sync_schedules: [{ ...VALID_SCHEDULE, day: 'funday' }],
      })
      expect(result.success).toBe(false)
    })

    it('accepts all valid day values', () => {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
      for (const day of days) {
        expect(
          parse({ ...VALID_INPUT, sync_schedules: [{ ...VALID_SCHEDULE, day }] }).success,
          `day=${day} should be valid`,
        ).toBe(true)
      }
    })

    it('rejects hour < 0', () => {
      expect(
        parse({ ...VALID_INPUT, sync_schedules: [{ ...VALID_SCHEDULE, hour: -1 }] }).success,
      ).toBe(false)
    })

    it('rejects hour > 23', () => {
      expect(
        parse({ ...VALID_INPUT, sync_schedules: [{ ...VALID_SCHEDULE, hour: 24 }] }).success,
      ).toBe(false)
    })

    it('accepts hour = 0 (midnight)', () => {
      expect(
        parse({ ...VALID_INPUT, sync_schedules: [{ ...VALID_SCHEDULE, hour: 0 }] }).success,
      ).toBe(true)
    })

    it('accepts hour = 23', () => {
      expect(
        parse({ ...VALID_INPUT, sync_schedules: [{ ...VALID_SCHEDULE, hour: 23 }] }).success,
      ).toBe(true)
    })

    it('rejects non-integer hour', () => {
      expect(
        parse({ ...VALID_INPUT, sync_schedules: [{ ...VALID_SCHEDULE, hour: 10.5 }] }).success,
      ).toBe(false)
    })

    it('rejects invalid IANA timezone', () => {
      expect(
        parse({ ...VALID_INPUT, sync_schedules: [{ ...VALID_SCHEDULE, tz: 'Invalid/Timezone' }] }).success,
      ).toBe(false)
    })

    it('accepts a valid non-Brazil timezone', () => {
      expect(
        parse({ ...VALID_INPUT, sync_schedules: [{ ...VALID_SCHEDULE, tz: 'America/New_York' }] }).success,
      ).toBe(true)
    })

    it('rejects label exceeding 100 characters', () => {
      expect(
        parse({
          ...VALID_INPUT,
          sync_schedules: [{ ...VALID_SCHEDULE, label: 'a'.repeat(101) }],
        }).success,
      ).toBe(false)
    })

    it('accepts label at exactly 100 characters', () => {
      expect(
        parse({
          ...VALID_INPUT,
          sync_schedules: [{ ...VALID_SCHEDULE, label: 'a'.repeat(100) }],
        }).success,
      ).toBe(true)
    })
  })

  describe('sync_schedules — label trimming', () => {
    it('trims leading and trailing whitespace from label', () => {
      const result = parse({
        ...VALID_INPUT,
        sync_schedules: [{ ...VALID_SCHEDULE, label: '  hello  ' }],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sync_schedules[0].label).toBe('hello')
      }
    })

    it('trims label to empty string when only whitespace', () => {
      const result = parse({
        ...VALID_INPUT,
        sync_schedules: [{ ...VALID_SCHEDULE, label: '   ' }],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sync_schedules[0].label).toBe('')
      }
    })

    it('does not alter a label that is already trimmed', () => {
      const result = parse({
        ...VALID_INPUT,
        sync_schedules: [{ ...VALID_SCHEDULE, label: 'Morning Sync' }],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sync_schedules[0].label).toBe('Morning Sync')
      }
    })
  })

  describe('sync_schedules — max entries (superRefine)', () => {
    it('accepts exactly 21 entries', () => {
      const entries = Array.from({ length: 21 }, (_, i) => ({
        ...VALID_SCHEDULE,
        hour: i % 24,
        day: (['monday', 'tuesday', 'wednesday'] as const)[i % 3],
      }))
      expect(parse({ ...VALID_INPUT, sync_schedules: entries }).success).toBe(true)
    })

    it('rejects 22 entries (exceeds max)', () => {
      const entries = Array.from({ length: 22 }, (_, i) => ({
        ...VALID_SCHEDULE,
        hour: i % 24,
      }))
      expect(parse({ ...VALID_INPUT, sync_schedules: entries }).success).toBe(false)
    })
  })

  describe('sync_schedules — duplicate detection (superRefine)', () => {
    it('rejects duplicate (day, hour, tz) combination', () => {
      const result = parse({
        ...VALID_INPUT,
        sync_schedules: [
          { day: 'monday', hour: 10, tz: 'America/Sao_Paulo', label: 'A' },
          { day: 'monday', hour: 10, tz: 'America/Sao_Paulo', label: 'B' },
        ],
      })
      expect(result.success).toBe(false)
    })

    it('reports the correct duplicate index in the error', () => {
      const result = parse({
        ...VALID_INPUT,
        sync_schedules: [
          { day: 'tuesday', hour: 9, tz: 'America/Sao_Paulo', label: 'First' },
          { day: 'tuesday', hour: 9, tz: 'America/Sao_Paulo', label: 'Dupe' },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.flatMap((i) => i.path)
        expect(paths).toContain(1)
      }
    })

    it('allows same day+hour with different timezone', () => {
      expect(
        parse({
          ...VALID_INPUT,
          sync_schedules: [
            { day: 'monday', hour: 10, tz: 'America/Sao_Paulo', label: '' },
            { day: 'monday', hour: 10, tz: 'America/New_York', label: '' },
          ],
        }).success,
      ).toBe(true)
    })

    it('allows same day+tz with different hour', () => {
      expect(
        parse({
          ...VALID_INPUT,
          sync_schedules: [
            { day: 'monday', hour: 10, tz: 'America/Sao_Paulo', label: '' },
            { day: 'monday', hour: 11, tz: 'America/Sao_Paulo', label: '' },
          ],
        }).success,
      ).toBe(true)
    })

    it('allows same hour+tz with different day', () => {
      expect(
        parse({
          ...VALID_INPUT,
          sync_schedules: [
            { day: 'monday', hour: 10, tz: 'America/Sao_Paulo', label: '' },
            { day: 'tuesday', hour: 10, tz: 'America/Sao_Paulo', label: '' },
          ],
        }).success,
      ).toBe(true)
    })

    it('detects a duplicate when it is not the first pair', () => {
      // Entries 0 and 1 are unique; entries 1 and 2 are duplicates
      const result = parse({
        ...VALID_INPUT,
        sync_schedules: [
          { day: 'friday', hour: 8, tz: 'UTC', label: 'A' },
          { day: 'friday', hour: 9, tz: 'UTC', label: 'B' },
          { day: 'friday', hour: 9, tz: 'UTC', label: 'C' },
        ],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('schedule_label', () => {
    it('accepts null', () => {
      expect(parse({ ...VALID_INPUT, schedule_label: null }).success).toBe(true)
    })

    it('accepts undefined (optional field)', () => {
      const { schedule_label: _omit, ...rest } = VALID_INPUT
      expect(parse(rest).success).toBe(true)
    })

    it('accepts a non-empty string', () => {
      expect(parse({ ...VALID_INPUT, schedule_label: 'My label' }).success).toBe(true)
    })

    it('rejects label exceeding 200 characters', () => {
      expect(parse({ ...VALID_INPUT, schedule_label: 'a'.repeat(201) }).success).toBe(false)
    })

    it('accepts label at exactly 200 characters', () => {
      expect(parse({ ...VALID_INPUT, schedule_label: 'a'.repeat(200) }).success).toBe(true)
    })

    it('transforms whitespace-only string to null', () => {
      const result = parse({ ...VALID_INPUT, schedule_label: '   ' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.schedule_label).toBeNull()
      }
    })

    it('transforms empty string to null', () => {
      const result = parse({ ...VALID_INPUT, schedule_label: '' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.schedule_label).toBeNull()
      }
    })

    it('trims whitespace before checking emptiness', () => {
      const result = parse({ ...VALID_INPUT, schedule_label: '  Real Label  ' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.schedule_label).toBe('Real Label')
      }
    })
  })
})
