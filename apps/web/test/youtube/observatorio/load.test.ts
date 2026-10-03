// @vitest-environment node
// apps/web/test/youtube/observatorio/load.test.ts — pure rowsToDataset (Review Focus 2 and 4).
import { describe, it, expect } from 'vitest'
import { rowsToDataset, nextSyncSlot, trackedVideoIds, dailyReadFrom, dailyCappedFrom, mapLimit, type ObservatoryRows, type ChannelRow, type VideoRow, type VersionRow, type LegacyChangeRow, type DailyRow, type ReadingRow, type OwnChannelRow, type OwnVideoRow } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { formulasOf } from '@/lib/youtube/observatorio/catalog'

const DAY = 864e5, H = 36e5
const sp = (iso: string) => Date.parse(iso + '-03:00')
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = sp('2026-10-24T15:02:00')
const SERIES = '2026-10-05T09:00:00-03:00' // deliberately not 03/10: nothing may assume the mockup's start

function rows(o: Partial<ObservatoryRows> = {}): ObservatoryRows {
  return { settings: null, channels: [], ownChannels: [], videos: [], ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null, ...o }
}
const channel = (o: Partial<ChannelRow> = {}): ChannelRow => ({
  id: 'ch1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 50,
  youtube_video_count: 300, sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: iso(NOW - 2 * H), last_synced_at: iso(NOW - 2 * H),
  full_sync_completed_at: null, added_at: iso(sp('2026-09-01T10:00:00')), ...o,
})
const video = (o: Partial<VideoRow> = {}): VideoRow => ({
  id: 'v1', competitor_channel_id: 'ch1', video_id: 'yt1', title: 'Um título', view_count: 1000, like_count: 10, comment_count: 1, duration_seconds: 600,
  published_at: iso(sp('2026-10-10T10:00:00')), is_short: false, last_checked_at: iso(NOW - 2 * H), tags: null, thumbnail_url: null, ...o,
})
const version = (o: Partial<VersionRow> = {}): VersionRow => ({
  id: 'ver1', video_id: 'v1', field: 'title', value_text: 'Um título', value_hash: 'h1', has_text: true, thumb_blob_url: null,
  first_seen_at: iso(sp('2026-10-10T12:00:00')), last_seen_at: iso(NOW - 2 * H), window_start: null, precision: 'first', is_current: true, ...o,
})
const legacy = (o: Partial<LegacyChangeRow> = {}): LegacyChangeRow => ({ id: 'lc1', video_id: 'v1', change_type: 'title', old_title: null, new_title: null, detected_at: iso(sp('2026-09-10T09:00:00')), ...o })
const daily = (video_id: string, snap_date: string, views: number): DailyRow => ({ video_id, snap_date, views, likes: null, comments: null, taken_at: snap_date + 'T09:00:00Z' })

describe('rowsToDataset — empty rows (Review Focus 2)', () => {
  const ds = rowsToDataset(rows(), NOW)
  const obs = createObservatory(ds)
  it('counts are zero, never NaN', () => {
    expect(obs.tabCounts('todos')).toEqual({ canais: 0, mud: 0, out: 0 })
    expect(obs.outliers().count).toBe(0)
    expect(JSON.stringify(obs.channelSlots())).not.toMatch(/NaN|null/)
    expect(obs.channelSlots()).toEqual({ used: 0, limit: 75, free: 75 })
    expect(obs.integrity.ok).toBe(true)
  })
  it('a never-synced observatory says so instead of "sincronizado há NaN"', () => {
    expect(obs.SYNC.last).toBeNull()
    expect(obs.SYNC.text).toBe('nunca sincronizado')
    expect(JSON.stringify(obs.SYNC)).not.toMatch(/NaN/)
  })
  it('LAST_IDX and the patterns base never become -Infinity without series', () => {
    expect(Number.isFinite(obs.LAST_IDX)).toBe(true)
    expect(obs.LAST_IDX).toBe(obs.date.snapIdxAtOrBefore(NOW))
    const p = obs.patternsNow('todos')
    expect(Number.isFinite(p.asOf)).toBe(true)
    expect(p.nVideos).toBe(0)
  })
  it('without a series start, the series starts now (nothing is "since")', () => {
    expect(ds.seriesStart).toBe(NOW)
    expect(obs.heatmap('todos').n).toBe(0)
    expect(obs.themeTrend('todos').length).toBe(0)
  })
})

