import { describe, it, expect } from 'vitest'
import { computeUrgencyColor, computeUrgencyBadge } from '@/lib/cms/sidebar-badges'

describe('pipeline urgency in sidebar badges', () => {
  it('computes red for pipeline items due within 4 days', () => {
    expect(computeUrgencyColor(2)).toBe('red')
  })

  it('computes orange for pipeline items due within 5-9 days', () => {
    expect(computeUrgencyColor(7)).toBe('orange')
  })

  it('computes yellow for pipeline items due within 10-15 days', () => {
    expect(computeUrgencyColor(12)).toBe('yellow')
  })

  it('returns null for pipeline items with no approaching deadline', () => {
    expect(computeUrgencyColor(20)).toBeNull()
  })

  it('builds urgency badge for pipeline items', () => {
    const result = computeUrgencyBadge([
      { typeName: 'Video', typeColor: '#ef4444', slotDate: '2026-05-28', daysUntil: 2 },
      { typeName: 'Blog', typeColor: '#f59e0b', slotDate: '2026-06-01', daysUntil: 6 },
    ])
    expect(result).not.toBeNull()
    expect(result!.count).toBe(2)
    expect(result!.color).toBe('red')
  })
})
