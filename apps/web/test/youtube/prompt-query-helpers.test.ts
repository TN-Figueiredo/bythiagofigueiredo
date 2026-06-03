import { describe, it, expect } from 'vitest'
import {
  aggregateCategoryPerformance,
  detectOutlierSuccesses,
  computeBestPerformingDay,
  computeBestPerformingHour,
} from '@/lib/youtube/prompt-query-helpers'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVideo(overrides: Partial<{
  id: string
  title: string
  category_id: string | null
  view_count: number
  avg_view_percentage: number | null
  published_at: string
}> = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? 'Test Video',
    category_id: 'category_id' in overrides ? overrides.category_id! : null,
    view_count: overrides.view_count ?? 100,
    avg_view_percentage: 'avg_view_percentage' in overrides ? overrides.avg_view_percentage! : 50,
    published_at: overrides.published_at ?? '2026-01-15T14:00:00Z',
  }
}

function makeCategoryMap(entries: Array<{ id: string; slug: string; name_pt: string; name_en: string }>) {
  return new Map(entries.map(e => [e.id, e]))
}

// ---------------------------------------------------------------------------
// aggregateCategoryPerformance
// ---------------------------------------------------------------------------

describe('aggregateCategoryPerformance', () => {
  const defaultMap = makeCategoryMap([
    { id: 'cat-a', slug: 'tutorials', name_pt: 'Tutoriais', name_en: 'Tutorials' },
    { id: 'cat-b', slug: 'vlogs', name_pt: 'Vlogs', name_en: 'Vlogs' },
    { id: 'cat-c', slug: 'reviews', name_pt: 'Reviews', name_en: 'Reviews' },
    { id: 'cat-d', slug: 'shorts', name_pt: 'Shorts', name_en: 'Shorts' },
    { id: 'cat-e', slug: 'podcasts', name_pt: 'Podcasts', name_en: 'Podcasts' },
    { id: 'cat-f', slug: 'lives', name_pt: 'Lives', name_en: 'Lives' },
  ])

  it('returns empty array for empty videos', () => {
    expect(aggregateCategoryPerformance([], defaultMap)).toEqual([])
  })

  it('returns empty array when all videos have no category_id', () => {
    const videos = [
      makeVideo({ category_id: null }),
      makeVideo({ category_id: null }),
    ]
    expect(aggregateCategoryPerformance(videos, defaultMap)).toEqual([])
  })

  it('correctly aggregates 3 categories sorted by avgViews descending', () => {
    const videos = [
      // cat-a: 2 videos, views 1000 + 500 = 1500, avg = 750
      makeVideo({ category_id: 'cat-a', view_count: 1000, avg_view_percentage: 60 }),
      makeVideo({ category_id: 'cat-a', view_count: 500, avg_view_percentage: 40 }),
      // cat-b: 3 videos, views 2000 + 1000 + 600 = 3600, avg = 1200
      makeVideo({ category_id: 'cat-b', view_count: 2000, avg_view_percentage: 70 }),
      makeVideo({ category_id: 'cat-b', view_count: 1000, avg_view_percentage: 50 }),
      makeVideo({ category_id: 'cat-b', view_count: 600, avg_view_percentage: 30 }),
      // cat-c: 1 video, views 200, avg = 200
      makeVideo({ category_id: 'cat-c', view_count: 200, avg_view_percentage: 80 }),
    ]

    const result = aggregateCategoryPerformance(videos, defaultMap)

    expect(result).toHaveLength(3)

    // Sorted descending by avgViews: cat-b (1200) > cat-a (750) > cat-c (200)
    expect(result[0]!.categorySlug).toBe('vlogs')
    expect(result[0]!.avgViews).toBe(1200)
    expect(result[0]!.videoCount).toBe(3)
    expect(result[0]!.avgRetention).toBe(50) // (70+50+30)/3 = 50

    expect(result[1]!.categorySlug).toBe('tutorials')
    expect(result[1]!.avgViews).toBe(750)
    expect(result[1]!.videoCount).toBe(2)
    expect(result[1]!.avgRetention).toBe(50) // (60+40)/2 = 50

    expect(result[2]!.categorySlug).toBe('reviews')
    expect(result[2]!.avgViews).toBe(200)
    expect(result[2]!.videoCount).toBe(1)
    expect(result[2]!.avgRetention).toBe(80)
  })

  it('handles null avg_view_percentage by treating as 0', () => {
    const videos = [
      makeVideo({ category_id: 'cat-a', view_count: 100, avg_view_percentage: null }),
      makeVideo({ category_id: 'cat-a', view_count: 100, avg_view_percentage: 60 }),
    ]

    const result = aggregateCategoryPerformance(videos, defaultMap)

    expect(result).toHaveLength(1)
    // (0 + 60) / 2 = 30
    expect(result[0]!.avgRetention).toBe(30)
  })

  it('caps results at 5 categories', () => {
    const videos = [
      makeVideo({ category_id: 'cat-a', view_count: 600 }),
      makeVideo({ category_id: 'cat-b', view_count: 500 }),
      makeVideo({ category_id: 'cat-c', view_count: 400 }),
      makeVideo({ category_id: 'cat-d', view_count: 300 }),
      makeVideo({ category_id: 'cat-e', view_count: 200 }),
      makeVideo({ category_id: 'cat-f', view_count: 100 }),
    ]

    const result = aggregateCategoryPerformance(videos, defaultMap)

    expect(result).toHaveLength(5)
    // The lowest (cat-f, 100 views) should be excluded
    expect(result.map(r => r.categorySlug)).not.toContain('lives')
  })

  it('reports correct videoCount per category', () => {
    const videos = [
      makeVideo({ category_id: 'cat-a', view_count: 100 }),
      makeVideo({ category_id: 'cat-a', view_count: 200 }),
      makeVideo({ category_id: 'cat-a', view_count: 300 }),
      makeVideo({ category_id: 'cat-b', view_count: 1000 }),
    ]

    const result = aggregateCategoryPerformance(videos, defaultMap)

    const catA = result.find(r => r.categorySlug === 'tutorials')!
    const catB = result.find(r => r.categorySlug === 'vlogs')!

    expect(catA.videoCount).toBe(3)
    expect(catA.avgViews).toBe(200) // (100+200+300)/3 = 200

    expect(catB.videoCount).toBe(1)
    expect(catB.avgViews).toBe(1000)
  })

  it('skips videos whose category_id is not in the map', () => {
    const videos = [
      makeVideo({ category_id: 'unknown-cat', view_count: 9999 }),
      makeVideo({ category_id: 'cat-a', view_count: 100 }),
    ]

    const result = aggregateCategoryPerformance(videos, defaultMap)

    expect(result).toHaveLength(1)
    expect(result[0]!.categorySlug).toBe('tutorials')
  })
})

