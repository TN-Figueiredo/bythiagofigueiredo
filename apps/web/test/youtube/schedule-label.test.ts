import { describe, it, expect } from 'vitest'
import { deriveScheduleLabel, resolveScheduleLabel } from '@/lib/youtube/schedule-label'

describe('deriveScheduleLabel', () => {
  it('returns null for empty schedules', () => {
    expect(deriveScheduleLabel([], 'en')).toBeNull()
    expect(deriveScheduleLabel([], 'pt-BR')).toBeNull()
  })

  it('handles single day in EN', () => {
    const schedules = [{ day: 'thursday', hour: 10, tz: 'America/Sao_Paulo', label: '' }]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every Thursday')
  })

  it('handles single day in PT-BR', () => {
    const schedules = [{ day: 'thursday', hour: 10, tz: 'America/Sao_Paulo', label: '' }]
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade toda quinta')
  })

  it('handles monday', () => {
    const schedules = [{ day: 'monday', hour: 8, tz: 'UTC', label: '' }]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every Monday')
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade toda segunda')
  })

  it('handles two days with & separator', () => {
    const schedules = [
      { day: 'tuesday', hour: 10, tz: 'UTC', label: '' },
      { day: 'friday', hour: 10, tz: 'UTC', label: '' },
    ]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new Tue & Fri')
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade terça e sexta')
  })

  it('handles three days with comma + &', () => {
    const schedules = [
      { day: 'monday', hour: 10, tz: 'UTC', label: '' },
      { day: 'wednesday', hour: 10, tz: 'UTC', label: '' },
      { day: 'friday', hour: 10, tz: 'UTC', label: '' },
    ]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new Mon, Wed & Fri')
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade seg, qua e sex')
  })

  it('deduplicates same-day entries', () => {
    const schedules = [
      { day: 'thursday', hour: 10, tz: 'UTC', label: '' },
      { day: 'thursday', hour: 14, tz: 'UTC', label: '' },
    ]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every Thursday')
  })

  it('returns null for unknown day values', () => {
    const schedules = [{ day: 'funday', hour: 10, tz: 'UTC', label: '' }]
    expect(deriveScheduleLabel(schedules, 'en')).toBeNull()
  })

  it('handles all seven days', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const schedules = days.map(d => ({ day: d, hour: 10, tz: 'UTC', label: '' }))
    const result = deriveScheduleLabel(schedules, 'en')
    expect(result).toContain('Mon')
    expect(result).toContain('Sun')
  })
})

describe('resolveScheduleLabel', () => {
  it('returns manual override when set', () => {
    const schedules = [{ day: 'thursday', hour: 10, tz: 'UTC', label: '' }]
    expect(resolveScheduleLabel('custom text', schedules, 'en')).toBe('custom text')
  })

  it('trims whitespace-only override to null and falls through', () => {
    expect(resolveScheduleLabel('   ', null, 'en')).toBeNull()
  })

  it('auto-derives when no override', () => {
    const schedules = [{ day: 'thursday', hour: 10, tz: 'UTC', label: '' }]
    expect(resolveScheduleLabel(null, schedules, 'en')).toBe('new every Thursday')
  })

  it('returns null when both are empty', () => {
    expect(resolveScheduleLabel(null, [], 'en')).toBeNull()
    expect(resolveScheduleLabel(null, null, 'pt-BR')).toBeNull()
  })
})