describe('rowsToDataset — legacy history', () => {
  const realFirst = version({ id: 'real-title', value_text: 'Novo', first_seen_at: iso(sp('2026-10-05T09:00:00')) })
  const base = rows({
    settings: { series_started_at: SERIES, channel_limit: 75 }, channels: [channel()],
    videos: [video({ published_at: iso(sp('2026-08-01T10:00:00')), title: 'Novo' }), video({ id: 'v2', video_id: 'yt2', published_at: iso(sp('2026-08-02T10:00:00')), title: 'Só legado' })],
    versions: [realFirst],
    legacyChanges: [
      legacy({ old_title: 'Antigo', new_title: 'Novo' }),
      legacy({ id: 'lc2', video_id: 'v2', old_title: 'A', new_title: 'B' }),
      legacy({ id: 'lc3', change_type: 'thumbnail' }),
      legacy({ id: 'lc4', change_type: 'description' }),
    ],
  })
  const ds = rowsToDataset(base, NOW), obs = createObservatory(ds)
  const v1 = ds.videos.find(v => v.id === 'v1')!, v2 = ds.videos.find(v => v.id === 'v2')!
  const d = sp('2026-09-10T09:00:00')
  it('a legacy title row becomes a pre-series version pair with 1 d precision; the real first version carries the new title', () => {
    expect(v1.titles.map(t => [t.text, t.prec])).toEqual([['Antigo', '1d'], ['Novo', '1d']])
    expect(v1.titles[1]!.window).toEqual([d - DAY, d])
    expect(v1.titles[1]!.id).toBe('real-title')
    expect(v1.titles[1]!.first_seen).toBe(d)
    expect(v1.titles[1]!.current).toBe(true)
    expect(v1.titles[0]!.current).toBe(false)
  })
  it('without real versions the legacy pair stands alone', () => {
    expect(v2.titles.map(t => [t.text, t.prec, t.current])).toEqual([['A', '1d', false], ['B', '1d', true]])
  })
  it('the change is pre-series and its effect is "sem série … desde <series start>"', () => {
    const c = obs.changes.find(x => x.video === 'v1' && x.type === 'title')!
    expect(c.preSeries).toBe(true)
    const e = obs.effect(c.id)!
    expect(e.status).toBe('sem-serie')
    expect(JSON.stringify(e)).toContain('desde ' + obs.date.dm(obs.SERIES_START))
    expect(obs.date.dm(obs.SERIES_START)).toBe('05/10')
  })
  it('legacy thumbnail rows are ignored', () => {
    expect(v1.thumbs).toEqual([])
    expect(obs.changes.filter(c => c.type === 'thumb')).toEqual([])
  })
  it('legacy description changes become versions without text', () => {
    expect(v1.descs.map(x => [x.lines, x.hasText])).toEqual([[null, false], [null, false]])
    const c = obs.changes.find(x => x.video === 'v1' && x.type === 'desc')!
    expect(c.hasText).toBe(false)
  })
  it('a video with no title version and no legacy row still has its current title (engine needs titles[0])', () => {
    const ds2 = rowsToDataset(rows({ channels: [channel()], videos: [video({ title: 'Sozinho' })] }), NOW)
    expect(ds2.videos[0]!.titles.map(t => [t.text, t.current])).toEqual([['Sozinho', true]])
  })
})

