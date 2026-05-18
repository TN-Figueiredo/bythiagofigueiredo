import 'server-only'

import * as Sentry from '@sentry/nextjs'
import { unstable_cache } from 'next/cache'
import {
  fetchYtChannelMetrics,
  fetchYtDailyMetrics,
  fetchYtSearchTerms,
  fetchYtDemographics,
  YouTubeAnalyticsError,
} from './analytics-client'
import type { YtVideoGrade, YtHealthScore } from './analytics-types'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function getCachedYtMetrics(siteId: string, days: number, channelId?: string) {
  try {
    return await unstable_cache(
      () => fetchYtChannelMetrics(siteId, days, channelId),
      [`yt-metrics-${siteId}-${days}-${channelId ?? 'default'}`],
      { revalidate: 300 },
    )()
  } catch (e) {
    if (e instanceof YouTubeAnalyticsError) {
      Sentry.captureException(e, { tags: { youtube_endpoint: 'metrics' } })
    }
    return null
  }
}

export async function getCachedYtDaily(siteId: string, days: number, channelId?: string) {
  try {
    return await unstable_cache(
      () => fetchYtDailyMetrics(siteId, days, channelId),
      [`yt-daily-${siteId}-${days}-${channelId ?? 'default'}`],
      { revalidate: 300 },
    )()
  } catch (e) {
    if (e instanceof YouTubeAnalyticsError) {
      Sentry.captureException(e, { tags: { youtube_endpoint: 'daily' } })
    }
    return []
  }
}

export type SearchTermsResult = { data: Awaited<ReturnType<typeof fetchYtSearchTerms>>; error?: string }
export type DemographicsResult = { data: Awaited<ReturnType<typeof fetchYtDemographics>>; error?: string }

export async function getCachedYtSearchTerms(siteId: string, days: number, channelId?: string): Promise<SearchTermsResult> {
  try {
    const data = await unstable_cache(
      () => fetchYtSearchTerms(siteId, days, channelId),
      [`yt-search-${siteId}-${days}-${channelId ?? 'default'}`],
      { revalidate: 300 },
    )()
    return { data }
  } catch (e) {
    if (e instanceof YouTubeAnalyticsError) {
      Sentry.captureException(e, { tags: { youtube_endpoint: 'search_terms' } })
      return { data: [], error: e.statusCode === 403 ? 'scope' : `api_error_${e.statusCode}` }
    }
    return { data: [], error: 'unknown' }
  }
}

export async function getCachedYtDemographics(siteId: string, days: number, channelId?: string): Promise<DemographicsResult> {
  try {
    const data = await unstable_cache(
      () => fetchYtDemographics(siteId, days, channelId),
      [`yt-demographics-${siteId}-${days}-${channelId ?? 'default'}`],
      { revalidate: 300 },
    )()
    return { data }
  } catch (e) {
    if (e instanceof YouTubeAnalyticsError) {
      Sentry.captureException(e, { tags: { youtube_endpoint: 'demographics' } })
      return { data: { ageGender: [], countries: [], devices: [] }, error: e.statusCode === 403 ? 'scope' : `api_error_${e.statusCode}` }
    }
    return { data: { ageGender: [], countries: [], devices: [] }, error: 'unknown' }
  }
}

export async function fetchVideoGrades(siteId: string, internalChannelId?: string): Promise<YtVideoGrade[]> {
  const supabase = getSupabaseServiceClient()

  let query = supabase
    .from('youtube_videos')
    .select('id, title, thumbnail_url, published_at, view_count, channel_id')
    .eq('site_id', siteId)
  if (internalChannelId) query = query.eq('channel_id', internalChannelId)
  const { data: videos } = await query
    .order('published_at', { ascending: false })
    .limit(20)

  if (!videos || videos.length < 3) return []

  const avgViews =
    videos.slice(0, 10).reduce((s, v) => s + (v.view_count ?? 0), 0) /
    Math.min(videos.length, 10)

  return videos.map((v) => {
    const score = avgViews > 0 ? (v.view_count ?? 0) / avgViews : 1
    const grade: YtVideoGrade['grade'] =
      score >= 2 ? 'A' : score >= 1.2 ? 'B' : score >= 0.7 ? 'C' : 'D'
    return {
      videoId: v.id,
      title: v.title ?? '',
      thumbnailUrl: v.thumbnail_url ?? '',
      publishedAt: v.published_at ?? '',
      views7d: v.view_count ?? 0,
      ctr: 0,
      avgPercentage: 0,
      score,
      grade,
    }
  })
}

// Re-export YtHealthScore type so callers don't need to import from analytics-types directly
export type { YtHealthScore }
