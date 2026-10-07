// @vitest-environment node
// apps/web/test/youtube/observatorio/pinned-engine.test.ts — R119: a pinned video is observed, never `tracked`.
import { describe, it, expect } from 'vitest'
import { rowsToDataset, type ObservatoryRows, type ChannelRow, type VideoRow, type VersionRow, type DailyRow } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'

const DAY = 864e5, H = 36e5
const sp = (iso: string) => Date.parse(iso + '-03:00')
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = sp('2026-10-24T15:02:00') // handed to the engine as a parameter; never compared with the wall clock
const SERIES = '2026-10-05T09:00:00-03:00'
const DAYS = Array.from({ length: 10 }, (_, i) => '2026-10-' + (15 + i)) // 15/10 … 24/10

function rows(o: Partial<ObservatoryRows> = {}): ObservatoryRows {
  return { settings: null, channels: [], ownChannels: [], videos: [], ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null, ...o }
}
const channel = (o: Partial<ChannelRow> = {}): ChannelRow => ({
  id: 'ch1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 3,
  youtube_video_count: 300, sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: iso(NOW - 2 * H), last_synced_at: iso(NOW - 2 * H),
  full_sync_completed_at: null, added_at: iso(sp('2026-09-01T10:00:00')), ...o,
})
const video = (o: Partial<VideoRow> = {}): VideoRow => ({
  id: 'v1', competitor_channel_id: 'ch1', video_id: 'yt1', title: 'Um título', view_count: 1000, like_count: 10, comment_count: 1, duration_seconds: 600,
  published_at: iso(NOW - 10 * DAY), is_short: false, last_checked_at: iso(NOW - 2 * H), tags: null, thumbnail_url: null, pinned_at: null, ...o,
})
const version = (o: Partial<VersionRow> = {}): VersionRow => ({
  id: 'ver1', video_id: 'v1', field: 'title', value_text: 'Um título', value_hash: 'h1', has_text: true, thumb_blob_url: null,
  first_seen_at: iso(sp('2026-10-06T09:00:00')), last_seen_at: iso(NOW - 2 * H), window_start: null, precision: 'first', is_current: true, ...o,
})
const daily = (video_id: string, snap_date: string, views: number): DailyRow => ({ video_id, snap_date, views, likes: null, comments: null, taken_at: snap_date + 'T15:00:00Z' })
const grow = (id: string, perDay: number) => DAYS.map((d, i) => daily(id, d, 10_000 + i * perDay))

/**
 * One channel, video_limit 3: a, b, c are the tracked ones (25, 30 and 40 days old), u is an untracked 100-day-old video,
 * and `old` is 400 days old with a far bigger daily rate. `pin` decides whether `old` is pinned (and so has its daily record read).
 */
const fixture = (pin: boolean, o: { oldViews?: number | null; oldDaily?: DailyRow[]; versions?: VersionRow[] } = {}) => rows({
  settings: { series_started_at: SERIES, channel_limit: 75 }, channels: [channel()],
  videos: [
    video({ id: 'a', video_id: 'ya', published_at: iso(NOW - 25 * DAY) }), video({ id: 'b', video_id: 'yb', published_at: iso(NOW - 30 * DAY) }),
    video({ id: 'c', video_id: 'yc', published_at: iso(NOW - 40 * DAY) }), video({ id: 'u', video_id: 'yu', published_at: iso(NOW - 100 * DAY) }),
    video({ id: 'old', video_id: 'yo', published_at: iso(NOW - 400 * DAY), view_count: o.oldViews === undefined ? 9_000_000 : o.oldViews, pinned_at: pin ? iso(NOW - 2 * DAY) : null }),
  ],
  daily: [...grow('a', 100), ...grow('b', 200), ...grow('c', 300), ...(pin ? o.oldDaily ?? grow('old', 50_000) : [])],
  versions: o.versions ?? [],
})
const A = createObservatory(rowsToDataset(fixture(false), NOW)), B = createObservatory(rowsToDataset(fixture(true), NOW))

