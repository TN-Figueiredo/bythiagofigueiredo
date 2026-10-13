// @vitest-environment node
// A5 (E2): intervalo semanal só existe onde a faixa gravada diz "semanal"; buraco continua buraco; nada do que as telas leem muda.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { rowsToDataset, type ObservatoryRows, type ChannelRow, type VideoRow, type VersionRow, type DailyRow, type SpanRow } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { weeklyThroughout } from '@/lib/youtube/observatorio/series'

const DAY = 864e5, H = 36e5
const sp = (s: string) => Date.parse(s + '-03:00')
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = sp('2026-10-24T15:02:00') // entregue ao motor como parâmetro; nunca comparado com o relógio de parede
const SERIES = '2026-10-05T09:00:00-03:00'
const D = (day: number) => '2026-10-' + String(day).padStart(2, '0')
const noon = (day: number) => sp(D(day) + 'T12:00:00')

function rows(o: Partial<ObservatoryRows> = {}): ObservatoryRows {
  return { settings: { series_started_at: SERIES, channel_limit: 75 }, channels: [], ownChannels: [], videos: [], ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null, ...o }
}
const channel = (o: Partial<ChannelRow> = {}): ChannelRow => ({
  id: 'ch1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 1,
  youtube_video_count: 300, sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: iso(NOW - 2 * H), last_synced_at: iso(NOW - 2 * H),
  full_sync_completed_at: null, added_at: iso(sp('2026-09-01T10:00:00')), ...o,
})
const video = (id: string, ageDays: number, o: Partial<VideoRow> = {}): VideoRow => ({
  id, competitor_channel_id: 'ch1', video_id: 'yt-' + id, title: 'Título ' + id, view_count: 1000, like_count: 10, comment_count: 1, duration_seconds: 600,
  published_at: iso(NOW - ageDays * DAY), is_short: false, last_checked_at: iso(NOW - 2 * H), tags: null, thumbnail_url: null, pinned_at: null, ...o,
})
const version = (o: Partial<VersionRow>): VersionRow => ({
  id: 'ver', video_id: 'w', field: 'title', value_text: 'Um', value_hash: 'h1', has_text: true, thumb_blob_url: null,
  first_seen_at: iso(sp('2026-10-06T09:00:00')), last_seen_at: iso(NOW - 2 * H), window_start: null, precision: 'first', is_current: true, ...o,
})
const pt = (video_id: string, day: number, views: number): DailyRow => ({ video_id, snap_date: D(day), views, likes: null, comments: null, taken_at: D(day) + 'T15:00:00Z' })
const span = (video_id: string, from: number, to: number | null, tier: string): SpanRow => ({ video_id, from_date: D(from), to_date: to == null ? null : D(to), tier })
const days = (video_id: string, from: number, to: number, perDay: number) => Array.from({ length: to - from + 1 }, (_, i) => pt(video_id, from + i, 10_000 + i * perDay))

// Canal com limite 1: `a` (10 dias) é o acompanhado; os outros têm 400 dias e não são observados.
const A_DAILY = days('a', 15, 24, 100)
const base = (extra: { videos?: VideoRow[]; daily?: DailyRow[]; spans?: SpanRow[]; versions?: VersionRow[] }) => rows({
  channels: [channel()], videos: [video('a', 10, { series_tier: 'diaria' }), ...(extra.videos ?? [])],
  daily: [...A_DAILY, ...(extra.daily ?? [])], spans: [span('a', 5, null, 'diaria'), ...(extra.spans ?? [])], versions: extra.versions ?? [],
})
const obsOf = (r: ObservatoryRows) => createObservatory(rowsToDataset(r, NOW))

