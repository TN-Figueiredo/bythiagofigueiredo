// Fábrica sintética de ObservatoryRows para os testes da borda dos sinais (F2 T6). Datas relativas a NOW.
import type { ObservatoryRows, ChannelRow, VideoRow, DailyRow, VersionRow } from '@/lib/youtube/observatorio/load'

export const DAY = 864e5
export const H = 36e5
export const NOW = Date.parse('2026-10-24T15:00:00-03:00')
const iso = (ms: number): string => new Date(ms).toISOString()
const spDate = (ms: number): string => new Date(ms - 3 * H).toISOString().slice(0, 10)

export function canal(id: string, o: Partial<ChannelRow> = {}): ChannelRow {
  return {
    id, channel_id: 'UC' + id, channel_name: 'Canal ' + id, thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 50,
    youtube_video_count: 300, sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: iso(NOW - 2 * H), last_synced_at: iso(NOW - 2 * H),
    full_sync_completed_at: null, added_at: iso(NOW - 40 * DAY), removal_requested_at: null, ...o,
  }
}

export interface VideoSpec { id: string; ch: string; vpd: number; ageDias?: number; short?: boolean; title?: string; tags?: string[]; inicio?: number }

/** Vídeo com série diária de 10 dias crescendo `vpd` views por dia. */
export function videoComSerie(s: VideoSpec): { video: VideoRow; daily: DailyRow[]; versions: VersionRow[] } {
  const age = s.ageDias ?? 20
  const video: VideoRow = {
    id: s.id, competitor_channel_id: s.ch, video_id: 'yt-' + s.id, title: s.title ?? 'Título ' + s.id, view_count: 5000, like_count: 10, comment_count: 1,
    duration_seconds: s.short ? 30 : 600, published_at: iso(NOW - age * DAY), is_short: s.short ?? false, last_checked_at: iso(NOW - 2 * H),
    tags: s.tags ?? [], thumbnail_url: null,
  }
  const daily: DailyRow[] = []
  for (let d = 10; d >= 0; d--) daily.push({ video_id: s.id, snap_date: spDate(NOW - d * DAY), views: (s.inicio ?? 1000) + (10 - d) * s.vpd, likes: null, comments: null, taken_at: iso(NOW - d * DAY - 3 * H) })
  const versions: VersionRow[] = [{
    id: s.id + '-t', video_id: s.id, field: 'title', value_text: video.title, value_hash: 't', has_text: true, thumb_blob_url: null,
    first_seen_at: iso(NOW - age * DAY), last_seen_at: iso(NOW - H), window_start: null, precision: 'first', is_current: true,
  }]
  return { video, daily, versions }
}

export function rowsDe(canais: ChannelRow[], specs: VideoSpec[], extra: { versions?: VersionRow[] } = {}): ObservatoryRows {
  const vs = specs.map(videoComSerie)
  return {
    settings: { series_started_at: iso(NOW - 12 * DAY), channel_limit: 75 },
    channels: canais, ownChannels: [], videos: vs.map((v) => v.video), ownVideos: [],
    versions: [...vs.flatMap((v) => v.versions), ...(extra.versions ?? [])], legacyChanges: [],
    daily: vs.flatMap((v) => v.daily), snapshots: [], readings: [], tasks: [], heartbeat: null,
  }
}
