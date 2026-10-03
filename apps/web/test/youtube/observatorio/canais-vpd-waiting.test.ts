// @vitest-environment node
// Defeito C: Canais não diz "nenhum vídeo acompanhado" quando há longos acompanhados sem mediana ainda.
import { describe, it, expect } from 'vitest'
import { rowsToDataset, type ObservatoryRows, type ChannelRow, type VideoRow, type DailyRow } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'

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

describe('C — Canais: frase honesta quando há longos acompanhados e ainda não há mediana', () => {
  const vpdOf = (r: ObservatoryRows) => {
    const v = buildCanaisView(createObservatory(rowsToDataset(r, NOW)), { niche: 'todos', limit: 75 })
    return v.groups.flatMap(g => g.rows).find(x => x.id === 'ch1')!.vpd
  }
  it('longos acompanhados, um registro diário e vídeo antigo: frase de espera', () => {
    const c = vpdOf(rows({ channels: [channel()], videos: [video({ published_at: iso(sp('2026-10-10T10:00:00')) })], daily: [daily('v1', TODAY, 1000, iso(sp(TODAY + 'T12:30:00')))] }))
    expect(c).toBe('Aguardando o 2º registro diário.')
  })
  it('longos acompanhados e nenhum registro diário: frase de espera', () => {
    const c = vpdOf(rows({ channels: [channel()], videos: [video({ published_at: iso(sp('2026-10-10T10:00:00')) })] }))
    expect(c).toBe('Aguardando o 2º registro diário.')
  })
  it('só Shorts acompanhados: a coluna longa mantém "Nenhum vídeo longo acompanhado."', () => {
    const c = vpdOf(rows({ channels: [channel()], videos: [video({ is_short: true, duration_seconds: 30, published_at: iso(sp('2026-10-10T10:00:00')) })] }))
    expect(c).toBe('Nenhum vídeo longo acompanhado.')
  })
  it('canal sem nenhum vídeo: frase original', () => {
    expect(vpdOf(rows({ channels: [channel()] }))).toBe('Nenhum vídeo longo acompanhado.')
  })
})
