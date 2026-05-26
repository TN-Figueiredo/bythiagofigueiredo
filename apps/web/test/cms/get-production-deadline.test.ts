import { describe, it, expect } from 'vitest'
import { getProductionDeadline } from '../../src/lib/pipeline/get-production-deadline'

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
})
