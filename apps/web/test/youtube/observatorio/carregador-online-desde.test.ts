// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { throw new Error('não usado') } }))
import { dailyReadFrom, dailyCappedFrom, rowsToDataset } from '@/lib/youtube/observatorio/load'
import { assembleRows } from '@/lib/youtube/observatorio/load-channel'
import { viewsAtAge } from '@/lib/youtube/observatorio/series'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { OnlineDesde } from '@/lib/youtube/observatorio/arquivo-mensal/online-desde'
import * as Sentry from '@sentry/nextjs'
import { fakeSupabase } from '../../helpers/fake-supabase'
import { buildTables, ids } from './load-fixture'
import { loadLiveRows, loadChannelLiveRows } from '@/lib/youtube/observatorio/load'
import { _esquecerAvisos } from '@/lib/youtube/observatorio/arquivo-mensal/online-desde'
import { rows, channel, video, daily, iso, ctxDe } from './helpers/fabrica-load'

const DIA = 86_400_000
const SS = Date.parse('2026-10-03T03:00:00Z')           // seriesStart: começo da coleta
const OD = Date.parse('2027-05-01T03:00:00Z')           // online desde da diária
const AGORA = Date.parse('2027-06-10T15:00:00Z')
const dias = (de: string, ate: string) => { const r: string[] = []; for (let t = Date.parse(de); t <= Date.parse(ate); t += DIA) r.push(new Date(t).toISOString().slice(0, 10)); return r }
const odDe = (od: number | null | 'nao-lido'): OnlineDesde => od === 'nao-lido' ? { lido: false, porque: 'erro_do_banco' } : { lido: true, porTabela: { competitor_video_daily: od, competitor_video_early: od, competitor_video_hourly: null } }
const comOd = (od: number | null | 'nao-lido') => rows({
  settings: { series_started_at: iso(SS), channel_limit: 75 }, channels: [channel()],
  videos: [video({ id: 'cortado', video_id: 'vid-cortado', published_at: iso(Date.parse('2026-10-10T12:00:00Z')) })],
  daily: dias('2027-05-01', '2027-06-10').map((d, i) => daily('cortado', d, 1000 + i * 10)),
  onlineDesde: odDe(od),
})

describe('carregador com online desde', () => {
  it('a leitura da diária não espera o online desde: sempre a véspera do começo', () => {
    expect(dailyReadFrom(SS)).toBe('2026-10-02')
    expect(dailyReadFrom(SS - 900 * DIA)).toBe(new Date(SS - 901 * DIA).toISOString().slice(0, 10)) // nunca recorta em 365
  })
  it('nada saiu: nenhum corte', () => { expect(dailyCappedFrom(SS, null)).toBeNull() })
  it('online desde depois do começo: marca o corte nele', () => { expect(dailyCappedFrom(SS, OD)).toBe(OD) })
  it('online desde antes da véspera do começo: não corta', () => { expect(dailyCappedFrom(SS, SS - 5 * DIA)).toBeNull() })
  it('item 34: vídeo publicado antes do corte → truncated; 14 dias de vídeo cortado é nulo', () => {
    const ds = rowsToDataset(comOd(OD), AGORA)
    const v = ds.videos.find(x => x.ytId === 'vid-cortado')!
    expect(v.truncated).toBe(true)
    expect(ds.dailyCappedFrom).toBe(OD)
    expect(viewsAtAge(ctxDe(ds), v, 14 * DIA, null)).toBeNull()
  })
  it('item 34: dentro da série online a média existe (controle positivo)', () => {
    const ds = rowsToDataset(comOd(OD), AGORA)
    const v = ds.videos.find(x => x.ytId === 'vid-cortado')!
    const idade = Date.parse('2027-05-20T15:00:00Z') - v.pub
    expect(viewsAtAge(ctxDe(ds), v, idade, null)).not.toBeNull()
  })
  it('item 81: com o corte o vídeo antigo é truncated; sem o corte (nada saiu) não é', () => {
    const sem = rowsToDataset(comOd(null), AGORA).videos.find(x => x.ytId === 'vid-cortado')!
    expect(sem.truncated).toBeUndefined()
  })
  it('Review Focus 1: online desde não lido → Dataset diz não lido, nenhum vídeo truncated, nada assume 365', () => {
    const ds = rowsToDataset(comOd('nao-lido'), AGORA)
    expect(ds.onlineDesde).toEqual({ lido: false, porque: 'erro_do_banco' })
    expect(ds.dailyCappedFrom).toBeNull()
    expect(ds.videos.some(v => v.truncated)).toBe(false)
  })
  it('Review Focus 2: viewsAtAge antes do primeiro ponto é nulo, incondicionalmente, nunca extrapolado', () => {
    const ds = rowsToDataset(comOd(OD), AGORA)
    const v = ds.videos.find(x => x.ytId === 'vid-cortado')!
    expect(viewsAtAge(ctxDe(ds), v, 2 * DIA, null)).toBeNull()
  })
  it('sem onlineDesde nas linhas (o golden e o oracle): o Dataset não ganha a chave', () => {
    const r = comOd(null) as { onlineDesde?: unknown }; delete r.onlineDesde
    expect('onlineDesde' in rowsToDataset(r as never, AGORA)).toBe(false)
  })
  it('assembleRows descarta as linhas do pacote anteriores ao online desde', () => {
    const base = comOd(OD)
    const live = { ...base, videos: undefined, daily: undefined } as never
    const parts = [{ videos: base.videos, versions: [], snapshots: [], spans: [], daily: [daily('cortado', '2027-04-15', 500), ...base.daily] }]
    const out = assembleRows(live, parts as never, SS, AGORA)
    expect(out.daily.some(d => d.snap_date === '2027-04-15')).toBe(false)
    expect(out.daily.some(d => d.snap_date === '2027-05-01')).toBe(true)
    expect(out.onlineDesde).toEqual(odDe(OD))
  })
  it('expectedCurve: vídeo cortado sai da curva dos demais, que fica igual', () => {
    const outro = video({ id: 'novo', video_id: 'vid-novo', published_at: iso(Date.parse('2027-05-02T12:00:00Z')) })
    const dn = dias('2027-05-02', '2027-06-10').map((d, i) => daily('novo', d, 10 + i * 5))
    const base = comOd(OD)
    const com = rowsToDataset({ ...base, videos: [...base.videos, outro], daily: [...base.daily, ...dn] }, AGORA)
    const sem = rowsToDataset({ ...base, videos: [outro], daily: dn }, AGORA)
    const curva = (ds: typeof com) => JSON.stringify(createObservatory(ds).expectedCurve('novo'))
    expect(curva(com)).toBe(curva(sem))
  })
})

