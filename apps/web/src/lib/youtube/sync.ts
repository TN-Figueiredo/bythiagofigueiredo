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
  result.quotaUsed += Math.ceil(videoIds.length / 50) || 1
  result.videosFound = videoIds.length

  if (videoIds.length === 0) {
    await updateChannelMeta(supabase, channel, apiKey, result)
    return result
  }

  const { data: existing, error: existingErr } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('channel_id', channel.id)
    .in('youtube_video_id', videoIds)

  if (existingErr) throw new Error(`Failed to query existing videos: ${existingErr.message}`)

  const existingIds = new Set((existing ?? []).map((r: { youtube_video_id: string }) => r.youtube_video_id))
  const newIds = videoIds.filter((id) => !existingIds.has(id))

  if (newIds.length === 0) {
    await updateChannelMeta(supabase, channel, apiKey, result)
    return result
  }

  const details = await fetchVideoDetails(newIds, apiKey)
  result.quotaUsed += Math.ceil(newIds.length / 50) || 1

  const { data: categories, error: catErr } = await supabase
    .from('youtube_categories')
    .select('*')
    .eq('site_id', channel.site_id)
    .order('sort_order')

  if (catErr) throw new Error(`Failed to query categories: ${catErr.message}`)

  const rows = details.map((video) => {
    const cat = autoCategorize(
      { title: video.title, tags: video.tags, description: video.description },
      (categories ?? []) as YouTubeCategoryRow[],
    )

    return {
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
  })

  if (rows.length > 0) {
    const { error } = await supabase.from('youtube_videos').upsert(rows, {
      onConflict: 'site_id,youtube_video_id',
    })
    if (error) throw new Error(`Video upsert failed: ${error.message}`)
    result.videosInserted = newIds.length
  }

  await updateChannelMeta(supabase, channel, apiKey, result)
  return result
}

async function updateChannelMeta(
  supabase: SupabaseClient,
  channel: YouTubeChannelRow,
  apiKey: string,
  result: SyncResult,
): Promise<void> {
  const stats = await fetchChannelStats(channel.channel_id, apiKey)
  result.quotaUsed += 1

  const { error: updateErr } = await supabase.from('youtube_channels').update({
    subscriber_count: stats.subscriberCount,
    video_count: stats.videoCount,
    last_synced_at: new Date().toISOString(),
  }).eq('id', channel.id)

  if (updateErr) throw new Error(`Failed to update channel metadata: ${updateErr.message}`)
}

async function refreshMetrics(
  supabase: SupabaseClient,
  channel: YouTubeChannelRow,
  apiKey: string,
  result: SyncResult,
): Promise<SyncResult> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent, error: recentErr } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('channel_id', channel.id)
    .gte('published_at', thirtyDaysAgo)

  if (recentErr) throw new Error(`Failed to query recent videos: ${recentErr.message}`)
  if (!recent || recent.length === 0) return result

  const ids = recent.map((r: { youtube_video_id: string }) => r.youtube_video_id)
  const batchSize = 50
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const details = await fetchVideoDetails(batch, apiKey)
    result.quotaUsed += 1

    const updateRows = details.map((video) => ({
      site_id: channel.site_id,
      channel_id: channel.id,
      youtube_video_id: video.youtubeVideoId,
      view_count: video.viewCount,
      like_count: video.likeCount,
      comment_count: video.commentCount,
    }))
    const { error: updateErr } = await supabase.from('youtube_videos').upsert(updateRows, {
      onConflict: 'site_id,youtube_video_id',
    })
    if (updateErr) throw new Error(`Failed to update video metrics: ${updateErr.message}`)
    result.videosUpdated += details.length
  }

  return result
}

export { YouTubeQuotaError }
