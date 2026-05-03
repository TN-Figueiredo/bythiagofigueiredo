import { describe, it, expect } from 'vitest'
import {
  formatSubscriberCount,
  formatDaysAgo,
  resolveAccentTextColor,
  deriveCadenceLabel,
} from '@/lib/newsletter/format'

describe('formatSubscriberCount', () => {
  it('returns null when count < 10', () => {
    expect(formatSubscriberCount(5)).toBeNull()
    expect(formatSubscriberCount(0)).toBeNull()
    expect(formatSubscriberCount(9)).toBeNull()
  })

  it('returns exact number below 1000', () => {
    expect(formatSubscriberCount(10)).toBe('10')
    expect(formatSubscriberCount(408)).toBe('408')
    expect(formatSubscriberCount(999)).toBe('999')
  })

  it('formats thousands with 1 decimal', () => {
    expect(formatSubscriberCount(1000)).toBe('1.0k')
    expect(formatSubscriberCount(1240)).toBe('1.2k')
    expect(formatSubscriberCount(12500)).toBe('12.5k')
  })
})

describe('formatDaysAgo', () => {
  it('returns today key for 0 days', () => {
    expect(formatDaysAgo(0, 'en')).toBe('today')
    expect(formatDaysAgo(0, 'pt-BR')).toBe('hoje')
  })

  it('returns yesterday key for 1 day', () => {
    expect(formatDaysAgo(1, 'en')).toBe('yesterday')
    expect(formatDaysAgo(1, 'pt-BR')).toBe('ontem')
  })

  it('returns interpolated string for n days', () => {
    expect(formatDaysAgo(5, 'en')).toBe('5 days ago')
    expect(formatDaysAgo(5, 'pt-BR')).toBe('há 5 dias')
    expect(formatDaysAgo(30, 'en')).toBe('30 days ago')
  })
})

describe('resolveAccentTextColor', () => {
  it('returns white for dark backgrounds', () => {
    expect(resolveAccentTextColor('#000000')).toBe('#FFFFFF')
    expect(resolveAccentTextColor('#1F5F8B')).toBe('#FFFFFF')
    expect(resolveAccentTextColor('#C14513')).toBe('#FFFFFF')
  })

  it('returns black for light backgrounds', () => {
    expect(resolveAccentTextColor('#FFFFFF')).toBe('#000000')
    expect(resolveAccentTextColor('#FFE37A')).toBe('#000000')
    expect(resolveAccentTextColor('#A983D6')).toBe('#FFFFFF')
  })
})

describe('deriveCadenceLabel', () => {
  it('returns label when cadence_label exists', () => {
    expect(deriveCadenceLabel('1× por semana', 7, 'pt-BR')).toBe('1× por semana')
  })

  it('derives from cadence_days when label is null', () => {
    expect(deriveCadenceLabel(null, 7, 'en')).toBe('Weekly')
    expect(deriveCadenceLabel(null, 7, 'pt-BR')).toBe('Semanal')
    expect(deriveCadenceLabel(null, 14, 'en')).toBe('Bi-weekly')
    expect(deriveCadenceLabel(null, 14, 'pt-BR')).toBe('Quinzenal')
    expect(deriveCadenceLabel(null, 30, 'en')).toBe('Monthly')
    expect(deriveCadenceLabel(null, 30, 'pt-BR')).toBe('Mensal')
  })

  it('appends day of week when cadence_start_date is provided', () => {
    // 2026-05-01 is a Friday (day 5)
    expect(deriveCadenceLabel(null, 7, 'en', '2026-05-01')).toBe('Weekly, Fridays')
    expect(deriveCadenceLabel(null, 7, 'pt-BR', '2026-05-01')).toBe('semanal, sextas')
    // 2026-05-03 is a Sunday (day 0)
    expect(deriveCadenceLabel(null, 14, 'en', '2026-05-03')).toBe('Bi-weekly, Sundays')
    expect(deriveCadenceLabel(null, 14, 'pt-BR', '2026-05-03')).toBe('quinzenal, domingos')
  })

  it('does not append day for non-standard cadence_days even with start date', () => {
    expect(deriveCadenceLabel(null, 3, 'en', '2026-05-01')).toBe('every 3 days')
    expect(deriveCadenceLabel(null, 45, 'pt-BR', '2026-05-01')).toBe('a cada 45 dias')
  })

  it('falls back to generic "every N days" for unknown cadence_days', () => {
    expect(deriveCadenceLabel(null, 3, 'en')).toBe('every 3 days')
    expect(deriveCadenceLabel(null, 45, 'pt-BR')).toBe('a cada 45 dias')
  })

  it('returns null for 0 cadence_days without label', () => {
    expect(deriveCadenceLabel(null, 0, 'en')).toBeNull()
  })

  it('ignores cadence_start_date when label exists', () => {
    expect(deriveCadenceLabel('custom', 7, 'en', '2026-05-01')).toBe('custom')
  })
})