describe('rowsToDataset — series start and daily rows', () => {
  it('series_started_at = 2026-11-02 → SERIES_START_LABEL 02/11', () => {
    const now = sp('2026-11-20T10:00:00')
    const obs = createObservatory(rowsToDataset(rows({ settings: { series_started_at: '2026-11-02T09:13:00-03:00', channel_limit: 75 } }), now))
    expect(obs.SERIES_START_LABEL).toBe('02/11')
    expect(obs.SERIES_START).toBe(sp('2026-11-02T00:00:00'))
  })
  it('daily rows on 3 days → 3 points at nominal 12:00 SP, firstIdx = dayIndex of the first', () => {
    const ds = rowsToDataset(rows({
      settings: { series_started_at: SERIES, channel_limit: 75 }, channels: [channel()], videos: [video()],
      daily: [daily('v1', '2026-10-08', 300), daily('v1', '2026-10-06', 100), daily('v1', '2026-10-07', 200)],
    }), NOW)
    const v = ds.videos[0]!
    expect(v.series).toHaveLength(3)
    expect(v.firstIdx).toBe(1)
    expect(v.series.map(p => [p.idx, p.views])).toEqual([[1, 100], [2, 200], [3, 300]])
    expect(v.series[0]!.t).toBe(sp('2026-10-06T12:00:00'))
    expect(ds.snap0).toBe(sp('2026-10-05T12:00:00'))
    expect(ds.channels[0]!.lastIdx).toBe(3)
  })
})