// ---------------------------------------------------------------------------
// detectOutlierSuccesses
// ---------------------------------------------------------------------------

describe('detectOutlierSuccesses', () => {
  it('returns empty array when fewer than 5 videos', () => {
    const videos = Array.from({ length: 4 }, (_, i) =>
      makeVideo({ id: `v${i}`, view_count: 100 }),
    )
    expect(detectOutlierSuccesses(videos)).toEqual([])
  })

  it('detects a video with extreme views as an outlier', () => {
    // Use varied view counts so MAD is non-zero, allowing modified Z-score to work
    const videos = Array.from({ length: 10 }, (_, i) =>
      makeVideo({ id: `v${i}`, title: `Normal ${i}`, view_count: 80 + i * 10 }),
    )
    // Add one extreme outlier (far above the cluster)
    videos.push(makeVideo({ id: 'outlier-1', title: 'Viral Hit', view_count: 100000 }))

    const result = detectOutlierSuccesses(videos)

    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.some(o => o.title === 'Viral Hit' && o.views === 100000)).toBe(true)
    // All outliers should be positive (sorted by modifiedZ desc)
    for (const o of result) {
      expect(o.modifiedZ).toBeGreaterThan(0)
    }
  })

  it('returns empty array when all videos have identical views', () => {
    const videos = Array.from({ length: 10 }, (_, i) =>
      makeVideo({ id: `v${i}`, view_count: 500 }),
    )
    expect(detectOutlierSuccesses(videos)).toEqual([])
  })

  it('uses video id (not title) as identifier — two videos with same title but different ids', () => {
    // Use varied view counts so MAD is non-zero
    const base = Array.from({ length: 9 }, (_, i) =>
      makeVideo({ id: `base-${i}`, title: 'Common Title', view_count: 50 + i * 20 }),
    )
    // Two videos with the same title, different ids, one is an extreme outlier
    base.push(makeVideo({ id: 'dup-low', title: 'Shared Title', view_count: 120 }))
    base.push(makeVideo({ id: 'dup-high', title: 'Shared Title', view_count: 100000 }))

    const result = detectOutlierSuccesses(base)

    // The outlier should have the high-view video's data
    const outlier = result.find(o => o.views === 100000)
    expect(outlier).toBeDefined()
    expect(outlier!.title).toBe('Shared Title')
    // The low-view one with the same title should NOT be an outlier
    const lowOutlier = result.find(o => o.views === 120)
    expect(lowOutlier).toBeUndefined()
  })

  it('sorts outliers by modifiedZ descending', () => {
    const base = Array.from({ length: 8 }, (_, i) =>
      makeVideo({ id: `base-${i}`, view_count: 50 + i * 15 }),
    )
    base.push(makeVideo({ id: 'big', title: 'Big', view_count: 20000 }))
    base.push(makeVideo({ id: 'bigger', title: 'Bigger', view_count: 50000 }))

    const result = detectOutlierSuccesses(base)

    if (result.length >= 2) {
      expect(result[0]!.modifiedZ).toBeGreaterThanOrEqual(result[1]!.modifiedZ)
    }
  })
})