describe('intervalo semanal (itens 19 e 222)', () => {
  it('vídeo em faixa semanal com 7 dias entre dois pontos: intervalo semanal, taxa = média da semana, e a frase diz isso', () => {
    const obs = obsOf(base({ videos: [video('w', 400, { series_tier: 'semanal' })], daily: [pt('w', 17, 50_000), pt('w', 24, 57_000)], spans: [span('w', 10, null, 'semanal')] }))
    const r = obs.weeklyRate('w', noon(17), noon(24))
    expect(r.weekly).toBe(true)
    expect(r.vpd).toBeCloseTo(1000, 5)
    expect(r.text).toContain('taxa média da semana')
  })
  it('vídeo SEM nenhuma linha de faixa nunca tem intervalo semanal (anterior à MG2)', () => {
    const obs = obsOf(base({ videos: [video('w', 400)], daily: [pt('w', 17, 50_000), pt('w', 24, 57_000)] }))
    expect(obs.weeklyRate('w', noon(17), noon(24))).toMatchObject({ vpd: null, weekly: false })
  })
  it('buraco não vira semana: vídeo em faixa DIÁRIA com 3 dias sem leitura → o intervalo é recusado', () => {
    const holed = A_DAILY.filter(p => p.snap_date < D(19) || p.snap_date > D(21)) // faltam 19, 20 e 21
    const r = rows({ channels: [channel()], videos: [video('a', 10, { series_tier: 'diaria' })], daily: holed, spans: [span('a', 5, null, 'diaria')] })
    const obs = obsOf(r)
    expect(obs.weeklyRate('a', noon(19), noon(21))).toMatchObject({ vpd: null, weekly: false }) // período inteiro dentro do buraco: nada
    expect(obs.periodRate('a', noon(19), noon(21)).vpd).toBeNull()                              // e o que as telas leem continua recusando, como hoje
    // os mesmos pontos, com a faixa dizendo "semanal" nos dias sem leitura: aí sim é intervalo (quem decide é a faixa, não a distância)
    const weekly = obsOf({ ...r, spans: [span('a', 5, 18, 'diaria'), span('a', 19, null, 'semanal')] })
    expect(weekly.weeklyRate('a', noon(19), noon(21))).toMatchObject({ weekly: true })
  })
  it('rebaixado ontem: do último ponto diário ao primeiro semanal é intervalo aceito', () => {
    const obs = obsOf(base({ videos: [video('d', 400, { series_tier: 'semanal' })], daily: [...days('d', 15, 20, 500), pt('d', 24, 14_000)], spans: [span('d', 5, 20, 'diaria'), span('d', 21, null, 'semanal')] }))
    const r = obs.weeklyRate('d', noon(20), noon(24))
    expect(r.weekly).toBe(true)
    expect(r.vpd).toBeCloseTo((14_000 - 12_500) / 4, 5)
  })
  it('promovido: do último ponto semanal ao primeiro diário é intervalo aceito', () => {
    const obs = obsOf(base({ videos: [video('p', 400, { series_tier: 'diaria' })], daily: [pt('p', 15, 1000), pt('p', 20, 6000), pt('p', 21, 7000)], spans: [span('p', 5, 19, 'semanal'), span('p', 20, null, 'diaria')] }))
    expect(obs.weeklyRate('p', noon(15), noon(20))).toMatchObject({ weekly: true })
    expect(obs.weeklyRate('p', noon(15), noon(20)).vpd).toBeCloseTo(1000, 5)
  })
  it('9 dias entre dois pontos é buraco mesmo em faixa semanal', () => {
    const obs = obsOf(base({ videos: [video('w', 400, { series_tier: 'semanal' })], daily: [pt('w', 15, 50_000), pt('w', 24, 59_000)], spans: [span('w', 10, null, 'semanal')] }))
    expect(obs.weeklyRate('w', noon(15), noon(24))).toMatchObject({ vpd: null, weekly: false })
  })
  it('sobre uma série só diária, weeklyRate dá o mesmo número de periodRate', () => {
    const obs = obsOf(base({}))
    expect(obs.weeklyRate('a', noon(16), noon(23)).vpd).toBe(obs.periodRate('a', noon(16), noon(23)).vpd)
    expect(obs.weeklyRate('a', noon(16), noon(23)).weekly).toBe(false)
  })
})