describe('R119: um fixado antigo não entra nas contas do canal', () => {
  it('o fixado foi carregado como observado (com ritmo próprio), não como acompanhado', () => {
    expect(B.video('old')).toMatchObject({ tracked: false, pinned: true })
    expect(B.video('old')!.vpd).not.toBeNull() // it HAS a rate: the comparisons below would move if it leaked into a median
    expect(A.video('old')!.vpd).toBeNull()
  })
  it('mediana de views/dia do canal e mediana de 7 dias não mudam', () => {
    const sa = A.channelStats('ch1'), sb = B.channelStats('ch1')
    expect(sa.vpdMedian).not.toBeNull()
    expect(sa.vpd7Median).not.toBeNull()
    expect(sa.vpdN).toBe(3)
    expect(B.video('old')!.vpd!).toBeGreaterThan(sa.vpdMedian!)
    expect([sb.vpdMedian, sb.vpdN, sb.vpd7Median, sb.tracked, sb.total]).toEqual([sa.vpdMedian, sa.vpdN, sa.vpd7Median, sa.tracked, sa.total])
  })
  it('multiplicador e curva esperada de um vídeo acompanhado não mudam', () => {
    expect(JSON.stringify(B.multiplier('a'))).toBe(JSON.stringify(A.multiplier('a')))
    expect(JSON.stringify(B.expectedCurve('a'))).toBe(JSON.stringify(A.expectedCurve('a')))
  })
  it('Outliers: mesma base analisada, mesmos itens; o fixado segue contado como fora dos acompanhados', () => {
    const q = { ages: 'all' as const, min: 0, includeWeak: true }
    const oa = A.outliers(q), ob = B.outliers(q)
    expect(oa.analyzed).toBe(3)
    expect([ob.analyzed, ob.items.map(x => x.id), ob.untracked, ob.noBase]).toEqual([oa.analyzed, oa.items.map(x => x.id), oa.untracked, oa.noBase])
    expect(ob.items.some(x => x.id === 'old')).toBe(false)
    expect(ob.untracked).toBe(2) // u and old
  })
  it('tendência de temas: o canal continua de fora, porque a janela de 91 a 180 dias segue incompleta', () => {
    for (const o of [A, B]) {
      const ex = o.themeTrend('viagem').excluded
      expect(ex.map(x => x.id)).toEqual(['ch1'])
      expect(ex[0]!.reason).toBe('Canal Um: os 3 vídeos acompanhados só alcançam 40 dias — a janela de 91–180 dias ficaria incompleta')
    }
  })
})

describe('R119: o próprio vídeo fixado fala como vídeo observado', () => {
  const CHANGE = [
    version({ id: 'o1', video_id: 'old', value_text: 'Um', first_seen_at: iso(sp('2026-10-06T09:00:00')), is_current: false }),
    version({ id: 'o2', video_id: 'old', value_text: 'Dois', first_seen_at: iso(sp('2026-10-18T09:00:00')), window_start: iso(sp('2026-10-18T03:00:00')), precision: '6h' }),
  ]
  const effectOf = (pin: boolean) => {
    const obs = createObservatory(rowsToDataset(fixture(pin, { versions: CHANGE }), NOW))
    return obs.effect(obs.changes.find(x => x.video === 'old')!.id)!
  }
  it('efeito: fixado deixa de ser "fora dos acompanhados"; desafixado volta a ser (R120)', () => {
    const pinned = effectOf(true)
    expect(pinned.status).not.toBe('sem-serie')
    expect(pinned.reason).not.toBe('Fora dos vídeos acompanhados: sem série diária de views.')
    expect(effectOf(false)).toMatchObject({ status: 'sem-serie', reason: 'Fora dos vídeos acompanhados: sem série diária de views.' })
  })
  it('série: fixado com um registro só está "aguardando o 2º registro diário"', () => {
    const one = createObservatory(rowsToDataset(fixture(true, { oldDaily: [daily('old', '2026-10-24', 9_000_000)] }), NOW))
    expect(one.periodRate('old', NOW - 5 * DAY, NOW).text).toBe('aguardando o 2º registro diário')
    expect(A.periodRate('old', NOW - 5 * DAY, NOW).text).toBe('fora dos vídeos acompanhados')
  })
  it('multiplicador sem número: fixado diz "sem série"; não fixado diz "fora dos vídeos acompanhados"', () => {
    const noViews = (pin: boolean) => createObservatory(rowsToDataset(fixture(pin, { oldViews: null, oldDaily: [] }), NOW)).multiplier('old')
    expect(noViews(true)).toMatchObject({ value: null, reason: 'sem série' })
    expect(noViews(false)).toMatchObject({ value: null, reason: 'fora dos vídeos acompanhados' })
  })
})
