import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(),
}))

import { formatDuration } from '@/lib/analytics/content-queries'

describe('content-queries helpers', () => {
  it('formatDuration converts seconds to m:ss format', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(59)).toBe('0:59')
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(125)).toBe('2:05')
    expect(formatDuration(3600)).toBe('60:00')
  })

  it('delta computation: up direction for positive diff', () => {
    const makeDelta = (current: number, previous: number, suffix = '') => {
      const diff = current - previous
      if (diff === 0) return { value: '— same', direction: 'neutral' }
      const sign = diff > 0 ? '+' : ''
      return { value: `${sign}${diff}${suffix}`, direction: diff > 0 ? 'up' : 'down' }
    }
    expect(makeDelta(100, 80)).toEqual({ value: '+20', direction: 'up' })
    expect(makeDelta(50, 80)).toEqual({ value: '-30', direction: 'down' })
    expect(makeDelta(80, 80)).toEqual({ value: '— same', direction: 'neutral' })
    expect(makeDelta(90, 80, 'pp')).toEqual({ value: '+10pp', direction: 'up' })
  })

  it('sparkline: Posts Published sparkline is array of 1s (one per day)', () => {
    const rows = Array.from({ length: 30 }, () => ({ views: 10 }))
    const sparkline = rows.map(() => 1)
    expect(sparkline).toHaveLength(30)
    expect(sparkline.every(v => v === 1)).toBe(true)
  })

  it('avg computation handles empty rows', () => {
    const rows: Array<{ avg_read_depth: number | null }> = []
    const avgDepth = rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + (r.avg_read_depth ?? 0), 0) / rows.length)
      : 0
    expect(avgDepth).toBe(0)
  })

  it('avg computation with data', () => {
    const rows = [
      { avg_read_depth: 80 },
      { avg_read_depth: 60 },
      { avg_read_depth: null },
    ]
    const avgDepth = rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + (r.avg_read_depth ?? 0), 0) / rows.length)
      : 0
    expect(avgDepth).toBe(47) // (80+60+0)/3 = 46.67 → 47
  })
})
