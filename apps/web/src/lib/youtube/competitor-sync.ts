import { getSupabaseServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

/** Normalize URL for comparison: strip query params + trailing slash */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.search = ''
    return u.toString().replace(/\/$/, '')
  } catch {
    return url
  }
}

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

  // Insert daily channel snapshot for growth tracking
  await supabase
    .from('competitor_channel_snapshots')
    .upsert({
      competitor_channel_id: channelRow.id,
      subscriber_count: parseInt(stats?.subscriberCount ?? '0', 10),
      video_count: parseInt(stats?.videoCount ?? '0', 10),
      view_count: parseInt(stats?.viewCount ?? '0', 10),
      snapshot_date: new Date().toISOString().slice(0, 10),
    }, { onConflict: 'competitor_channel_id,snapshot_date' })

  // 2. Get latest 50 videos
  const playlistRes = await fetch(
    `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`,
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
    `${YOUTUBE_API_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`,
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
    const likeCount = parseInt(video.statistics?.likeCount ?? '0', 10)
    const commentCount = parseInt(video.statistics?.commentCount ?? '0', 10)
    const tags: string[] = video.snippet?.tags ?? []
    const categoryId: string | null = video.snippet?.categoryId ?? null

    // Parse ISO 8601 duration (PT1H2M3S → seconds)
    let durationSeconds: number | null = null
    const durationStr = video.contentDetails?.duration as string | undefined
    if (durationStr) {
      const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
      if (match) {
        durationSeconds = (parseInt(match[1] ?? '0', 10) * 3600) +
                          (parseInt(match[2] ?? '0', 10) * 60) +
                          parseInt(match[3] ?? '0', 10)
      }
    }
    const isShort = (durationSeconds !== null && durationSeconds <= 60) ||
                    (title?.includes('#Shorts') ?? false)

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
        like_count: likeCount,
        comment_count: commentCount,
        duration_seconds: durationSeconds,
        is_short: isShort,
        tags,
        category_id: categoryId,
        original_thumbnail_url: thumbnailUrl,
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

    if (existing.thumbnail_url && thumbnailUrl && normalizeUrl(existing.thumbnail_url) !== normalizeUrl(thumbnailUrl)) {
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
        like_count: likeCount,
        comment_count: commentCount,
        duration_seconds: durationSeconds,
        is_short: isShort,
        tags,
        category_id: categoryId,
      })
      .eq('id', existing.id)
  }

  return { videosChecked, changesDetected }
}
