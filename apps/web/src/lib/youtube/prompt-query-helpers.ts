/**
 * Pure helper functions for computing prompt-context fields.
 * No DB access, no 'use server' — consumed by youtube-prompt-actions.ts.
 */

import { computeOutliers } from '@/lib/youtube/scoring'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoWithCategory {
  id: string
  title: string
  category_id: string | null
  view_count: number
  avg_view_percentage: number | null
  published_at: string
}

interface CategoryInfo {
  id: string
  slug: string
  name_pt: string
  name_en: string
}

export interface CategoryPerformance {
  categorySlug: string
  categoryName: string
  avgViews: number
  /**
   * Mean `avg_view_percentage` over the videos that HAVE it. The key is absent
   * (not 0, not null) when no video in the category was measured — which in
   * production is every video: the analytics sync never requests
   * averageViewPercentage. This object is serialized into an LLM prompt, and a
   * model reads "avgRetention: 0" as a fact about the audience.
   */
  avgRetention?: number
  /** How many of `videoCount` videos the retention average covers. Present iff `avgRetention` is. */
  retentionVideoCount?: number
  videoCount: number
}

export interface OutlierSuccess {
  title: string
  modifiedZ: number
  views: number
}

// ---------------------------------------------------------------------------
// 1. aggregateCategoryPerformance
// ---------------------------------------------------------------------------

export function aggregateCategoryPerformance(
  videos: VideoWithCategory[],
  categoryMap: Map<string, CategoryInfo>,
): CategoryPerformance[] {
  const buckets = new Map<string, { slug: string; name: string; totalViews: number; totalRetention: number; retentionCount: number; count: number }>()

  for (const v of videos) {
    if (!v.category_id) continue
    const cat = categoryMap.get(v.category_id)
    if (!cat) continue

    const bucket = buckets.get(v.category_id) ?? { slug: cat.slug, name: cat.name_pt, totalViews: 0, totalRetention: 0, retentionCount: 0, count: 0 }
    bucket.totalViews += v.view_count
    if (v.avg_view_percentage !== null) {
      bucket.totalRetention += v.avg_view_percentage
      bucket.retentionCount++
    }
    bucket.count++
    buckets.set(v.category_id, bucket)
  }

  return Array.from(buckets.values())
    .map((b): CategoryPerformance => ({
      categorySlug: b.slug,
      categoryName: b.name,
      avgViews: Math.round(b.totalViews / b.count),
      ...(b.retentionCount > 0
        ? {
            avgRetention: Math.round((b.totalRetention / b.retentionCount) * 10) / 10,
            retentionVideoCount: b.retentionCount,
          }
        : {}),
      videoCount: b.count,
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 5)
}

// ---------------------------------------------------------------------------
// 2. detectOutlierSuccesses
// ---------------------------------------------------------------------------

export function detectOutlierSuccesses(
  videos: VideoWithCategory[],
): OutlierSuccess[] {
  if (videos.length < 5) return []

  const scored = videos.map(v => ({ videoId: v.id, score: v.view_count }))
  const outliers = computeOutliers(scored, 'reach')

  const videoMap = new Map(videos.map(v => [v.id, v]))
  return outliers
    .filter(o => o.direction === 'positive')
    .map(o => {
      const video = videoMap.get(o.videoId)
      return {
        title: video?.title ?? '',
        modifiedZ: Math.round(o.modifiedZ * 100) / 100,
        views: video?.view_count ?? 0,
      }
    })
    .sort((a, b) => b.modifiedZ - a.modifiedZ)
}

// ---------------------------------------------------------------------------
// 3. computeBestPerformingDay
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export function computeBestPerformingDay(
  videos: VideoWithCategory[],
): string | null {
  if (videos.length < 7) return null

  const byDay = new Map<number, { totalViews: number; count: number }>()

  for (const v of videos) {
    const day = new Date(v.published_at).getUTCDay()
    const bucket = byDay.get(day) ?? { totalViews: 0, count: 0 }
    bucket.totalViews += v.view_count
    bucket.count++
    byDay.set(day, bucket)
  }

  let bestDay = -1
  let bestAvg = -1

  for (const [day, bucket] of byDay) {
    const avg = bucket.totalViews / bucket.count
    if (avg > bestAvg) {
      bestAvg = avg
      bestDay = day
    }
  }

  return bestDay >= 0 ? DAY_NAMES[bestDay]! : null
}

// ---------------------------------------------------------------------------
// 4. computeBestPerformingHour
// ---------------------------------------------------------------------------

export function computeBestPerformingHour(
  videos: VideoWithCategory[],
): number | null {
  if (videos.length < 10) return null

  const byHour = new Map<number, { totalViews: number; count: number }>()

  for (const v of videos) {
    const hour = new Date(v.published_at).getUTCHours()
    const bucket = byHour.get(hour) ?? { totalViews: 0, count: 0 }
    bucket.totalViews += v.view_count
    bucket.count++
    byHour.set(hour, bucket)
  }

  let bestHour = -1
  let bestAvg = -1

  for (const [hour, bucket] of byHour) {
    const avg = bucket.totalViews / bucket.count
    if (avg > bestAvg) {
      bestAvg = avg
      bestHour = hour
    }
  }

  return bestHour >= 0 ? bestHour : null
}
