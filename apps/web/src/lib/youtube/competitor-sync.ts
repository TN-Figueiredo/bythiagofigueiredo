import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createNotification } from '@/lib/notifications/create'
import crypto from 'crypto'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const MAX_FULL_SYNC_VIDEOS = 2000
const MAX_INCREMENTAL_PAGES = 5
const CHANGE_DETECTION_WINDOW_DAYS = 90
const PAGE_DELAY_MS = 300

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
  skipped?: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function syncCompetitorChannel(
  channelRow: { id: string; channel_id: string; site_id: string },
  apiKey: string,
): Promise<SyncResult> {
  const supabase = getSupabaseServiceClient()

  // ── CAS Lock: acquire or skip ──
  const { data: locked } = await supabase
    .from('competitor_channels')
    .update({
      sync_status: 'syncing',
      sync_started_at: new Date().toISOString(),
      sync_progress: 0,
      sync_error: null,
    })
    .eq('id', channelRow.id)
    .or(`sync_status.neq.syncing,sync_started_at.lt.${new Date(Date.now() - 10 * 60_000).toISOString()}`)
    .select('id, sync_mode, full_sync_completed_at')

  if (!locked || locked.length === 0) {
    return { videosChecked: 0, changesDetected: 0, skipped: true }
  }

  const syncMode = (locked[0] as { sync_mode: string }).sync_mode
  const fullSyncDone = (locked[0] as { full_sync_completed_at: string | null }).full_sync_completed_at

  let videosChecked = 0
  let changesDetected = 0

  try {
    // ── 1. Channel metadata ──
    const channelRes = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=contentDetails,snippet,statistics&id=${channelRow.channel_id}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!channelRes.ok) throw new Error(`YouTube API ${channelRes.status} for channel ${channelRow.channel_id}`)

    const channelData = await channelRes.json()
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylistId) {
      await supabase.from('competitor_channels').update({ sync_status: 'idle' }).eq('id', channelRow.id)
      return { videosChecked: 0, changesDetected: 0 }
    }

    const snippet = channelData.items[0].snippet
    const stats = channelData.items[0].statistics
    const youtubeVideoCount = parseInt(stats?.videoCount ?? '0', 10)

    await supabase
      .from('competitor_channels')
      .update({
        channel_name: snippet?.title ?? '',
        thumbnail_url: snippet?.thumbnails?.default?.url ?? null,
        subscriber_count: parseInt(stats?.subscriberCount ?? '0', 10),
        youtube_video_count: youtubeVideoCount,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', channelRow.id)

    // Daily snapshot (non-blocking)
    try {
      await supabase
        .from('competitor_channel_snapshots')
        .upsert({
          competitor_channel_id: channelRow.id,
          subscriber_count: parseInt(stats?.subscriberCount ?? '0', 10),
          video_count: youtubeVideoCount,
          view_count: parseInt(stats?.viewCount ?? '0', 10),
          snapshot_date: new Date().toISOString().slice(0, 10),
        }, { onConflict: 'competitor_channel_id,snapshot_date' })
    } catch {
      // Non-fatal
    }

    // ── 2. Decide sync strategy ──
    const isFullSync = syncMode === 'full' && !fullSyncDone
    const changeDetectionCutoff = new Date(Date.now() - CHANGE_DETECTION_WINDOW_DAYS * 86_400_000).toISOString()

    let nextPageToken: string | undefined
    let pageCount = 0

    do {
      // Fetch playlist page
      let playlistUrl = `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`
      if (nextPageToken) playlistUrl += `&pageToken=${nextPageToken}`

      const playlistRes = await fetch(playlistUrl, { signal: AbortSignal.timeout(10_000) })
      if (!playlistRes.ok) throw new Error(`YouTube API ${playlistRes.status} for playlist ${uploadsPlaylistId}`)

      const playlistData = await playlistRes.json()
      const videoIds = (playlistData.items ?? [])
        .map((item: Record<string, unknown>) => {
          const snip = item.snippet as Record<string, unknown> | undefined
          const resId = snip?.resourceId as Record<string, unknown> | undefined
          return resId?.videoId
        })
        .filter(Boolean) as string[]

      if (!videoIds.length) break

      // Fetch video details
      const videosRes = await fetch(
        `${YOUTUBE_API_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`,
        { signal: AbortSignal.timeout(10_000) },
      )
      if (!videosRes.ok) throw new Error(`YouTube API ${videosRes.status} for video details`)

      const videosData = await videosRes.json()

      // Batch lookup existing videos
      const { data: existingVideos } = await supabase
        .from('competitor_videos')
        .select('id, video_id, title, description_hash, thumbnail_url, view_count')
        .eq('competitor_channel_id', channelRow.id)
        .in('video_id', videoIds)
      const existingMap = new Map((existingVideos ?? []).map(v => [v.video_id, v]))

      // Smart incremental: stop if we hit a known video
      let hitKnownVideo = false

      for (const video of videosData.items ?? []) {
        videosChecked++
        const videoId = video.id as string
        const title = (video.snippet?.title as string) ?? null
        const description = (video.snippet?.description as string) ?? ''
        const descriptionHash = crypto.createHash('sha256').update(description).digest('hex').slice(0, 16)
        const thumbnailUrl = (video.snippet?.thumbnails?.maxres?.url ?? video.snippet?.thumbnails?.high?.url ?? null) as string | null
        const viewCount = parseInt(video.statistics?.viewCount ?? '0', 10)
        const publishedAt = (video.snippet?.publishedAt as string) ?? null
        const likeCount = parseInt(video.statistics?.likeCount ?? '0', 10)
        const commentCount = parseInt(video.statistics?.commentCount ?? '0', 10)
        const tags: string[] = (video.snippet?.tags as string[]) ?? []
        const categoryId: string | null = (video.snippet?.categoryId as string) ?? null

        let durationSeconds: number | null = null
        const durationStr = video.contentDetails?.duration as string | undefined
        if (durationStr) {
          const match = durationStr.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
          if (match && (match[1] || match[2] || match[3] || match[4])) {
            durationSeconds = (parseInt(match[1] ?? '0', 10) * 86400) +
                              (parseInt(match[2] ?? '0', 10) * 3600) +
                              (parseInt(match[3] ?? '0', 10) * 60) +
                              parseInt(match[4] ?? '0', 10)
          }
        }
        const isShort = (durationSeconds !== null && durationSeconds <= 60) ||
                        (title?.includes('#Shorts') ?? false)

        const existing = existingMap.get(videoId) ?? null

        if (!existing) {
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

        // Mark as known for smart incremental
        hitKnownVideo = true

        // Change detection — skip for old videos
        const shouldDetectChanges = publishedAt ? publishedAt > changeDetectionCutoff : true

        if (shouldDetectChanges) {
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
        }

        // Update stats
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

      // Update progress
      await supabase
        .from('competitor_channels')
        .update({ sync_progress: videosChecked })
        .eq('id', channelRow.id)

      nextPageToken = playlistData.nextPageToken as string | undefined
      pageCount++

      // Decide whether to continue
      if (isFullSync) {
        if (videosChecked >= MAX_FULL_SYNC_VIDEOS) break
        if (nextPageToken) await sleep(PAGE_DELAY_MS)
      } else {
        // Smart incremental: stop when we hit a known video or reach page cap
        if (hitKnownVideo || pageCount >= MAX_INCREMENTAL_PAGES) break
      }
    } while (nextPageToken)

    // Mark completion
    const updatePayload: Record<string, unknown> = {
      sync_status: 'idle',
      sync_error: null,
    }
    if (isFullSync) {
      updatePayload.full_sync_completed_at = new Date().toISOString()
    }
    await supabase.from('competitor_channels').update(updatePayload).eq('id', channelRow.id)

    // Notifications (unchanged from original)
    if (changesDetected > 0 && process.env.COMPETITOR_NOTIFICATIONS_ENABLED !== 'false') {
      try {
        const { data: owner } = await supabase
          .from('site_users')
          .select('user_id')
          .eq('site_id', channelRow.site_id)
          .eq('role', 'super_admin')
          .limit(1)
          .single()

        if (owner) {
          await createNotification({
            site_id: channelRow.site_id,
            user_id: owner.user_id,
            type: 'youtube.competitor_change',
            domain: 'youtube',
            priority: 2,
            title: `${changesDetected} mudança(s) em ${snippet?.title ?? channelRow.channel_id}`,
            message: `Detectamos mudanças em vídeos de ${snippet?.title ?? 'competidor'}. Confira no Observatório.`,
            action_href: '/cms/youtube/competitors?tab=mudancas',
            dedup_key: `competitor-change-${channelRow.id}-${new Date().toISOString().slice(0, 10)}`,
          })
        }
      } catch {
        // Non-fatal
      }
    }

    return { videosChecked, changesDetected }
  } catch (error) {
    // Set error status, preserve partial data
    await supabase
      .from('competitor_channels')
      .update({
        sync_status: 'error',
        sync_error: error instanceof Error ? error.message : 'Unknown sync error',
      })
      .eq('id', channelRow.id)
    throw error
  }
}