describe('efeito de troca e múltiplo sobre série semanal (item 19)', () => {
  const CHANGE = [
    version({ id: 'w1', value_text: 'Um', is_current: false }),
    version({ id: 'w2', value_text: 'Dois', value_hash: 'h2', first_seen_at: iso(sp('2026-10-18T09:00:00')), window_start: iso(sp('2026-10-11T09:00:00')), precision: '1d' }),
  ]
  const withWeekly = base({ videos: [video('w', 400, { series_tier: 'semanal' })], daily: [pt('w', 17, 50_000), pt('w', 24, 57_000)], spans: [span('w', 10, null, 'semanal')], versions: CHANGE })
  // (emenda do portão: S-I8, pergunta 5) nenhum texto de tela muda: o estado, o rótulo E o motivo são os de hoje; o fato novo vai num campo que nenhuma tela lê
  it('troca num vídeo semanal: o estado, o rótulo e o motivo continuam os de hoje; o efeito ganha weeklySeries: true', () => {
    const obs = obsOf(withWeekly)
    expect(obs.effect(obs.changes.find(x => x.video === 'w')!.id)).toMatchObject({ status: 'sem-serie', label: 'sem série', reason: 'Fora dos vídeos acompanhados: sem série diária de views.', weeklySeries: true })
  })
  it('troca num vídeo não observado SEM ponto nenhum: a frase de hoje', () => {
    const obs = obsOf(base({ videos: [video('w', 400)], versions: CHANGE }))
    expect(obs.effect(obs.changes.find(x => x.video === 'w')!.id)).toMatchObject({ status: 'sem-serie', reason: 'Fora dos vídeos acompanhados: sem série diária de views.' })
  })
  it('o múltiplo de um vídeo semanal nunca usa o método "mesmo dia de vida"', () => {
    expect(obsOf(withWeekly).multiplier('w').method).not.toBe('mesmo dia de vida')
  })
})

describe('item 20: nada do que as telas leem hoje muda', () => {
  // o que o carregador de hoje entrega (só os observados têm série; sem faixa) × o que o novo entrega (tudo)
  const extraVideos = [video('w', 400), video('x', 200)]
  const before = rows({ channels: [channel()], videos: [video('a', 10), ...extraVideos], daily: A_DAILY })
  const after = rows({ channels: [channel()], videos: [video('a', 10, { series_tier: 'diaria' }), ...extraVideos.map(v => ({ ...v, series_tier: 'semanal' }))],
    daily: [...A_DAILY, pt('w', 17, 50_000), pt('w', 24, 57_000), ...days('x', 15, 24, 9_999)], spans: [span('a', 5, null, 'diaria'), span('w', 10, null, 'semanal'), span('x', 10, null, 'semanal')] })
  const strip = (ds: ReturnType<typeof rowsToDataset>) => ({ ...ds, videos: ds.videos.map(({ tier: _t, tierSpans: _s, unobservedSeries: _u, ...v }) => v) })
  it('o conjunto de dados, sem os três campos novos, é idêntico (logo, todo número calculado dele também)', () => {
    expect(strip(rowsToDataset(after, NOW))).toEqual(strip(rowsToDataset(before, NOW)))
  })
  it('o vídeo não observado guarda os pontos em unobservedSeries, e `series` continua vazia; o índice do último dia do canal vem só dos observados', () => {
    const ds = rowsToDataset(after, NOW)
    expect(ds.videos.find(v => v.id === 'w')).toMatchObject({ series: [], firstIdx: null, tier: 'semanal' })
    expect(ds.videos.find(v => v.id === 'w')!.unobservedSeries).toHaveLength(2)
    expect(ds.videos.find(v => v.id === 'a')!.unobservedSeries).toBeUndefined()
    expect(ds.channels[0]!.lastIdx).toBe(rowsToDataset(before, NOW).channels[0]!.lastIdx)
  })
  it('views por dia, múltiplo e mediana do canal: iguais com e sem os dados novos', () => {
    const a = createObservatory(rowsToDataset(before, NOW)), b = createObservatory(rowsToDataset(after, NOW))
    expect(b.channelStats('ch1')).toEqual(a.channelStats('ch1'))
    for (const id of ['a', 'w', 'x']) {
      expect(b.video(id)!.vpd).toBe(a.video(id)!.vpd)
      expect(b.video(id)!.vpd7).toBe(a.video(id)!.vpd7)
      expect(b.multiplier(id)).toEqual(a.multiplier(id))
    }
  })
  it('os campos novos só são lidos onde este plano diz: nenhuma tela e nenhum outro módulo do motor os toca', () => {
    const root = 'src', hits: string[] = []
    const walk = (dir: string): void => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name) && /unobservedSeries|tierSpans/.test(readFileSync(p, 'utf8'))) hits.push(p.replace(/\\/g, '/')) } }
    walk(root)
    expect(hits.sort()).toEqual(['src/lib/youtube/observatorio/effect.ts', 'src/lib/youtube/observatorio/load.ts', 'src/lib/youtube/observatorio/series.ts', 'src/lib/youtube/observatorio/types.ts'])
  })
})

