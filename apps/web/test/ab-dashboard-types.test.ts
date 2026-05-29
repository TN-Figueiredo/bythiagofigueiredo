import { describe, it, expect } from 'vitest'
import type { DashboardStats, AbTestDraft, SuggestedVideo, LearningsData, LearningsTag, EligibleVideo, AbTestCardView } from '@/lib/youtube/ab-types'

describe('Dashboard types', () => {
  it('DashboardStats has all required fields', () => {
    const s: DashboardStats = { activeTests: 2, avgConfidence: 87, winRate: 60, avgLift: 12.3 }
    expect(s.activeTests).toBe(2)
    expect(s.avgConfidence).toBeGreaterThanOrEqual(0)
    expect(s.avgConfidence).toBeLessThanOrEqual(100)
  })
  it('AbTestCardView lift is percentage', () => {
    const c = { lift: 15.2 } as AbTestCardView
    expect(c.lift).toBeGreaterThan(0)
  })
  it('SuggestedVideo grade is A-F', () => {
    const g: SuggestedVideo['grade'] = 'D'
    expect(['A','B','C','D','F']).toContain(g)
  })
  it('LearningsTag negative flag defaults undefined', () => {
    const t: LearningsTag = { tag: 'face-close', wins: 3, avgLift: 8, kind: 'thumb' }
    expect(t.negative).toBeUndefined()
  })
  it('AbTestDraft step is 0-4', () => {
    const d = { step: 2 } as AbTestDraft
    expect(d.step).toBeGreaterThanOrEqual(0)
    expect(d.step).toBeLessThanOrEqual(4)
  })
})
