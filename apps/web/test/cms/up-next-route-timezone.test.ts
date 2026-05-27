import { describe, it, expect } from 'vitest'
import { buildScheduledAt } from '../../src/lib/pipeline/build-scheduled-at'

const SITE_TIMEZONE = 'America/Sao_Paulo'

describe('buildScheduledAt timezone handling', () => {
  it('preserves BRT time for morning slot', () => {
    const result = buildScheduledAt('2026-05-26', '10:00', SITE_TIMEZONE)
    expect(result).toBe('2026-05-26T10:00:00-03:00')
  })

  it('preserves BRT time for evening slot', () => {
    const result = buildScheduledAt('2026-05-26', '18:00', SITE_TIMEZONE)
    expect(result).toBe('2026-05-26T18:00:00-03:00')
  })

  it('defaults to midnight BRT when slotHour is null', () => {
    const result = buildScheduledAt('2026-05-26', null, SITE_TIMEZONE)
    expect(result).toBe('2026-05-26T00:00:00-03:00')
  })

  it('handles DST transition day correctly', () => {
    const result = buildScheduledAt('2026-11-15', '10:00', SITE_TIMEZONE)
    expect(result).toBe('2026-11-15T10:00:00-03:00')
  })

  it('roundtrips: extracting hour from result matches input', () => {
    const result = buildScheduledAt('2026-06-01', '14:30', SITE_TIMEZONE)
    expect(result).toContain('T14:30:00')
  })
})
