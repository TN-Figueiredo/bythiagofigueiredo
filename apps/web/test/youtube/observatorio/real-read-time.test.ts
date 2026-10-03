// @vitest-environment node
// Defeito B (views/dia negativo): o instante de um registro diário é o taken_at real.
import { describe, it, expect } from 'vitest'
import { rowsToDataset, type ObservatoryRows, type ChannelRow, type VideoRow, type DailyRow } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'

const DAY = 864e5, H = 36e5
const sp = (isoSp: string) => Date.parse(isoSp + '-03:00')
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = sp('2026-10-24T15:02:00')
const TODAY = '2026-10-24'
const rows = (o: Partial<ObservatoryRows>): ObservatoryRows => ({ settings: { series_started_at: iso(sp(TODAY + 'T00:00:00')), channel_limit: 75 }, channels: [], ownChannels: [], videos: [], ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null, ...o })
const channel = (o: Partial<ChannelRow> = {}): ChannelRow => ({
  id: 'ch1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 50,
  youtube_video_count: 300, sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: iso(NOW - 2 * H), last_synced_at: iso(NOW - 2 * H),
  full_sync_completed_at: null, added_at: iso(sp('2026-09-01T10:00:00')), ...o,
})
const video = (o: Partial<VideoRow> = {}): VideoRow => ({
  id: 'v1', competitor_channel_id: 'ch1', video_id: 'yt1', title: 'Um título', view_count: 1000, like_count: 10, comment_count: 1, duration_seconds: 600,
  published_at: iso(sp(TODAY + 'T13:00:00')), is_short: false, last_checked_at: iso(NOW - 2 * H), tags: null, thumbnail_url: null, ...o,
})
const daily = (video_id: string, snap_date: string, views: number, taken_at: string): DailyRow => ({ video_id, snap_date, views, likes: null, comments: null, taken_at })

describe('B — o tempo de um registro diário é o taken_at real', () => {
  it('publicado 13:00, registro nominal 12:00 mas lido 14:40: taxa positiva sobre 1 h 40', () => {
    const o = createObservatory(rowsToDataset(rows({ channels: [channel()], videos: [video()], daily: [daily('v1', TODAY, 1000, iso(sp(TODAY + 'T14:40:00')))] }), NOW))
    expect(o.video('v1')!.vpd).toBeCloseTo(1000 / (100 / 1440), 6)
  })
  it('registro sem taken_at utilizável: cai para o 12:00 nominal (e nunca devolve negativo)', () => {
    for (const bad of ['', 'nao-e-data', iso(sp('2026-10-23T14:40:00'))]) {
      const o = createObservatory(rowsToDataset(rows({ channels: [channel()], videos: [video({ published_at: iso(sp(TODAY + 'T06:00:00')) })], daily: [daily('v1', TODAY, 600, bad)] }), NOW))
      expect(o.video('v1')!.vpd).toBeCloseTo(600 / (6 / 24), 6) // 12:00 − 06:00 = 6 h
    }
  })
  it('tempo decorrido zero ou negativo: sem taxa, nunca número negativo nem Infinity', () => {
    for (const pub of ['T14:40:00', 'T14:55:00']) {
      const o = createObservatory(rowsToDataset(rows({ channels: [channel()], videos: [video({ published_at: iso(sp(TODAY + pub)) })], daily: [daily('v1', TODAY, 1000, iso(sp(TODAY + 'T14:40:00')))] }), NOW))
      expect(o.video('v1')!.vpd).toBeNull()
    }
  })
  it('a mediana do canal não fica negativa nesse cenário (vídeo publicado entre 12:00 e a leitura)', () => {
    const ds = rowsToDataset(rows({
      channels: [channel()],
      videos: [video({ id: 'a', video_id: 'ya', published_at: iso(sp(TODAY + 'T13:00:00')) }), video({ id: 'b', video_id: 'yb', published_at: iso(sp(TODAY + 'T14:00:00')) })],
      daily: [daily('a', TODAY, 1000, iso(sp(TODAY + 'T14:40:00'))), daily('b', TODAY, 500, iso(sp(TODAY + 'T14:40:00')))],
    }), NOW)
    const o = createObservatory(ds)
    const S = o.channelStats('ch1', 'long')
    expect(S.vpdMedian).not.toBeNull()
    expect(S.vpdMedian!).toBeGreaterThan(0)
  })
})

