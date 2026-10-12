// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fakeSupabase } from '../../helpers/fake-supabase'
import { buildTables, ids } from './load-fixture'
import { loadRows, loadLiveRows, rowsToDataset, type ObservatoryRows, type VersionRow } from '@/lib/youtube/observatorio/load'
import { loadChannelRows, assembleRows } from '@/lib/youtube/observatorio/load-channel'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'

const NOW = Date.now(), DAY = 864e5, S = 'a'
const byId = <T extends { id?: string }>(xs: T[]) => [...xs].sort((x, y) => String(x.id).localeCompare(String(y.id)))

async function viaChannels(tables = buildTables({ siteId: S, now: NOW }), now = NOW) {
  const db = fakeSupabase(tables)
  const { seriesStartAt, ...live } = await loadLiveRows(db.client, S, now)
  const parts = []
  for (const c of live.channels) parts.push(await loadChannelRows(db.client, { channelId: c.id, videoLimit: c.video_limit, seriesStart: seriesStartAt, now }))
  return { db, rows: assembleRows(live, parts, seriesStartAt, now) }
}
/** What the whole-site loader returns, in the form the per-channel loader returns it. */
function comparable(rows: ObservatoryRows) {
  const descCount = new Map<string, number>()
  for (const v of rows.versions) if (v.field === 'desc') descCount.set(v.video_id, (descCount.get(v.video_id) ?? 0) + 1)
  const version = (v: VersionRow) => (v.field === 'desc' && descCount.get(v.video_id) === 1 ? { ...v, value_text: null, text_omitted: true } : v)
  return {
    ...rows,
    videos: byId(rows.videos), versions: byId(rows.versions.map(version)), snapshots: byId(rows.snapshots),
    daily: [...rows.daily].map(d => ({ video_id: d.video_id, snap_date: d.snap_date, views: d.views, taken_at: d.taken_at })).sort((x, y) => (x.video_id + x.snap_date).localeCompare(y.video_id + y.snap_date)),
  }
}

