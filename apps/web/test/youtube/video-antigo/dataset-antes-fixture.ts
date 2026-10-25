// Fixture do retrato do conjunto de dados (M10a, Tarefa 0) e a Tarefa 12: extraída do teste para a Tarefa 12 importar sem rodar o describe dele.
import path from 'node:path'
import { type ObservatoryRows, type ChannelRow, type VideoRow, type VersionRow, type ReadingRow } from '@/lib/youtube/observatorio/load'

export const GOLDEN = path.resolve(__dirname, '__golden__/dataset-antes.json')
const DAY = 864e5, H = 36e5
const sp = (iso: string) => Date.parse(iso + '-03:00')
const iso = (ms: number) => new Date(ms).toISOString()
export const NOW_FIXO = sp('2026-10-24T15:02:00')
const SERIES = '2026-10-05T09:00:00-03:00'

function rows(o: Partial<ObservatoryRows> = {}): ObservatoryRows {
  return { settings: null, channels: [], ownChannels: [], videos: [], ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null, ...o }
}
const channel = (o: Partial<ChannelRow> = {}): ChannelRow => ({
  id: 'ch1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 50,
  youtube_video_count: 300, sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: iso(NOW_FIXO - 2 * H), last_synced_at: iso(NOW_FIXO - 2 * H),
  full_sync_completed_at: null, added_at: iso(sp('2026-09-01T10:00:00')), ...o,
})
const video = (o: Partial<VideoRow> = {}): VideoRow => ({
  id: 'v1', competitor_channel_id: 'ch1', video_id: 'yt1', title: 'Um título', view_count: 1000, like_count: 10, comment_count: 1, duration_seconds: 600,
  published_at: iso(sp('2026-10-10T10:00:00')), is_short: false, last_checked_at: iso(NOW_FIXO - 2 * H), tags: null, thumbnail_url: null, pinned_at: null, ...o,
})
const version = (o: Partial<VersionRow> = {}): VersionRow => ({
  id: 'ver1', video_id: 'v1', field: 'title', value_text: 'Um título', value_hash: 'h1', has_text: true, thumb_blob_url: null,
  first_seen_at: iso(sp('2026-10-10T12:00:00')), last_seen_at: iso(NOW_FIXO - 2 * H), window_start: null, precision: 'first', is_current: true, ...o,
})

export function fixtureMaior(): ObservatoryRows {
  const temas: ReadingRow = { id: 'r1', task_type: 'temas', niche: 'viagem', video_id: null, fmt: null, model: 'Gemma 12B', generated_at: iso(NOW_FIXO - DAY), sent: { text: 'x' }, analysis: {}, text: { lead: 'l', items: [] }, evidence: [{ id: 'v1', theme: 'comida-de-rua' }, { id: 'v2', theme: 'tema-inexistente' }] }
  const older: ReadingRow = { ...temas, id: 'r0', generated_at: iso(NOW_FIXO - 5 * DAY), evidence: [{ id: 'v1', theme: 'lugares-perigosos' }, { id: 'v2', theme: 'lugares-perigosos' }] }
  return rows({
    settings: { series_started_at: SERIES, channel_limit: 75 },
    channels: [channel({ video_limit: 2 }), channel({ id: 'ch2', channel_id: 'UC2', channel_name: 'Dois', niche: 'ia', last_ok_synced_at: null, video_limit: 50, youtube_video_count: 30 }),
      channel({ id: 'ch3', channel_id: 'UC3', channel_name: 'Três', niche: 'ia', youtube_video_count: null, video_limit: 50, last_ok_synced_at: iso(NOW_FIXO - 30 * H) })],
    videos: [
      video({ title: 'I Tested 7 AI Video Tools' }),
      video({ id: 'v2', video_id: 'yt2', published_at: iso(sp('2026-10-01T10:00:00')), is_short: true }),
      video({ id: 'v3', video_id: 'yt3', published_at: iso(sp('2026-09-01T10:00:00')), pinned_at: iso(sp('2026-10-02T10:00:00')) }),
      video({ id: 'v4', competitor_channel_id: 'ch2', video_id: 'yt4' }),
      video({ id: 'v5', competitor_channel_id: 'ch3', video_id: 'yt5', published_at: iso(NOW_FIXO - 40 * DAY) }),
      video({ id: 'v6', competitor_channel_id: 'ch3', video_id: 'yt6', published_at: iso(NOW_FIXO - 800 * DAY), view_count: 5000 }),
    ],
    versions: [
      version({ id: 't1', field: 'thumb', value_text: null, value_hash: 'ffff0000ffff0000', has_text: false, thumb_blob_url: 'https://blob/a.jpg', is_current: false }),
      version({ id: 't2', field: 'thumb', value_text: null, value_hash: '0000ffff0000ffff', has_text: false, thumb_blob_url: 'https://blob/b.jpg', first_seen_at: iso(sp('2026-10-12T12:00:00')), window_start: iso(sp('2026-10-12T06:00:00')), precision: '6h' }),
      version({ id: 'd1', field: 'desc', value_text: 'linha 1\nlinha 2', value_hash: 'dh' }),
      version({ id: 'd0', field: 'desc', value_text: null, value_hash: 'dh0', has_text: false, first_seen_at: iso(sp('2026-10-10T11:00:00')), is_current: false }),
    ],
    daily: [
      { video_id: 'v1', snap_date: '2026-10-20', views: 800, likes: null, comments: null, taken_at: '2026-10-20T15:00:00Z' },
      { video_id: 'v1', snap_date: '2026-10-23', views: 950, likes: null, comments: null, taken_at: '2026-10-23T15:00:00Z' },
      { video_id: 'v6', snap_date: '2026-10-22', views: 4900, likes: null, comments: null, taken_at: '2026-10-22T15:00:00Z' },
    ],
    readings: [older, temas],
  })
}

