import { describe, it, expect } from 'vitest'
import { deriveScheduleLabel, resolveScheduleLabel } from '@/lib/youtube/schedule-label'

describe('deriveScheduleLabel', () => {
  it('returns null for empty schedules', () => {
    expect(deriveScheduleLabel([], 'en')).toBeNull()
    expect(deriveScheduleLabel([], 'pt-BR')).toBeNull()
  })

  it('handles single day in EN', () => {
    const schedules = [{ day: 'thursday' as const }]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every Thursday')
  })

  it('handles single day in PT-BR', () => {
    const schedules = [{ day: 'thursday' as const }]
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade toda quinta')
  })

  it('handles monday', () => {
    const schedules = [{ day: 'monday' as const }]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every Monday')
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade toda segunda')
  })

  it('uses "todo" for masculine PT-BR days (sábado, domingo)', () => {
    expect(deriveScheduleLabel([{ day: 'saturday' as const }], 'pt-BR')).toBe('novidade todo sábado')
    expect(deriveScheduleLabel([{ day: 'sunday' as const }], 'pt-BR')).toBe('novidade todo domingo')
  })

  it('handles two days with & separator', () => {
    const schedules = [{ day: 'tuesday' as const }, { day: 'friday' as const }]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new Tue & Fri')
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade terça e sexta')
  })

  it('handles three days with comma + &', () => {
    const schedules = [
      { day: 'monday' as const },
      { day: 'wednesday' as const },
      { day: 'friday' as const },
    ]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new Mon, Wed & Fri')
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade seg, qua e sex')
  })

  it('deduplicates same-day entries', () => {
    const schedules = [{ day: 'thursday' as const }, { day: 'thursday' as const }]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every Thursday')
  })

  it('returns null for unknown day values', () => {
    const schedules = [{ day: 'funday' as unknown as 'monday' }]
    expect(deriveScheduleLabel(schedules, 'en')).toBeNull()
  })

  it('collapses all seven days to "every day" in EN', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
    const schedules = days.map(d => ({ day: d }))
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every day')
  })

  it('collapses all seven days to "todo dia" in PT-BR', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
    const schedules = days.map(d => ({ day: d }))
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade todo dia')
  })

  it('collapses Mon-Fri to "weekdays" in EN', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
    const schedules = days.map(d => ({ day: d }))
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new weekdays')
  })

  it('collapses Mon-Fri to "de segunda a sexta" in PT-BR', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
    const schedules = days.map(d => ({ day: d }))
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade de segunda a sexta')
  })

  it('collapses Sat+Sun to "weekends" in EN', () => {
    const schedules = [{ day: 'saturday' as const }, { day: 'sunday' as const }]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new weekends')
  })

  it('collapses Sat+Sun to "nos fins de semana" in PT-BR', () => {
    const schedules = [{ day: 'saturday' as const }, { day: 'sunday' as const }]
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade nos fins de semana')
  })

  it('normalizes mixed-case day names', () => {
    const schedules = [{ day: 'Thursday' as unknown as 'thursday' }]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every Thursday')
  })

  it('handles 4-day combination (Mon, Tue, Thu, Fri) — no collapse', () => {
    const days = ['monday', 'tuesday', 'thursday', 'friday'] as const
    const schedules = days.map(d => ({ day: d }))
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new Mon, Tue, Thu & Fri')
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade seg, ter, qui e sex')
  })

  it('handles 6-day combination (Mon-Sat) — no collapse', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
    const schedules = days.map(d => ({ day: d }))
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new Mon, Tue, Wed, Thu, Fri & Sat')
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade seg, ter, qua, qui, sex e sáb')
  })

  it('sorts days to calendar order regardless of input order', () => {
    const schedules = [{ day: 'friday' as const }, { day: 'monday' as const }]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new Mon & Fri')
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade segunda e sexta')
  })

  it('filters out unknown days and derives from valid ones', () => {
    const schedules = [
      { day: 'monday' as const },
      { day: 'funday' as unknown as 'monday' },
    ]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every Monday')
  })

  it('accepts "pt" as alias for "pt-BR"', () => {
    const schedules = [{ day: 'thursday' as const }]
    expect(deriveScheduleLabel(schedules, 'pt')).toBe('novidade toda quinta')
  })
})

describe('resolveScheduleLabel', () => {
  it('returns manual override when set', () => {
    const schedules = [{ day: 'thursday' as const }]
    expect(resolveScheduleLabel('custom text', schedules, 'en')).toBe('custom text')
  })

  it('trims whitespace-only override to null and falls through', () => {
    expect(resolveScheduleLabel('   ', null, 'en')).toBeNull()
  })

  it('auto-derives when no override', () => {
    const schedules = [{ day: 'thursday' as const }]
    expect(resolveScheduleLabel(null, schedules, 'en')).toBe('new every Thursday')
  })

  it('returns null when both are empty', () => {
    expect(resolveScheduleLabel(null, [], 'en')).toBeNull()
    expect(resolveScheduleLabel(null, null, 'pt-BR')).toBeNull()
  })

  it('falls through whitespace override to derive from schedules', () => {
    const schedules = [{ day: 'thursday' as const }]
    expect(resolveScheduleLabel('   ', schedules, 'en')).toBe('new every Thursday')
  })
})
