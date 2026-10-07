// @vitest-environment node
// apps/web/test/youtube/observatorio/historico-untracked.test.ts — R117 / R120 / fixado no histórico.
import { describe, it, expect } from 'vitest'
import { rowsToDataset, type ObservatoryRows, type ChannelRow, type VideoRow, type VersionRow, type DailyRow } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'

const DAY = 864e5, H = 36e5
const sp = (iso: string) => Date.parse(iso + '-03:00')
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = sp('2026-10-24T15:02:00') // handed to the engine as a parameter; never compared with the wall clock
const SERIES = '2026-10-05T09:00:00-03:00'
const PUB = sp('2026-08-01T10:00:00')

function rows(o: Partial<ObservatoryRows> = {}): ObservatoryRows {
  return { settings: null, channels: [], ownChannels: [], videos: [], ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null, ...o }
}
const channel = (o: Partial<ChannelRow> = {}): ChannelRow => ({
  id: 'ch1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 10,
  youtube_video_count: 300, sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: iso(NOW - 2 * H), last_synced_at: iso(NOW - 2 * H),
  full_sync_completed_at: null, added_at: iso(sp('2026-09-01T10:00:00')), ...o,
})
const video = (o: Partial<VideoRow> = {}): VideoRow => ({
  id: 'v1', competitor_channel_id: 'ch1', video_id: 'yt1', title: 'Um título', view_count: 1000, like_count: 10, comment_count: 1, duration_seconds: 600,
  published_at: iso(NOW - 10 * DAY), is_short: false, last_checked_at: iso(NOW - 2 * H), tags: null, thumbnail_url: null, pinned_at: null, ...o,
})
const version = (o: Partial<VersionRow> = {}): VersionRow => ({
  id: 'ver1', video_id: 'b', field: 'title', value_text: 'Um', value_hash: 'h1', has_text: true, thumb_blob_url: null,
  first_seen_at: iso(sp('2026-10-06T09:00:00')), last_seen_at: iso(sp('2026-10-12T03:00:00')), window_start: null, precision: 'first', is_current: true, ...o,
})
const daily = (video_id: string, snap_date: string, views: number): DailyRow => ({ video_id, snap_date, views, likes: null, comments: null, taken_at: snap_date + 'T15:00:00Z' })