describe('rowsToDataset — videos, versions and channels', () => {
  const temas: ReadingRow = { id: 'r1', task_type: 'temas', niche: 'viagem', video_id: null, fmt: null, model: 'Gemma 12B', generated_at: iso(NOW - DAY), sent: { text: 'x' }, analysis: {}, text: { lead: 'l', items: [] }, evidence: [{ id: 'v1', theme: 'comida-de-rua' }, { id: 'v2', theme: 'tema-inexistente' }] }
  const older: ReadingRow = { ...temas, id: 'r0', generated_at: iso(NOW - 5 * DAY), evidence: [{ id: 'v1', theme: 'lugares-perigosos' }, { id: 'v2', theme: 'lugares-perigosos' }] }
  const ds = rowsToDataset(rows({
    settings: { series_started_at: SERIES, channel_limit: 75 },
    channels: [channel({ video_limit: 2 }), channel({ id: 'ch2', channel_id: 'UC2', channel_name: 'Dois', niche: 'ia', last_ok_synced_at: null, video_limit: 50, youtube_video_count: 30 }),
      channel({ id: 'ch3', channel_id: 'UC3', channel_name: 'Três', niche: 'ia', youtube_video_count: null, video_limit: 50, last_ok_synced_at: iso(NOW - 30 * H) })],
    videos: [
      video({ title: 'I Tested 7 AI Video Tools' }),
      video({ id: 'v2', video_id: 'yt2', published_at: iso(sp('2026-10-01T10:00:00')), is_short: true }),
      video({ id: 'v3', video_id: 'yt3', published_at: iso(sp('2026-09-01T10:00:00')) }),
      video({ id: 'v4', competitor_channel_id: 'ch2', video_id: 'yt4' }),
      video({ id: 'v5', competitor_channel_id: 'ch3', video_id: 'yt5', published_at: iso(NOW - 40 * DAY) }),
    ],
    versions: [
      version({ id: 't1', field: 'thumb', value_text: null, value_hash: 'ffff0000ffff0000', has_text: false, thumb_blob_url: 'https://blob/a.jpg', is_current: false }),
      version({ id: 't2', field: 'thumb', value_text: null, value_hash: '0000ffff0000ffff', has_text: false, thumb_blob_url: 'https://blob/b.jpg', first_seen_at: iso(sp('2026-10-12T12:00:00')), window_start: iso(sp('2026-10-12T06:00:00')), precision: '6h' }),
      version({ id: 'd1', field: 'desc', value_text: 'linha 1\nlinha 2', value_hash: 'dh' }),
      version({ id: 'd0', field: 'desc', value_text: null, value_hash: 'dh0', has_text: false, first_seen_at: iso(sp('2026-10-10T11:00:00')), is_current: false }),
    ],
    readings: [older, temas],
  }), NOW)
  const V = (id: string) => ds.videos.find(v => v.id === id)!
  const C = (id: string) => ds.channels.find(c => c.id === id)!
  it('tracked = the channel\'s video_limit most recent', () => {
    expect([V('v1').tracked, V('v2').tracked, V('v3').tracked]).toEqual([true, true, false])
  })
  it('fmt, ageDays, formulas, url', () => {
    expect(V('v2').fmt).toBe('short'); expect(V('v1').fmt).toBe('long')
    expect(V('v1').ageDays).toBe(Math.floor((NOW - sp('2026-10-10T10:00:00')) / DAY))
    expect(V('v1').formulas).toEqual(formulasOf('I Tested 7 AI Video Tools'))
    expect(V('v1').formulas.length).toBeGreaterThan(0)
    expect(V('v1').ytId).toBe('yt1')
    expect(V('v1').url).toBe('https://www.youtube.com/watch?v=yt1')
    expect(V('v2').url).toBe('https://www.youtube.com/shorts/yt2')
  })
  it('theme comes from the latest temas reading\'s evidence; unknown themes are dropped', () => {
    expect(V('v1').theme).toBe('comida-de-rua')
    expect(V('v2').theme).toBeNull()
    expect(V('v3').theme).toBeNull()
  })
  it('thumb versions: key = dHash, blobUrl = archived blob; window = [window_start, first_seen_at]', () => {
    expect(V('v1').thumbs.map(t => [t.id, t.key, t.blobUrl, t.prec])).toEqual([['t1', 'ffff0000ffff0000', 'https://blob/a.jpg', 'first'], ['t2', '0000ffff0000ffff', 'https://blob/b.jpg', '6h']])
    expect(V('v1').thumbs[1]!.window).toEqual([sp('2026-10-12T06:00:00'), sp('2026-10-12T12:00:00')])
    expect(V('v1').thumbs[0]!.window).toBeNull()
  })
  it('desc versions ordered by first_seen_at; lines only when the text was kept', () => {
    expect(V('v1').descs.map(d => [d.id, d.lines, d.hasText])).toEqual([['d0', null, false], ['d1', ['linha 1', 'linha 2'], true]])
  })
  it('sync: next 00/06/12/18 slot in SP; last = newest good sync', () => {
    expect(ds.sync.next).toBe(sp('2026-10-24T18:00:00'))
    expect(ds.sync.last).toBe(NOW - 2 * H)
    expect(nextSyncSlot(sp('2026-10-24T18:00:00'))).toBe(sp('2026-10-25T00:00:00'))
    expect(nextSyncSlot(sp('2026-10-24T23:59:00'))).toBe(sp('2026-10-25T00:00:00'))
  })
  it('R21: a never-synced channel is backfill with done/total; one with an ok sync is not', () => {
    expect(C('ch2').sync.state).toBe('backfill')
    expect(C('ch2').sync.backfill).toEqual({ done: 1, total: 30 })
    expect(C('ch2').lastIdx).toBeNull()
    expect(C('ch1').sync.state).toBe('ok')
    expect(C('ch1').sync.backfill).toBeNull()
    expect(C('ch3').sync.state).toBe('atrasado')
  })
  it('activity: no upload in 30 days → parado', () => {
    expect(C('ch3').activity).toEqual({ state: 'parado', pausedDays: 40 })
    expect(C('ch1').activity).toEqual({ state: 'ativo' })
  })
  it('channel identity', () => {
    expect(C('ch1')).toMatchObject({ name: 'Canal Um', niche: 'viagem', own: false, subs: 1000, video_limit: 2, url: 'https://www.youtube.com/channel/UC1', ini: 'CU' })
  })
})

describe('rowsToDataset — a video published after now (scheduled premiere, clock skew)', () => {
  it('age is clamped to 0, so the engine never sees a negative age', () => {
    const ds = rowsToDataset(rows({ channels: [channel()], videos: [video({ published_at: iso(NOW + 3 * DAY) })] }), NOW)
    expect(ds.videos[0]!.ageDays).toBe(0)
    expect(() => createObservatory(ds)).not.toThrow()
  })
})

