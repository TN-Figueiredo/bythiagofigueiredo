import 'server-only'

import { unstable_cache } from 'next/cache'
import {
  fetchYtChannelMetrics,
  fetchYtDailyMetrics,
  fetchYtSearchTerms,
  fetchYtDemographics,
} from './analytics-client'
import type { YtVideoGrade, YtHealthScore } from './analytics-types'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export function getCachedYtMetrics(siteId: string, days: number) {
  return unstable_cache(
    () => fetchYtChannelMetrics(siteId, days),
    [`yt-metrics-${siteId}-${days}`],
    { revalidate: 300 },
  )()
}

export function getCachedYtDaily(siteId: string, days: number) {
  return unstable_cache(
    () => fetchYtDailyMetrics(siteId, days),
    [`yt-daily-${siteId}-${days}`],
    { revalidate: 300 },
  )()
}

export function getCachedYtSearchTerms(siteId: string, days: number) {
  return unstable_cache(
    () => fetchYtSearchTerms(siteId, days),
    [`yt-search-${siteId}-${days}`],
    { revalidate: 300 },
  )()
}

export function getCachedYtDemographics(siteId: string, days: number) {
  return unstable_cache(
    () => fetchYtDemographics(siteId, days),
    [`yt-demographics-${siteId}-${days}`],
    { revalidate: 300 },
  )()
}

export async function fetchVideoGrades(siteId: string): Promise<YtVideoGrade[]> {
  const supabase = getSupabaseServiceClient()

  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('id, title, thumbnail_url, published_at, views_count, channel_id')
    .eq('site_id', siteId)
    .order('published_at', { ascending: false })
    .limit(20)

  if (!videos || videos.length < 3) return []

  const avgViews =
    videos.slice(0, 10).reduce((s, v) => s + (v.views_count ?? 0), 0) /
    Math.min(videos.length, 10)

  return videos.map((v) => {
    const score = avgViews > 0 ? (v.views_count ?? 0) / avgViews : 1
    const grade: YtVideoGrade['grade'] =
      score >= 2 ? 'A' : score >= 1.2 ? 'B' : score >= 0.7 ? 'C' : 'D'
    return {
      videoId: v.id,
      title: v.title ?? '',
      thumbnailUrl: v.thumbnail_url ?? '',
      publishedAt: v.published_at ?? '',
      views7d: v.views_count ?? 0,
      ctr: 0,
      avgPercentage: 0,
      score,
      grade,
    }
  })
}

// Re-export YtHealthScore type so callers don't need to import from analytics-types directly
export type { YtHealthScore }
