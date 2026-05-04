import { describe, it, expect } from 'vitest'
import { computeUrgencyColor, computeUrgencyBadge } from '@/lib/cms/sidebar-badges'

describe('computeUrgencyColor', () => {
  it('returns red for 0 days (today)', () => {
    expect(computeUrgencyColor(0)).toBe('red')
  })
  it('returns red for 4 days', () => {
    expect(computeUrgencyColor(4)).toBe('red')
  })
  it('returns orange for 5 days', () => {
    expect(computeUrgencyColor(5)).toBe('orange')
  })
  it('returns orange for 9 days', () => {
    expect(computeUrgencyColor(9)).toBe('orange')
  })
  it('returns yellow for 10 days', () => {
    expect(computeUrgencyColor(10)).toBe('yellow')
  })
  it('returns yellow for 15 days', () => {
    expect(computeUrgencyColor(15)).toBe('yellow')
  })
  it('returns null for >15 days', () => {
    expect(computeUrgencyColor(16)).toBeNull()
  })
  it('returns null for negative days (past slots excluded)', () => {
    expect(computeUrgencyColor(-1)).toBeNull()
  })
})

describe('computeUrgencyBadge', () => {
  it('returns null when no unfilled slots', () => {
    expect(computeUrgencyBadge([])).toBeNull()
  })
  it('returns count and red for single slot at 3 days', () => {
    const result = computeUrgencyBadge([
      { typeName: 'Weekly', typeColor: '#ef4444', slotDate: '2026-05-06', daysUntil: 3 },
    ])
    expect(result).toEqual({
      count: 1,
      color: 'red',
      slots: [{ typeName: 'Weekly', typeColor: '#ef4444', slotDate: '2026-05-06', daysUntil: 3 }],
    })
  })
  it('uses worst (nearest) color when multiple slots span tiers', () => {
    const result = computeUrgencyBadge([
      { typeName: 'A', typeColor: '#aaa', slotDate: '2026-05-15', daysUntil: 12 },
      { typeName: 'B', typeColor: '#bbb', slotDate: '2026-05-08', daysUntil: 5 },
    ])
    expect(result!.color).toBe('orange')
    expect(result!.count).toBe(2)
  })
  it('filters out slots beyond 15 days', () => {
    const result = computeUrgencyBadge([
      { typeName: 'A', typeColor: '#aaa', slotDate: '2026-05-20', daysUntil: 17 },
    ])
    expect(result).toBeNull()
  })
  it('includes today (daysUntil=0) as red', () => {
    const result = computeUrgencyBadge([
      { typeName: 'Today', typeColor: '#000', slotDate: '2026-05-03', daysUntil: 0 },
    ])
    expect(result!.color).toBe('red')
    expect(result!.count).toBe(1)
  })
  it('counts per-slot not per-type', () => {
    const result = computeUrgencyBadge([
      { typeName: 'Same', typeColor: '#aaa', slotDate: '2026-05-06', daysUntil: 3 },
      { typeName: 'Same', typeColor: '#aaa', slotDate: '2026-05-13', daysUntil: 10 },
      { typeName: 'Other', typeColor: '#bbb', slotDate: '2026-05-08', daysUntil: 5 },
    ])
    expect(result!.count).toBe(3)
    expect(result!.color).toBe('red')
  })
})