describe('rowsToDataset — own channel', () => {
  const own: OwnChannelRow = { id: 'own1', channel_id: 'UCown', name: 'tnFigueiredo', handle: '@tnfigueiredo', subscriber_count: 3210, last_synced_at: iso(NOW - H) }
  const ov = (id: string, o: Partial<OwnVideoRow> = {}): OwnVideoRow => ({ id, channel_id: 'own1', youtube_video_id: 'y' + id, title: 'Meu vídeo ' + id, view_count: 500, like_count: 5, comment_count: 1, duration_seconds: 700, published_at: iso(NOW - 10 * DAY), updated_at: iso(NOW - H), tags: [], ...o })
  const ds = rowsToDataset(rows({ ownChannels: [own], ownVideos: [ov('o1'), ov('o2', { duration_seconds: 45 })] }), NOW)
  const obs = createObservatory(ds)
  it('own: true, no slot used, no series and no versions', () => {
    const c = ds.channels[0]!
    expect(c).toMatchObject({ id: 'own1', own: true, name: 'tnFigueiredo', handle: '@tnfigueiredo', lastIdx: null })
    expect(obs.channelSlots().used).toBe(0)
    const v = ds.videos.find(x => x.id === 'o1')!
    expect(v.series).toEqual([]); expect(v.thumbs).toEqual([]); expect(v.descs).toEqual([])
    expect(v.titles.map(t => t.text)).toEqual(['Meu vídeo o1'])
    expect(ds.videos.find(x => x.id === 'o2')!.fmt).toBe('short')
  })
  it('own channel never counts as an outlier source or a monitored channel', () => {
    expect(obs.tabCounts('todos')).toEqual({ canais: 0, mud: 0, out: 0 })
    expect(ds.sync.last).toBeNull()
  })
})

describe('expectedCurve — life day is idx-based, a hole does not shift it (Review Focus 4)', () => {
  const now = sp('2026-10-20T15:00:00')
  const dates = Array.from({ length: 9 }, (_, i) => '2026-10-' + String(5 + i).padStart(2, '0'))
  const vids = ['v1', 'v2', 'v3', 'v4'].map(id => video({ id, video_id: 'y' + id, published_at: iso(sp('2026-10-05T10:00:00')), title: 'T ' + id }))
  const dailyRows: DailyRow[] = []
  for (const v of vids) dates.forEach((d, i) => { if (!(v.id === 'v1' && i === 3)) dailyRows.push(daily(v.id, d, 100 * (i + 1) * (v.id === 'v1' ? 2 : 1))) })
  const ds = rowsToDataset(rows({ settings: { series_started_at: SERIES, channel_limit: 75 }, channels: [channel({ last_ok_synced_at: iso(now - H) })], videos: vids, daily: dailyRows }), now)
  const obs = createObservatory(ds)
  it('every point has lifeDay = idx − firstIdx, including after the hole', () => {
    const v = obs.video('v1')!
    expect(v.series.map(p => p.idx)).toEqual([0, 1, 2, 4, 5, 6, 7, 8])
    const curve = obs.expectedCurve('v1')
    expect(curve.length).toBeGreaterThan(3)
    for (const p of curve) expect(p.lifeDay).toBe(p.idx - v.firstIdx!)
    expect(curve.find(p => p.idx === 6)!.lifeDay).toBe(6)
  })
})

