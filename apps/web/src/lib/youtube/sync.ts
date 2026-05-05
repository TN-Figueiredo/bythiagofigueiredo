import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchRecentVideoIds, fetchVideoDetails, fetchChannelStats, YouTubeQuotaError } from './api-client'
import { autoCategorize } from './auto-categorize'
import type { YouTubeChannelRow, YouTubeCategoryRow, SyncMode } from './types'

interface SyncResult {
  videosFound: number
  videosInserted: number
  videosUpdated: number
  quotaUsed: number
}

export async function syncChannel(
  supabase: SupabaseClient,
  channel: YouTubeChannelRow,
  apiKey: string,
  mode: SyncMode,
): Promise<SyncResult> {
  const result: SyncResult = { videosFound: 0, videosInserted: 0, videosUpdated: 0, quotaUsed: 0 }

  if (mode === 'metrics') {
    return refreshMetrics(supabase, channel, apiKey, result)
  }

  const videoIds = await fetchRecentVideoIds(channel.uploads_playlist_id, apiKey)
  result.quotaUsed += 1

  const { data: existing } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('channel_id', channel.id)
    .in('youtube_video_id', videoIds)

  const existingIds = new Set((existing ?? []).map((r: { youtube_video_id: string }) => r.youtube_video_id))
  const newIds = videoIds.filter((id) => !existingIds.has(id))
  result.videosFound = videoIds.length

  if (newIds.length === 0) return result

  const details = await fetchVideoDetails(newIds, apiKey)
  result.quotaUsed += 1

  const { data: categories } = await supabase
    .from('youtube_categories')
    .select('*')
    .eq('site_id', channel.site_id)
    .order('sort_order')

  for (const video of details) {
    const cat = autoCategorize(
      { title: video.title, tags: video.tags, description: video.description },
      (categories ?? []) as YouTubeCategoryRow[],
    )

    const row = {
      site_id: channel.site_id,
      channel_id: channel.id,
      youtube_video_id: video.youtubeVideoId,
      title: video.title,
      description: video.description,
      duration: video.duration,
      duration_seconds: video.durationSeconds,
      published_at: video.publishedAt,
      thumbnail_url: video.thumbnailUrl,
      thumbnail_hq_url: video.thumbnailHqUrl,
      tags: video.tags,
      view_count: video.viewCount,
      like_count: video.likeCount,
      comment_count: video.commentCount,
      auto_suggested_category_id: cat?.categoryId ?? null,
      category_id: cat?.autoApprove ? cat.categoryId : null,
    }

    const { error } = await supabase.from('youtube_videos').upsert(row, {
      onConflict: 'site_id,youtube_video_id',
    })

    if (!error) result.videosInserted += 1
  }

  const stats = await fetchChannelStats(channel.channel_id, apiKey)
  result.quotaUsed += 1

  await supabase.from('youtube_channels').update({
    subscriber_count: stats.subscriberCount,
    video_count: stats.videoCount,
    last_synced_at: new Date().toISOString(),
  }).eq('id', channel.id)

  return result
}

async function refreshMetrics(
  supabase: SupabaseClient,
  channel: YouTubeChannelRow,
  apiKey: string,
  result: SyncResult,
): Promise<SyncResult> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('channel_id', channel.id)
    .gte('published_at', thirtyDaysAgo)

  if (!recent || recent.length === 0) return result

  const ids = recent.map((r: { youtube_video_id: string }) => r.youtube_video_id)
  const batchSize = 50
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const details = await fetchVideoDetails(batch, apiKey)
    result.quotaUsed += 1

    for (const video of details) {
      await supabase.from('youtube_videos').update({
        view_count: video.viewCount,
        like_count: video.likeCount,
        comment_count: video.commentCount,
      }).eq('site_id', channel.site_id).eq('youtube_video_id', video.youtubeVideoId)
      result.videosUpdated += 1
    }
  }

  return result
}

export { YouTubeQuotaError }