const linhaRpc = (t: string, d: string | null) => ({ class: t === 'competitor_video_hourly' ? 'horaria' : 'serie', table_name: t, online_since: d, divergencia: false })
const rpcCom = (d: string | null) => ({ obs_archive_online_since: { data: ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'].map(t => linhaRpc(t, d)), error: null } })
const AGORA_V = Date.now()
describe('fiação: o resultado do RPC chega ao retorno do carregador (Yannis I-3)', () => {
  beforeEach(() => { vi.mocked(Sentry.captureMessage).mockClear(); _esquecerAvisos() })
  const esperado = { lido: true, porTabela: { competitor_video_daily: Date.parse('2027-05-01T03:00:00Z'), competitor_video_early: Date.parse('2027-05-01T03:00:00Z'), competitor_video_hourly: Date.parse('2027-05-01T03:00:00Z') } }
  it('loadLiveRows devolve a chave onlineDesde com o que o RPC respondeu, e o RPC recebe o siteId', async () => {
    const db = fakeSupabase(buildTables({ siteId: 'a', now: AGORA_V }), { rpc: rpcCom('2027-05-01') })
    const live = await loadLiveRows(db.client, 'a', AGORA_V)
    expect(live).toHaveProperty('onlineDesde')
    expect(live.onlineDesde).toStrictEqual(esperado)
    expect(db.rpcArgs).toStrictEqual([{ fn: 'obs_archive_online_since', args: { p_site: 'a' } }])
  })
  it('loadChannelLiveRows devolve o mesmo', async () => {
    const db = fakeSupabase(buildTables({ siteId: 'a', now: AGORA_V }), { rpc: rpcCom('2027-05-01') })
    const live = await loadChannelLiveRows(db.client, 'a', ids.channel('a', 0), AGORA_V)
    expect(live).not.toBeNull()
    expect(live).toHaveProperty('onlineDesde')
    expect(live!.onlineDesde).toStrictEqual(esperado)
    expect(db.rpcArgs).toStrictEqual([{ fn: 'obs_archive_online_since', args: { p_site: 'a' } }])
  })
  it('RPC com falha: onlineDesde não lido, a página não cai', async () => {
    const db = fakeSupabase(buildTables({ siteId: 'a', now: AGORA_V }), { rpc: rpcCom(null), failOn: 'rpc:obs_archive_online_since' })
    const live = await loadLiveRows(db.client, 'a', AGORA_V)
    expect(live.onlineDesde).toStrictEqual({ lido: false, porque: 'erro_do_banco' })
    expect(rowsToDataset({ ...comOd(null), onlineDesde: live.onlineDesde }, AGORA).dailyCappedFrom).toBeNull()
  })
  it('rpc não simulada lança no fake (nunca devolve o payload de outra função)', async () => {
    const db = fakeSupabase({})
    await expect(db.client.rpc('obs_archive_pagina' as never)).rejects.toThrow(/não simulada/)
  })
})

describe('alarme de série longa sem saída (Phil M4, Yannis m-4)', () => {
  beforeEach(() => { vi.mocked(Sentry.captureMessage).mockClear(); _esquecerAvisos() })
  const com = (diasDeSerie: number) => { const t = buildTables({ siteId: 'a', now: AGORA_V }); t.competitor_settings = t.competitor_settings!.map(r => ({ ...r, series_started_at: new Date(AGORA_V - diasDeSerie * DIA).toISOString() })); return fakeSupabase(t, { rpc: rpcCom(null) }) }
  it('301 dias e nada saiu: avisa 1× mesmo com várias leituras', async () => {
    for (let i = 0; i < 3; i++) await loadLiveRows(com(301).client, 'a', AGORA_V)
    expect(vi.mocked(Sentry.captureMessage).mock.calls.filter(c => String(c[0]).includes('mais de 300 dias'))).toHaveLength(1)
  })
  it('299 dias: não avisa', async () => {
    await loadLiveRows(com(299).client, 'a', AGORA_V)
    expect(vi.mocked(Sentry.captureMessage).mock.calls.filter(c => String(c[0]).includes('mais de 300 dias'))).toHaveLength(0)
  })
})
