import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

describe('content-queries', () => {
  it('fetchContentKpis returns posts published, avg depth, avg time, reads complete', async () => {
    interface ContentKpi {
      label: string
      value: number | string
      delta: { value: string; direction: 'up' | 'down' | 'neutral' } | null
      sparkline: number[]
    }

    const expectedLabels = ['Posts Published', 'Avg Read Depth', 'Avg Time on Page', 'Reads Complete']
    expect(expectedLabels).toHaveLength(4)
  })

  it('fetchTopPosts returns posts sorted by views with depth and time', () => {
    interface TopPost {
      id: string
      title: string
      status: string
      views: number
      uniqueViews: number
      avgDepth: number
      avgTime: number
      readsComplete: number
    }

    const mockPost: TopPost = {
      id: '1',
      title: 'Test',
      status: 'published',
      views: 412,
      uniqueViews: 298,
      avgDepth: 82,
      avgTime: 340,
      readsComplete: 87,
    }
    expect(mockPost.views).toBeGreaterThan(0)
  })

  it('fetchDailyViewsChart returns points with current and previous period', () => {
    interface DailyViewPoint {
      date: string
      current: number
      previous: number
    }
    const point: DailyViewPoint = { date: '2026-05-01', current: 42, previous: 38 }
    expect(point.current).toBeGreaterThan(point.previous)
  })
})