/** Two stored titles of `b`: "Um" (first seen 06/10 09:00), then "Dois" (seen 12/10 09:00, window from 03:00), last checked 20/10 06:00. */
const TWO: VersionRow[] = [
  version({ id: 'b1', is_current: false }),
  version({ id: 'b2', value_text: 'Dois', value_hash: 'h2', first_seen_at: iso(sp('2026-10-12T09:00:00')), window_start: iso(sp('2026-10-12T03:00:00')), precision: '6h', last_seen_at: iso(sp('2026-10-20T06:00:00')) }),
]
const FIVE_DAYS = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'].map((d, i) => daily('b', d, 5000 + i * 100))
/** Channel with video_limit 10: n0…n9 are the tracked ones; `b` (published 01/08) is outside them. */
const build = (o: { pinned?: boolean; pinnedAt?: number; checked?: string | null; versions?: VersionRow[]; daily?: DailyRow[]; channel?: Partial<ChannelRow> } = {}) => createObservatory(rowsToDataset(rows({
  settings: { series_started_at: SERIES, channel_limit: 75 }, channels: [channel(o.channel)],
  videos: [
    ...Array.from({ length: 10 }, (_, i) => video({ id: 'n' + i, video_id: 'yn' + i, published_at: iso(NOW - (i + 1) * DAY) })),
    video({ id: 'b', video_id: 'yb', title: 'Dois', view_count: 7_654_321, published_at: iso(PUB), pinned_at: o.pinned ? iso(o.pinnedAt ?? NOW - 2 * DAY) : null, ...(o.checked !== undefined ? { last_checked_at: o.checked } : {}) }),
  ],
  versions: o.versions ?? [], daily: o.daily ?? [],
  heartbeat: { last_poll_at: iso(NOW - 60_000), capabilities: ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas', 'leitura-video'] },
}), NOW))
const NOTICE = 'Este vídeo está fora dos 10 mais recentes acompanhados de Canal Um. Mostramos o histórico de títulos, thumbnails e descrições guardado. O gráfico de views só aparece para vídeos acompanhados ou fixados.'

describe('R117: vídeo fora dos observados com versões guardadas', () => {
  const v = buildHistoricoView(build({ versions: TWO }), 'b', {})
  it('sem gráfico e sem comparação, mas com faixas e seção de versões', () => {
    expect(v.state).toBe('untr')
    expect(v.chart).toBeNull()
    expect(v.comparisons).toEqual([])
    expect(v.defaultPair).toBeNull()
    expect(v.lanes.map(l => l.type)).toEqual(['title', 'thumb', 'desc'])
    const titles = v.lanes.find(l => l.type === 'title')!
    expect(titles.versions.map(x => x.clipText)).toEqual(['Um', 'Dois'])
    expect(titles.markers).toHaveLength(1)
    expect(titles.markers[0]!.pairK).toBeNull()
    expect(v.versions!.titles.items).toHaveLength(2)
    expect(v.header!.counts).toEqual([])
  })
  it('o aviso diz o que é mostrado, sem data inventada; a frase da tela de hoje não muda', () => {
    expect(v.untracked!.notice).toBe(NOTICE)
    expect(v.untracked!.text).toMatch(/os mais recentes; este ficou de fora/)
    expect(v.untracked!.href).toContain('channel=ch1')
  })
  it('a versão corrente termina na última conferência, nunca em "agora"', () => {
    const cur = v.lanes.find(l => l.type === 'title')!.versions[1]!
    expect(cur.to).toBe('até 20/10 06:00 (última conferência)')
    expect(cur.tag).toEqual({ kind: 'now', text: 'último visto' })
    expect(cur.atLeast).toBe(true)
    expect(JSON.stringify(v.lanes)).not.toMatch(/agora|no ar/)
  })
  it('as faixas têm eixo próprio: da primeira versão vista à última conferência', () => {
    const h = (ms: number) => (ms - PUB) / H
    expect(v.lanesAxis).toEqual({
      fromH: h(sp('2026-10-06T09:00:00')), toH: h(sp('2026-10-20T06:00:00')),
      ticks: [{ h: h(sp('2026-10-06T09:00:00')), label: '06/10 09:00' }, { h: h(sp('2026-10-12T09:00:00')), label: '12/10 09:00' }, { h: h(sp('2026-10-20T06:00:00')), label: '20/10 06:00' }],
    })
    expect(v.legends['']!.some(l => l.kind === 'win')).toBe(true)
  })
  it('nenhum texto sai com NaN, undefined ou objeto', () => {
    expect(JSON.stringify(v)).not.toMatch(/NaN|undefined|\[object Object\]/)
  })
  it('D11: a contagem de views gravada está congelada e não aparece em campo nenhum da view', () => {
    expect(v.header!.views).toEqual({ num: null, text: 'contagem de views não acompanhada' })
    expect(JSON.stringify(v)).not.toMatch(/7[.,]?654[.,]?321/)
  })
  it('a forja continua recusando: não há série para ler', () => {
    expect(JSON.stringify([v.forja, v.forjaCard])).toContain('Vídeo fora dos acompanhados')
  })
  it('o estado de fixar acompanha a view: não fixado, 0 de RULES.pinLimit', () => {
    expect(v.pin).toEqual({ pinned: false, used: 0, limit: RULES.pinLimit, state: null, note: null })
  })
})

describe('R117: vídeo fora dos observados SEM versão guardada (o dado não existe)', () => {
  const v = buildHistoricoView(build(), 'b', {})
  it('continua com a frase honesta de hoje, sem aviso de histórico, sem faixas', () => {
    expect(v.state).toBe('untr')
    expect(v.chart).toBeNull()
    expect(v.lanes).toEqual([])
    expect(v.versions).toBeNull()
    expect(v.lanesAxis).toBeNull()
    expect(v.untracked!.notice).toBeNull()
    expect(v.untracked!.text).toMatch(/sem versões de título, thumbnail ou descrição para mostrar\.$/)
  })
})

describe('R120: desafixar deixa o histórico à mostra', () => {
  it('um vídeo que tinha registro diário e foi desafixado cai no mesmo estado do R117', () => {
    // unpinned: the loader no longer reads its daily record, so the dataset has no series for it
    const v = buildHistoricoView(build({ pinned: false, versions: TWO }), 'b', {})
    expect(v.state).toBe('untr')
    expect(v.untracked!.notice).toBe(NOTICE)
    expect(v.versions!.titles.items).toHaveLength(2)
  })
})

describe('D13: vídeo antigo recém-fixado, antes da primeira conferência', () => {
  const PIN = NOW - 30 * 60_000, MIN = 60_000
  const NOTE = 'Fixado agora. A primeira conferência acontece em até 6 h.'
  const pending = build({ pinned: true, pinnedAt: PIN, checked: iso(PIN - MIN), versions: TWO })
  const v = buildHistoricoView(pending, 'b', {})
  it('conferência 1 min antes de fixar: estado explícito e a frase, sem afirmar nada sobre agora', () => {
    expect(v.pin).toEqual({ pinned: true, used: 1, limit: RULES.pinLimit, state: 'aguardando-primeira', note: NOTE })
    expect(v.state).not.toBe('untr')
    expect(v.untracked).toBeNull()
    const cur = v.lanes.find(l => l.type === 'title')!.versions[1]!
    expect(cur.to).toBe('até 20/10 06:00 (última conferência)') // the real last time this version was seen
    expect(cur.tag).toEqual({ kind: 'now', text: 'último visto' })
    expect(cur.atLeast).toBe(true)
    expect(JSON.stringify([v.lanes, v.versions])).not.toMatch(/agora|no ar/)
    expect(JSON.stringify(v)).not.toContain('conferidos a cada sincronização')
  })
  it('as versões guardadas de antes continuam com as datas reais delas', () => {
    const first = v.lanes.find(l => l.type === 'title')!.versions[0]!
    expect(first.clipText).toBe('Um')
    expect(first.to).toBe(buildHistoricoView(build({ versions: TWO }), 'b', {}).lanes.find(l => l.type === 'title')!.versions[0]!.to)
    expect(v.versions!.titles.items).toHaveLength(2)
  })
  it('sem número de views: o gravado é de antes de fixar', () => {
    expect(v.header!.views).toEqual({ num: null, text: 'contagem de views na primeira conferência' })
    expect(JSON.stringify(v)).not.toMatch(/7[.,]?654[.,]?321/)
  })
  it('sem troca nenhuma, o texto que explica a conferência é a frase de recém-fixado', () => {
    const one = buildHistoricoView(build({ pinned: true, pinnedAt: PIN, checked: iso(PIN - MIN), versions: [TWO[0]!] }), 'b', {})
    expect(one.compareEmpty).toMatch(/^Fixado agora\. A primeira conferência acontece em até 6 h\./)
    expect(one.versions!.titles.same).toBe('Sem troca de título vista até 12/10 03:00, a última conferência deste vídeo.')
  })
  it('canal em erro ou atrasado: a frase não promete prazo (a conferência depende da sincronização voltar)', () => {
    const LATER = 'Fixado agora. A primeira conferência acontece na próxima sincronização do canal.'
    const inError = buildHistoricoView(build({ pinned: true, pinnedAt: PIN, checked: iso(PIN - MIN), versions: [TWO[0]!], channel: { sync_status: 'error', sync_error: 'YouTube API 500', sync_error_since: iso(NOW - 3 * H) } }), 'b', {})
    expect(inError.pin).toMatchObject({ state: 'aguardando-primeira', note: LATER })
    expect(inError.compareEmpty).toMatch(/^Fixado agora\. A primeira conferência acontece na próxima sincronização do canal\./)
    // late: the last good sync is older than RULES.syncLateHours (12 h)
    const late = buildHistoricoView(build({ pinned: true, pinnedAt: PIN, checked: iso(PIN - MIN), versions: TWO, channel: { last_ok_synced_at: iso(NOW - 20 * H), last_synced_at: iso(NOW - 20 * H) } }), 'b', {})
    expect(late.pin!.note).toBe(LATER)
    expect(JSON.stringify(late)).not.toContain('em até 6 h')
    // and the ok channel keeps the deadline
    expect(v.pin!.note).toBe(NOTE)
  })
  it('canal que nunca sincronizou (o dado não existe): também sem a promessa de 6 h, e nada sai como NaN', () => {
    const x = buildHistoricoView(build({ pinned: true, pinnedAt: PIN, checked: null, versions: TWO, channel: { last_ok_synced_at: null, last_synced_at: null } }), 'b', {})
    expect(x.pin).toMatchObject({ state: 'aguardando-primeira', note: 'Fixado agora. A primeira conferência acontece na próxima sincronização do canal.' })
    expect(JSON.stringify(x)).not.toMatch(/NaN|undefined|\[object Object\]|em até 6 h/)
  })
  it('last_checked_at nulo e canal sincronizado antes de fixar: também aguardando', () => {
    // channel() in this file syncs at NOW − 2 h; pinning 30 min ago is after that
    expect(buildHistoricoView(build({ pinned: true, pinnedAt: PIN, checked: null, versions: TWO }), 'b', {}).pin!.state).toBe('aguardando-primeira')
  })
  it('conferência 1 min depois de fixar: ativo, sem a frase, e as views saem com a data da conferência (D15)', () => {
    const obs = build({ pinned: true, pinnedAt: PIN, checked: iso(PIN + MIN), versions: TWO })
    const a = buildHistoricoView(obs, 'b', {})
    expect(a.pin).toEqual({ pinned: true, used: 1, limit: RULES.pinLimit, state: 'ativo', note: null })
    expect(a.header!.views).toEqual({ num: obs.fmt.num(7_654_321), text: ' views em 24/10 14:33' }) // PIN + 1 min = 15:02 − 29 min
    expect(a.lanes.find(l => l.type === 'title')!.versions[1]!.to).toBe('agora')
  })
})

describe('A2: fixado que o YouTube não devolveu (sem-resposta)', () => {
  const PIN = NOW - 5 * H, MIN = 60_000
  const GONE = 'Fixado. O YouTube não devolveu este vídeo na última sincronização; ele pode ter sido apagado ou ficado privado.'
  // channel() syncs ok at NOW − 2 h, after the pin; the video's own check is from before the pin
  const v = buildHistoricoView(build({ pinned: true, pinnedAt: PIN, checked: iso(PIN - MIN), versions: TWO }), 'b', {})
  it('estado explícito e a frase própria, sem promessa de prazo', () => {
    expect(v.pin).toEqual({ pinned: true, used: 1, limit: RULES.pinLimit, state: 'sem-resposta', note: GONE })
    expect(v.state).not.toBe('untr')
    expect(JSON.stringify(v)).not.toMatch(/em até 6 h|próxima sincronização do canal|primeira conferência|conferidos a cada sincronização/)
  })
  it('as versões guardadas terminam na última vez em que foram vistas, com a data real, nunca em "agora"', () => {
    const cur = v.lanes.find(l => l.type === 'title')!.versions[1]!
    expect(cur.to).toBe('até 20/10 06:00 (última conferência)')
    expect(cur.tag).toEqual({ kind: 'now', text: 'último visto' })
    expect(JSON.stringify([v.lanes, v.versions])).not.toMatch(/agora|no ar/)
    expect(v.versions!.titles.items).toHaveLength(2)
  })
  it('sem número de views: o gravado é de antes de fixar e ninguém o conferiu', () => {
    expect(v.header!.views).toEqual({ num: null, text: 'contagem de views não conferida' })
    expect(JSON.stringify(v)).not.toMatch(/7[.,]?654[.,]?321/)
  })
  it('sem troca nenhuma, o texto que explica a conferência é a frase do sem-resposta', () => {
    const one = buildHistoricoView(build({ pinned: true, pinnedAt: PIN, checked: iso(PIN - MIN), versions: [TWO[0]!] }), 'b', {})
    expect(one.compareEmpty!.startsWith(GONE)).toBe(true)
  })
  it('last_checked_at nulo com canal sincronizado depois de fixar: também sem-resposta, nunca ativo', () => {
    const x = buildHistoricoView(build({ pinned: true, pinnedAt: PIN, checked: null, versions: TWO }), 'b', {})
    expect(x.pin!.state).toBe('sem-resposta')
    expect(x.header!.views.num).toBeNull()
  })
  it('o vídeo volta a ser devolvido (conferência depois de fixar): ativo, sem a frase', () => {
    expect(buildHistoricoView(build({ pinned: true, pinnedAt: PIN, checked: iso(NOW - 2 * H), versions: TWO }), 'b', {}).pin).toMatchObject({ state: 'ativo', note: null })
  })
})

describe('D14: hora sempre como DD/MM HH:MM nos textos novos', () => {
  it('aviso, estado de fixar, eixo das faixas e views não usam a forma "12h"', () => {
    const PIN = NOW - 30 * 60_000
    for (const obs of [build({ versions: TWO }), build({ pinned: true, pinnedAt: PIN, checked: iso(PIN - 60_000), versions: TWO }), build({ pinned: true, pinnedAt: PIN, checked: iso(PIN + 60_000), versions: TWO })]) {
      const v = buildHistoricoView(obs, 'b', {})
      const cur = v.lanes.find(l => l.type === 'title')!.versions[1]!
      expect(JSON.stringify([v.untracked, v.pin, v.lanesAxis, v.header!.views, cur.to])).not.toMatch(/\d{2}h\b/)
    }
  })
})

describe('vídeo fixado antigo', () => {
  const obs = build({ pinned: true, versions: TWO, daily: FIVE_DAYS })
  const v = buildHistoricoView(obs, 'b', { from: 'canais' })
  it('tem gráfico, faixas no eixo do gráfico e contagens no cabeçalho', () => {
    expect(['full', 'pre']).toContain(v.state)
    expect(v.untracked).toBeNull()
    expect(v.lanesAxis).toBeNull()
    expect(v.chart).not.toBeNull()
    expect(v.chart!.points.length).toBeGreaterThan(0)
    expect(v.header!.counts.map(c => c.type)).toEqual(['title', 'thumb', 'desc'])
    expect(v.header!.views.num).not.toBeNull() // observed: the count is kept fresh by the sync (Task 2), so it is shown
    expect(v.lanes.find(l => l.type === 'title')!.versions[1]!.to).toBe('agora')
  })
  it('A4: o "N de 10" conta os fixados do canal no banco, inclusive o que não tem published_at (fora do conjunto)', () => {
    const o2 = createObservatory(rowsToDataset(rows({
      settings: { series_started_at: SERIES, channel_limit: 75 }, channels: [channel()],
      videos: [
        video({ id: 'n0', video_id: 'yn0', published_at: iso(NOW - DAY) }),
        video({ id: 'b', video_id: 'yb', published_at: iso(PUB), pinned_at: iso(NOW - 2 * DAY) }),
        video({ id: 'semdata', video_id: 'ys', published_at: null, pinned_at: iso(NOW - 2 * DAY) }),
      ],
    }), NOW))
    expect(o2.video('semdata')).toBeUndefined()
    expect(buildHistoricoView(o2, 'b', {}).pin!.used).toBe(2)
  })
  it('está no paginador de Canais, depois dos N mais recentes', () => {
    expect(v.pager!.position).toBe('vídeo 11 de 11 de Canal Um (longos acompanhados, do mais novo ao mais antigo)')
    expect(buildHistoricoView(obs, 'n9', { from: 'canais' }).pager!.next).toBe(obs.link.historico('b', { from: 'canais' }))
  })
  it('a forja não o recusa por estar fora dos acompanhados', () => {
    expect(JSON.stringify([v.forja, v.forjaCard])).not.toContain('Vídeo fora dos acompanhados')
  })
  it('o estado de fixar: fixado, 1 de RULES.pinLimit', () => {
    expect(v.pin).toEqual({ pinned: true, used: 1, limit: RULES.pinLimit, state: 'ativo', note: null })
  })
})
