// @vitest-environment node
// R109: um canal de Shorts de 90 s não pode aparecer com ritmo alto de vídeos longos.
import { describe, it, expect } from 'vitest'
import { rowsToDataset, type ObservatoryRows, type ChannelRow, type VideoRow } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { classifyShort } from '@/lib/youtube/short-classifier'

const DAY = 864e5, NOW = Date.now(), iso = (ms: number) => new Date(ms).toISOString()
const channel: ChannelRow = {
  id: 'ch1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 200,
  youtube_video_count: 300, sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: iso(NOW - 3_600_000), last_synced_at: iso(NOW - 3_600_000),
  full_sync_completed_at: null, added_at: iso(NOW - 120 * DAY),
}
const rows = (isShortOf: (dur: number) => boolean): ObservatoryRows => {
  const vids: VideoRow[] = []
  const mk = (i: number, dur: number): VideoRow => ({
    id: 'v' + i, competitor_channel_id: 'ch1', video_id: 'yt' + i, title: 'T' + i, view_count: 1000, like_count: 10, comment_count: 1, duration_seconds: dur,
    published_at: iso(NOW - (1 + (i % 85)) * DAY), is_short: isShortOf(dur), last_checked_at: iso(NOW - 3_600_000), tags: null, thumbnail_url: null,
  })
  for (let i = 0; i < 150; i++) vids.push(mk(i, 90))
  vids.push(mk(150, 600), mk(151, 700))
  return { settings: { series_started_at: iso(NOW - 60 * DAY), channel_limit: 75 }, channels: [channel], ownChannels: [], videos: vids, ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null }
}

describe('ritmo de longos com a classificação nova', () => {
  it('150 vídeos de 90 s (Shorts) e 2 longos: ritmo de longos baixo, de Shorts alto', () => {
    const obs = createObservatory(rowsToDataset(rows(d => classifyShort({ durationSeconds: d, probe: 'short' }).isShort), NOW))
    expect(obs.cadence('ch1', 'long').n).toBe(2)
    expect(obs.cadence('ch1', 'long').pw).toBeLessThan(0.5)
    expect(obs.cadence('ch1', 'short').pw).toBeGreaterThan(10)
  })
  it('a regra antiga (≤ 60 s) inflava o ritmo — o defeito que este teste cobre', () => {
    const obs = createObservatory(rowsToDataset(rows(d => d <= 60), NOW))
    expect(obs.cadence('ch1', 'long').pw).toBeGreaterThan(10)
  })
})