describe('rowsToDataset — a channel that never synced OK and now errors', () => {
  const ds = rowsToDataset(rows({
    channels: [channel({ last_ok_synced_at: null, sync_status: 'error', sync_error: 'quotaExceeded', sync_error_since: iso(NOW - 3 * H), added_at: iso(sp('2026-09-01T10:00:00')) })],
    videos: [video()],
  }), NOW)
  const forced = ds
  const obs = createObservatory(forced)
  const c = obs.channels[0]!
  it('sync.last is null, never added_at', () => {
    expect(ds.channels[0]!.sync.state).toBe('erro')
    expect(ds.channels[0]!.sync.last).toBeNull()
  })
  it('the problem phrase and sync text say "nunca sincronizado com sucesso" and name no sync date', () => {
    expect(c.sync.problemPhrase).toContain('nunca sincronizado com sucesso')
    expect(c.sync.problemPhrase).not.toMatch(/última sincronização boa/)
    expect(c.sync.problemPhrase).not.toMatch(/\d\d\/\d\d 0?1[0-9]:\d\d.*sincroniza/)
    expect(obs.syncText(c.id)).toContain('nunca sincronizado com sucesso')
    expect(c.syncAgeHours).toBeUndefined()
    expect(JSON.stringify(c.sync)).not.toMatch(/NaN/)
  })
  it('the phase of its videos says no rhythm is measured, without a date', () => {
    const ph = obs.phaseOf(forced.videos[0]!.id)
    expect(ph.why).toBe('sincronização com erro e nenhuma sincronização boa: o ritmo não está medido')
  })
})

describe('rowsToDataset — legacy title merge only on equal text', () => {
  const mk = (newTitle: string) => rowsToDataset(rows({
    settings: { series_started_at: SERIES, channel_limit: 75 }, channels: [channel()],
    videos: [video({ published_at: iso(sp('2026-08-01T10:00:00')) })],
    versions: [version({ id: 'real-title', value_text: 'Texto real', first_seen_at: iso(sp('2026-10-05T09:00:00')) })],
    legacyChanges: [legacy({ old_title: 'Antigo', new_title: newTitle })],
  }), NOW).videos[0]!.titles
  it('equal text: merged into the real version', () => {
    expect(mk('Texto real').map(t => t.text)).toEqual(['Antigo', 'Texto real'])
    expect(mk('Texto real')[1]!.id).toBe('real-title')
  })
  it('different text: both the legacy "after" and the real version are kept', () => {
    const t = mk('Outro texto')
    expect(t.map(x => x.text)).toEqual(['Antigo', 'Outro texto', 'Texto real'])
    expect(t[1]!.current).toBe(false)
  })
})

describe('daily read bound', () => {
  it('only the video_limit most recent per channel are tracked ids', () => {
    const chs = [channel({ video_limit: 2 })]
    const vs = [video({ id: 'a', published_at: iso(NOW - 1 * DAY) }), video({ id: 'b', published_at: iso(NOW - 2 * DAY) }), video({ id: 'c', published_at: iso(NOW - 3 * DAY) }), video({ id: 'n', published_at: null })]
    expect(trackedVideoIds(chs, vs).sort()).toEqual(['a', 'b'])
  })
  it('reads from series start − 1 d, never older than 365 d, in SP dates', () => {
    expect(dailyReadFrom(NOW - 30 * DAY, NOW)).toBe('2026-09-23')
    expect(dailyReadFrom(NOW - 900 * DAY, NOW)).toBe(new Date(NOW - 365 * DAY - 3 * H).toISOString().slice(0, 10))
  })
})

describe('own channel that never synced', () => {
  const own: OwnChannelRow = { id: 'own1', channel_id: 'UCown', name: 'tn', handle: '@tn', subscriber_count: 1, last_synced_at: null, locale: 'pt', created_at: iso(sp('2026-09-01T10:00:00')) }
  const ds = rowsToDataset(rows({ ownChannels: [own] }), NOW)
  const obs = createObservatory(ds)
  it('has no sync date, says so, and keeps its locale and creation date', () => {
    const c = ds.channels[0]!
    expect(c.sync.last).toBeNull()
    expect(c.sync.added).toBe(sp('2026-09-01T10:00:00'))
    expect(c.lang).toBe('pt')
    expect(obs.syncText('own1')).toBe('nunca sincronizado com sucesso')
    expect(obs.syncText('own1')).not.toMatch(/sincronizado agora/)
    expect(obs.channels[0]!.syncAgeHours).toBeUndefined()
  })
})