describe('leitura por canal', () => {
  it('canal sem vídeo: listas vazias em 2 idas, sem consulta por lista vazia', async () => {
    const tables = buildTables({ siteId: S, now: NOW, channels: 1, videosPerChannel: 0 })
    const db = fakeSupabase(tables)
    const out = await loadChannelRows(db.client, { channelId: ids.channel(S, 0), videoLimit: 3, seriesStart: null, now: NOW })
    expect(out.videos).toEqual([]); expect(out.versions).toEqual([]); expect(out.daily).toEqual([])
    expect(out.snapshots.length).toBeGreaterThan(0)
    expect(db.trips).toEqual(expect.arrayContaining(['competitor_videos', 'competitor_channel_snapshots']))
    expect(db.trips).toHaveLength(2)
  })
  it('montado por canal é igual ao carregador do site inteiro', async () => {
    const tables = buildTables({ siteId: S, now: NOW })
    const whole = await loadRows({ siteId: S, now: NOW, supabase: fakeSupabase(tables).client })
    const { rows } = await viaChannels(tables)
    expect(comparable(rows)).toEqual(comparable(whole))
  })
  it('série não iniciada: mesma igualdade', async () => {
    const tables = buildTables({ siteId: S, now: NOW, seriesStarted: false })
    const whole = await loadRows({ siteId: S, now: NOW, supabase: fakeSupabase(tables).client })
    expect(comparable((await viaChannels(tables)).rows)).toEqual(comparable(whole))
  })
  it('vídeo fixado fora do limite: mesma igualdade, o diário dele vem e o conjunto o marca como fixado', async () => {
    const tables = buildTables({ siteId: S, now: NOW, pinOldest: true })
    const whole = await loadRows({ siteId: S, now: NOW, supabase: fakeSupabase(tables).client })
    const { rows } = await viaChannels(tables)
    expect(comparable(rows)).toEqual(comparable(whole))
    const pinned = ids.video(S, 0, 3)
    expect(rows.daily.filter(d => d.video_id === pinned)).toHaveLength(6)
    const ds = rowsToDataset(rows, NOW)
    expect(ds.videos.find(v => v.id === pinned)).toMatchObject({ pinned: true, tracked: false })
    expect(ds.videos.find(v => v.id === pinned)!.series).toHaveLength(6)
    expect(ds.channels.find(c => c.id === ids.channel(S, 0))!.pinnedCount).toBe(1)
  })
  it('só os acompanhados têm diário, e sem as colunas que o motor não lê', async () => {
    const { rows, db } = await viaChannels()
    expect(new Set(rows.daily.map(d => d.video_id)).size).toBe(2 * 3)
    expect(Object.keys(rows.daily[0]!).sort()).toEqual(['snap_date', 'taken_at', 'video_id', 'views'])
    expect(db.selects.filter(s => s.table === 'competitor_video_daily').every(s => !s.cols.includes('likes'))).toBe(true)
  })
  it('a leitura dos vídeos pede pinned_at', async () => {
    const { db } = await viaChannels()
    const sel = db.selects.filter(s => s.table === 'competitor_videos')
    expect(sel.length).toBeGreaterThan(0)
    expect(sel.every(s => s.cols.includes('pinned_at'))).toBe(true)
  })
  it('descrição que nunca mudou: o texto não é pedido ao banco', async () => {
    const { rows, db } = await viaChannels()
    const single = rows.versions.find(v => v.id === ids.video(S, 0, 1) + '-d1')!
    expect(single).toMatchObject({ value_text: null, text_omitted: true, has_text: true })
    const descSelects = db.selects.filter(s => s.table === 'competitor_video_versions')
    expect(descSelects.some(s => !s.cols.includes('value_text'))).toBe(true)
  })
  it('descrição que mudou: as duas versões chegam com o texto', async () => {
    const { rows } = await viaChannels()
    const v0 = ids.video(S, 0, 0)
    const pair = rows.versions.filter(v => v.video_id === v0 && v.field === 'desc')
    expect(pair).toHaveLength(2)
    expect(pair.every(v => typeof v.value_text === 'string' && !v.text_omitted)).toBe(true)
  })
  it('a troca de descrição mostra a comparação no motor, em Mudanças e no histórico', async () => {
    const { rows } = await viaChannels()
    const obs = createObservatory(rowsToDataset(rows, NOW)), v0 = ids.video(S, 0, 0)
    const change = obs.changes.find(c => c.video === v0 && c.type === 'desc')!
    expect(change.hasText).toBe(true)
    expect(change.diff!.lines.some(l => l.op === 'add' && l.text === 'linha três')).toBe(true)
    const mud = JSON.stringify(buildMudancasView(obs, { niche: 'todos' }, new Set()))
    expect(mud).toContain('linha três')
    expect(mud).not.toContain('o texto não foi arquivado')
    const hist = buildHistoricoView(obs, v0, { niche: 'todos' })
    expect(hist.versions).not.toBeNull()
    expect(hist.versions!.descs.diffs).toHaveLength(1)
    expect(JSON.stringify(hist.versions!.descs.diffs)).toContain('linha três')
  })
  it('descrição única no histórico não vira "texto não guardado"', async () => {
    const { rows } = await viaChannels()
    const obs = createObservatory(rowsToDataset(rows, NOW))
    const hist = buildHistoricoView(obs, ids.video(S, 0, 1), { niche: 'todos' })
    expect(hist.versions).not.toBeNull()
    expect(JSON.stringify(hist)).not.toContain('texto não guardado')
  })
  it('descrição com troca que chega sem o texto: erro alto, nunca comparação vazia', async () => {
    const { rows } = await viaChannels()
    const v0 = ids.video(S, 0, 0)
    const broken = { ...rows, versions: rows.versions.map(v => (v.video_id === v0 && v.field === 'desc' ? { ...v, value_text: null, text_omitted: true } : v)) }
    expect(() => rowsToDataset(broken, NOW)).toThrow(/descrição com troca chegou sem o texto/)
  })
  it('as janelas de data são reaplicadas com o relógio do render', async () => {
    const tables = buildTables({ siteId: S, now: NOW })
    const db = fakeSupabase(tables)
    const { seriesStartAt, ...live } = await loadLiveRows(db.client, S, NOW)
    const parts = [await loadChannelRows(db.client, { channelId: ids.channel(S, 0), videoLimit: 3, seriesStart: seriesStartAt, now: NOW })]
    expect(assembleRows(live, parts, seriesStartAt, NOW).snapshots.length).toBeGreaterThan(0)
    expect(assembleRows(live, parts, seriesStartAt, NOW + 91 * DAY).snapshots).toEqual([])
    expect(assembleRows(live, parts, seriesStartAt, NOW - 2 * DAY).daily.every(d => d.snap_date <= new Date(NOW - 2 * DAY - 3 * 36e5).toISOString().slice(0, 10))).toBe(true)
  })
  it('A5: os dois carregadores leem a série de TODO vídeo datado e as faixas, e dão o mesmo conjunto', async () => {
    const db = fakeSupabase(buildTables({ siteId: 'a', now: NOW, channels: 1, videosPerChannel: 6, limit: 2, days: 14, weekly: true }))
    const site = await loadRows({ siteId: 'a', now: NOW, supabase: db.client })
    const one = await loadChannelRows(db.client, { channelId: ids.channel('a', 0), videoLimit: 2, seriesStart: NOW - 14 * 864e5, now: NOW })
    const untracked = ids.video('a', 0, 5)
    expect(site.daily.some(d => d.video_id === untracked)).toBe(true)
    expect(one.daily.map(d => d.video_id + d.snap_date).sort()).toEqual(site.daily.map(d => d.video_id + d.snap_date).sort())
    expect(one.spans).toHaveLength(6)
    expect([...site.spans!].sort((x, y) => x.video_id.localeCompare(y.video_id))).toEqual([...one.spans].sort((x, y) => x.video_id.localeCompare(y.video_id)))
    const ds = rowsToDataset(site, NOW)
    expect(ds.videos.find(v => v.id === untracked)).toMatchObject({ series: [], tier: 'semanal' })
    expect(ds.videos.find(v => v.id === untracked)!.unobservedSeries!.length).toBeGreaterThan(0)
  })
  it('A5: as colunas lidas incluem series_tier e as faixas; sem weekly o conjunto de linhas dos observados não muda', async () => {
    const { db, rows } = await viaChannels()
    expect(db.selects.filter(s => s.table === 'competitor_videos').every(s => s.cols.endsWith(', series_tier'))).toBe(true)
    expect(db.selects.filter(s => s.table === 'competitor_video_tier_spans').map(s => s.cols)).toEqual(['video_id, from_date, to_date, tier', 'video_id, from_date, to_date, tier'])
    expect(rows.spans).toEqual([])
    expect(rows.weeklyOmitted).toBeUndefined()
  })
  it('A5: mais de 1.000 linhas de série e de faixa: tudo chega (leitura paginada), nos dois carregadores', async () => {
    // 1.200 vídeos: a série (1.200 vídeos x vários pontos) e as faixas passam de 1.000 linhas por lote de ids
    const tables = buildTables({ siteId: 'a', now: NOW, channels: 1, videosPerChannel: 1200, limit: 2, days: 14, weekly: true })
    const expectedDaily = tables.competitor_video_daily!.length
    expect(expectedDaily).toBeGreaterThan(2000)
    // e UM vídeo com mais de 1.000 faixas, para que a própria leitura das faixas tenha de paginar
    const crowded = ids.video('a', 0, 7)
    for (let i = 0; i < 1100; i++) tables.competitor_video_tier_spans!.push({ video_id: crowded, from_date: '2025-01-01', to_date: null, tier: 'semanal', n: i })
    const db = fakeSupabase(tables)
    const site = await loadRows({ siteId: 'a', now: NOW, supabase: db.client })
    const one = await loadChannelRows(db.client, { channelId: ids.channel('a', 0), videoLimit: 2, seriesStart: NOW - 14 * 864e5, now: NOW })
    for (const rows of [site, one]) {
      expect(rows.daily).toHaveLength(expectedDaily)
      expect(rows.spans).toHaveLength(1200 + 1100)
      expect(new Set(rows.daily.map(d => d.video_id)).size).toBe(1200)
    }
    expect(db.ranges.some(r => r.table === 'competitor_video_tier_spans' && r.range != null && r.range[0] >= 1000)).toBe(true)
  })
  it('A5: o DIÁRIO passa de 1.000 linhas num único lote de ids (40 vídeos): tudo chega, nos dois carregadores', async () => {
    const tables = buildTables({ siteId: 'a', now: NOW, channels: 1, videosPerChannel: 40, limit: 40, days: 30, weekly: true })
    const expectedDaily = tables.competitor_video_daily!.length
    expect(expectedDaily).toBeGreaterThan(1000)
    const db = fakeSupabase(tables)
    const site = await loadRows({ siteId: 'a', now: NOW, supabase: db.client })
    const one = await loadChannelRows(db.client, { channelId: ids.channel('a', 0), videoLimit: 40, seriesStart: NOW - 30 * 864e5, now: NOW })
    for (const rows of [site, one]) {
      expect(rows.daily).toHaveLength(expectedDaily)
      expect(new Set(rows.daily.map(d => d.video_id)).size).toBe(40)
    }
    expect(db.ranges.some(r => r.table === 'competitor_video_daily' && r.range != null && r.range[0] >= 1000)).toBe(true)
  })
  describe('A5: a leitura das faixas ou da coluna series_tier falha (o banco ainda sem a migration): a tela recebe erro, nunca um conjunto vazio em verde', () => {
    const NO_COLUMN = { code: '42703', message: 'column competitor_videos.series_tier does not exist' }
    /** O banco de verdade, salvo `competitor_videos`: lá a leitura devolve o erro de coluna que não existe. */
    function withoutSeriesTier(tables: ReturnType<typeof buildTables>) {
      const db = fakeSupabase(tables)
      const chain: object = new Proxy({}, { get: (_t, p) => (p === 'then' ? undefined : p === 'range' ? async () => ({ data: null, error: NO_COLUMN }) : () => chain) })
      return { from: (table: string) => (table === 'competitor_videos' ? chain : db.client.from(table)) } as unknown as Parameters<typeof loadChannelRows>[0]
    }
    it('tabela de faixas indisponível: lança com o nome da tabela, no site inteiro e por canal', async () => {
      const db = fakeSupabase(buildTables({ siteId: S, now: NOW, weekly: true }), { failOn: 'competitor_video_tier_spans' })
      await expect(loadRows({ siteId: S, now: NOW, supabase: db.client })).rejects.toThrow(/competitor_video_tier_spans/)
      await expect(loadChannelRows(db.client, { channelId: ids.channel(S, 0), videoLimit: 3, seriesStart: null, now: NOW })).rejects.toThrow(/competitor_video_tier_spans/)
    })
    it('coluna series_tier ausente: lança ObservatoryLoadError 42703 em competitor_videos, no site inteiro e por canal', async () => {
      const client = withoutSeriesTier(buildTables({ siteId: S, now: NOW }))
      await expect(loadRows({ siteId: S, now: NOW, supabase: client })).rejects.toMatchObject({ name: 'ObservatoryLoadError', table: 'competitor_videos', code: '42703' })
      await expect(loadChannelRows(client, { channelId: ids.channel(S, 0), videoLimit: 3, seriesStart: null, now: NOW })).rejects.toMatchObject({ name: 'ObservatoryLoadError', table: 'competitor_videos', code: '42703' })
    })
  })
  it('erro numa tabela pesada é lançado com o nome da tabela', async () => {
    const db = fakeSupabase(buildTables({ siteId: S, now: NOW }), { failOn: 'competitor_video_daily' })
    await expect(loadChannelRows(db.client, { channelId: ids.channel(S, 0), videoLimit: 3, seriesStart: null, now: NOW })).rejects.toThrow(/competitor_video_daily/)
  })
})
