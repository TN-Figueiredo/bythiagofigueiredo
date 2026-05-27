import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/pipeline/get-production-deadline', () => ({
  getProductionDeadline: vi.fn((pubDate: string, stage: string) => {
    if (stage === 'roteiro') return '2026-05-24'
    if (stage === 'draft') return '2026-05-24'
    return undefined
  }),
}))

import { getProductionDeadline } from '@/lib/pipeline/get-production-deadline'

describe('pipeline-deadline-digest logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getProductionDeadline returns deadline for active stages', () => {
    expect(getProductionDeadline('2026-05-28', 'roteiro')).toBe('2026-05-24')
  })

  it('getProductionDeadline returns undefined for published stage', () => {
    expect(getProductionDeadline('2026-05-28', 'published')).toBeUndefined()
  })

  describe('bucketing', () => {
    function bucket(daysUntil: number): 'overdue' | 'tomorrow' | 'upcoming' | 'skip' {
      if (daysUntil < 0) return 'overdue'
      if (daysUntil <= 1) return 'tomorrow'
      if (daysUntil <= 3) return 'upcoming'
      return 'skip'
    }

    it('buckets past deadlines as overdue', () => {
      expect(bucket(-2)).toBe('overdue')
    })

    it('buckets today/tomorrow as tomorrow', () => {
      expect(bucket(0)).toBe('tomorrow')
      expect(bucket(1)).toBe('tomorrow')
    })

    it('buckets 2-3 days as upcoming', () => {
      expect(bucket(2)).toBe('upcoming')
      expect(bucket(3)).toBe('upcoming')
    })

    it('skips items beyond 3 days', () => {
      expect(bucket(4)).toBe('skip')
    })
  })
})
