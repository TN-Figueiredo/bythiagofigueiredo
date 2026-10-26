// Fábrica compartilhada dos testes do carregador (movida de load.test.ts na Tarefa 4 da M5).
import type { ObservatoryRows, ChannelRow, VideoRow, VersionRow, LegacyChangeRow, DailyRow } from '@/lib/youtube/observatorio/load'
import { createClock } from '@/lib/youtube/observatorio/time'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import type { EngineCtx } from '@/lib/youtube/observatorio/series'

export const DAY = 864e5, H = 36e5
export const sp = (iso: string) => Date.parse(iso + '-03:00')
export const iso = (ms: number) => new Date(ms).toISOString()
export const NOW = sp('2026-10-24T15:02:00')
export const SERIES = '2026-10-05T09:00:00-03:00' // deliberately not 03/10: nothing may assume the mockup's start

export function rows(o: Partial<ObservatoryRows> = {}): ObservatoryRows {
  return { settings: null, channels: [], ownChannels: [], videos: [], ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null, ...o }
}
export const channel = (o: Partial<ChannelRow> = {}): ChannelRow => ({
  id: 'ch1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 50,
  youtube_video_count: 300, sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: iso(NOW - 2 * H), last_synced_at: iso(NOW - 2 * H),
  full_sync_completed_at: null, added_at: iso(sp('2026-09-01T10:00:00')), removal_requested_at: null, ...o,
})
export const video = (o: Partial<VideoRow> = {}): VideoRow => ({
  id: 'v1', competitor_channel_id: 'ch1', video_id: 'yt1', title: 'Um título', view_count: 1000, like_count: 10, comment_count: 1, duration_seconds: 600,
  published_at: iso(sp('2026-10-10T10:00:00')), is_short: false, last_checked_at: iso(NOW - 2 * H), tags: null, thumbnail_url: null, pinned_at: null, ...o,
})
export const version = (o: Partial<VersionRow> = {}): VersionRow => ({
  id: 'ver1', video_id: 'v1', field: 'title', value_text: 'Um título', value_hash: 'h1', has_text: true, thumb_blob_url: null,
  first_seen_at: iso(sp('2026-10-10T12:00:00')), last_seen_at: iso(NOW - 2 * H), window_start: null, precision: 'first', is_current: true, ...o,
})
export const legacy = (o: Partial<LegacyChangeRow> = {}): LegacyChangeRow => ({ id: 'lc1', video_id: 'v1', change_type: 'title', old_title: null, new_title: null, detected_at: iso(sp('2026-09-10T09:00:00')), ...o })
export const daily = (video_id: string, snap_date: string, views: number): DailyRow => ({ video_id, snap_date, views, likes: null, comments: null, taken_at: snap_date + 'T15:00:00Z' /* 12:00 SP: the nominal instant */ })

/** Contexto mínimo do motor para as funções de série (ds + relógio); o resto não é tocado por viewsAtAge. */
export function ctxDe(ds: Dataset): EngineCtx {
  return { ds, clock: createClock(ds.now, ds.seriesStart, ds.snap0), V: new Map(ds.videos.map(v => [v.id, v])) } as unknown as EngineCtx
}

