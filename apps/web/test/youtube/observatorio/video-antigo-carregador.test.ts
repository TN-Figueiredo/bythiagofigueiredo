// @vitest-environment node
// M10a (Tarefa 9, ponto 6): o carregador rotula o vídeo antigo marcado; nunca o acompanha, nem inventa título, nem dá taxa atual.
// Com zero marcado a saída é a de antes (prova byte a byte na Tarefa 12).
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { fakeSupabase } from '../../helpers/fake-supabase'
import { buildTables, ids } from './load-fixture'
import { rowsToDataset, readVideos, VIDEO_COLS, ObservatoryLoadError, type ObservatoryRows, type ChannelRow, type VideoRow, type VersionRow, type LegacyChangeRow } from '@/lib/youtube/observatorio/load'
import { loadChannelRows } from '@/lib/youtube/observatorio/load-channel'
import { createObservatory } from '@/lib/youtube/observatorio'
import { PACK_VERSION } from '@/lib/youtube/observatorio/pack'

const DAY = 864e5, H = 36e5
const sp = (s: string) => Date.parse(s + '-03:00')
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = sp('2026-10-24T15:02:00')
const SERIES = '2026-10-05T09:00:00-03:00'
const FROZEN = iso(sp('2026-09-01T10:00:00'))

const rows = (o: Partial<ObservatoryRows> = {}): ObservatoryRows => ({ settings: { series_started_at: SERIES, channel_limit: 75 }, channels: [], ownChannels: [], videos: [], ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null, ...o })
const channel = (o: Partial<ChannelRow> = {}): ChannelRow => ({
  id: 'ch1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 2,
  youtube_video_count: 300, sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: iso(NOW - 2 * H), last_synced_at: iso(NOW - 2 * H),
  full_sync_completed_at: null, added_at: iso(sp('2026-09-01T10:00:00')), ...o,
})
const video = (id: string, ageDays: number, o: Partial<VideoRow> = {}): VideoRow => ({
  id, competitor_channel_id: 'ch1', video_id: 'yt-' + id, title: 'Título ' + id, view_count: 1000, like_count: 10, comment_count: 1, duration_seconds: 600,
  published_at: iso(NOW - ageDays * DAY), is_short: false, last_checked_at: iso(NOW - 2 * H), tags: null, thumbnail_url: null, pinned_at: null, ...o,
})
const legacy = (video_id: string, type: 'title' | 'description'): LegacyChangeRow => ({ id: 'l-' + video_id + type, video_id, change_type: type, old_title: 'antigo', new_title: 'novo', detected_at: iso(NOW - 20 * DAY) })
const version = (o: Partial<VersionRow>): VersionRow => ({
  id: 'ver', video_id: 'x', field: 'title', value_text: 'Um', value_hash: 'h1', has_text: true, thumb_blob_url: null,
  first_seen_at: iso(sp('2026-10-06T09:00:00')), last_seen_at: iso(NOW - 2 * H), window_start: null, precision: 'first', is_current: true, ...o,
})
const byId = (ds: ReturnType<typeof rowsToDataset>, id: string) => ds.videos.find(v => v.id === id)!

