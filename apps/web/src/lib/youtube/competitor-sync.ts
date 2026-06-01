import { getSupabaseServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

interface SyncResult {
  videosChecked: number
  changesDetected: number
}

export async function syncCompetitorChannel(
  channelRow: { id: string; channel_id: string; site_id: string },
  apiKey: string,
): Promise<SyncResult> {
  const supabase = getSupabaseServiceClient()
  let videosChecked = 0
  let changesDetected = 0

  // 1. Get uploads playlist ID
  const channelRes = await fetch(
    `${YOUTUBE_API_BASE}/channels?part=contentDetails,snippet,statistics&id=${channelRow.channel_id}&key=${apiKey}`,
    { signal: AbortSignal.timeout(10_000) },
  )
  if (!channelRes.ok) throw new Error(`YouTube API ${channelRes.status} for channel ${channelRow.channel_id}`)

  const channelData = await channelRes.json()
  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsPlaylistId) return { videosChecked: 0, changesDetected: 0 }

  // Update channel metadata
  const snippet = channelData.items[0].snippet
  const stats = channelData.items[0].statistics
  await supabase
    .from('competitor_channels')
    .update({
      channel_name: snippet?.title ?? '',
      thumbnail_url: snippet?.thumbnails?.default?.url ?? null,
      subscriber_count: parseInt(stats?.subscriberCount ?? '0', 10),
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', channelRow.id)

  // 2. Get latest 10 videos
  const playlistRes = await fetch(
    `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10&key=${apiKey}`,
    { signal: AbortSignal.timeout(10_000) },
  )
  if (!playlistRes.ok) throw new Error(`YouTube API ${playlistRes.status} for playlist ${uploadsPlaylistId}`)

  const playlistData = await playlistRes.json()
  const videoIds = (playlistData.items ?? [])
    .map((item: Record<string, unknown>) => {
      const snip = item.snippet as Record<string, unknown> | undefined
      const resId = snip?.resourceId as Record<string, unknown> | undefined
      return resId?.videoId
    })
    .filter(Boolean)

  if (!videoIds.length) return { videosChecked: 0, changesDetected: 0 }

  // 3. Get video details (statistics + snippet)
  const videosRes = await fetch(
    `${YOUTUBE_API_BASE}/videos?part=snippet,statistics&id=${videoIds.join(',')}&key=${apiKey}`,
    { signal: AbortSignal.timeout(10_000) },
  )
  if (!videosRes.ok) throw new Error(`YouTube API ${videosRes.status} for video details`)

  const videosData = await videosRes.json()

  for (const video of videosData.items ?? []) {
    videosChecked++
    const videoId = video.id
    const title = video.snippet?.title ?? null
    const description = video.snippet?.description ?? ''
    const descriptionHash = crypto.createHash('sha256').update(description).digest('hex').slice(0, 16)
    const thumbnailUrl = video.snippet?.thumbnails?.maxres?.url ?? video.snippet?.thumbnails?.high?.url ?? null
    const viewCount = parseInt(video.statistics?.viewCount ?? '0', 10)
    const publishedAt = video.snippet?.publishedAt ?? null

    // Check existing record
    const { data: existing } = await supabase
      .from('competitor_videos')
      .select('id, title, description_hash, thumbnail_url, view_count')
      .eq('video_id', videoId)
      .maybeSingle()

    if (!existing) {
      // New video — insert
      await supabase.from('competitor_videos').insert({
        competitor_channel_id: channelRow.id,
        video_id: videoId,
        title,
        description_hash: descriptionHash,
        thumbnail_url: thumbnailUrl,
        view_count: viewCount,
        published_at: publishedAt,
      })
      continue
    }

    // Detect changes
    if (existing.title && title && existing.title !== title) {
      await supabase.from('competitor_changes').insert({
        video_id: existing.id,
        site_id: channelRow.site_id,
        change_type: 'title',
        old_title: existing.title,
        new_title: title,
        view_count_at_change: viewCount,
      })
      changesDetected++
    }

    if (existing.description_hash && descriptionHash !== existing.description_hash) {
      await supabase.from('competitor_changes').insert({
        video_id: existing.id,
        site_id: channelRow.site_id,
        change_type: 'description',
        view_count_at_change: viewCount,
      })
      changesDetected++
    }

    if (existing.thumbnail_url && thumbnailUrl && existing.thumbnail_url !== thumbnailUrl) {
      await supabase.from('competitor_changes').insert({
        video_id: existing.id,
        site_id: channelRow.site_id,
        change_type: 'thumbnail',
        old_thumbnail_url: existing.thumbnail_url,
        new_thumbnail_url: thumbnailUrl,
        view_count_at_change: viewCount,
      })
      changesDetected++
    }

    // Update record
    await supabase
      .from('competitor_videos')
      .update({
        title,
        description_hash: descriptionHash,
        thumbnail_url: thumbnailUrl,
        view_count: viewCount,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  }

  return { videosChecked, changesDetected }
}
