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
  avgRetention: number
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
  const buckets = new Map<string, { slug: string; name: string; totalViews: number; totalRetention: number; count: number }>()

  for (const v of videos) {
    if (!v.category_id) continue
    const cat = categoryMap.get(v.category_id)
    if (!cat) continue

    const bucket = buckets.get(v.category_id) ?? { slug: cat.slug, name: cat.name_pt, totalViews: 0, totalRetention: 0, count: 0 }
    bucket.totalViews += v.view_count
    bucket.totalRetention += v.avg_view_percentage ?? 0
    bucket.count++
    buckets.set(v.category_id, bucket)
  }

  return Array.from(buckets.values())
    .map(b => ({
      categorySlug: b.slug,
      categoryName: b.name,
      avgViews: Math.round(b.totalViews / b.count),
      avgRetention: Math.round((b.totalRetention / b.count) * 10) / 10,
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