describe('M10a: carregadores e taxa semanal (Tarefa 9)', () => {
  it('1. VIDEO_COLS e as duas leituras de produção pedem as colunas da marca', async () => {
    expect(VIDEO_COLS).toContain('archive_frozen_at')
    expect(VIDEO_COLS).toContain('archive_dropped_at')
    const db1 = fakeSupabase(buildTables({ siteId: 'a', now: NOW }))
    await readVideos(db1.client, [ids.channel('a', 0)])
    const sels1 = db1.selects.filter(s => s.table === 'competitor_videos')
    expect(sels1.length).toBeGreaterThan(0)
    for (const s of sels1) { expect(s.cols).toContain('archive_frozen_at'); expect(s.cols).toContain('archive_dropped_at') }
    const db2 = fakeSupabase(buildTables({ siteId: 'a', now: NOW }))
    await loadChannelRows(db2.client, { channelId: ids.channel('a', 0), videoLimit: 3, seriesStart: NOW - 5 * DAY, now: NOW })
    const sels2 = db2.selects.filter(s => s.table === 'competitor_videos')
    expect(sels2.length).toBeGreaterThan(0)
    for (const s of sels2) { expect(s.cols).toContain('archive_frozen_at'); expect(s.cols).toContain('archive_dropped_at') }
  })

  it('2. V4: o congelado mais recente não é acompanhado nem gasta o limite; os 2 ativos mais recentes são', () => {
    const ds = rowsToDataset(rows({
      channels: [channel({ video_limit: 2 })],
      videos: [video('frz', 1, { archive_frozen_at: FROZEN }), video('a1', 2), video('a2', 3), video('a3', 4)],
    }), NOW)
    expect(byId(ds, 'frz').tracked).toBe(false)
    expect(['a1', 'a2', 'a3'].map(id => byId(ds, id).tracked)).toEqual([true, true, false])
    expect(ds.videos.filter(v => v.tracked)).toHaveLength(2)
  })
  it('2b. pinState dos ativos é o de hoje (posição entre os ativos)', () => {
    const pinned = iso(NOW - 5 * H)
    const ds = rowsToDataset(rows({
      channels: [channel({ video_limit: 1 })],
      videos: [video('frz', 1, { archive_frozen_at: FROZEN }), video('a1', 2, { pinned_at: pinned }), video('a2', 3, { pinned_at: pinned, last_checked_at: null })],
    }), NOW)
    expect(byId(ds, 'a1').pinState).toBe('ativo')
    expect(byId(ds, 'a2').pinState).toBe('sem-resposta')
  })
  it('3. V3: congelado sem versão de título: titles vazio, title = v.title; sem título, ""; nunca a versão inventada', () => {
    const ds = rowsToDataset(rows({ channels: [channel()], videos: [video('frz', 50, { archive_frozen_at: FROZEN }), video('frz2', 60, { archive_frozen_at: FROZEN, title: null }), video('a1', 2)] }), NOW)
    expect(byId(ds, 'frz').titles).toEqual([])
    expect(byId(ds, 'frz').title).toBe('Título frz')
    expect(byId(ds, 'frz2').title).toBe('')
    for (const v of ds.videos.filter(x => x.arquivo)) expect(v.titles.some(t => t.id.endsWith('/title'))).toBe(false)
    expect(byId(ds, 'a1').titles.map(t => t.id)).toEqual(['a1/title']) // o ativo continua com a versão de hoje
  })
  it('4. V2: vídeo no arquivo não leva versão legada; em leitura mensal continua levando', () => {
    const ds = rowsToDataset(rows({
      channels: [channel()],
      videos: [video('arq', 50, { archive_frozen_at: FROZEN, archive_dropped_at: FROZEN }), video('mensal', 60, { archive_frozen_at: FROZEN })],
      legacyChanges: [legacy('arq', 'title'), legacy('arq', 'description'), legacy('mensal', 'title')],
      versions: [version({ id: 'v-m', video_id: 'mensal' })],
    }), NOW)
    const arq = byId(ds, 'arq'), mensal = byId(ds, 'mensal')
    expect(arq.arquivo).toEqual({ estado: 'no_arquivo', desde: Date.parse(FROZEN) })
    expect(arq.titles).toEqual([])
    expect(arq.descs).toEqual([])
    expect(mensal.arquivo).toEqual({ estado: 'leitura_mensal', desde: Date.parse(FROZEN) })
    expect(mensal.titles.length).toBeGreaterThan(0)
  })
  it('5. V15: weeklyRate de vídeo marcado devolve vpd nulo e a frase de leitura mensal; o ativo segue como hoje', () => {
    const D = (day: number) => '2026-10-' + String(day).padStart(2, '0')
    const daily = Array.from({ length: 10 }, (_, i) => ({ video_id: 'a1', snap_date: D(15 + i), views: 10_000 + i * 100, taken_at: D(15 + i) + 'T15:00:00Z' }))
    const base = rows({ channels: [channel()], videos: [video('frz', 50, { archive_frozen_at: FROZEN }), video('a1', 10, { series_tier: 'diaria' })], daily, spans: [{ video_id: 'a1', from_date: D(5), to_date: null, tier: 'diaria' }] })
    const obs = createObservatory(rowsToDataset(base, NOW))
    const r = obs.weeklyRate('frz', NOW - 10 * DAY, NOW)
    expect(r).toMatchObject({ vpd: null, weekly: false })
    expect(r.text).toMatch(/^em leitura mensal desde \d{2}\/\d{2}: sem taxa atual$/)
    expect(r.text).not.toMatch(/parou/)
    expect(obs.weeklyRate('a1', sp(D(17) + 'T12:00:00'), sp(D(24) + 'T12:00:00')).vpd).not.toBeNull()
  })
  it('6. PACK_VERSION é 3', () => { expect(PACK_VERSION).toBe(3) })
  it('7. archive_frozen_at ilegível lança ObservatoryLoadError (nunca vídeo ativo calado)', () => {
    const r = rows({ channels: [channel()], videos: [video('frz', 50, { archive_frozen_at: 'lixo' })] })
    expect(() => rowsToDataset(r, NOW)).toThrow(ObservatoryLoadError)
  })
  it('zero marcado: nenhuma chave nova no vídeo ativo', () => {
    const ds = rowsToDataset(rows({ channels: [channel()], videos: [video('a1', 2, { archive_frozen_at: null, archive_dropped_at: null }), video('a2', 3)] }), NOW)
    for (const v of ds.videos) expect('arquivo' in v).toBe(false)
  })
})
