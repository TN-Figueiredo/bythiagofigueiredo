import { describe, it, expect } from 'vitest'
import { generateCadenceSlots, getNextSlot, isSlotDate, describePattern } from './cadence-slots'
import type { CadencePattern, Weekday } from './cadence-pattern'

// Helper: parse ISO date string to a Date for weekday assertions
function dow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

describe('generateCadenceSlots', () => {
  // -------------------------------------------------------------------------
  // daily
  // -------------------------------------------------------------------------
  describe('daily', () => {
    it('generates consecutive days', () => {
      const slots = generateCadenceSlots({ type: 'daily' }, { from: '2025-01-01', maxSlots: 5 })
      expect(slots).toEqual([
        '2025-01-01',
        '2025-01-02',
        '2025-01-03',
        '2025-01-04',
        '2025-01-05',
      ])
    })

    it('includes the from date itself', () => {
      const slots = generateCadenceSlots({ type: 'daily' }, { from: '2025-06-15', maxSlots: 1 })
      expect(slots).toEqual(['2025-06-15'])
    })
  })

  // -------------------------------------------------------------------------
  // daily_weekdays
  // -------------------------------------------------------------------------
  describe('daily_weekdays', () => {
    it('skips Saturday and Sunday', () => {
      // 2025-01-03 is a Friday; next Mon is 2025-01-06
      const slots = generateCadenceSlots(
        { type: 'daily_weekdays' },
        { from: '2025-01-03', maxSlots: 5 },
      )
      // Fri, Mon, Tue, Wed, Thu
      expect(slots).toEqual([
        '2025-01-03',
        '2025-01-06',
        '2025-01-07',
        '2025-01-08',
        '2025-01-09',
      ])
    })

    it('starting on Saturday skips to Monday', () => {
      // 2025-01-04 is Saturday
      const slots = generateCadenceSlots(
        { type: 'daily_weekdays' },
        { from: '2025-01-04', maxSlots: 2 },
      )
      expect(slots).toEqual(['2025-01-06', '2025-01-07'])
    })

    it('all returned days are Mon-Fri', () => {
      const slots = generateCadenceSlots(
        { type: 'daily_weekdays' },
        { from: '2025-03-01', maxSlots: 20 },
      )
      for (const slot of slots) {
        const d = dow(slot)
        expect(d).not.toBe(0) // not Sunday
        expect(d).not.toBe(6) // not Saturday
      }
    })
  })

  // -------------------------------------------------------------------------
  // weekly
  // -------------------------------------------------------------------------
  describe('weekly', () => {
    it('generates only specified weekdays', () => {
      // 2025-01-06 is Monday
      const slots = generateCadenceSlots(
        { type: 'weekly', days: ['mon', 'thu'] },
        { from: '2025-01-06', maxSlots: 6 },
      )
      // Mon 01-06, Thu 01-09, Mon 01-13, Thu 01-16, Mon 01-20, Thu 01-23
      expect(slots).toEqual([
        '2025-01-06',
        '2025-01-09',
        '2025-01-13',
        '2025-01-16',
        '2025-01-20',
        '2025-01-23',
      ])
    })

    it('returns empty array for empty days array', () => {
      const slots = generateCadenceSlots(
        { type: 'weekly', days: [] },
        { from: '2025-01-01', maxSlots: 5 },
      )
      expect(slots).toEqual([])
    })

    it('single day repeats weekly', () => {
      const slots = generateCadenceSlots(
        { type: 'weekly', days: ['fri'] },
        { from: '2025-01-01', maxSlots: 4 },
      )
      // All should be Fridays (dow=5)
      for (const slot of slots) expect(dow(slot)).toBe(5)
      expect(slots).toHaveLength(4)
      // Fridays: 2025-01-03, 01-10, 01-17, 01-24
      expect(slots).toEqual(['2025-01-03', '2025-01-10', '2025-01-17', '2025-01-24'])
    })
  })

  // -------------------------------------------------------------------------
  // biweekly
  // -------------------------------------------------------------------------
  describe('biweekly', () => {
    it('generates every 14 days on the correct weekday', () => {
      // 2025-01-03 is a Friday
      const slots = generateCadenceSlots(
        { type: 'biweekly', day: 'fri' },
        { from: '2025-01-03', maxSlots: 4 },
      )
      expect(slots).toEqual([
        '2025-01-03',
        '2025-01-17',
        '2025-01-31',
        '2025-02-14',
      ])
      // All must be Fridays
      for (const slot of slots) expect(dow(slot)).toBe(5)
    })

    it('advances to next target weekday when from is not that weekday', () => {
      // 2025-01-01 is Wednesday; the biweekly Monday chain (epoch-anchored to
      // 2000-01-03) lands on 2025-01-13, 2025-01-27, 2025-02-10
      const slots = generateCadenceSlots(
        { type: 'biweekly', day: 'mon' },
        { from: '2025-01-01', maxSlots: 3 },
      )
      expect(slots).toEqual(['2025-01-13', '2025-01-27', '2025-02-10'])
      for (const slot of slots) expect(dow(slot)).toBe(1) // Monday
    })

    it('generates exactly 14-day intervals', () => {
      const slots = generateCadenceSlots(
        { type: 'biweekly', day: 'wed' },
        { from: '2025-01-01', maxSlots: 5 },
      )
      for (let i = 1; i < slots.length; i++) {
        const diff =
          (new Date(slots[i]).getTime() - new Date(slots[i - 1]).getTime()) /
          86_400_000
        expect(diff).toBe(14)
      }
    })
  })

  // -------------------------------------------------------------------------
  // every_n_days
  // -------------------------------------------------------------------------
  describe('every_n_days', () => {
    it('generates every N days starting from "from"', () => {
      const slots = generateCadenceSlots(
        { type: 'every_n_days', interval: 7 },
        { from: '2025-01-01', maxSlots: 4 },
      )
      expect(slots).toEqual([
        '2025-01-01',
        '2025-01-08',
        '2025-01-15',
        '2025-01-22',
      ])
    })

    it('interval of 1 behaves like daily', () => {
      const slots = generateCadenceSlots(
        { type: 'every_n_days', interval: 1 },
        { from: '2025-03-01', maxSlots: 3 },
      )
      expect(slots).toEqual(['2025-03-01', '2025-03-02', '2025-03-03'])
    })
  })

  // -------------------------------------------------------------------------
  // monthly_day
  // -------------------------------------------------------------------------
  describe('monthly_day', () => {
    it('generates same day each month', () => {
      const slots = generateCadenceSlots(
        { type: 'monthly_day', day: 15 },
        { from: '2025-01-15', maxSlots: 4 },
      )
      expect(slots).toEqual([
        '2025-01-15',
        '2025-02-15',
        '2025-03-15',
        '2025-04-15',
      ])
    })

    it('clamps day 31 in February (non-leap year) to 28', () => {
      // 2025 is not a leap year
      const slots = generateCadenceSlots(
        { type: 'monthly_day', day: 31 },
        { from: '2025-02-01', maxSlots: 2 },
      )
      expect(slots[0]).toBe('2025-02-28')
      expect(slots[1]).toBe('2025-03-31')
    })

    it('clamps day 31 in February (leap year 2028) to 29', () => {
      const slots = generateCadenceSlots(
        { type: 'monthly_day', day: 31 },
        { from: '2028-02-01', maxSlots: 2 },
      )
      expect(slots[0]).toBe('2028-02-29')
      expect(slots[1]).toBe('2028-03-31')
    })

    it('clamps day 29 in non-leap February to 28', () => {
      // 2025 is not a leap year
      const slots = generateCadenceSlots(
        { type: 'monthly_day', day: 29 },
        { from: '2025-02-01', maxSlots: 1 },
      )
      expect(slots[0]).toBe('2025-02-28')
    })

    it('clamps day 29 in leap February to 29', () => {
      // 2028 is a leap year
      const slots = generateCadenceSlots(
        { type: 'monthly_day', day: 29 },
        { from: '2028-02-01', maxSlots: 1 },
      )
      expect(slots[0]).toBe('2028-02-29')
    })

    it('skips month if from is after that month slot', () => {
      // day=1, from=Jan 15 → first slot should be Feb 1
      const slots = generateCadenceSlots(
        { type: 'monthly_day', day: 1 },
        { from: '2025-01-15', maxSlots: 3 },
      )
      expect(slots).toEqual(['2025-02-01', '2025-03-01', '2025-04-01'])
    })
  })

  // -------------------------------------------------------------------------
  // monthly_last_day
  // -------------------------------------------------------------------------
  describe('monthly_last_day', () => {
    it('generates last day of each month', () => {
      const slots = generateCadenceSlots(
        { type: 'monthly_last_day' },
        { from: '2025-01-01', maxSlots: 4 },
      )
      expect(slots).toEqual([
        '2025-01-31',
        '2025-02-28',
        '2025-03-31',
        '2025-04-30',
      ])
    })

    it('correctly handles leap year February', () => {
      const slots = generateCadenceSlots(
        { type: 'monthly_last_day' },
        { from: '2028-02-01', maxSlots: 1 },
      )
      expect(slots[0]).toBe('2028-02-29')
    })

    it('from date equals last day of month — includes it', () => {
      const slots = generateCadenceSlots(
        { type: 'monthly_last_day' },
        { from: '2025-01-31', maxSlots: 2 },
      )
      expect(slots).toEqual(['2025-01-31', '2025-02-28'])
    })
  })

  // -------------------------------------------------------------------------
  // monthly_weekday
  // -------------------------------------------------------------------------
  describe('monthly_weekday', () => {
    it('generates 1st Friday of each month', () => {
      const slots = generateCadenceSlots(
        { type: 'monthly_weekday', week: 1, day: 'fri' },
        { from: '2025-01-01', maxSlots: 3 },
      )
      // Jan 2025: 1st Fri = Jan 3; Feb: Feb 7; Mar: Mar 7
      expect(slots).toEqual(['2025-01-03', '2025-02-07', '2025-03-07'])
      for (const slot of slots) expect(dow(slot)).toBe(5)
    })

    it('generates 3rd Monday of each month', () => {
      const slots = generateCadenceSlots(
        { type: 'monthly_weekday', week: 3, day: 'mon' },
        { from: '2025-01-01', maxSlots: 3 },
      )
      // Jan 2025: 1st Mon = Jan 6; 3rd Mon = Jan 20
      // Feb: 3rd Mon = Feb 17; Mar: 3rd Mon = Mar 17
      expect(slots).toEqual(['2025-01-20', '2025-02-17', '2025-03-17'])
      for (const slot of slots) expect(dow(slot)).toBe(1)
    })

    it('generates 4th Tuesday of month', () => {
      const slots = generateCadenceSlots(
        { type: 'monthly_weekday', week: 4, day: 'tue' },
        { from: '2025-01-01', maxSlots: 2 },
      )
      // Jan 2025: 1st Tue = Jan 7; 4th = Jan 28
      expect(slots[0]).toBe('2025-01-28')
      for (const slot of slots) expect(dow(slot)).toBe(2)
    })
  })

  // -------------------------------------------------------------------------
  // monthly_last_weekday
  // -------------------------------------------------------------------------
  describe('monthly_last_weekday', () => {
    it('generates last Friday of each month', () => {
      const slots = generateCadenceSlots(
        { type: 'monthly_last_weekday', day: 'fri' },
        { from: '2025-01-01', maxSlots: 3 },
      )
      // Jan 2025: last Fri = Jan 31; Feb: last Fri = Feb 28; Mar: last Fri = Mar 28
      expect(slots).toEqual(['2025-01-31', '2025-02-28', '2025-03-28'])
      for (const slot of slots) expect(dow(slot)).toBe(5)
    })

    it('generates last Monday of each month', () => {
      const slots = generateCadenceSlots(
        { type: 'monthly_last_weekday', day: 'mon' },
        { from: '2025-01-01', maxSlots: 2 },
      )
      // Jan 2025: last Mon = Jan 27; Feb: Feb 24
      expect(slots).toEqual(['2025-01-27', '2025-02-24'])
      for (const slot of slots) expect(dow(slot)).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // quarterly_day
  // -------------------------------------------------------------------------
  describe('quarterly_day', () => {
    it('generates day 15 in Jan/Apr/Jul/Oct', () => {
      const slots = generateCadenceSlots(
        { type: 'quarterly_day', day: 15, months: [1, 4, 7, 10] },
        { from: '2025-01-01', maxSlots: 5 },
      )
      expect(slots).toEqual([
        '2025-01-15',
        '2025-04-15',
        '2025-07-15',
        '2025-10-15',
        '2026-01-15',
      ])
    })

    it('clamps day 31 in months with fewer days', () => {
      // Apr has 30 days — day 31 should clamp to Apr 30
      const slots = generateCadenceSlots(
        { type: 'quarterly_day', day: 31, months: [1, 4, 7, 10] },
        { from: '2025-01-01', maxSlots: 4 },
      )
      expect(slots).toEqual([
        '2025-01-31',
        '2025-04-30',
        '2025-07-31',
        '2025-10-31',
      ])
    })

    it('skips quarters before from date', () => {
      const slots = generateCadenceSlots(
        { type: 'quarterly_day', day: 1, months: [1, 4, 7, 10] },
        { from: '2025-05-01', maxSlots: 3 },
      )
      expect(slots).toEqual(['2025-07-01', '2025-10-01', '2026-01-01'])
    })
  })

  // -------------------------------------------------------------------------
  // Edge: maxSlots = 0
  // -------------------------------------------------------------------------
  describe('maxSlots = 0', () => {
    it('returns empty array for daily', () => {
      expect(
        generateCadenceSlots({ type: 'daily' }, { from: '2025-01-01', maxSlots: 0 }),
      ).toEqual([])
    })

    it('returns empty array for monthly_day', () => {
      expect(
        generateCadenceSlots(
          { type: 'monthly_day', day: 1 },
          { from: '2025-01-01', maxSlots: 0 },
        ),
      ).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // Paused ranges
  // -------------------------------------------------------------------------
  describe('paused ranges', () => {
    it('skips dates within a paused range', () => {
      const slots = generateCadenceSlots(
        { type: 'daily' },
        {
          from: '2025-01-01',
          maxSlots: 5,
          pausedRanges: [{ from: '2025-01-02', to: '2025-01-04' }],
        },
      )
      // Jan 02, 03, 04 are skipped; 01 and 05, 06, 07... fill slots
      expect(slots).toEqual([
        '2025-01-01',
        '2025-01-05',
        '2025-01-06',
        '2025-01-07',
        '2025-01-08',
      ])
    })

    it('skipped dates do NOT count toward maxSlots', () => {
      const slots = generateCadenceSlots(
        { type: 'weekly', days: ['mon'] },
        {
          from: '2025-01-06', // Monday
          maxSlots: 3,
          pausedRanges: [{ from: '2025-01-06', to: '2025-01-13' }],
        },
      )
      // Jan 6 and Jan 13 are paused; first valid is Jan 20
      expect(slots).toHaveLength(3)
      expect(slots[0]).toBe('2025-01-20')
    })

    it('multiple paused ranges work correctly', () => {
      const slots = generateCadenceSlots(
        { type: 'daily' },
        {
          from: '2025-01-01',
          maxSlots: 4,
          pausedRanges: [
            { from: '2025-01-02', to: '2025-01-02' },
            { from: '2025-01-04', to: '2025-01-05' },
          ],
        },
      )
      // Valid: 01, 03, 06, 07
      expect(slots).toEqual([
        '2025-01-01',
        '2025-01-03',
        '2025-01-06',
        '2025-01-07',
      ])
    })

    it('paused range inclusive of both endpoints', () => {
      const slots = generateCadenceSlots(
        { type: 'daily' },
        {
          from: '2025-01-01',
          maxSlots: 3,
          pausedRanges: [{ from: '2025-01-01', to: '2025-01-01' }],
        },
      )
      expect(slots[0]).toBe('2025-01-02')
    })
  })
})

// ---------------------------------------------------------------------------
// getNextSlot
// ---------------------------------------------------------------------------
describe('getNextSlot', () => {
  it('returns next daily slot after a date', () => {
    expect(getNextSlot({ type: 'daily' }, '2025-03-10')).toBe('2025-03-11')
  })

  it('returns next weekday slot skipping weekend', () => {
    // 2025-01-03 is Friday; next weekday after it is 2025-01-06 (Monday)
    expect(getNextSlot({ type: 'daily_weekdays' }, '2025-01-03')).toBe('2025-01-06')
  })

  it('returns next weekly slot', () => {
    // 2025-01-06 is Monday; next Monday is 2025-01-13
    expect(getNextSlot({ type: 'weekly', days: ['mon'] }, '2025-01-06')).toBe('2025-01-13')
  })

  it('returns next biweekly slot', () => {
    // 2025-01-03 is Friday; next biweekly Friday is 2025-01-17
    expect(getNextSlot({ type: 'biweekly', day: 'fri' }, '2025-01-03')).toBe('2025-01-17')
  })

  it('returns null when empty weekly days', () => {
    expect(getNextSlot({ type: 'weekly', days: [] }, '2025-01-01')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// isSlotDate
// ---------------------------------------------------------------------------
describe('isSlotDate', () => {
  it('identifies a daily slot', () => {
    expect(isSlotDate({ type: 'daily' }, '2025-06-01')).toBe(true)
  })

  it('identifies weekday slot correctly', () => {
    // 2025-01-06 is Monday
    expect(isSlotDate({ type: 'daily_weekdays' }, '2025-01-06')).toBe(true)
    // 2025-01-04 is Saturday
    expect(isSlotDate({ type: 'daily_weekdays' }, '2025-01-04')).toBe(false)
  })

  it('identifies weekly slot', () => {
    // 2025-01-06 is Monday
    expect(isSlotDate({ type: 'weekly', days: ['mon', 'fri'] }, '2025-01-06')).toBe(true)
    expect(isSlotDate({ type: 'weekly', days: ['mon', 'fri'] }, '2025-01-07')).toBe(false)
  })

  it('identifies biweekly slot', () => {
    // 2025-01-03 is a Friday
    expect(isSlotDate({ type: 'biweekly', day: 'fri' }, '2025-01-03')).toBe(true)
    // 2025-01-10 would be next Friday but biweekly — so NOT a slot (not a match)
    expect(isSlotDate({ type: 'biweekly', day: 'fri' }, '2025-01-10')).toBe(false)
  })

  it('identifies monthly_day slot', () => {
    expect(isSlotDate({ type: 'monthly_day', day: 15 }, '2025-03-15')).toBe(true)
    expect(isSlotDate({ type: 'monthly_day', day: 15 }, '2025-03-14')).toBe(false)
  })

  it('identifies monthly_day clamped slot (day 31 in Feb)', () => {
    // day 31 in Feb 2025 clamps to Feb 28
    expect(isSlotDate({ type: 'monthly_day', day: 31 }, '2025-02-28')).toBe(true)
    expect(isSlotDate({ type: 'monthly_day', day: 31 }, '2025-02-27')).toBe(false)
  })

  it('identifies monthly_last_day slot', () => {
    expect(isSlotDate({ type: 'monthly_last_day' }, '2025-01-31')).toBe(true)
    expect(isSlotDate({ type: 'monthly_last_day' }, '2025-02-28')).toBe(true)
    expect(isSlotDate({ type: 'monthly_last_day' }, '2025-02-27')).toBe(false)
  })

  it('identifies quarterly_day slot', () => {
    expect(
      isSlotDate({ type: 'quarterly_day', day: 15, months: [1, 4, 7, 10] }, '2025-04-15'),
    ).toBe(true)
    expect(
      isSlotDate({ type: 'quarterly_day', day: 15, months: [1, 4, 7, 10] }, '2025-05-15'),
    ).toBe(false)
  })

  it('returns false for empty weekly days', () => {
    expect(isSlotDate({ type: 'weekly', days: [] }, '2025-01-06')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// describePattern
// ---------------------------------------------------------------------------
describe('describePattern', () => {
  describe('en', () => {
    it('daily', () => {
      expect(describePattern({ type: 'daily' }, 'en')).toBe('Every day')
    })

    it('daily_weekdays', () => {
      expect(describePattern({ type: 'daily_weekdays' }, 'en')).toBe('Weekdays (Mon-Fri)')
    })

    it('weekly with multiple days', () => {
      expect(describePattern({ type: 'weekly', days: ['mon', 'thu'] }, 'en')).toBe('Every Mon, Thu')
    })

    it('weekly with single day', () => {
      expect(describePattern({ type: 'weekly', days: ['fri'] }, 'en')).toBe('Every Fri')
    })

    it('biweekly', () => {
      expect(describePattern({ type: 'biweekly', day: 'fri' }, 'en')).toBe('Every 2 weeks on Friday')
    })

    it('every_n_days', () => {
      expect(describePattern({ type: 'every_n_days', interval: 14 }, 'en')).toBe('Every 14 days')
    })

    it('monthly_day', () => {
      expect(describePattern({ type: 'monthly_day', day: 1 }, 'en')).toBe('Monthly on day 1')
    })

    it('monthly_last_day', () => {
      expect(describePattern({ type: 'monthly_last_day' }, 'en')).toBe('Last day of month')
    })

    it('monthly_weekday 1st Friday', () => {
      expect(describePattern({ type: 'monthly_weekday', week: 1, day: 'fri' }, 'en')).toBe(
        '1st Friday of month',
      )
    })

    it('monthly_weekday 3rd Monday', () => {
      expect(describePattern({ type: 'monthly_weekday', week: 3, day: 'mon' }, 'en')).toBe(
        '3rd Monday of month',
      )
    })

    it('monthly_last_weekday', () => {
      expect(describePattern({ type: 'monthly_last_weekday', day: 'fri' }, 'en')).toBe(
        'Last Friday of month',
      )
    })

    it('quarterly_day with Jan/Apr/Jul/Oct', () => {
      expect(
        describePattern({ type: 'quarterly_day', day: 15, months: [1, 4, 7, 10] }, 'en'),
      ).toBe('Quarterly on day 15 (Jan, Apr, Jul, Oct)')
    })
  })

  describe('pt-BR', () => {
    it('daily', () => {
      expect(describePattern({ type: 'daily' }, 'pt-BR')).toBe('Todo dia')
    })

    it('daily_weekdays', () => {
      expect(describePattern({ type: 'daily_weekdays' }, 'pt-BR')).toBe('Dias úteis (Seg-Sex)')
    })

    it('weekly with multiple days', () => {
      expect(describePattern({ type: 'weekly', days: ['mon', 'thu'] }, 'pt-BR')).toBe(
        'Toda Seg, Qui',
      )
    })

    it('biweekly', () => {
      expect(describePattern({ type: 'biweekly', day: 'fri' }, 'pt-BR')).toBe(
        'A cada 2 semanas na Sexta',
      )
    })

    it('every_n_days', () => {
      expect(describePattern({ type: 'every_n_days', interval: 14 }, 'pt-BR')).toBe(
        'A cada 14 dias',
      )
    })

    it('monthly_day', () => {
      expect(describePattern({ type: 'monthly_day', day: 1 }, 'pt-BR')).toBe('Mensal no dia 1')
    })

    it('monthly_last_day', () => {
      expect(describePattern({ type: 'monthly_last_day' }, 'pt-BR')).toBe('Último dia do mês')
    })

    it('monthly_weekday 1st Friday', () => {
      expect(describePattern({ type: 'monthly_weekday', week: 1, day: 'fri' }, 'pt-BR')).toBe(
        '1ª Sexta do mês',
      )
    })

    it('monthly_last_weekday', () => {
      expect(describePattern({ type: 'monthly_last_weekday', day: 'fri' }, 'pt-BR')).toBe(
        'Última Sexta do mês',
      )
    })

    it('quarterly_day with Jan/Apr/Jul/Oct', () => {
      expect(
        describePattern({ type: 'quarterly_day', day: 15, months: [1, 4, 7, 10] }, 'pt-BR'),
      ).toBe('Trimestral no dia 15 (Jan, Abr, Jul, Out)')
    })
  })
})