describe('Lote 2 (revisão da T16): ramo semanal isolado e faixas de borda', () => {
  const sp2 = (...x: [number, number | null, 'diaria' | 'semanal'][]) => x.map(([from, to, tier]) => ({ from, to, tier }))
  it('vídeo OBSERVADO com faixa semanal: o ramo semanal não vaza para periodRate (weeklyRate aceita, periodRate recusa)', () => {
    const r = rows({ channels: [channel()], videos: [video('a', 10, { series_tier: 'semanal' })], daily: [pt('a', 17, 50_000), pt('a', 24, 57_000)], spans: [span('a', 5, null, 'semanal')] })
    const obs = obsOf(r)
    expect(obs.weeklyRate('a', noon(17), noon(24))).toMatchObject({ weekly: true })
    expect(obs.periodRate('a', noon(17), noon(24)).vpd).toBeNull()
  })
  it('weeklyThroughout: só o PRIMEIRO dia do buraco é semanal -> falso', () => {
    expect(weeklyThroughout({ tierSpans: sp2([10, 15, 'diaria'], [16, 16, 'semanal'], [17, null, 'diaria']) }, 16, 18)).toBe(false)
    expect(weeklyThroughout({ tierSpans: sp2([10, 16, 'semanal'], [17, null, 'diaria']) }, 16, 18)).toBe(false)
  })
  it('weeklyThroughout: só o ÚLTIMO dia do buraco é semanal -> falso', () => {
    expect(weeklyThroughout({ tierSpans: sp2([10, 17, 'diaria'], [18, null, 'semanal']) }, 16, 18)).toBe(false)
    expect(weeklyThroughout({ tierSpans: sp2([10, 17, 'diaria'], [18, 18, 'semanal'], [19, null, 'diaria']) }, 16, 18)).toBe(false)
  })
  it('weeklyRate: buraco que cruza a fronteira diária/semanal no meio é recusado, nos dois sentidos', () => {
    const a = obsOf(rows({ channels: [channel()], videos: [video('a', 10)], daily: [pt('a', 15, 1000), pt('a', 22, 8000)], spans: [span('a', 5, 17, 'diaria'), span('a', 18, null, 'semanal')] }))
    expect(a.weeklyRate('a', noon(15), noon(22))).toMatchObject({ vpd: null, weekly: false })
    const b = obsOf(rows({ channels: [channel()], videos: [video('a', 10)], daily: [pt('a', 15, 1000), pt('a', 22, 8000)], spans: [span('a', 5, 17, 'semanal'), span('a', 18, null, 'diaria')] }))
    expect(b.weeklyRate('a', noon(15), noon(22))).toMatchObject({ vpd: null, weekly: false })
  })
  it('faixas sobrepostas no mesmo dia: só conta como semanal se TODA faixa que o cobre for semanal', () => {
    expect(weeklyThroughout({ tierSpans: sp2([10, null, 'semanal'], [15, 20, 'diaria']) }, 16, 18)).toBe(false)
    expect(weeklyThroughout({ tierSpans: sp2([15, 20, 'diaria'], [10, null, 'semanal']) }, 16, 18)).toBe(false)
    expect(weeklyThroughout({ tierSpans: sp2([10, null, 'semanal'], [12, 30, 'semanal']) }, 16, 18)).toBe(true)
    expect(weeklyThroughout({ tierSpans: sp2([10, 12, 'semanal']) }, 16, 18)).toBe(false) // nenhuma faixa cobre: como hoje
  })
})