// ---------------------------------------------------------------------------
// computeBestPerformingDay
// ---------------------------------------------------------------------------

describe('computeBestPerformingDay', () => {
  it('returns null when fewer than 7 videos', () => {
    const videos = Array.from({ length: 6 }, () => makeVideo())
    expect(computeBestPerformingDay(videos)).toBeNull()
  })

  it('returns Wednesday when it has highest average views', () => {
    // Create 14 videos spread across days, with Wednesday having the highest average
    // We use UTC dates where the day of week is known
    const videos = [
      // Monday (2026-01-05 is a Monday)
      makeVideo({ view_count: 100, published_at: '2026-01-05T10:00:00Z' }),
      makeVideo({ view_count: 120, published_at: '2026-01-12T10:00:00Z' }),
      // Tuesday
      makeVideo({ view_count: 150, published_at: '2026-01-06T10:00:00Z' }),
      makeVideo({ view_count: 130, published_at: '2026-01-13T10:00:00Z' }),
      // Wednesday — highest avg views
      makeVideo({ view_count: 5000, published_at: '2026-01-07T10:00:00Z' }),
      makeVideo({ view_count: 4000, published_at: '2026-01-14T10:00:00Z' }),
      // Thursday
      makeVideo({ view_count: 200, published_at: '2026-01-08T10:00:00Z' }),
      makeVideo({ view_count: 180, published_at: '2026-01-15T10:00:00Z' }),
      // Friday
      makeVideo({ view_count: 300, published_at: '2026-01-09T10:00:00Z' }),
      makeVideo({ view_count: 250, published_at: '2026-01-16T10:00:00Z' }),
      // Saturday
      makeVideo({ view_count: 80, published_at: '2026-01-10T10:00:00Z' }),
      makeVideo({ view_count: 90, published_at: '2026-01-17T10:00:00Z' }),
      // Sunday
      makeVideo({ view_count: 50, published_at: '2026-01-11T10:00:00Z' }),
      makeVideo({ view_count: 60, published_at: '2026-01-18T10:00:00Z' }),
    ]

    expect(computeBestPerformingDay(videos)).toBe('Wednesday')
  })

  it('returns that day when all videos are on the same day', () => {
    // All on Friday (2026-01-09 is a Friday)
    const videos = Array.from({ length: 8 }, (_, i) =>
      makeVideo({ view_count: 100 + i, published_at: `2026-01-09T${String(10 + i).padStart(2, '0')}:00:00Z` }),
    )

    expect(computeBestPerformingDay(videos)).toBe('Friday')
  })
})

// ---------------------------------------------------------------------------
// computeBestPerformingHour
// ---------------------------------------------------------------------------

describe('computeBestPerformingHour', () => {
  it('returns null when fewer than 10 videos', () => {
    const videos = Array.from({ length: 9 }, () => makeVideo())
    expect(computeBestPerformingHour(videos)).toBeNull()
  })

  it('returns hour 14 when it has highest average views', () => {
    const videos: ReturnType<typeof makeVideo>[] = []

    // 5 videos at hour 10 with low views
    for (let i = 0; i < 5; i++) {
      videos.push(makeVideo({
        view_count: 100,
        published_at: `2026-01-${String(10 + i).padStart(2, '0')}T10:00:00Z`,
      }))
    }

    // 5 videos at hour 14 with high views
    for (let i = 0; i < 5; i++) {
      videos.push(makeVideo({
        view_count: 5000,
        published_at: `2026-01-${String(10 + i).padStart(2, '0')}T14:00:00Z`,
      }))
    }

    // 5 videos at hour 20 with medium views
    for (let i = 0; i < 5; i++) {
      videos.push(makeVideo({
        view_count: 500,
        published_at: `2026-01-${String(10 + i).padStart(2, '0')}T20:00:00Z`,
      }))
    }

    expect(computeBestPerformingHour(videos)).toBe(14)
  })

  it('returns the correct hour even when there is a single dominant hour', () => {
    const videos: ReturnType<typeof makeVideo>[] = []

    // 9 videos at various hours with low views
    for (let i = 0; i < 9; i++) {
      videos.push(makeVideo({
        view_count: 50,
        published_at: `2026-01-${String(10 + i).padStart(2, '0')}T${String(i).padStart(2, '0')}:00:00Z`,
      }))
    }

    // 1 video at hour 18 with very high views
    videos.push(makeVideo({
      view_count: 99999,
      published_at: '2026-01-20T18:00:00Z',
    }))

    expect(computeBestPerformingHour(videos)).toBe(18)
  })

  it('returns a number in [0, 23] range', () => {
    const videos = Array.from({ length: 12 }, (_, i) =>
      makeVideo({
        view_count: 100 * (i + 1),
        published_at: `2026-01-${String(10 + i).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:30:00Z`,
      }),
    )

    const result = computeBestPerformingHour(videos)
    expect(result).not.toBeNull()
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(23)
  })
})
