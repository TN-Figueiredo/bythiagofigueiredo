import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createNotification } from '@/lib/notifications/create'
import crypto from 'crypto'
import { probeThumb, isNewThumb, archiveThumb, type ThumbProbe } from '@/lib/youtube/thumb-fingerprint'
import {
  reconcileVideoVersions, normalizeDescription, type StoredVersion, type VersionPlan, type VersionField,
} from '@/lib/youtube/competitor-versions'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const MAX_FULL_SYNC_VIDEOS = 2000
const MAX_INCREMENTAL_PAGES = 5
const CHANGE_DETECTION_WINDOW_DAYS = 90
const PAGE_DELAY_MS = 300

/** provisional until spike S1 (Last-Modified granularity) */
const LAST_MODIFIED_MINUTE = true

export interface SyncResult {
  videosChecked: number
  changesDetected: number
  dailyRecorded: number
  unitsUsed: number
  skipped?: boolean
}

const SP_OFFSET_MS = 3 * 3_600_000 // America/Sao_Paulo is UTC−3 with no DST since 2019
export function spDate(ms: number): string { return new Date(ms - SP_OFFSET_MS).toISOString().slice(0, 10) }
export function isDailyRecordDue(nowIso: string, lastRecordDate: string | null): { due: boolean; snapDate: string } {
  const now = Date.parse(nowIso), snapDate = spDate(now)
  const spHour = new Date(now - SP_OFFSET_MS).getUTCHours()
  return { due: spHour >= 12 && lastRecordDate !== snapDate, snapDate }
}

export type ThumbAction = 'skip' | 'heal' | 'etag' | 'reconcile'
/**
 * R10: how persistence treats a thumbnail probe against the current thumb version.
 * - skip: probe failed, nothing to say.
 * - heal: the current version never had a dHash and the probe brought one → fill it in, no change.
 * - etag: the ETag moved but the image is within DHASH_MAX_SAME → store only the ETag (avoids re-downloading
 *   every sync, never moves the dHash so slow drift cannot accumulate).
 * - reconcile: hand it to reconcileVideoVersions.
 */
export function classifyThumb(prev: StoredVersion | null, probe: ThumbProbe): ThumbAction {
  if (!probe.etag && !probe.dhash) return 'skip'
  if (prev) {
    if (!prev.thumb_dhash && probe.dhash && probe.bytes) return 'heal'
    if (prev.thumb_dhash && probe.dhash && probe.etag && probe.etag !== prev.thumb_etag
      && !isNewThumb({ etag: prev.thumb_etag, dhash: prev.thumb_dhash }, probe)) return 'etag'
  }
  return 'reconcile'
}

const CHANGE_TYPE: Record<VersionField, 'title' | 'description' | 'thumbnail'> = { title: 'title', desc: 'description', thumb: 'thumbnail' }

