import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { link } from '@/lib/youtube/observatorio/links'
import { createNotification } from '@/lib/notifications/create'
import crypto from 'crypto'
import { probeThumb, isNewThumb, archiveThumb, type ThumbProbe } from '@/lib/youtube/thumb-fingerprint'
import {
  reconcileVideoVersions, normalizeDescription, type StoredVersion, type VersionPlan, type VersionField,
} from '@/lib/youtube/competitor-versions'
import { classifyShort, needsShortProbe, probeShortsBatch, newProbeBudget, isYoutubeVideoId, type ProbeBudget, type ShortProbeResult } from '@/lib/youtube/short-classifier'
import { reclassifyStoredShorts } from '@/lib/youtube/short-backfill'
import { warnIfProbeBlocked } from '@/lib/youtube/short-guard'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const MAX_FULL_SYNC_VIDEOS = 2000
const MAX_INCREMENTAL_PAGES = 5
const CHANGE_DETECTION_WINDOW_DAYS = 90
const PAGE_DELAY_MS = 300

/** provisional until spike S1 (Last-Modified granularity) */
const LAST_MODIFIED_MINUTE = true

/** A counter the API may omit (hidden likes/subscribers): null when absent or not numeric, never 0. */
export function optCount(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = parseInt(String(v), 10)
  return Number.isFinite(n) ? n : null
}

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

