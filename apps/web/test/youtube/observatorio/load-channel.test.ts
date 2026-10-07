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
  it('erro numa tabela pesada é lançado com o nome da tabela', async () => {
    const db = fakeSupabase(buildTables({ siteId: S, now: NOW }), { failOn: 'competitor_video_daily' })
    await expect(loadChannelRows(db.client, { channelId: ids.channel(S, 0), videoLimit: 3, seriesStart: null, now: NOW })).rejects.toThrow(/competitor_video_daily/)
  })
})