/** R10(c): drop the plan parts of fields whose API value was missing/failed. */
export function dropFields(plan: VersionPlan, current: StoredVersion[], skip: VersionField[]): VersionPlan {
  if (!skip.length) return plan
  const skipIds = new Set(current.filter(v => skip.includes(v.field)).map(v => v.id))
  return {
    touch: plan.touch.filter(id => !skipIds.has(id)),
    close: plan.close.filter(id => !skipIds.has(id)),
    open: plan.open.filter(o => !skip.includes(o.field)),
    changes: plan.changes.filter(c => !skip.includes(c.field)),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function syncCompetitorChannel(
  channelRow: { id: string; channel_id: string; site_id: string },
  apiKey: string,
  opts: { now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<SyncResult> {
  const supabase = getSupabaseServiceClient()
  const now = opts.now ?? new Date()
  const nowIso = now.toISOString()
  const nowMs = now.getTime()
  const f: typeof fetch = opts.fetchImpl ?? fetch
  let unitsUsed = 0
  const api = (url: string): Promise<Response> => { unitsUsed++; return f(url, { signal: AbortSignal.timeout(10_000) }) }

  // ── CAS Lock: acquire or skip ──
  const { data: locked } = await supabase
    .from('competitor_channels')
    .update({
      sync_status: 'syncing',
      sync_started_at: nowIso,
      sync_progress: 0,
      sync_error: null,
      last_synced_at: nowIso, // the cursor: start of this attempt
    })
    .eq('id', channelRow.id)
    .or(`sync_status.neq.syncing,sync_started_at.lt.${new Date(nowMs - 10 * 60_000).toISOString()}`)
    .select('id, sync_mode, full_sync_completed_at, video_limit, last_ok_synced_at, sync_error_since')

  if (!locked || locked.length === 0) {
    return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 0, skipped: true }
  }
  const prevOkAt = (locked[0] as { last_ok_synced_at?: string | null }).last_ok_synced_at ?? null
  const prevErrorSince = (locked[0] as { sync_error_since?: string | null }).sync_error_since ?? null

  const syncMode = (locked[0] as { sync_mode: string }).sync_mode
  const fullSyncDone = (locked[0] as { full_sync_completed_at: string | null }).full_sync_completed_at
  const videoLimit = (locked[0] as { video_limit: number | null }).video_limit ?? 50
  const maxIncrementalPages = Math.max(1, Math.ceil(videoLimit / 50))

  const { count: syncedCount } = await supabase
    .from('competitor_videos')
    .select('id', { count: 'exact', head: true })
    .eq('competitor_channel_id', channelRow.id)
  const needsBackfill = (syncedCount ?? 0) < videoLimit

  let videosChecked = 0
  let changesDetected = 0
  let dailyRecorded = 0

  try {
    // Daily record due? (12:00 São Paulo, once per SP date)
    const { data: lastDaily } = await supabase
      .from('competitor_video_daily')
      .select('snap_date, competitor_videos!inner(competitor_channel_id)')
      .eq('competitor_videos.competitor_channel_id', channelRow.id)
      .order('snap_date', { ascending: false })
      .limit(1)
    const lastRecordDate = ((lastDaily as Array<{ snap_date: string }> | null)?.[0]?.snap_date) ?? null
    const { due: dailyDue, snapDate } = isDailyRecordDue(nowIso, lastRecordDate)

    // ── 1. Channel metadata ──
    const channelRes = await api(
      `${YOUTUBE_API_BASE}/channels?part=contentDetails,snippet,statistics&id=${channelRow.channel_id}&key=${apiKey}`,
    )
    if (!channelRes.ok) throw new Error(`YouTube API ${channelRes.status} for channel ${channelRow.channel_id}`)

    const channelData = await channelRes.json()
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylistId) {
      await supabase.from('competitor_channels').update({ sync_status: 'idle' }).eq('id', channelRow.id)
      return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed }
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
          snapshot_date: snapDate,
        }, { onConflict: 'competitor_channel_id,snapshot_date' })
    } catch {
      // Non-fatal
    }

    // ── 2. Decide sync strategy ──
    const isFullSync = syncMode === 'full' && !fullSyncDone
    const changeDetectionCutoff = new Date(nowMs - CHANGE_DETECTION_WINDOW_DAYS * 86_400_000).toISOString()

    let nextPageToken: string | undefined
    let pageCount = 0

    do {
      // Fetch playlist page
      let playlistUrl = `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`
      if (nextPageToken) playlistUrl += `&pageToken=${nextPageToken}`

      const playlistRes = await api(playlistUrl)
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
      const videosRes = await api(
        `${YOUTUBE_API_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`,
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

      // Current versions of every known video in this page, one query
      const currentByVideo = new Map<string, StoredVersion[]>()
      const knownUuids = (existingVideos ?? []).map(v => v.id as string)
      if (knownUuids.length) {
        const { data: versionRows } = await supabase
          .from('competitor_video_versions')
          .select('id, video_id, field, value_text, value_hash, thumb_etag, thumb_dhash, first_seen_at, last_seen_at')
          .in('video_id', knownUuids)
          .eq('is_current', true)
        for (const r of (versionRows ?? []) as Array<StoredVersion & { video_id: string }>) {
          const list = currentByVideo.get(r.video_id) ?? []
          list.push(r)
          currentByVideo.set(r.video_id, list)
        }
      }
      const touchIds: string[] = []

      // Smart incremental: stop if we hit a known video
      let hitKnownVideo = false

      for (const video of videosData.items ?? []) {
        videosChecked++
        const videoId = video.id as string
        const apiTitle = (video.snippet?.title as string | undefined) ?? ''
        const title = apiTitle || null
        const apiDescription = video.snippet?.description as string | undefined
        const description = apiDescription ?? ''
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
        let videoUuid: string | null = existing ? (existing.id as string) : null

        if (!existing) {
          const { data: inserted } = await supabase.from('competitor_videos').insert({
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
          }).select('id').single()
          videoUuid = (inserted as { id: string } | null)?.id ?? null
        } else {
          // Mark as known for smart incremental
          hitKnownVideo = true
        }

        // Versions: <90-day videos every sync, older ones only when the daily record is due
        const shouldReconcile = dailyDue || (publishedAt ? publishedAt > changeDetectionCutoff : true)
        if (videoUuid && shouldReconcile) {
          const current = currentByVideo.get(videoUuid) ?? []
          const prevThumb = current.find(v => v.field === 'thumb') ?? null
          let probe: ThumbProbe | null = null
          try {
            probe = await probeThumb(videoId, prevThumb ? { etag: prevThumb.thumb_etag, dhash: prevThumb.thumb_dhash } : null, f)
          } catch {
            probe = null // network failure: skip the thumbnail this round
          }
          const action: ThumbAction = probe ? classifyThumb(prevThumb, probe) : 'skip'

          if (probe && prevThumb && action === 'heal') {
            const blobUrl = await archiveThumb(videoUuid, probe).catch(() => null)
            await supabase.from('competitor_video_versions').update({
              thumb_dhash: probe.dhash, thumb_etag: probe.etag, last_seen_at: nowIso,
              ...(blobUrl ? { thumb_blob_url: blobUrl } : {}),
            }).eq('id', prevThumb.id)
          } else if (probe && prevThumb && action === 'etag') {
            await supabase.from('competitor_video_versions').update({
              thumb_etag: probe.etag, last_seen_at: nowIso,
            }).eq('id', prevThumb.id)
          }

          const skip: VersionField[] = []
          if (!apiTitle) skip.push('title')
          if (apiDescription === undefined) skip.push('desc')
          if (action !== 'reconcile') skip.push('thumb')

          const rawPlan = reconcileVideoVersions(
            current,
            { title: apiTitle, description: apiDescription === undefined ? '' : normalizeDescription(apiDescription), thumb: action === 'reconcile' ? probe : null },
            { prevOkAt, now: nowIso },
            { lastModifiedMinute: LAST_MODIFIED_MINUTE },
          )
          const plan = dropFields(rawPlan, current, skip)

          touchIds.push(...plan.touch)
          if (plan.close.length) {
            await supabase.from('competitor_video_versions').update({ is_current: false }).in('id', plan.close)
          }
          const newIds = new Map<VersionField, string>()
          if (plan.open.length) {
            const rows = []
            for (const o of plan.open) {
              const blobUrl = o.field === 'thumb' && o.thumb ? await archiveThumb(videoUuid, o.thumb).catch(() => null) : null
              const lm = o.thumb?.lastModified ? Date.parse(o.thumb.lastModified) : NaN
              rows.push({
                video_id: videoUuid,
                field: o.field,
                value_text: o.value_text,
                value_hash: o.value_hash,
                has_text: o.has_text,
                thumb_etag: o.thumb?.etag ?? null,
                thumb_dhash: o.thumb?.dhash ?? null,
                thumb_blob_url: blobUrl,
                thumb_last_modified: Number.isFinite(lm) ? new Date(lm).toISOString() : null,
                first_seen_at: o.first_seen_at,
                last_seen_at: nowIso,
                window_start: o.window_start,
                precision: o.precision,
                is_current: true,
              })
            }
            const { data: opened } = await supabase.from('competitor_video_versions').insert(rows).select('id, field')
            for (const r of (opened ?? []) as Array<{ id: string; field: VersionField }>) newIds.set(r.field, r.id)
          }
          for (const c of plan.changes) {
            const fromV = current.find(v => v.id === c.fromId) as (StoredVersion & { value_text?: string | null }) | undefined
            const opened = plan.open.find(o => o.field === c.field)
            await supabase.from('competitor_changes').insert({
              video_id: videoUuid,
              site_id: channelRow.site_id,
              change_type: CHANGE_TYPE[c.field],
              ...(c.field === 'title' ? { old_title: fromV?.value_text ?? existing?.title ?? null, new_title: opened?.value_text ?? title } : {}),
              ...(c.field === 'thumb' ? { old_thumbnail_url: existing?.thumbnail_url ?? null, new_thumbnail_url: thumbnailUrl } : {}),
              view_count_at_change: viewCount,
              from_version_id: c.fromId,
              to_version_id: newIds.get(c.field) ?? null,
              window_start: c.window_start,
              window_end: c.window_end,
              precision: c.precision,
              detected_at: nowIso,
            })
            changesDetected++
          }
        }

        if (!existing) continue

        // Update stats
        await supabase
          .from('competitor_videos')
          .update({
            ...(title ? { title } : {}),
            ...(apiDescription !== undefined ? { description_hash: descriptionHash } : {}),
            thumbnail_url: thumbnailUrl,
            view_count: viewCount,
            last_checked_at: nowIso,
            like_count: likeCount,
            comment_count: commentCount,
            duration_seconds: durationSeconds,
            is_short: isShort,
            tags,
            category_id: categoryId,
          })
          .eq('id', existing.id)
      }

      if (touchIds.length) {
        await supabase.from('competitor_video_versions').update({ last_seen_at: nowIso }).in('id', touchIds)
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
        // Smart incremental: stop when we hit a known video or reach per-channel page cap
        if ((!needsBackfill && hitKnownVideo) || pageCount >= maxIncrementalPages) break
      }
    } while (nextPageToken)

    // ── Daily views record (12:00 SP): every tracked video, pages of 50 ──
    if (dailyDue) {
      const { data: tracked } = await supabase
        .from('competitor_videos')
        .select('id, video_id')
        .eq('competitor_channel_id', channelRow.id)
        .order('published_at', { ascending: false })
        .limit(videoLimit)
      const trackedRows = (tracked ?? []) as Array<{ id: string; video_id: string }>
      for (let i = 0; i < trackedRows.length; i += 50) {
        const chunk = trackedRows.slice(i, i + 50)
        const res = await api(`${YOUTUBE_API_BASE}/videos?part=statistics&id=${chunk.map(c => c.video_id).join(',')}&key=${apiKey}`)
        if (!res.ok) throw new Error(`YouTube API ${res.status} for daily statistics`)
        const body = await res.json()
        const uuidByYt = new Map(chunk.map(c => [c.video_id, c.id]))
        const rows = ((body.items ?? []) as Array<{ id: string; statistics?: Record<string, string> }>)
          .filter(it => uuidByYt.has(it.id) && it.statistics?.viewCount !== undefined)
          .map(it => ({
            video_id: uuidByYt.get(it.id)!,
            snap_date: snapDate,
            views: parseInt(it.statistics!.viewCount!, 10),
            likes: it.statistics!.likeCount !== undefined ? parseInt(it.statistics!.likeCount, 10) : null,
            comments: it.statistics!.commentCount !== undefined ? parseInt(it.statistics!.commentCount, 10) : null,
            taken_at: nowIso,
          }))
        if (rows.length) {
          await supabase.from('competitor_video_daily').upsert(rows, { onConflict: 'video_id,snap_date', ignoreDuplicates: true })
          dailyRecorded += rows.length
        }
      }
      if (dailyRecorded > 0) {
        const { data: st } = await supabase
          .from('competitor_settings').select('series_started_at').eq('site_id', channelRow.site_id).maybeSingle()
        if (!(st as { series_started_at: string | null } | null)?.series_started_at) {
          await supabase.from('competitor_settings').upsert(
            { site_id: channelRow.site_id, series_started_at: nowIso, updated_at: nowIso },
            { onConflict: 'site_id' },
          )
        }
      }
    }

    // Mark completion
    const updatePayload: Record<string, unknown> = {
      sync_status: 'idle',
      sync_error: null,
      last_ok_synced_at: nowIso,
      sync_error_since: null,
    }
    if (isFullSync) {
      updatePayload.full_sync_completed_at = nowIso
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
            dedup_key: `competitor-change-${channelRow.id}-${nowIso.slice(0, 10)}`,
          })
        }
      } catch {
        // Non-fatal
      }
    }

    return { videosChecked, changesDetected, dailyRecorded, unitsUsed }
  } catch (error) {
    // Set error status, preserve partial data
    await supabase
      .from('competitor_channels')
      .update({
        sync_status: 'error',
        sync_error: error instanceof Error ? error.message : 'Unknown sync error',
        sync_error_since: prevErrorSince ?? nowIso,
      })
      .eq('id', channelRow.id)
    throw error
  }
}
