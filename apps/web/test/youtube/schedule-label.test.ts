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

  it('handles all seven days in EN', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
    const schedules = days.map(d => ({ day: d }))
    const result = deriveScheduleLabel(schedules, 'en')!
    expect(result).toContain('Mon')
    expect(result).toContain('Tue')
    expect(result).toContain('Sun')
  })

  it('handles all seven days in PT-BR with correct abbreviations', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
    const schedules = days.map(d => ({ day: d }))
    const result = deriveScheduleLabel(schedules, 'pt-BR')!
    expect(result).toContain('seg')
    expect(result).toContain('ter')
    expect(result).toContain('qua')
    expect(result).toContain('qui')
    expect(result).toContain('sex')
    expect(result).toContain('sáb')
    expect(result).toContain('dom')
  })

  it('normalizes mixed-case day names', () => {
    const schedules = [{ day: 'Thursday' as unknown as 'thursday' }]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every Thursday')
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
})
