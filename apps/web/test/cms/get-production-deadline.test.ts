import { describe, it, expect } from 'vitest'
import { getProductionDeadline } from '../../src/lib/pipeline/get-production-deadline'
import type { VelocityMap } from '../../src/lib/pipeline/up-next-types'

describe('getProductionDeadline', () => {
  it('returns pub - 4 days for writing stages', () => {
    expect(getProductionDeadline('2026-06-10', 'idea')).toBe('2026-06-06')
    expect(getProductionDeadline('2026-06-10', 'outline')).toBe('2026-06-06')
    expect(getProductionDeadline('2026-06-10', 'draft')).toBe('2026-06-06')
    expect(getProductionDeadline('2026-06-10', 'roteiro')).toBe('2026-06-06')
  })

  it('returns pub - 3 days for gravacao', () => {
    expect(getProductionDeadline('2026-06-10', 'gravacao')).toBe('2026-06-07')
  })

  it('returns pub - 2 days for edicao', () => {
    expect(getProductionDeadline('2026-06-10', 'edicao')).toBe('2026-06-08')
  })

  it('returns pub - 1 day for pos_producao and ready', () => {
    expect(getProductionDeadline('2026-06-10', 'pos_producao')).toBe('2026-06-09')
    expect(getProductionDeadline('2026-06-10', 'ready')).toBe('2026-06-09')
  })

  it('returns undefined for scheduled and published', () => {
    expect(getProductionDeadline('2026-06-10', 'scheduled')).toBeUndefined()
    expect(getProductionDeadline('2026-06-10', 'published')).toBeUndefined()
  })

  it('handles month boundary correctly', () => {
    expect(getProductionDeadline('2026-06-02', 'idea')).toBe('2026-05-29')
  })

  it('handles year boundary correctly', () => {
    expect(getProductionDeadline('2026-01-03', 'idea')).toBe('2025-12-30')
  })

  it('returns undefined for unknown stage string', () => {
    expect(getProductionDeadline('2026-06-10', 'nonexistent_stage' as never)).toBeUndefined()
  })
})

describe('getProductionDeadline with velocity', () => {
  const velocityMap: VelocityMap = {
    'video:roteiro':      { medianMinutes: 180, p90Minutes: 240, sampleCount: 10, effectiveMinutes: 180 },
    'video:gravacao':     { medianMinutes: 240, p90Minutes: 300, sampleCount: 10, effectiveMinutes: 240 },
    'video:edicao':       { medianMinutes: 90,  p90Minutes: 120, sampleCount: 10, effectiveMinutes: 90 },
    'video:pos_producao': { medianMinutes: 60,  p90Minutes: 90,  sampleCount: 10, effectiveMinutes: 60 },
    'video:ready':        { medianMinutes: 30,  p90Minutes: 45,  sampleCount: 10, effectiveMinutes: 30 },
  }

  it('sums effectiveMinutes from current stage to ready and converts to calendar days', () => {
    // From roteiro: 180+240+90+60+30 = 600 min = 1.25 workdays → ceil = 2 days
    const result = getProductionDeadline('2026-06-10', 'roteiro', { velocityMap, format: 'video' })
    expect(result).toBe('2026-06-08')
  })

  it('uses velocity for gravacao stage', () => {
    // From gravacao: 240+90+60+30 = 420 min = 0.875 workdays → ceil = 1 day
    const result = getProductionDeadline('2026-06-10', 'gravacao', { velocityMap, format: 'video' })
    expect(result).toBe('2026-06-09')
  })

  it('falls back to fixed offset when velocityMap is missing entries', () => {
    const sparseMap: VelocityMap = {
      'video:roteiro': { medianMinutes: 180, p90Minutes: 240, sampleCount: 10, effectiveMinutes: 180 },
    }
    const result = getProductionDeadline('2026-06-10', 'roteiro', { velocityMap: sparseMap, format: 'video' })
    expect(result).toBe('2026-06-06')
  })

  it('falls back to fixed offset when format is not provided', () => {
    const result = getProductionDeadline('2026-06-10', 'roteiro', { velocityMap })
    expect(result).toBe('2026-06-06')
  })

  it('returns undefined for scheduled/published even with velocity', () => {
    expect(getProductionDeadline('2026-06-10', 'scheduled', { velocityMap, format: 'video' })).toBeUndefined()
    expect(getProductionDeadline('2026-06-10', 'published', { velocityMap, format: 'video' })).toBeUndefined()
  })

  it('is backward-compatible: no velocity params = same behavior', () => {
    expect(getProductionDeadline('2026-06-10', 'idea')).toBe('2026-06-06')
    expect(getProductionDeadline('2026-06-10', 'gravacao')).toBe('2026-06-07')
  })

  it('sums effectiveMinutes from idea stage when all entries are present', () => {
    const fullMap = {
      'video:idea':         { medianMinutes: 60,  p90Minutes: 90,  sampleCount: 5, effectiveMinutes: 60 },
      'video:outline':      { medianMinutes: 60,  p90Minutes: 90,  sampleCount: 5, effectiveMinutes: 60 },
      'video:draft':        { medianMinutes: 60,  p90Minutes: 90,  sampleCount: 5, effectiveMinutes: 60 },
      'video:roteiro':      { medianMinutes: 180, p90Minutes: 240, sampleCount: 10, effectiveMinutes: 180 },
      'video:gravacao':     { medianMinutes: 240, p90Minutes: 300, sampleCount: 10, effectiveMinutes: 240 },
      'video:edicao':       { medianMinutes: 90,  p90Minutes: 120, sampleCount: 10, effectiveMinutes: 90 },
      'video:pos_producao': { medianMinutes: 60,  p90Minutes: 90,  sampleCount: 10, effectiveMinutes: 60 },
      'video:ready':        { medianMinutes: 30,  p90Minutes: 45,  sampleCount: 10, effectiveMinutes: 30 },
    }
    // Total from idea: 60+60+60+180+240+90+60+30 = 780 min → ceil(780/480) = 2 days
    expect(getProductionDeadline('2026-06-10', 'idea', { velocityMap: fullMap, format: 'video' })).toBe('2026-06-08')
  })

  it('uses only ready entry when stage is ready', () => {
    // Only video:ready = 30 min → ceil(30/480) = 1 day
    const map = {
      'video:ready': { medianMinutes: 30, p90Minutes: 45, sampleCount: 10, effectiveMinutes: 30 },
    }
    expect(getProductionDeadline('2026-06-10', 'ready', { velocityMap: map, format: 'video' })).toBe('2026-06-09')
  })

  it('returns null when all velocity entries have 0 effectiveMinutes', () => {
    const zeroMap = {
      'video:roteiro':      { medianMinutes: 0, p90Minutes: 0, sampleCount: 10, effectiveMinutes: 0 },
      'video:gravacao':     { medianMinutes: 0, p90Minutes: 0, sampleCount: 10, effectiveMinutes: 0 },
      'video:edicao':       { medianMinutes: 0, p90Minutes: 0, sampleCount: 10, effectiveMinutes: 0 },
      'video:pos_producao': { medianMinutes: 0, p90Minutes: 0, sampleCount: 10, effectiveMinutes: 0 },
      'video:ready':        { medianMinutes: 0, p90Minutes: 0, sampleCount: 10, effectiveMinutes: 0 },
    }
    // Zero total falls back to fixed offset (pub - 4 for roteiro)
    expect(getProductionDeadline('2026-06-10', 'roteiro', { velocityMap: zeroMap, format: 'video' })).toBe('2026-06-06')
  })
})