describe('daily lookback cap', () => {
  it('a series start older than the cap is flagged with the read start; a recent one is not', () => {
    expect(dailyCappedFrom(NOW - 30 * DAY, NOW)).toBeNull()
    const f = dailyCappedFrom(NOW - 900 * DAY, NOW)!
    expect(f).toBe(Date.parse(dailyReadFrom(NOW - 900 * DAY, NOW) + 'T00:00:00-03:00'))
    const ds = rowsToDataset(rows({ settings: { series_started_at: iso(NOW - 900 * DAY), channel_limit: 75 } }), NOW)
    expect(ds.dailyCappedFrom).toBe(f)
    expect(rowsToDataset(rows(), NOW).dailyCappedFrom).toBeNull()
  })
  it('a video published after seriesStart but before the cap is truncated: no day-0 baseline; a newer one keeps it', () => {
    const f = dailyCappedFrom(NOW - 900 * DAY, NOW)!
    const old = iso(f - 20 * DAY), fresh = iso(f + 20 * DAY)
    const dayOf = (ms: number) => new Date(ms - 3 * H).toISOString().slice(0, 10)
    const ds = rowsToDataset(rows({
      settings: { series_started_at: iso(NOW - 900 * DAY), channel_limit: 75 }, channels: [channel()],
      videos: [video({ id: 'old', video_id: 'yo', published_at: old }), video({ id: 'new', video_id: 'yn', published_at: fresh })],
      daily: [daily('old', dayOf(f + DAY), 100), daily('old', dayOf(f + 2 * DAY), 120), daily('new', dayOf(f + 21 * DAY), 10), daily('new', dayOf(f + 22 * DAY), 30)],
    }), NOW)
    const o = createObservatory(ds)
    expect(ds.videos.find(v => v.id === 'old')!.truncated).toBe(true)
    expect(ds.videos.find(v => v.id === 'new')!.truncated).toBeUndefined()
    const vo = o.videos.find(v => v.id === 'old')!, vn = o.videos.find(v => v.id === 'new')!
    // with a baseline the old video would report 100 views over its first day from 0; truncated, its rate is 20/day
    expect(vo.vpd).toBe(20)
    expect(vn.vpd).toBeGreaterThan(0)
  })
})

describe('R37: untracked video effect', () => {
  it('an untracked video change is "fora dos vídeos acompanhados", not "sem série diária"', () => {
    const ds = rowsToDataset(rows({
      settings: { series_started_at: SERIES, channel_limit: 75 }, channels: [channel({ video_limit: 1 })],
      videos: [video({ id: 'a', published_at: iso(sp('2026-10-20T10:00:00')) }), video({ id: 'b', video_id: 'yb', published_at: iso(sp('2026-08-01T10:00:00')) })],
      versions: [version({ id: 'b1', video_id: 'b', value_text: 'Um', first_seen_at: iso(sp('2026-10-06T09:00:00')), is_current: false }), version({ id: 'b2', video_id: 'b', value_text: 'Dois', first_seen_at: iso(sp('2026-10-12T09:00:00')), window_start: iso(sp('2026-10-12T03:00:00')), precision: '6h' })],
    }), NOW)
    const obs = createObservatory(ds)
    const c = obs.changes.find(x => x.video === 'b')!
    const e = obs.effect(c.id)!
    expect(e.status).toBe('sem-serie')
    expect(e.reason).toBe('Fora dos vídeos acompanhados: sem série diária de views.')
  })
})

describe('mapLimit', () => {
  it('keeps input order, never exceeds the limit, and propagates the first rejection', async () => {
    let inflight = 0, peak = 0
    const out = await mapLimit([5, 1, 4, 2, 3, 6, 7, 8], 4, async n => { inflight++; peak = Math.max(peak, inflight); await new Promise(r => setTimeout(r, n)); inflight--; return n * 2 })
    expect(out).toEqual([10, 2, 8, 4, 6, 12, 14, 16])
    expect(peak).toBeLessThanOrEqual(4); expect(peak).toBeGreaterThan(1)
    await expect(mapLimit([1, 2, 3], 2, async n => { if (n === 2) throw new Error('boom'); return n })).rejects.toThrow('boom')
    expect(await mapLimit([], 4, async n => n)).toEqual([])
  })
})