/** ISO-8601 (PT1M30S) → segundos; null quando ausente/ilegível. */
export function parseIsoDuration(durationStr: string | undefined): number | null {
  if (!durationStr) return null
  const match = durationStr.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match || !(match[1] || match[2] || match[3] || match[4])) return null
  return (parseInt(match[1] ?? '0', 10) * 86400) + (parseInt(match[2] ?? '0', 10) * 3600) +
         (parseInt(match[3] ?? '0', 10) * 60) + parseInt(match[4] ?? '0', 10)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function syncCompetitorChannel(
  channelRow: { id: string; channel_id: string; site_id: string },
  apiKey: string,
  opts: { now?: Date; fetchImpl?: typeof fetch; probeBudget?: ProbeBudget; deferBackfill?: boolean } = {},
): Promise<SyncResult> {
  const supabase = getSupabaseServiceClient()
  const now = opts.now ?? new Date()
  const nowIso = now.toISOString()
  const nowMs = now.getTime()
  const f: typeof fetch = opts.fetchImpl ?? fetch
  let unitsUsed = 0
  // Teto de sondas de Short (R109): compartilhado com o lote quando vem de runCompetitorBatch.
  const probeBudget = opts.probeBudget ?? newProbeBudget()
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
  const reconciled = new Set<string>()

  type TrackedRow = { id: string; video_id: string; title: string | null; thumbnail_url: string | null }
  const loadTracked = async (): Promise<TrackedRow[]> => {
    const { data } = await supabase
      .from('competitor_videos')
      .select('id, video_id, title, thumbnail_url')
      .eq('competitor_channel_id', channelRow.id)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(videoLimit)
    return (data ?? []) as TrackedRow[]
  }
  /** tracked uuids with no competitor_video_daily row for snapDate */
  const missingDaily = async (uuids: string[], snapDate: string): Promise<string[]> => {
    if (!uuids.length) return []
    const have = new Set<string>()
    for (let i = 0; i < uuids.length; i += 200) {
      const { data } = await supabase.from('competitor_video_daily').select('video_id').eq('snap_date', snapDate).in('video_id', uuids.slice(i, i + 200))
      for (const r of (data ?? []) as Array<{ video_id: string }>) have.add(r.video_id)
    }
    return uuids.filter(u => !have.has(u))
  }
  const loadCurrent = async (uuids: string[]): Promise<Map<string, StoredVersion[]>> => {
    const map = new Map<string, StoredVersion[]>()
    if (!uuids.length) return map
    const { data } = await supabase
      .from('competitor_video_versions')
      .select('id, video_id, field, value_text, value_hash, thumb_etag, thumb_dhash, first_seen_at, last_seen_at')
      .in('video_id', uuids)
      .eq('is_current', true)
    for (const r of (data ?? []) as Array<StoredVersion & { video_id: string }>) {
      const list = map.get(r.video_id) ?? []
      list.push(r)
      map.set(r.video_id, list)
    }
    return map
  }
  const fail = (what: string, error: { message?: string } | null | undefined): void => {
    if (error) throw new Error(`${what}: ${error.message ?? 'database error'}`)
  }

  /** Reconciles one video's versions and applies the plan. Throws on any database error (compensating first). */
  const reconcileVideo = async (
    videoUuid: string, videoId: string,
    o: { apiTitle: string; apiDescription: string | undefined; thumbnailUrl: string | null; viewCount: number | null; existingTitle: string | null; existingThumbUrl: string | null },
    current: StoredVersion[], touchIds: string[],
  ): Promise<void> => {
    reconciled.add(videoUuid)
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
      const { error } = await supabase.from('competitor_video_versions').update({
        thumb_dhash: probe.dhash, thumb_etag: probe.etag, last_seen_at: nowIso,
        ...(blobUrl ? { thumb_blob_url: blobUrl } : {}),
      }).eq('id', prevThumb.id)
      fail('heal thumb version', error)
    } else if (probe && prevThumb && action === 'etag') {
      const { error } = await supabase.from('competitor_video_versions').update({
        thumb_etag: probe.etag, last_seen_at: nowIso,
      }).eq('id', prevThumb.id)
      fail('update thumb etag', error)
    }

    const skip: VersionField[] = []
    if (!o.apiTitle) skip.push('title')
    if (o.apiDescription === undefined) skip.push('desc')
    if (action !== 'reconcile') skip.push('thumb')

    const rawPlan = reconcileVideoVersions(
      current,
      { title: o.apiTitle, description: o.apiDescription === undefined ? '' : normalizeDescription(o.apiDescription), thumb: action === 'reconcile' ? probe : null },
      { prevOkAt, now: nowIso },
      { lastModifiedMinute: LAST_MODIFIED_MINUTE },
    )
    const plan = dropFields(rawPlan, current, skip)

    touchIds.push(...plan.touch)
    if (!plan.close.length && !plan.open.length && !plan.changes.length) return

    // One transaction in the database (R22): close + open + change rows, or nothing.
    const openRows = []
    for (const op of plan.open) {
      const blobUrl = op.field === 'thumb' && op.thumb ? await archiveThumb(videoUuid, op.thumb).catch(() => null) : null
      const lm = op.thumb?.lastModified ? Date.parse(op.thumb.lastModified) : NaN
      openRows.push({
        field: op.field,
        value_text: op.value_text,
        value_hash: op.value_hash,
        has_text: op.has_text,
        thumb_etag: op.thumb?.etag ?? null,
        thumb_dhash: op.thumb?.dhash ?? null,
        thumb_blob_url: blobUrl,
        thumb_last_modified: Number.isFinite(lm) ? new Date(lm).toISOString() : null,
        first_seen_at: op.first_seen_at,
        last_seen_at: nowIso,
        window_start: op.window_start,
        precision: op.precision,
      })
    }
    const changeRows = plan.changes.map(c => {
      const fromV = current.find(v => v.id === c.fromId) as (StoredVersion & { value_text?: string | null }) | undefined
      const opened = plan.open.find(op => op.field === c.field)
      return {
        field: c.field,
        site_id: channelRow.site_id,
        change_type: CHANGE_TYPE[c.field],
        ...(c.field === 'title' ? { old_title: fromV?.value_text ?? o.existingTitle ?? null, new_title: opened?.value_text ?? o.apiTitle } : {}),
        ...(c.field === 'thumb' ? { old_thumbnail_url: o.existingThumbUrl, new_thumbnail_url: o.thumbnailUrl } : {}),
        view_count_at_change: o.viewCount,
        from_version_id: c.fromId,
        window_start: c.window_start,
        window_end: c.window_end,
        precision: c.precision,
        detected_at: nowIso,
      }
    })
    const { data, error } = await supabase.rpc('apply_competitor_version_plan', {
      p_video_id: videoUuid, p_close: plan.close, p_open: openRows, p_changes: changeRows,
    })
    fail('apply version plan', error)
    changesDetected += (data as { changes?: number } | null)?.changes ?? 0
  }

  try {
    // Daily record due? 12:00 São Paulo AND at least one tracked video has no row for today's SP date
    // (due per video, so a partial record is completed by the next sync).
    const snapDate = spDate(nowMs)
    const hourOk = isDailyRecordDue(nowIso, null).due
    let dailyDue = false
    if (hourOk) {
      const tracked = await loadTracked()
      dailyDue = needsBackfill || (await missingDaily(tracked.map(t => t.id), snapDate)).length > 0
    }

    // ── 1. Channel metadata ──
    const channelRes = await api(
      `${YOUTUBE_API_BASE}/channels?part=contentDetails,snippet,statistics&id=${channelRow.channel_id}&key=${apiKey}`,
    )
    if (!channelRes.ok) throw new Error(`YouTube API ${channelRes.status} for channel ${channelRow.channel_id}`)

    const channelData = await channelRes.json()
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylistId) {
      // `items: []` = channel removed/closed or a mistyped id. Never stamp last_ok_synced_at; the catch below records the
      // error and humanizeSyncError turns the 404 into "não encontrado no YouTube".
      throw new Error(`YouTube API 404 for channel ${channelRow.channel_id}`)
    }

    const snippet = channelData.items[0].snippet
    const stats = channelData.items[0].statistics
    const youtubeVideoCount = parseInt(stats?.videoCount ?? '0', 10)
    // Hidden counters are absent from the API: null, never 0 ("sem contagem").
    const subscriberCount = optCount(stats?.hiddenSubscriberCount ? undefined : stats?.subscriberCount)

    await supabase
      .from('competitor_channels')
      .update({
        channel_name: snippet?.title ?? '',
        thumbnail_url: snippet?.thumbnails?.default?.url ?? null,
        subscriber_count: subscriberCount,
        youtube_video_count: youtubeVideoCount,
      })
      .eq('id', channelRow.id)

    // Daily snapshot (non-blocking)
    try {
      await supabase
        .from('competitor_channel_snapshots')
        .upsert({
          competitor_channel_id: channelRow.id,
          subscriber_count: subscriberCount,
          video_count: youtubeVideoCount,
          view_count: optCount(stats?.viewCount),
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
        .select('id, video_id, title, description_hash, thumbnail_url, view_count, is_short')
        .eq('competitor_channel_id', channelRow.id)
        .in('video_id', videoIds)
      const existingMap = new Map((existingVideos ?? []).map(v => [v.video_id, v]))

      // Current versions of every known video in this page, one query
      const currentByVideo = await loadCurrent((existingVideos ?? []).map(v => v.id as string))
      const touchIds: string[] = []

      // Smart incremental: stop if we hit a known video
      let hitKnownVideo = false

      // Shorts de 61–180 s: a sonda decide (R109), só para vídeos novos, dentro do teto da execução.
      const probeCandidates = ((videosData.items ?? []) as Array<Record<string, unknown>>)
        .map(v => ({ id: v.id as string, dur: parseIsoDuration((v.contentDetails as { duration?: string } | undefined)?.duration), title: ((v.snippet as { title?: string } | undefined)?.title) ?? '' }))
        .filter(v => needsShortProbe(v.dur) && !v.title.includes('#Shorts') && !existingMap.has(v.id)) // só novos; os já gravados são do backfill (I-1)
      const probes = await probeShortsBatch(probeCandidates.map(v => v.id), probeBudget, f)
      if (probeBudget.stats) probeBudget.stats.pending += probeCandidates.filter(v => isYoutubeVideoId(v.id) && !probes.has(v.id)).length

      for (const video of videosData.items ?? []) {
        videosChecked++
        const videoId = video.id as string
        const apiTitle = (video.snippet?.title as string | undefined) ?? ''
        const title = apiTitle || null
        const apiDescription = video.snippet?.description as string | undefined
        const description = apiDescription ?? ''
        const descriptionHash = crypto.createHash('sha256').update(description).digest('hex').slice(0, 16)
        const thumbnailUrl = (video.snippet?.thumbnails?.maxres?.url ?? video.snippet?.thumbnails?.high?.url ?? null) as string | null
        const viewCount = optCount(video.statistics?.viewCount)
        const publishedAt = (video.snippet?.publishedAt as string) ?? null
        const likeCount = optCount(video.statistics?.likeCount)
        const commentCount = parseInt(video.statistics?.commentCount ?? '0', 10)
        const tags: string[] = (video.snippet?.tags as string[]) ?? []
        const categoryId: string | null = (video.snippet?.categoryId as string) ?? null

        const durationSeconds = parseIsoDuration(video.contentDetails?.duration as string | undefined)
        const probe: ShortProbeResult | undefined = probes.get(videoId)
        const verdict = classifyShort({ durationSeconds, title, probe })
        let isShort = verdict.isShort
        // Já gravado e sem veredito conclusivo nesta rodada (teto esgotado ou sonda inconclusiva): mantém o gravado (R114).
        const keepStored = needsShortProbe(durationSeconds) && !title?.includes('#Shorts') && probe !== 'short' && probe !== 'normal'
        const storedShort = existingMap.get(videoId)?.is_short as boolean | null | undefined
        if (keepStored && storedShort != null && existingMap.has(videoId)) isShort = storedShort

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
          await reconcileVideo(videoUuid, videoId, {
            apiTitle, apiDescription, thumbnailUrl, viewCount,
            existingTitle: existing ? (existing.title as string | null) : null,
            existingThumbUrl: existing ? (existing.thumbnail_url as string | null) : null,
          }, currentByVideo.get(videoUuid) ?? [], touchIds)
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
        const { error } = await supabase.from('competitor_video_versions').update({ last_seen_at: nowIso }).in('id', touchIds)
        fail('touch versions', error)
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

    // ── Daily views record (12:00 SP), due per video; also the once-a-day pass over older videos (R17) ──
    let dailyFailure: Error | null = null
    if (hourOk) {
      const tracked = await loadTracked()
      const missing = new Set(await missingDaily(tracked.map(t => t.id), snapDate))
      const todo = tracked.filter(t => missing.has(t.id))
      for (let i = 0; i < todo.length; i += 50) {
        const chunk = todo.slice(i, i + 50)
        try {
          const res = await api(`${YOUTUBE_API_BASE}/videos?part=snippet,statistics&id=${chunk.map(c => c.video_id).join(',')}&key=${apiKey}`)
          if (!res.ok) throw new Error(`YouTube API ${res.status} for daily statistics`)
          const body = await res.json()
          const byYt = new Map(chunk.map(c => [c.video_id, c]))
          const items = ((body.items ?? []) as Array<{ id: string; snippet?: Record<string, unknown>; statistics?: Record<string, string> }>)
            .filter(it => byYt.has(it.id))
          const rows = items
            .filter(it => it.statistics?.viewCount !== undefined)
            .map(it => ({
              video_id: byYt.get(it.id)!.id,
              snap_date: snapDate,
              views: parseInt(it.statistics!.viewCount!, 10),
              likes: it.statistics!.likeCount !== undefined ? parseInt(it.statistics!.likeCount, 10) : null,
              comments: it.statistics!.commentCount !== undefined ? parseInt(it.statistics!.commentCount, 10) : null,
              taken_at: nowIso,
            }))
          if (rows.length) {
            const { data: inserted, error } = await supabase
              .from('competitor_video_daily')
              .upsert(rows, { onConflict: 'video_id,snap_date', ignoreDuplicates: true })
              .select('video_id')
            fail('record daily views', error)
            dailyRecorded += (inserted ?? []).length
          }
          // once-a-day pass: reconcile what the incremental pages did not reach
          const pending = items.filter(it => !reconciled.has(byYt.get(it.id)!.id))
          const currentMap = await loadCurrent(pending.map(it => byYt.get(it.id)!.id))
          const touch: string[] = []
          for (const it of pending) {
            const row = byYt.get(it.id)!
            const sn = it.snippet ?? {}
            const thumbs = sn.thumbnails as { maxres?: { url?: string }; high?: { url?: string } } | undefined
            await reconcileVideo(row.id, it.id, {
              apiTitle: (sn.title as string | undefined) ?? '',
              apiDescription: sn.description as string | undefined,
              thumbnailUrl: thumbs?.maxres?.url ?? thumbs?.high?.url ?? null,
              viewCount: optCount(it.statistics?.viewCount),
              existingTitle: row.title,
              existingThumbUrl: row.thumbnail_url,
            }, currentMap.get(row.id) ?? [], touch)
          }
          if (touch.length) {
            const { error } = await supabase.from('competitor_video_versions').update({ last_seen_at: nowIso }).in('id', touch)
            fail('touch versions', error)
          }
        } catch (e) {
          dailyFailure ??= e instanceof Error ? e : new Error(String(e))
        }
      }
      if (dailyRecorded > 0) {
        // series start: atomic, only while still null
        const { error: e1 } = await supabase.from('competitor_settings')
          .upsert({ site_id: channelRow.site_id }, { onConflict: 'site_id', ignoreDuplicates: true })
        fail('ensure competitor_settings', e1)
        const { error: e2 } = await supabase.from('competitor_settings')
          .update({ series_started_at: nowIso, updated_at: nowIso })
          .eq('site_id', channelRow.site_id)
          .is('series_started_at', null)
        fail('start series', e2)
      }
      if (dailyFailure) throw dailyFailure // the next sync fills in the missing ids
    }

    // ── Re-classificação dos já gravados como longos com 61–180 s (R109), mesmo teto da execução ──
    try {
      if (!opts.deferBackfill) {
        await reclassifyStoredShorts(supabase, channelRow.id, nowMs, probeBudget, f)
        if (probeBudget.stats) warnIfProbeBlocked(probeBudget.stats) // "sincronizar agora" também avisa
      }
    } catch {
      // a sonda nunca derruba o sync
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
            action_href: link.mudancas(),
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

export { reclassifyStoredShorts } from '@/lib/youtube/short-backfill'
