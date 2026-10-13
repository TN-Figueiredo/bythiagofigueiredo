// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { weekSlotOf, dayNumber, addDays } from '@/lib/youtube/competitor-tiers'

const T0 = new Date(Date.now() - 20 * 86_400_000) // 20 dias atrás: nada aqui depende do relógio de parede
const at = (h: number) => new Date(T0.getTime() + h * 3_600_000).toISOString()
const spDate = (iso: string) => new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 10)

describe.skipIf(skipIfNoLocalDb())('A5 E1 e E2: funções das migrations (banco local)', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId = '', otherSite = '', ch = '', v1 = '', v2 = ''
  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    siteId = (await seedSite(sb)).siteId
    otherSite = (await seedSite(sb)).siteId
    ch = (await sb.from('competitor_channels').insert({ site_id: siteId, channel_id: 'UCa5e1e2', channel_name: 'A5' }).select('id').single()).data!.id
    const vids = await sb.from('competitor_videos').insert([
      { competitor_channel_id: ch, video_id: 'a5e1e2vid01', published_at: at(-2400) },
      { competitor_channel_id: ch, video_id: 'a5e1e2vid02', published_at: at(-48) },
    ]).select('id, video_id, view_count, like_count, comment_count, miss_streak')
    expect(vids.error).toBeNull()
    v1 = vids.data!.find(v => v.video_id === 'a5e1e2vid01')!.id
    v2 = vids.data!.find(v => v.video_id === 'a5e1e2vid02')!.id
    // D2: sem o default 0, contagem não informada nasce nula
    expect(vids.data!.every(v => v.view_count === null && v.like_count === null && v.comment_count === null && v.miss_streak === 0)).toBe(true)
  })
  afterAll(async () => {
    const todos = [siteId, otherSite, ...extraSites]
    await sb.from('competitor_channels').delete().in('site_id', todos)
    await sb.from('youtube_quota_usage').delete().in('site_id', todos)
    await sb.from('sites').delete().in('id', todos)
  })
  const open = (video_id: string | null, field: string, value: unknown, hash: string, first: string, win: string | null, precision: string) =>
    ({ video_id, field, value, value_hash: hash, first_seen_at: first, window_start: win, precision })
  const current = async (video: string) => (await sb.from('competitor_field_versions').select('id').eq('video_id', video).eq('is_current', true)).data!.map(r => ({ id: r.id, last_seen_at: at(6) }))

  it('item 5: A, B, A são três versões, uma corrente, e o fecho copia a última leitura boa', async () => {
    expect((await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [open(v1, 'tags', ['a'], 'hA', at(0), null, 'first')] })).data).toEqual({ closed: 0, opened: 1 })
    expect((await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: await current(v1), p_open: [open(v1, 'tags', ['b'], 'hB', at(12), at(6), '6h')] })).data).toEqual({ closed: 1, opened: 1 })
    expect((await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: await current(v1), p_open: [open(v1, 'tags', ['a'], 'hA', at(18), at(12), '6h')] })).error).toBeNull()
    const rows = (await sb.from('competitor_field_versions').select('value_hash, is_current, last_seen_at').eq('video_id', v1).order('id')).data!
    expect(rows.map(r => r.value_hash)).toEqual(['hA', 'hB', 'hA'])
    expect(rows.filter(r => r.is_current)).toHaveLength(1)
    expect(Date.parse(rows[0]!.last_seen_at)).toBe(Date.parse(at(6)))
  })
  it('segunda versão corrente do mesmo campo é recusada, e a chamada inteira não grava nada', async () => {
    const before = (await sb.from('competitor_field_versions').select('*', { count: 'exact', head: true }).eq('competitor_channel_id', ch)).count
    const r = await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [open(v2, 'category_id', '22', 'h22', at(0), null, 'first'), open(v1, 'tags', ['z'], 'hZ', at(20), at(18), '6h')] })
    expect(r.error?.message).toMatch(/duplicate|unique/i)
    expect((await sb.from('competitor_field_versions').select('*', { count: 'exact', head: true }).eq('competitor_channel_id', ch)).count).toBe(before)
  })
  it('vídeo de outro canal na lista: a função lança', async () => {
    const r = await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [open('00000000-0000-4000-8000-000000000001', 'tags', [], 'x', at(0), null, 'first')] })
    expect(r.error?.message).toMatch(/versões abertas/)
  })
  it('campo do canal (video_id nulo) e valor nulo', async () => {
    expect((await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [open(null, 'country', null, 'hnull', at(0), null, 'first')] })).data).toEqual({ closed: 0, opened: 1 })
    expect((await sb.from('competitor_field_versions').select('value').eq('competitor_channel_id', ch).is('video_id', null).single()).data!.value).toBeNull()
  })
  it('raw: abre, troca, e uma corrente por vídeo', async () => {
    expect((await sb.rpc('apply_competitor_raw_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [{ video_id: v1, raw_sha256: 'r1', first_seen_at: at(0), raw: { id: 'x' } }, { video_id: null, raw_sha256: 'rc', first_seen_at: at(0), raw: { id: 'UC' } }] })).data).toEqual({ closed: 0, opened: 2 })
    const cur = (await sb.from('competitor_raw').select('id').eq('video_id', v1).eq('is_current', true)).data!.map(r => ({ id: r.id, last_seen_at: at(24) }))
    expect((await sb.rpc('apply_competitor_raw_plan', { p_site_id: siteId, p_channel_id: ch, p_close: cur, p_open: [{ video_id: v1, raw_sha256: 'r2', first_seen_at: at(48), raw: { id: 'y' } }] })).data).toEqual({ closed: 1, opened: 1 })
  })
  it('item 221: 1ª falta não marca; 2ª marca com a data (São Paulo) da 1ª; vir no meio zera', async () => {
    await sb.rpc('competitor_mark_missing', { p_channel_id: ch, p_video_ids: [v1, v2], p_now: at(0) })
    let rows = (await sb.from('competitor_videos').select('id, miss_streak, missing_since, miss_first_at').in('id', [v1, v2])).data!
    expect(rows.every(r => r.miss_streak === 1 && r.missing_since === null && Date.parse(r.miss_first_at) === Date.parse(at(0)))).toBe(true)
    await sb.from('competitor_videos').update({ miss_streak: 0, miss_first_at: null, missing_since: null, last_seen_at: at(6) }).eq('id', v2) // v2 veio
    const out = (await sb.rpc('competitor_mark_missing', { p_channel_id: ch, p_video_ids: [v1], p_now: at(30) })).data as Array<{ id: string; miss_streak: number; missing_since: string | null }>
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: v1, miss_streak: 2, missing_since: spDate(at(0)) })
    rows = (await sb.from('competitor_videos').select('id, miss_streak, missing_since').eq('id', v2)).data!
    expect(rows[0]).toMatchObject({ miss_streak: 0, missing_since: null })
    await sb.rpc('competitor_mark_missing', { p_channel_id: ch, p_video_ids: [v1], p_now: at(60) })
    expect((await sb.from('competitor_videos').select('miss_streak, missing_since').eq('id', v1).single()).data).toMatchObject({ miss_streak: 3, missing_since: spDate(at(0)) })
  })
  it('item 221, canal: o mesmo', async () => {
    expect(((await sb.rpc('competitor_channel_mark_missing', { p_channel_id: ch, p_now: at(0) })).data as { miss_streak: number; missing_since: string | null })).toMatchObject({ miss_streak: 1, missing_since: null })
    expect(((await sb.rpc('competitor_channel_mark_missing', { p_channel_id: ch, p_now: at(6) })).data as { missing_since: string | null }).missing_since).toBe(spDate(at(0)))
    await sb.from('competitor_channels').update({ miss_streak: 0, miss_first_at: null, missing_since: null }).eq('id', ch)
  })
  it('item 224: 20 somas ao mesmo tempo dão a soma das 20; operations soma por chave e guarda o maior em p_max', async () => {
    const day = spDate(at(0))
    await Promise.all(Array.from({ length: 20 }, (_, i) => sb.rpc('youtube_quota_add', { p_site_id: siteId, p_day: day, p_units: 3, p_add: { competitors: 3 }, p_max: { teto_diario_cortados: i } })))
    const row = (await sb.from('youtube_quota_usage').select('units_used, operations').eq('site_id', siteId).eq('date', day).single()).data!
    expect(row.units_used).toBe(60)
    expect(row.operations).toEqual({ competitors: 60, teto_diario_cortados: 19 })
  })
  it('item 222: troca de faixa grava a linha; sem mudança não escreve; promoção e rebaixamento no mesmo dia deixam UMA linha aberta com a última faixa', async () => {
    const d0 = spDate(at(0)), d5 = spDate(at(120))
    expect((await sb.rpc('apply_competitor_tier_plan', { p_site_id: siteId, p_channel_id: ch, p_changes: [{ video_id: v1, tier: 'semanal' }, { video_id: v2, tier: 'diaria' }], p_today: d0 })).data).toEqual({ changed: 2 })
    expect((await sb.rpc('apply_competitor_tier_plan', { p_site_id: siteId, p_channel_id: ch, p_changes: [{ video_id: v1, tier: 'semanal' }], p_today: spDate(at(24)) })).data).toEqual({ changed: 0 })
    await sb.rpc('apply_competitor_tier_plan', { p_site_id: siteId, p_channel_id: ch, p_changes: [{ video_id: v1, tier: 'diaria' }], p_today: d5 })
    await sb.rpc('apply_competitor_tier_plan', { p_site_id: siteId, p_channel_id: ch, p_changes: [{ video_id: v1, tier: 'semanal' }], p_today: d5 })
    const spans = (await sb.from('competitor_video_tier_spans').select('from_date, to_date, tier').eq('video_id', v1).order('from_date')).data!
    expect(spans).toEqual([{ from_date: d0, to_date: spDate(at(96)), tier: 'semanal' }, { from_date: d5, to_date: null, tier: 'semanal' }])
    expect((await sb.from('competitor_videos').select('series_tier, series_tier_since').eq('id', v1).single()).data).toEqual({ series_tier: 'semanal', series_tier_since: d5 })
  })
  it('as duas provas respondem com todas as chaves, em números', async () => {
    const c = (await sb.rpc('competitor_capture_health', { p_site_id: siteId, p_now: at(7) })).data as Record<string, unknown>
    for (const k of ['videos_vistos_sem_raw', 'canais_vistos_sem_raw', 'canais_vistos_dia_pacifico', 'cota_dia_pacifico', 'videos_ausentes', 'canais_ausentes', 'canais_em_erro_12h', 'canais_em_erro_3d', 'canais_total']) expect(typeof c[k]).toBe('number')
    expect(Object.keys(c)).toHaveLength(9)
    expect(c.videos_ausentes).toBe(1) // v1
    const s = (await sb.rpc('competitor_series_health', { p_site_id: siteId, p_now: at(7) })).data as Record<string, unknown>
    for (const k of ['hora_sp', 'fora_da_prova', 'sem_faixa', 'diaria_sem_ponto_hoje', 'diaria_buracos_3d', 'semanal_atrasados', 'semanal_atrasados_9d', 'semanal_devidos_hoje', 'sem_miniatura_9d', 'diaria_total', 'semanal_total', 'fora_canal_em_erro_3d']) expect(typeof s[k]).toBe('number')
    expect(Object.keys(s)).toHaveLength(13)
    expect(s.fora_da_prova).toBe(1) // v1 ausente fica fora de todas as contas
  })
  it('competitor_channel_removal_impact conta as quatro tabelas novas e mantém as chaves antigas', async () => {
    const r = (await sb.rpc('competitor_channel_removal_impact', { p_site_id: siteId, p_channel_id: ch })).data as Record<string, unknown>
    expect(r).toMatchObject({ status: 'ok', videos: 2 })
    for (const k of ['pinned', 'versions', 'daily_days', 'bookmarks', 'field_versions', 'raw', 'early', 'tier_spans']) expect(typeof r[k]).toBe('number')
  })

  // ───────────────────────────────────────────────────────────────────────────────────────────────
  // Casos da emenda e do fecho do portão (roteiros plano-e1-e2-emenda-prova.sql e plano-e1-e2-fecho-prova.sql).
  // As provas contam o site inteiro: cada caso semeia o PRÓPRIO site (os casos acima ficam só com `siteId`).
  // ───────────────────────────────────────────────────────────────────────────────────────────────
  const extraSites: string[] = []
  const fresh = async () => { const s = (await seedSite(sb)).siteId; extraSites.push(s); return s }
  const mkCh = async (site: string, tag: string, extra: Record<string, unknown> = {}) => {
    const r = await sb.from('competitor_channels').insert({ site_id: site, channel_id: `UC${tag}`, channel_name: tag, ...extra }).select('id').single()
    expect(r.error).toBeNull()
    return r.data!.id as string
  }
  const mkVid = async (channel: string, ytId: string, published = at(-48)) => {
    const r = await sb.from('competitor_videos').insert({ competitor_channel_id: channel, video_id: ytId, published_at: published }).select('id').single()
    expect(r.error).toBeNull()
    return r.data!.id as string
  }
  const call = async (fn: string, args: Record<string, unknown>) => {
    const r = await sb.rpc(fn, args)
    expect(r.error).toBeNull()
    return r.data as Record<string, unknown>
  }
  const today = () => spDate(new Date().toISOString())
  const daysAgo = (n: number) => addDays(today(), -n)
  const hoursAgoIso = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
  const point = (video: string, snap: string, views = 100) => ({ video_id: video, snap_date: snap, views, taken_at: `${snap}T15:00:00Z` })
  const tierPlan = (site: string, channel: string, changes: Array<{ video_id: string; tier: string }>, day: string) =>
    sb.rpc('apply_competitor_tier_plan', { p_site_id: site, p_channel_id: channel, p_changes: changes, p_today: day })
  const countsOf = async (video: string) => {
    const n = async (table: string, col: string) => (await sb.from(table).select('*', { count: 'exact', head: true }).eq(col, video)).count
    return [await n('competitor_videos', 'id'), await n('competitor_video_daily', 'video_id'), await n('competitor_video_versions', 'video_id'), await n('competitor_field_versions', 'video_id'), await n('competitor_raw', 'video_id')]
  }

  it('D-m3: as três funções de plano recusam canal de outro site, e nada é gravado', async () => {
    const site = await fresh()
    const c = await mkCh(site, 'dm3')
    const v = await mkVid(c, 'dm3vid00001')
    const antes = [(await sb.from('competitor_field_versions').select('*', { count: 'exact', head: true }).eq('competitor_channel_id', c)).count, (await sb.from('competitor_raw').select('*', { count: 'exact', head: true }).eq('competitor_channel_id', c)).count, (await sb.from('competitor_video_tier_spans').select('*', { count: 'exact', head: true }).eq('video_id', v)).count]
    const f = await sb.rpc('apply_competitor_field_plan', { p_site_id: otherSite, p_channel_id: c, p_close: [], p_open: [open(v, 'tags', ['a'], 'h', at(0), null, 'first')] })
    const r = await sb.rpc('apply_competitor_raw_plan', { p_site_id: otherSite, p_channel_id: c, p_close: [], p_open: [{ video_id: v, raw_sha256: 'r', first_seen_at: at(0), raw: { id: 'x' } }] })
    const t = await tierPlan(otherSite, c, [{ video_id: v, tier: 'diaria' }], today())
    for (const x of [f, r, t]) expect(x.error?.message).toMatch(/não é do site/)
    const depois = [(await sb.from('competitor_field_versions').select('*', { count: 'exact', head: true }).eq('competitor_channel_id', c)).count, (await sb.from('competitor_raw').select('*', { count: 'exact', head: true }).eq('competitor_channel_id', c)).count, (await sb.from('competitor_video_tier_spans').select('*', { count: 'exact', head: true }).eq('video_id', v)).count]
    expect(depois).toEqual(antes)
    expect(depois).toEqual([0, 0, 0])
  })

  it('D-m4: a 2ª falta 20 minutos depois não conta; 6 horas depois conta, com a data da 1ª', async () => {
    const site = await fresh()
    const c = await mkCh(site, 'dm4')
    const v = await mkVid(c, 'dm4vid00001')
    await sb.rpc('competitor_mark_missing', { p_channel_id: c, p_video_ids: [v], p_now: at(0) })
    await sb.rpc('competitor_mark_missing', { p_channel_id: c, p_video_ids: [v], p_now: at(20 / 60) })
    expect((await sb.from('competitor_videos').select('miss_streak, missing_since').eq('id', v).single()).data).toMatchObject({ miss_streak: 1, missing_since: null })
    const out = (await sb.rpc('competitor_mark_missing', { p_channel_id: c, p_video_ids: [v, v], p_now: at(6) })).data as unknown[]
    expect(out).toHaveLength(1) // id repetido na lista: uma linha só
    expect((await sb.from('competitor_videos').select('miss_streak, missing_since').eq('id', v).single()).data).toMatchObject({ miss_streak: 2, missing_since: spDate(at(0)) })
    await sb.rpc('competitor_channel_mark_missing', { p_channel_id: c, p_now: at(0) })
    await sb.rpc('competitor_channel_mark_missing', { p_channel_id: c, p_now: at(10 / 60) })
    expect((await sb.from('competitor_channels').select('miss_streak, missing_since').eq('id', c).single()).data).toMatchObject({ miss_streak: 1, missing_since: null })
    const ch6 = (await sb.rpc('competitor_channel_mark_missing', { p_channel_id: c, p_now: at(6) })).data as { miss_streak: number; missing_since: string }
    expect(ch6).toMatchObject({ miss_streak: 2, missing_since: spDate(at(0)) })
  })

  it('S-M1: marcar ausência não apaga nada', async () => {
    const site = await fresh()
    const c = await mkCh(site, 'sm1')
    const v = await mkVid(c, 'sm1vid00001')
    expect((await sb.from('competitor_video_daily').insert(point(v, daysAgo(2)))).error).toBeNull()
    expect((await sb.from('competitor_video_versions').insert({ video_id: v, field: 'title', value_text: 't', has_text: true, value_hash: 'h', first_seen_at: at(0), last_seen_at: at(0), precision: 'first' })).error).toBeNull()
    await call('apply_competitor_field_plan', { p_site_id: site, p_channel_id: c, p_close: [], p_open: [open(v, 'tags', ['a'], 'h', at(0), null, 'first')] })
    await call('apply_competitor_raw_plan', { p_site_id: site, p_channel_id: c, p_close: [], p_open: [{ video_id: v, raw_sha256: 'r', first_seen_at: at(0), raw: { id: 'x' } }] })
    const antes = await countsOf(v)
    expect(antes).toEqual([1, 1, 1, 1, 1])
    await sb.rpc('competitor_mark_missing', { p_channel_id: c, p_video_ids: [v], p_now: at(0) })
    await sb.rpc('competitor_mark_missing', { p_channel_id: c, p_video_ids: [v], p_now: at(6) })
    expect(await countsOf(v)).toEqual(antes)
  })

  it('S-I4: a prova da captura enxerga a captura que falhou, e só o que foi lido depois do começo da E1', async () => {
    const site = await fresh()
    const c = await mkCh(site, 'si4', { last_ok_synced_at: hoursAgoIso(1), last_synced_at: hoursAgoIso(1) })
    const a = await mkVid(c, 'si4vid00001'), b = await mkVid(c, 'si4vid00002')
    await sb.from('competitor_videos').update({ last_checked_at: hoursAgoIso(1) }).in('id', [a, b])
    const health = () => call('competitor_capture_health', { p_site_id: site, p_now: new Date().toISOString() })
    // (a) nenhuma resposta guardada no site: o código antigo lendo não conta
    expect(await health()).toMatchObject({ videos_vistos_sem_raw: 0, canais_vistos_sem_raw: 0 })
    // (b) a E1 começou há 30 min (resposta do canal): o vídeo conferido antes disso não conta
    await call('apply_competitor_raw_plan', { p_site_id: site, p_channel_id: c, p_close: [], p_open: [{ video_id: null, raw_sha256: 'rc', first_seen_at: hoursAgoIso(0.5), raw: { id: 'UC' } }] })
    expect(await health()).toMatchObject({ videos_vistos_sem_raw: 0 })
    // (c) vídeo conferido DEPOIS do começo da E1, sem resposta e sem last_seen_at: a captura falhou
    await sb.from('competitor_videos').update({ last_checked_at: hoursAgoIso(5 / 60) }).eq('id', b)
    expect(await health()).toMatchObject({ videos_vistos_sem_raw: 1 })
    // (d) com a resposta guardada, volta a 0
    await call('apply_competitor_raw_plan', { p_site_id: site, p_channel_id: c, p_close: [], p_open: [{ video_id: b, raw_sha256: 'r2', first_seen_at: new Date().toISOString(), raw: { id: 'b' } }] })
    expect(await health()).toMatchObject({ videos_vistos_sem_raw: 0 })
    // (e) segundo canal que terminou bem há 5 minutos e não tem resposta corrente
    await mkCh(site, 'si4b', { last_ok_synced_at: hoursAgoIso(5 / 60) })
    expect(await health()).toMatchObject({ canais_vistos_sem_raw: 1 })
  })

  it('D-I1: canal em erro há 13 horas conta em 12h e não em 3d; há 4 dias, nos dois; ausente, em nenhum', async () => {
    const site = await fresh()
    const c = await mkCh(site, 'di1')
    const health = () => call('competitor_capture_health', { p_site_id: site, p_now: new Date().toISOString() })
    await sb.from('competitor_channels').update({ sync_status: 'error', sync_error_since: hoursAgoIso(13) }).eq('id', c)
    expect(await health()).toMatchObject({ canais_em_erro_12h: 1, canais_em_erro_3d: 0 })
    await sb.from('competitor_channels').update({ sync_error_since: hoursAgoIso(96) }).eq('id', c)
    expect(await health()).toMatchObject({ canais_em_erro_12h: 1, canais_em_erro_3d: 1 })
    await sb.from('competitor_channels').update({ missing_since: today() }).eq('id', c)
    const last = await health()
    expect(last).toMatchObject({ canais_em_erro_12h: 0, canais_em_erro_3d: 0 })
    expect(Object.keys(last)).toHaveLength(9)
  })

  it('D-I2: estreia agendada sem ponto não é buraco; dia sem ponto depois de um ponto é', async () => {
    const site = await fresh()
    const c = await mkCh(site, 'di2', { last_seen_at: new Date().toISOString(), last_ok_synced_at: new Date().toISOString() })
    const v = await mkVid(c, 'di2vid00001')
    const health = () => call('competitor_series_health', { p_site_id: site, p_now: new Date().toISOString() })
    expect((await tierPlan(site, c, [{ video_id: v, tier: 'diaria' }], daysAgo(3))).error).toBeNull()
    expect(await health()).toMatchObject({ diaria_buracos_3d: 0, diaria_sem_ponto_hoje: 1 })
    expect((await sb.from('competitor_video_daily').insert(point(v, daysAgo(3)))).error).toBeNull()
    expect(await health()).toMatchObject({ diaria_buracos_3d: 2 })
  })

  it('D-I3: semanal aos 7, 8 e 9 dias, e o dia fixo', async () => {
    const site = await fresh()
    const c = await mkCh(site, 'di3', { last_seen_at: new Date().toISOString(), last_ok_synced_at: new Date().toISOString() })
    const v = await mkVid(c, 'di3vid00001')
    const health = () => call('competitor_series_health', { p_site_id: site, p_now: new Date().toISOString() })
    const triple = async () => { const h = await health(); return [h.semanal_devidos_hoje, h.semanal_atrasados, h.semanal_atrasados_9d] }
    expect((await tierPlan(site, c, [{ video_id: v, tier: 'semanal' }], daysAgo(20))).error).toBeNull()
    expect((await sb.from('competitor_video_daily').insert(point(v, daysAgo(7)))).error).toBeNull()
    expect(await triple()).toEqual([1, 0, 0])
    await sb.from('competitor_video_daily').update({ snap_date: daysAgo(8) }).eq('video_id', v)
    expect(await triple()).toEqual([1, 1, 0])
    await sb.from('competitor_video_daily').update({ snap_date: daysAgo(9) }).eq('video_id', v)
    expect(await triple()).toEqual([1, 1, 1])
    await sb.from('competitor_video_daily').insert(point(v, today()))
    expect(await triple()).toEqual([0, 0, 0])
    // ponto há 3 dias: só é devido se hoje for o dia fixo do id (weekSlotOf/dayNumber do TypeScript)
    await sb.from('competitor_video_daily').delete().eq('video_id', v)
    await sb.from('competitor_video_daily').insert(point(v, daysAgo(3)))
    const slotToday = dayNumber(today()) % 7
    const ids = Array.from({ length: 200 }, (_, g) => `emfix${g}`)
    const fixo = ids.find(id => weekSlotOf(id) === slotToday)!
    const outro = ids.find(id => weekSlotOf(id) !== slotToday)!
    await sb.from('competitor_videos').update({ video_id: outro }).eq('id', v)
    expect((await health()).semanal_devidos_hoje).toBe(0)
    await sb.from('competitor_videos').update({ video_id: fixo }).eq('id', v)
    expect((await health()).semanal_devidos_hoje).toBe(1)
    // sem contagem de views: sai das três contas e entra em fora_da_prova
    await sb.from('competitor_videos').update({ views_hidden: true }).eq('id', v)
    expect(await health()).toMatchObject({ semanal_devidos_hoje: 0, semanal_atrasados: 0, semanal_atrasados_9d: 0, fora_da_prova: 1 })
  })

  it('D-I4: vídeo com faixa há 9 dias e sem versão de miniatura', async () => {
    const site = await fresh()
    const c = await mkCh(site, 'di4', { last_seen_at: new Date().toISOString(), last_ok_synced_at: new Date().toISOString() })
    const v9 = await mkVid(c, 'di4vid00009'), v3 = await mkVid(c, 'di4vid00003')
    const health = () => call('competitor_series_health', { p_site_id: site, p_now: new Date().toISOString() })
    await tierPlan(site, c, [{ video_id: v9, tier: 'diaria' }], daysAgo(9))
    await tierPlan(site, c, [{ video_id: v3, tier: 'diaria' }], daysAgo(3))
    expect((await health()).sem_miniatura_9d).toBe(1) // só o de 9 dias; o de 3 dias não conta
    expect((await sb.from('competitor_video_versions').insert({ video_id: v9, field: 'thumb', value_text: null, has_text: false, value_hash: 'h', first_seen_at: at(0), last_seen_at: at(0), precision: 'first' })).error).toBeNull()
    expect((await health()).sem_miniatura_9d).toBe(0)
  })

  it('D-I3: weekly_pass_date nasce nula e aceita data', async () => {
    const site = await fresh()
    const c = await mkCh(site, 'di3w')
    expect((await sb.from('competitor_channels').select('weekly_pass_date').eq('id', c).single()).data).toEqual({ weekly_pass_date: null })
    expect((await sb.from('competitor_channels').update({ weekly_pass_date: today() }).eq('id', c)).error).toBeNull()
    expect((await sb.from('competitor_channels').select('weekly_pass_date').eq('id', c).single()).data).toEqual({ weekly_pass_date: today() })
  })

  it('fecho F-1: o vídeo que entra em semanal reabre a passada do canal', async () => {
    const site = await fresh()
    const c1 = await mkCh(site, 'f1a'), c2 = await mkCh(site, 'f1b')
    const v3 = await mkVid(c2, 'fechovid001', at(-7200)), v4 = await mkVid(c2, 'fechovid002', at(-24))
    const hoje = today()
    const stamp = (id: string) => sb.from('competitor_channels').update({ weekly_pass_date: hoje }).eq('id', id)
    const pass = async (id: string) => (await sb.from('competitor_channels').select('weekly_pass_date').eq('id', id).single()).data!.weekly_pass_date
    await stamp(c1); await stamp(c2) // carimbados antes de ter faixa: o dia do deploy
    // (1) a primeira classificação reabre
    expect((await tierPlan(site, c2, [{ video_id: v3, tier: 'semanal' }, { video_id: v4, tier: 'diaria' }], hoje)).data).toEqual({ changed: 2 })
    expect(await pass(c2)).toBeNull()
    expect(await pass(c1)).toBe(hoje) // o carimbo de OUTRO canal não é tocado
    // (2) a mesma chamada de novo: changed 0, o carimbo fica
    await stamp(c2)
    expect((await tierPlan(site, c2, [{ video_id: v3, tier: 'semanal' }, { video_id: v4, tier: 'diaria' }], hoje)).data).toEqual({ changed: 0 })
    expect(await pass(c2)).toBe(hoje)
    // (3) promoção (semanal para diária): o carimbo fica
    expect((await tierPlan(site, c2, [{ video_id: v3, tier: 'diaria' }], hoje)).data).toEqual({ changed: 1 })
    expect(await pass(c2)).toBe(hoje)
    // (4) rebaixamento (diária para semanal): reabre
    expect((await tierPlan(site, c2, [{ video_id: v3, tier: 'semanal' }], hoje)).data).toEqual({ changed: 1 })
    expect(await pass(c2)).toBeNull()
    // (5) canal já nulo: outra entrada em semanal passa sem erro
    const r5 = await tierPlan(site, c2, [{ video_id: v4, tier: 'semanal' }], hoje)
    expect(r5.error).toBeNull()
    expect(r5.data).toEqual({ changed: 1 })
    expect(await pass(c2)).toBeNull()
    // uma linha aberta por vídeo, com a última faixa; as trocas do mesmo dia não duplicam
    const spans = (await sb.from('competitor_video_tier_spans').select('video_id, to_date, tier').in('video_id', [v3, v4])).data!
    expect(spans).toHaveLength(2)
    expect(spans.every(s => s.to_date === null && s.tier === 'semanal')).toBe(true)
  })

  it('fecho F-2: vídeo semanal pedido e não devolvido não conta como devido', async () => {
    const site = await fresh()
    const c = await mkCh(site, 'f2', { last_seen_at: new Date().toISOString(), last_ok_synced_at: new Date().toISOString() })
    const slotToday = dayNumber(today()) % 7
    const fixo = Array.from({ length: 200 }, (_, g) => `emfix${g}`).find(id => weekSlotOf(id) === slotToday)!
    const v = await mkVid(c, fixo, at(-7200))
    await tierPlan(site, c, [{ video_id: v, tier: 'semanal' }], daysAgo(20))
    await sb.from('competitor_video_daily').insert(point(v, daysAgo(3)))
    const health = () => call('competitor_series_health', { p_site_id: site, p_now: new Date().toISOString() })
    expect((await health()).semanal_devidos_hoje).toBe(1)
    await sb.from('competitor_videos').update({ miss_streak: 1, miss_first_at: new Date().toISOString() }).eq('id', v)
    expect(await health()).toMatchObject({ semanal_devidos_hoje: 0, fora_da_prova: 0 }) // uma falta não é ausência
    await sb.from('competitor_videos').update({ miss_streak: 0, miss_first_at: null }).eq('id', v)
    expect((await health()).semanal_devidos_hoje).toBe(1)
  })

  // PARIDADE do dia fixo da semana: competitor-tiers.ts (weekSlotOf: 4 primeiros bytes do sha256 do id, módulo 7;
  // dayNumber: dias desde 1970) contra o SQL da MG2 (competitor_series_health.semanal_devidos_hoje). O SQL não expõe
  // a conta numa função chamável, então compara pelo efeito: por data, marca como `semanal` só o conjunto S que o
  // TypeScript diz ser devido (todos com último ponto há 3 dias, para só o dia fixo valer); a prova tem de contar
  // |S| devidos. Depois marca só o complemento: tem de contar 0. Os dois juntos dão a igualdade EXATA dos conjuntos.
  it('paridade do dia fixo: TypeScript e SQL escolhem os mesmos vídeos (70 ids, 3 datas)', async () => {
    const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
    // ids pseudoaleatórios determinísticos: bytes do sha256 de um contador, mapeados no alfabeto do YouTube
    const idDe = (n: number) => Array.from(createHash('sha256').update(`paridade-${n}`).digest().subarray(0, 11), b => alfabeto[b % 64]).join('')
    const ytIds = new Set<string>(['-AbCdEfGh_1', '_____-----a', '0123456789a', 'dQw4w9WgXcQ'])
    for (let n = 0; ytIds.size < 70; n++) ytIds.add(idDe(n))
    const lista = [...ytIds].map(id => id.slice(0, 11))
    expect(new Set(lista).size).toBe(lista.length)
    const site = await fresh()
    const c = await mkCh(site, 'paridade', { last_seen_at: new Date().toISOString(), last_ok_synced_at: new Date().toISOString() })
    const ins = await sb.from('competitor_videos').insert(lista.map(id => ({ competitor_channel_id: c, video_id: id, published_at: at(-7200), series_tier: 'diaria', series_tier_since: daysAgo(30) }))).select('id, video_id')
    expect(ins.error).toBeNull()
    const idOf = new Map(ins.data!.map(r => [r.video_id as string, r.id as string]))
    expect(idOf.size).toBe(lista.length)
    const datas = [daysAgo(1), daysAgo(2), daysAgo(3)]
    expect(new Set(datas.map(d => dayNumber(d) % 7)).size).toBe(3) // três dias fixos diferentes
    for (const d of datas) {
      const slot = dayNumber(d) % 7
      const S = lista.filter(id => weekSlotOf(id) === slot)
      const resto = lista.filter(id => weekSlotOf(id) !== slot)
      expect(S.length).toBeGreaterThan(0)
      expect(resto.length).toBeGreaterThan(0)
      await sb.from('competitor_video_daily').delete().in('video_id', [...idOf.values()])
      expect((await sb.from('competitor_video_daily').insert([...idOf.values()].map(v => point(v, addDays(d, -3))))).error).toBeNull()
      const pNow = `${d}T15:00:00Z` // 12:00 em São Paulo: o dia de SP é `d`
      const marca = async (semanais: string[], diarias: string[]) => {
        await sb.from('competitor_videos').update({ series_tier: 'semanal', series_tier_since: addDays(d, -20) }).in('id', semanais.map(i => idOf.get(i)!))
        await sb.from('competitor_videos').update({ series_tier: 'diaria' }).in('id', diarias.map(i => idOf.get(i)!))
        return call('competitor_series_health', { p_site_id: site, p_now: pNow })
      }
      const h1 = await marca(S, resto)
      expect(h1).toMatchObject({ hoje: d, semanal_total: S.length, semanal_devidos_hoje: S.length })
      const h2 = await marca(resto, S)
      expect(h2).toMatchObject({ hoje: d, semanal_total: resto.length, semanal_devidos_hoje: 0 })
    }
  })
})
