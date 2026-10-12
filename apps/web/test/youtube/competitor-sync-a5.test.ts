// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/youtube/thumb-fingerprint', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/thumb-fingerprint')>()),
  probeThumb: vi.fn(),
  archiveThumb: vi.fn(async () => 'https://blob.test/t.jpg'),
}))

import { syncCompetitorChannel, syncCompetitorWeekly, syncStatsOf, VIDEO_PARTS, WeeklyVersionError } from '@/lib/youtube/competitor-sync'
import { probeThumb, archiveThumb } from '@/lib/youtube/thumb-fingerprint'
import { createNotification } from '@/lib/notifications/create'
import { dayNumber, addDays, weekSlotOf } from '@/lib/youtube/competitor-tiers'
import { hashValue } from '@/lib/youtube/competitor-versions'
import { fieldHash, rawOf } from '@/lib/youtube/competitor-capture'
import { setup, apiFetch, traced, rpcs, updatesOf, rpcCalls, first, arg, type Call, NOW, NOW_ISO, EARLY, ch, recent, quiet, SINAIS, SNIPPET0, type SetupOpts } from './competitor-sync-harness'

beforeEach(() => {
  vi.mocked(probeThumb).mockReset()
  vi.mocked(probeThumb).mockResolvedValue({ etag: null, lastModified: null, dhash: null, bytes: null, url: 'u' })
})

const OLD = new Date(NOW.getTime() - 400 * 86_400_000).toISOString()
const page = (over: Record<string, unknown> = {}) => ({ id: 'vid-1', snippet: { title: 'T', description: '', publishedAt: recent(), tags: ['a'], categoryId: '19' }, statistics: { viewCount: '7', likeCount: '1', commentCount: '2' }, contentDetails: { duration: 'PT10M' }, ...over })
const ROW1 = { id: 'v-1', video_id: 'vid-1', title: 'T', description_hash: 'x', thumbnail_url: null, view_count: 1, is_short: false }
const PIN = { id: 'v-pin', video_id: 'vid-pin', title: 'Fixado', thumbnail_url: null }
const inserts = (db: ReturnType<typeof setup>) => db.calls.filter(c => c.table === 'competitor_videos' && first(c) === 'insert').map(c => arg(c, 'insert')!)

// Auxiliares das provas de série (faixas e leitura semanal): uma linha de vídeo do canal como a leitura paginada a devolve, e a resposta de videos.list que repete os ids pedidos.
const row = (i: number, ageDays: number, over: Record<string, unknown> = {}) => ({ id: 'v-' + i, video_id: 'vid-' + i, title: 'T' + i, thumbnail_url: null, published_at: new Date(NOW.getTime() - ageDays * 86_400_000).toISOString(), pinned_at: null, daily_until: null, series_tier: null, series_tier_since: null, last_seen_at: null, missing_since: null, views_hidden: null, live_broadcast_content: null, discovered_at: null, ...over })
const idsOf = (u: string) => decodeURIComponent(u.match(/[?&]id=([^&]*)/)![1]!).split(',')
const echo = (_n: number, u: string) => idsOf(u).map(id => ({ id, snippet: { title: 'T' + id.slice(4) }, statistics: { viewCount: '5', likeCount: '1', commentCount: '0' }, contentDetails: { duration: 'PT10M' } }))

describe('A5 E1: partes pedidas e a linha do vídeo', () => {
  it('toda chamada videos.list pede as quatro partes, e nenhuma chamada é acrescentada (D1)', async () => {
    setup({ lastDaily: '2026-10-23', existing: [ROW1] })
    const t1 = traced(apiFetch(page()))
    const r1 = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: t1.f, ...quiet })
    expect(t1.api()).toEqual(['channels?part=contentDetails,snippet,statistics&id=UC_test', 'playlistItems?part=snippet&playlistId=UU&maxResults=50', 'videos?part=' + VIDEO_PARTS + '&id=vid-1', 'videos?part=' + VIDEO_PARTS + '&id=vid-1'])
    expect(r1.unitsUsed).toBe(4)
    setup({ pinned: [PIN], existing: [ROW1] })
    const t2 = traced(apiFetch(page(), 200, { daily: () => [{ id: 'vid-pin', snippet: { title: 'Fixado', publishedAt: OLD }, statistics: { viewCount: '3' } }] }))
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: t2.f, ...quiet })
    expect(t2.api().at(-1)).toBe('videos?part=' + VIDEO_PARTS + '&id=vid-pin')
  })
  it('item 6: sem commentCount → comment_count nulo e comments_disabled; nenhuma gravação de 0 vinda de ausência', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ statistics: { viewCount: '7', likeCount: '1' } })), ...quiet })
    expect(updatesOf(db, 'v-1').at(-1)).toMatchObject({ comment_count: null, comments_disabled: true, like_count: 1, likes_hidden: false, view_count: 7, views_hidden: false })
    expect(db.calls.some(c => c.table === 'competitor_videos' && (arg(c, 'update')?.comment_count === 0 || arg(c, 'insert')?.comment_count === 0))).toBe(false)
  })
  it('item 8: liveStreamingDetails vira was_live e os horários; sem ele, was_live false', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ liveStreamingDetails: { actualStartTime: '2026-10-20T10:00:00Z', actualEndTime: '2026-10-20T11:00:00Z' } })), ...quiet })
    expect(updatesOf(db, 'v-1').at(-1)).toMatchObject({ was_live: true, live_actual_start_at: '2026-10-20T10:00:00Z', live_actual_end_at: '2026-10-20T11:00:00Z', live_scheduled_start_at: null })
    const db2 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    expect(updatesOf(db2, 'v-1').at(-1)).toMatchObject({ was_live: false })
  })
  it('vídeo novo nasce com discovered_at = agora e com os sinalizadores; vídeo que já existia nunca recebe discovered_at', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ statistics: { viewCount: '7' } })), ...quiet })
    expect(inserts(db)[0]).toMatchObject({ video_id: 'vid-1', discovered_at: EARLY.toISOString(), view_count: 7, like_count: null, likes_hidden: true, comment_count: null, comments_disabled: true, was_live: false })
    const db2 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    expect(updatesOf(db2, 'v-1').every(u => !('discovered_at' in u))).toBe(true)
  })
  it('a passada diária regrava a linha de todo vídeo que veio, fixado ou não, e só uma vez por sincronização', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked: [{ id: 'v-1', video_id: 'vid-1', title: 'T', thumbnail_url: null }, { id: 'v-2', video_id: 'vid-2', title: 'Outro', thumbnail_url: null }] })
    const ids = (u: string) => decodeURIComponent(u.match(/[?&]id=([^&]*)/)![1]!).split(',')
    await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).map(id => ({ id, statistics: { viewCount: '5', likeCount: '1', commentCount: '0' } })) }), ...quiet })
    expect(updatesOf(db, 'v-2')).toEqual([{ ...SINAIS, last_checked_at: NOW_ISO, view_count: 5, like_count: 1, comment_count: 0, views_hidden: false, likes_hidden: false, comments_disabled: false }])
    expect(updatesOf(db, 'v-1')).toHaveLength(1) // veio na página e de novo na passada: uma gravação só
  })
  it('falha em verde fechada: erro ao gravar a linha do vídeo lança e o canal fica em erro', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1], failUpdateOf: 'v-1' })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })).rejects.toThrow(/não foi possível atualizar a linha do vídeo/)
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)).toMatchObject({ sync_status: 'error' })
  })
  it('resposta sem a parte statistics: a contagem gravada não é tocada, e a execução conta a parte que faltou', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const { statistics: _s, ...noStats } = page()
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(noStats), ...quiet })
    expect('view_count' in updatesOf(db, 'v-1').at(-1)!).toBe(false)
    expect(r.partsMissing).toBe(1)
  })
})

describe('A5 E1 (emenda S-I5, S-M2): erro de gravação não custa a série do dia; resposta sem snippet', () => {
  it('erro ao regravar a linha de um vídeo: os outros são regravados, a série do dia é gravada, e o canal termina em erro com a frase em português', async () => {
    const tracked = ['v-1', 'v-2', 'v-3'].map((id, i) => ({ id, video_id: 'vid-' + (i + 1), title: 'T', thumbnail_url: null }))
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked, failUpdateOf: 'v-2' })
    const ids = (u: string) => decodeURIComponent(u.match(/[?&]id=([^&]*)/)![1]!).split(',')
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).map(id => ({ id, statistics: { viewCount: '5', likeCount: '1', commentCount: '0' } })) }), ...quiet })).rejects.toThrow(/não foi possível atualizar a linha do vídeo/)
    const dailyRows = db.calls.filter(c => c.table === 'competitor_video_daily' && first(c) === 'upsert').flatMap(c => c.ops[0]![1][0] as Array<{ video_id: string }>)
    expect(dailyRows.map(r => r.video_id).sort()).toEqual(['v-1', 'v-2', 'v-3'])
    expect(updatesOf(db, 'v-3')).toEqual([{ ...SINAIS, last_checked_at: NOW_ISO, view_count: 5, like_count: 1, comment_count: 0, views_hidden: false, likes_hidden: false, comments_disabled: false }])
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)).toMatchObject({ sync_status: 'error', sync_error: expect.stringMatching(/não foi possível atualizar a linha do vídeo/) })
  })
  it('resposta sem snippet: a linha do vídeo não perde tags, categoria nem miniatura', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const { snippet: _sn, ...noSnippet } = page()
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(noSnippet), ...quiet })
    const body = updatesOf(db, 'v-1').at(-1)!
    expect('tags' in body).toBe(false)
    expect('category_id' in body).toBe(false)
    expect('thumbnail_url' in body).toBe(false)
    const db2 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    // snippet presente mas sem miniatura utilizável: a coluna gravada também fica (a chave não entra)
    const body2 = updatesOf(db2, 'v-1').at(-1)!
    expect(body2).toMatchObject({ tags: ['a'], category_id: '19' })
    expect('thumbnail_url' in body2).toBe(false)
  })
})

describe('A5 E1: captura (campos e raw)', () => {
  const opened = (db: ReturnType<typeof setup>) => rpcCalls(db, 'apply_competitor_field_plan').flatMap(a => a.p_open as Array<Record<string, unknown>>)
  const rawOpened = (db: ReturnType<typeof setup>) => rpcCalls(db, 'apply_competitor_raw_plan').flatMap(a => a.p_open as Array<Record<string, unknown>>)
  it('itens 1 e 2: primeira leitura abre os 7 campos e o raw do canal, e os campos e o raw de cada vídeo, tudo "first"', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    const f = opened(db)
    expect(f.filter(x => x.video_id === null).map(x => x.field).sort()).toEqual(['availability', 'avatar_url', 'country', 'custom_url', 'description', 'name', 'subscribers_hidden'])
    expect(f.filter(x => x.video_id === 'v-1').map(x => x.field).sort()).toEqual(['availability', 'category_id', 'comments_disabled', 'default_audio_language', 'default_language', 'duration_seconds', 'likes_hidden', 'live_broadcast_content', 'tags', 'views_hidden'])
    expect(f.every(x => x.precision === 'first' && x.window_start === null)).toBe(true)
    expect(rawOpened(db).map(x => x.video_id)).toEqual([null, 'v-1'])
    // 7 do canal + 10 do vídeo (o plano dizia 16: contagem errada)
    expect(r).toMatchObject({ fieldsOpened: 17, rawOpened: 2 })
  })
  it('itens 3 e 223: segunda rodada sem mudança no YouTube → ZERO gravações em field_versions e em raw', async () => {
    const chItem = { id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { subscriberCount: '10' } }
    const first1 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    // o que a 1ª rodada abriu vira o estado gravado da 2ª
    const fields = opened(first1).map((o, i) => ({ id: i + 1, video_id: o.video_id, field: o.field, value_hash: o.value_hash }))
    const raws = [{ id: 1, video_id: null, raw_sha256: rawOf(chItem).sha }, { id: 2, video_id: 'v-1', raw_sha256: rawOf(page()).sha }]
    const db = setup({ lastDaily: '2026-10-24', existing: [{ ...ROW1, last_seen_at: EARLY.toISOString() }], fields, raws })
    const r = await syncCompetitorChannel(ch, 'k', { now: new Date(EARLY.getTime() + 3_600_000), fetchImpl: apiFetch(page({ statistics: { viewCount: '99999', likeCount: '50', commentCount: '9' } })), ...quiet })
    expect(rpcCalls(db, 'apply_competitor_field_plan')).toEqual([])
    expect(rpcCalls(db, 'apply_competitor_raw_plan')).toEqual([])
    expect(db.calls.filter(c => c.table === 'competitor_field_versions' || c.table === 'competitor_raw').every(c => first(c) === 'select')).toBe(true)
    expect(r.fieldsOpened ?? 0).toBe(0)
  })
  it('item 4: mudou uma tag → uma versão de tags, com a janela na leitura anterior do vídeo, e a antiga fechada com essa data', async () => {
    const prev = '2026-10-24T03:00:00.000Z'
    const db = setup({ lastDaily: '2026-10-24', existing: [{ ...ROW1, last_seen_at: prev }], fields: [{ id: 41, video_id: 'v-1', field: 'tags', value_hash: fieldHash(['a']) }] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, tags: ['b'] } })), ...quiet })
    const plan = rpcCalls(db, 'apply_competitor_field_plan').find(a => (a.p_open as Array<{ field: string }>).some(o => o.field === 'tags'))!
    expect(plan.p_close).toEqual([{ id: 41, last_seen_at: prev }])
    expect((plan.p_open as Array<Record<string, unknown>>).find(o => o.field === 'tags')).toMatchObject({ value: ['b'], window_start: prev, precision: '6h', first_seen_at: EARLY.toISOString() })
  })
  it('o "visto" só é carimbado DEPOIS da captura: se ela falha, last_seen_at não é gravado, a série do dia já foi, a linha do vídeo foi regravada com last_checked_at, e o canal termina em erro', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], rpcFail: 'apply_competitor_field_plan' })
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page()), ...quiet })).rejects.toThrow(/^não foi possível guardar o histórico de campos \(apply_competitor_field_plan: boom\)$/)
    expect(db.calls.some(c => c.table === 'competitor_videos' && 'last_seen_at' in (arg(c, 'update') ?? {}))).toBe(false)
    expect(db.calls.some(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')).toBe(true)
    expect(updatesOf(db, 'v-1').some(u => u.last_checked_at === NOW_ISO)).toBe(true)
    const lastCh = db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)
    expect(lastCh).toMatchObject({ sync_status: 'error' })
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).some(u => u && 'last_ok_synced_at' in u)).toBe(false)
  })
  it('captura bem-sucedida carimba last_seen_at dos vídeos do lote numa gravação só, e o do canal', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    const stamps = db.calls.filter(c => c.table === 'competitor_videos' && first(c) === 'update' && Object.keys(arg(c, 'update') ?? {}).join() === 'last_seen_at')
    expect(stamps).toHaveLength(1)
    expect(stamps[0]!.ops.find(o => o[0] === 'in')![1]).toEqual(['id', ['v-1']])
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!).some(u => u.last_seen_at === EARLY.toISOString() && u.custom_url === null && u.subscribers_hidden === false)).toBe(true)
  })
  it('o vídeo capturado na página não é capturado de novo na passada diária', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page()), ...quiet })
    expect(opened(db).filter(x => x.video_id === 'v-1' && x.field === 'tags')).toHaveLength(1)
  })
  it('o snapshot do canal leva subscribers_hidden', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { hiddenSubscriberCount: true, viewCount: '99' } }] }), ...quiet })
    expect(arg(db.calls.find(c => c.table === 'competitor_channel_snapshots')!, 'upsert')).toMatchObject({ subscribers_hidden: true, subscriber_count: null, view_count: 99 })
  })
  it('erro na trava do canal lança (antes virava "pulado" em silêncio: é o que aconteceria sem a MG1)', async () => {
    setup({ selectFail: 'competitor_channels' })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })).rejects.toThrow(/trava do canal/)
  })
  it('canal sem a parte statistics: a linha do canal não recebe subscribers_hidden por cima, os campos dela não saem, e a execução conta', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' } }] }), ...quiet })
    const chUpdate = db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!).find(u => 'last_seen_at' in u)!
    expect('subscribers_hidden' in chUpdate).toBe(false)
    expect(opened(db).filter(x => x.video_id === null).map(x => x.field)).not.toContain('subscribers_hidden')
    expect(r.channelPartsMissing).toBe(1)
  })
  it('texto com NUL na resposta: a captura limpa e a execução conta quantos itens foram limpos', async () => {
    setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, description: 'a\u0000b' } })), ...quiet })
    expect(r.sanitized).toBe(1)
  })
  it('falha da captura do canal: a linha do canal não carimba last_seen_at, os vídeos seguem e o canal termina em erro', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1], selectFail: 'competitor_field_versions' })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })).rejects.toThrow()
    const chUpdates = db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!)
    expect(chUpdates.some(u => 'last_seen_at' in u)).toBe(false)
    expect(chUpdates.some(u => u.custom_url === null)).toBe(true) // o resto da linha do canal foi gravado
    expect(chUpdates.at(-1)).toMatchObject({ sync_status: 'error' })
  })
})

describe('A5 E1 (consertos da revisão da 6b): parte ausente nunca apaga o gravado', () => {
  const ids = (u: string) => decodeURIComponent(u.match(/[?&]id=([^&]*)/)![1]!).split(',')
  const caught = async (p: Promise<unknown>): Promise<unknown> => { try { await p } catch (e) { return e } throw new Error('não lançou') }
  it('I1: resposta sem contentDetails não regrava is_short: o Short gravado continua Short', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [{ ...ROW1, is_short: true }] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ contentDetails: undefined })), ...quiet })
    const body = updatesOf(db, 'v-1').at(-1)!
    expect('duration_seconds' in body).toBe(false)
    expect(body.is_short).not.toBe(false)
    // com a parte presente a regra de sempre vale (PT10M não é Short)
    const db2 = setup({ lastDaily: '2026-10-24', existing: [{ ...ROW1, is_short: true }] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    expect(updatesOf(db2, 'v-1').at(-1)).toMatchObject({ is_short: false, duration_seconds: 600 })
  })
  it('I2 (b): o PRIMEIRO erro guardado é o que vale', async () => {
    const tracked = ['v-1', 'v-2', 'v-3'].map((id, i) => ({ id, video_id: 'vid-' + (i + 1), title: 'T', thumbnail_url: null }))
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked, failUpdates: { 'v-2': 'primeira falha', 'v-3': 'segunda falha' } })
    const e = await caught(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).map(id => ({ id, statistics: { viewCount: '5' } })) }), ...quiet }))
    expect((e as Error).message).toBe('não foi possível atualizar a linha do vídeo: primeira falha')
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)).toMatchObject({ sync_status: 'error', sync_error: 'não foi possível atualizar a linha do vídeo: primeira falha' })
  })
  it('miniatura: resposta sem miniatura utilizável (só default, ou nenhuma) não anula a gravada, na página, na passada diária e nos fixados', async () => {
    const onlyDefault = { default: { url: 'https://yt/d.jpg' } }
    for (const thumbnails of [onlyDefault, {}, undefined]) {
      const db = setup({ lastDaily: '2026-10-24', existing: [{ ...ROW1, thumbnail_url: 'https://yt/old.jpg' }] })
      await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, thumbnails } })), ...quiet })
      expect('thumbnail_url' in updatesOf(db, 'v-1').at(-1)!).toBe(false)
    }
    // passada diária (v-2 só vem dela) e fixados (v-pin)
    const withSn = (id: string) => ({ id, snippet: { title: 'X', publishedAt: OLD, thumbnails: onlyDefault }, statistics: { viewCount: '3' } })
    const d1 = setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked: [{ id: 'v-1', video_id: 'vid-1', title: 'T', thumbnail_url: null }, { id: 'v-2', video_id: 'vid-2', title: 'X', thumbnail_url: 'https://yt/old.jpg' }] })
    await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).map(withSn) }), ...quiet })
    expect('thumbnail_url' in updatesOf(d1, 'v-2').at(-1)!).toBe(false)
    const d2 = setup({ pinned: [{ ...PIN, thumbnail_url: 'https://yt/old.jpg' }], existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).map(withSn) }), ...quiet })
    expect('thumbnail_url' in updatesOf(d2, 'v-pin').at(-1)!).toBe(false)
    // com miniatura utilizável a coluna é regravada
    const d3 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, thumbnails: { high: { url: 'https://yt/h.jpg' } } } })), ...quiet })
    expect(updatesOf(d3, 'v-1').at(-1)).toMatchObject({ thumbnail_url: 'https://yt/h.jpg' })
    // vídeo novo sem miniatura: nasce com nulo (não há o que preservar)
    const d4 = setup({ lastDaily: '2026-10-24', existing: [] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, thumbnails: onlyDefault } })), ...quiet })
    expect(inserts(d4)[0]).toMatchObject({ thumbnail_url: null })
  })
  it('partsMissing conta vídeo DISTINTO: o mesmo vídeo pedido na página e na passada diária conta uma vez (e o resultado chega mesmo quando o canal termina em erro)', async () => {
    const { statistics: _s, ...noStats } = page()
    setup({ lastDaily: '2026-10-23', existing: [ROW1], failUpdateOf: 'v-1' })
    const e = await caught(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(noStats, 200, { daily: () => [noStats] }), ...quiet }))
    expect((e as Error).message).toMatch(/atualizar a linha do vídeo/)
    // a página falhou ao regravar, a passada diária pediu o mesmo vídeo de novo e falhou de novo: um vídeo, uma parte faltando
    expect(syncStatsOf(e)).toMatchObject({ partsMissing: 1, videosChecked: 1 })
  })
  it('os contadores novos (partsMissing, channelPartsMissing, sanitized) acompanham o erro quando o canal termina em erro; sem erro de gravação não há nada anexado', async () => {
    const { statistics: _s, ...noStats } = page()
    setup({ lastDaily: '2026-10-24', existing: [ROW1], failUpdateOf: 'v-1' })
    const chNoStats = [{ id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' } }]
    const e = await caught(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch({ ...noStats, snippet: { ...page().snippet, description: 'a\u0000b' } }, 200, { channelItems: chNoStats }), ...quiet }))
    expect(syncStatsOf(e)).toMatchObject({ partsMissing: 1, channelPartsMissing: 1, sanitized: 1 })
    expect(syncStatsOf(new Error('x'))).toBeUndefined()
    expect(syncStatsOf('texto')).toBeUndefined()
  })
  it('linha do canal: resposta SEM snippet não grava channel_name vazio nem thumbnail_url nulo; SEM statistics não grava subscriber_count nulo nem contagem de vídeos 0', async () => {
    const base = { id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } } }
    const chUpdate = (db: ReturnType<typeof setup>) => db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!).find(u => 'last_seen_at' in u)!
    const db1 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ ...base, statistics: { subscriberCount: '10', videoCount: '4' } }] }), ...quiet })
    const u1 = chUpdate(db1)
    expect('channel_name' in u1).toBe(false)
    expect('thumbnail_url' in u1).toBe(false)
    expect(u1).toMatchObject({ subscriber_count: 10, youtube_video_count: 4 })
    const db2 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ ...base, snippet: { title: 'Canal', thumbnails: { default: { url: 'https://yt/c.jpg' } } } }] }), ...quiet })
    const u2 = chUpdate(db2)
    expect('subscriber_count' in u2).toBe(false)
    expect('youtube_video_count' in u2).toBe(false)
    expect(u2).toMatchObject({ channel_name: 'Canal', thumbnail_url: 'https://yt/c.jpg' })
    // snippet presente e vazio: a parte veio (regra já decidida), então as chaves dela são gravadas
    const db3 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ ...base, snippet: {}, statistics: {} }] }), ...quiet })
    expect(chUpdate(db3)).toMatchObject({ channel_name: '', thumbnail_url: null, subscriber_count: null, youtube_video_count: null })
  })
})

describe('A5 E1: ausência e volta (itens 7 e 221)', () => {
  const PINROW = { ...PIN, last_seen_at: '2026-10-24T03:00:00.000Z' }
  const caught = async (p: Promise<unknown>): Promise<unknown> => { try { await p } catch (e) { return e } throw new Error('não lançou') }
  it('vídeo pedido e não devolvido: uma chamada a competitor_mark_missing com o uuid; nada é apagado nem regravado na linha', async () => {
    const db = setup({ pinned: [PINROW], existing: [ROW1], missed: [{ id: 'v-pin', miss_streak: 1, miss_first_at: EARLY.toISOString(), missing_since: null, last_seen_at: PINROW.last_seen_at }] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: () => [] }), ...quiet })
    expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([{ p_channel_id: 'cc-1', p_video_ids: ['v-pin'], p_now: EARLY.toISOString() }])
    expect(r).toMatchObject({ missed: 1 })
    expect(r.newlyMissing ?? 0).toBe(0)
    expect(db.calls.some(c => c.ops.some(o => o[0] === 'delete'))).toBe(false)
    expect(updatesOf(db, 'v-pin')).toEqual([])
    expect(rpcCalls(db, 'apply_competitor_field_plan').flatMap(a => a.p_open as Array<{ field: string; value: unknown }>).some(o => o.value === 'sumiu')).toBe(false)
  })
  it('segunda leitura seguida sem o vídeo: a versão availability = "sumiu" é aberta no instante da 1ª falta', async () => {
    const firstMiss = '2026-10-24T03:00:00.000Z'
    const db = setup({ pinned: [PINROW], existing: [ROW1], fields: [{ id: 9, video_id: 'v-pin', field: 'availability', value_hash: fieldHash('no_ar') }],
      missed: [{ id: 'v-pin', miss_streak: 2, miss_first_at: firstMiss, missing_since: '2026-10-24', last_seen_at: '2026-10-23T21:00:00.000Z' }] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: () => [] }), ...quiet })
    expect(r).toMatchObject({ missed: 1, newlyMissing: 1 })
    const sumiu = rpcCalls(db, 'apply_competitor_field_plan').flatMap(a => a.p_open as Array<Record<string, unknown>>).find(o => o.value === 'sumiu')!
    expect(sumiu).toMatchObject({ video_id: 'v-pin', field: 'availability', first_seen_at: firstMiss, window_start: '2026-10-23T21:00:00.000Z' })
  })
  it('Review Focus 2: pedido duas vezes na mesma sincronização e ausente nas duas → UMA falta (uma chamada, um uuid)', async () => {
    // v-1 está na página (a lista de uploads o traz) e na passada diária, e não vem em nenhuma das duas respostas
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1] })
    const f = (async (input: RequestInfo | URL) => {
      const u = String(input)
      if (u.includes('/channels?')) return Response.json({ items: [{ id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { subscriberCount: '10' } }] })
      if (u.includes('/playlistItems?')) return Response.json({ items: [{ snippet: { resourceId: { videoId: 'vid-1' } } }] })
      return Response.json({ items: [] })
    }) as typeof fetch
    await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: f, ...quiet })
    expect(rpcCalls(db, 'competitor_mark_missing')).toHaveLength(1)
    expect(rpcCalls(db, 'competitor_mark_missing')[0]!.p_video_ids).toEqual(['v-1'])
  })
  it('Review Focus 3: a chamada videos.list falha (HTTP 500) → nenhum vídeo dela conta como ausente', async () => {
    const db = setup({ pinned: [PINROW], existing: [ROW1] })
    const f = apiFetch(page(), 200, { daily: () => new Response('x', { status: 500 }) })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: f, ...quiet })).rejects.toThrow(/500/)
    expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([])
  })
  it('a passada diária que falha com 500 não marca ninguém como ausente, nem o vídeo que a página já pediu', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1] })
    const f = (async (input: RequestInfo | URL) => {
      const u = String(input)
      if (u.includes('/channels?')) return Response.json({ items: [{ id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { subscriberCount: '10' } }] })
      if (u.includes('/playlistItems?')) return Response.json({ items: [{ snippet: { resourceId: { videoId: 'vid-1' } } }] })
      if (u.includes('/videos?') && f.calls++ > 0) return new Response('x', { status: 500 })
      return Response.json({ items: [] })
    }) as typeof fetch & { calls: number }
    f.calls = 0
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: f, ...quiet })).rejects.toThrow(/500/)
    expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([])
  })
  it('vídeo ausente que volta: a linha zera a sequência, a decisão "manter" é limpa, abre "no_ar", e a execução conta a volta', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [{ ...ROW1, last_seen_at: '2026-10-20T03:00:00.000Z', missing_since: '2026-10-21' }], fields: [{ id: 9, video_id: 'v-1', field: 'availability', value_hash: fieldHash('sumiu') }] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    expect(updatesOf(db, 'v-1').some(u => u.miss_streak === 0 && u.missing_since === null && u.miss_first_at === null && u.removal_decision === null)).toBe(true)
    // (o canal também abre 'no_ar', com video_id nulo: o plano é o do vídeo)
    const plan = rpcCalls(db, 'apply_competitor_field_plan').find(a => (a.p_open as Array<{ value: unknown; video_id: unknown }>).some(o => o.value === 'no_ar' && o.video_id === 'v-1'))!
    expect(plan.p_close).toEqual([{ id: 9, last_seen_at: '2026-10-20T03:00:00.000Z' }])
    expect((plan.p_open as Array<Record<string, unknown>>).find(o => o.value === 'no_ar')).toMatchObject({ precision: 'gap' }) // 4 dias sem o vídeo: a janela é buraco, não "1 dia"
    expect(r.returned).toBe(1)
  })
  it('item 221, canal: channels.list sem o canal soma a falta do canal e o sync continua terminando em erro "não encontrado"', async () => {
    const db = setup({ channelMissed: { id: 'cc-1', miss_streak: 2, miss_first_at: '2026-10-24T03:00:00.000Z', missing_since: '2026-10-24', last_seen_at: '2026-10-23T21:00:00.000Z' } })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [] }), ...quiet })).rejects.toThrow(/404/)
    expect(rpcCalls(db, 'competitor_channel_mark_missing')).toEqual([{ p_channel_id: 'cc-1', p_now: EARLY.toISOString() }])
    expect(rpcCalls(db, 'apply_competitor_field_plan').flatMap(a => a.p_open as Array<Record<string, unknown>>).find(o => o.value === 'sumiu')).toMatchObject({ video_id: null, field: 'availability' })
  })
  it('canal: falha de rede ou HTTP na channels.list não soma falta do canal', async () => {
    const db = setup({})
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 500), ...quiet })).rejects.toThrow(/500/)
    expect(rpcCalls(db, 'competitor_channel_mark_missing')).toEqual([])
  })
  it('canal: item sem a lista de uploads (mas com o canal) não é sumiço: não soma falta', async () => {
    const db = setup({})
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { noUploads: true }), ...quiet })).rejects.toThrow(/404/)
    expect(rpcCalls(db, 'competitor_channel_mark_missing')).toEqual([])
  })
  it('a marca de ausência falhando no banco deixa o canal em erro (não some em silêncio)', async () => {
    const db = setup({ pinned: [PINROW], existing: [ROW1], rpcFail: 'competitor_mark_missing' })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: () => [] }), ...quiet })).rejects.toThrow(/deixou de vir do YouTube/)
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)).toMatchObject({ sync_status: 'error' })
  })
  it('a marca de ausência do canal falhando: o erro do canal continua sendo o 404 e traz "a falta não foi registrada"', async () => {
    setup({ rpcFail: 'competitor_channel_mark_missing' })
    const e = await caught(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [] }), ...quiet }))
    expect((e as Error).message).toMatch(/404/)
    expect((e as Error).message).toMatch(/a falta não foi registrada/)
  })
  it('a marca de ausência é gravação nova: a série do dia é gravada antes, e a marca falhando não a perde', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked: [{ id: 'v-1', video_id: 'vid-1', title: 'T', thumbnail_url: null }, { id: 'v-2', video_id: 'vid-2', title: 'X', thumbnail_url: null }], rpcFail: 'competitor_mark_missing' })
    const ids = (u: string) => decodeURIComponent(u.match(/[?&]id=([^&]*)/)![1]!).split(',')
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).filter(i => i === 'vid-1').map(id => ({ id, statistics: { viewCount: '5' } })) }), ...quiet })).rejects.toThrow(/deixou de vir do YouTube/)
    const iDaily = db.calls.findIndex(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')
    const iMark = db.calls.findIndex(c => c.table === 'rpc:competitor_mark_missing')
    expect(iDaily).toBeGreaterThan(-1)
    expect(iMark).toBeGreaterThan(iDaily)
  })
})

describe('A5 E1 (Tarefa 8): os contadores acompanham o resultado e o erro', () => {
  const PINROW = { ...PIN, last_seen_at: '2026-10-24T03:00:00.000Z' }
  const caught = async (p: Promise<unknown>): Promise<unknown> => { try { await p } catch (e) { return e } throw new Error('não lançou') }
  const gone = { id: 'v-pin', miss_streak: 2, miss_first_at: '2026-10-24T00:00:00.000Z', missing_since: '2026-10-24', last_seen_at: PINROW.last_seen_at }
  it('o sucesso traz faltas, ausentes e voltas; sem nada disso as chaves não aparecem', async () => {
    setup({ pinned: [PINROW], existing: [{ ...ROW1, missing_since: '2026-10-21', last_seen_at: '2026-10-20T03:00:00.000Z' }], missed: [gone] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: () => [] }), ...quiet })
    expect(r).toMatchObject({ missed: 1, newlyMissing: 1, returned: 1 })
    setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const r2 = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    for (const k of ['missed', 'newlyMissing', 'returned', 'duplicates', 'invalid']) expect(k in r2).toBe(false)
  })
  it('syncStatsOf: faltas, ausentes e voltas chegam quando o canal termina em erro de gravação', async () => {
    setup({ pinned: [PINROW], existing: [{ ...ROW1, missing_since: '2026-10-21', last_seen_at: '2026-10-20T03:00:00.000Z' }], missed: [gone], failUpdateOf: 'v-1' })
    const e = await caught(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: () => [] }), ...quiet }))
    expect((e as Error).message).toMatch(/atualizar a linha do vídeo/)
    expect(syncStatsOf(e)).toMatchObject({ missed: 1, newlyMissing: 1, returned: 1 })
  })
  it('syncStatsOf: o vídeo que voltou conta mesmo quando o erro vem antes da marca de ausência', async () => {
    const gone1 = { ...ROW1, missing_since: '2026-10-21', last_seen_at: '2026-10-20T03:00:00.000Z' }
    setup({ lastDaily: '2026-10-23', existing: [gone1], tracked: [{ id: 'v-1', video_id: 'vid-1', title: 'T', thumbnail_url: null, last_seen_at: gone1.last_seen_at, missing_since: gone1.missing_since }] })
    const e = await caught(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: () => new Response('x', { status: 500 }) }), ...quiet }))
    expect(syncStatsOf(e)).toMatchObject({ returned: 1 })
  })
  it('duplicates: o item repetido na resposta é contado no resultado e acompanha o erro (invalid segue a mesma via)', async () => {
    const v2 = { id: 'vid-2', statistics: { viewCount: '5' } }
    const tracked = [{ id: 'v-1', video_id: 'vid-1', title: 'T', thumbnail_url: null }, { id: 'v-2', video_id: 'vid-2', title: 'X', thumbnail_url: null }]
    setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: () => [v2, v2] }), ...quiet })
    expect(r.duplicates).toBe(1)
    setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked, failUpdateOf: 'v-1' })
    const e = await caught(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: () => [v2, v2] }), ...quiet }))
    expect(syncStatsOf(e)).toMatchObject({ duplicates: 1 })
  })
})

describe('A5 E1 (D2 no retrato do canal): resposta sem statistics não grava um dia medido em zero', () => {
  const base = { id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' } }
  const snapshots = (db: ReturnType<typeof setup>) => db.calls.filter(c => c.table === 'competitor_channel_snapshots')
  it('sem a parte statistics: nenhuma linha de retrato do dia (nem zero, nem nulo por cima de um retrato bom)', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [base] }), ...quiet })
    expect(snapshots(db)).toHaveLength(0)
  })
  it('com a parte statistics e ao menos uma contagem: o retrato é gravado como sempre foi', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ ...base, statistics: { subscriberCount: '10', videoCount: '4', viewCount: '99' } }] }), ...quiet })
    expect(arg(snapshots(db)[0]!, 'upsert')).toMatchObject({ subscriber_count: 10, video_count: 4, view_count: 99 })
  })
  it('statistics presente mas SEM nenhuma contagem (statistics: {}): nenhuma linha de retrato (um retrato todo nulo cobriria um bom do mesmo dia)', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ ...base, statistics: {} }] }), ...quiet })
    expect(snapshots(db)).toHaveLength(0)
    // chave desconhecida, ou "não escondido" sozinho, sem número nenhum, também não é medida
    for (const statistics of [{ foo: 'bar' }, { hiddenSubscriberCount: false }]) {
      const db2 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
      await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ ...base, statistics }] }), ...quiet })
      expect(snapshots(db2)).toHaveLength(0)
    }
  })
  it('o canal que esconde os inscritos E trouxe uma contagem grava o retrato com o sinalizador; hiddenSubscriberCount: true SOZINHO não grava (um retrato todo nulo cobriria um bom do mesmo dia)', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ ...base, statistics: { hiddenSubscriberCount: true, viewCount: '99' } }] }), ...quiet })
    expect(arg(snapshots(db)[0]!, 'upsert')).toMatchObject({ subscribers_hidden: true, subscriber_count: null, view_count: 99 })
    const db2 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ ...base, statistics: { hiddenSubscriberCount: true } }] }), ...quiet })
    expect(snapshots(db2)).toHaveLength(0)
  })
  it('basta UMA contagem para gravar o retrato (as outras seguem nulas, nunca zero)', async () => {
    for (const [stats, expected] of [
      [{ viewCount: '99' }, { subscriber_count: null, video_count: null, view_count: 99 }],
      [{ videoCount: '0' }, { subscriber_count: null, video_count: 0, view_count: null }],
      [{ subscriberCount: '10' }, { subscriber_count: 10, video_count: null, view_count: null }],
    ] as Array<[Record<string, unknown>, Record<string, unknown>]>) {
      const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
      await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ ...base, statistics: stats }] }), ...quiet })
      expect(snapshots(db)).toHaveLength(1)
      expect(arg(snapshots(db)[0]!, 'upsert')).toMatchObject(expected)
    }
  })
})

describe('A5 E1 (conserto da Tarefa 7): captura fora da página, primeiro erro, disjuntor e contadores', () => {
  const opened = (db: ReturnType<typeof setup>) => rpcCalls(db, 'apply_competitor_field_plan').flatMap(a => a.p_open as Array<Record<string, unknown>>)
  const rawOpened = (db: ReturnType<typeof setup>) => rpcCalls(db, 'apply_competitor_raw_plan').flatMap(a => a.p_open as Array<Record<string, unknown>>)
  const ids = (u: string) => decodeURIComponent(u.match(/[?&]id=([^&]*)/)![1]!).split(',')
  const caught = async (p: Promise<unknown>): Promise<unknown> => { try { await p } catch (e) { return e } throw new Error('não lançou') }
  const stamps = (db: ReturnType<typeof setup>) => db.calls
    .filter(c => c.table === 'competitor_videos' && first(c) === 'update' && Object.keys(arg(c, 'update') ?? {}).join() === 'last_seen_at')
    .map(c => c.ops.find(o => o[0] === 'in')![1][1] as string[])
  const dailyRows = (db: ReturnType<typeof setup>) => db.calls.filter(c => c.table === 'competitor_video_daily' && first(c) === 'upsert').flatMap(c => c.ops[0]![1][0] as Array<{ video_id: string }>).map(r => r.video_id)
  const tr = (n: number) => ({ id: 'v-' + n, video_id: 'vid-' + n, title: 'X', thumbnail_url: null })
  const TRACKED2 = [{ ...tr(1), title: 'T' }, tr(2)]
  const item = (id: string, over: Record<string, unknown> = {}) => ({ id, snippet: { title: 'X', description: '', publishedAt: OLD, tags: ['z'], categoryId: '22' }, statistics: { viewCount: '5' }, contentDetails: { duration: 'PT5M' }, ...over })
  const FIELDS_V = ['availability', 'category_id', 'comments_disabled', 'default_audio_language', 'default_language', 'duration_seconds', 'likes_hidden', 'live_broadcast_content', 'tags', 'views_hidden']
  const FIELD_PLAN = 'apply_competitor_field_plan'
  const FRASE = /^não foi possível guardar o histórico de campos \(apply_competitor_field_plan: boom\)$/

  it('I1: vídeo que só aparece na passada diária ganha campos, raw e carimbo; o pedido e não devolvido não é capturado', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked: [...TRACKED2, tr(3)] })
    await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).filter(i => i === 'vid-2').map(i => item(i)) }), ...quiet })
    expect(opened(db).filter(x => x.video_id === 'v-2').map(x => x.field).sort()).toEqual(FIELDS_V)
    expect(opened(db).find(x => x.video_id === 'v-2' && x.field === 'tags')).toMatchObject({ value: ['z'], precision: 'first' })
    expect(rawOpened(db).map(x => x.video_id)).toEqual([null, 'v-1', 'v-2'])
    expect(stamps(db)).toEqual([['v-1'], ['v-2']])
    expect(opened(db).some(x => x.video_id === 'v-3')).toBe(false) // pedido e não devolvido: nada de "tudo nulo"
    expect(rpcCalls(db, 'competitor_mark_missing')[0]!.p_video_ids).toEqual(['v-3'])
  })
  it('I1: vídeo fixado, lido só na passada dos fixados, ganha campos, raw e carimbo', async () => {
    const db = setup({ pinned: [PIN], existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).map(i => item(i, { snippet: { title: 'Fixado', publishedAt: OLD, tags: ['p'] } })) }), ...quiet })
    expect(opened(db).find(x => x.video_id === 'v-pin' && x.field === 'tags')).toMatchObject({ value: ['p'] })
    expect(rawOpened(db).map(x => x.video_id)).toEqual([null, 'v-1', 'v-pin'])
    expect(stamps(db)).toEqual([['v-1'], ['v-pin']])
  })
  it('I1: erro de captura na passada diária vai para o erro guardado sem custar a série do dia', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked: TRACKED2, rpcFailFor: { fn: FIELD_PLAN, videoId: 'v-2' } })
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).map(i => item(i)) }), ...quiet })).rejects.toThrow(FRASE)
    expect(dailyRows(db).sort()).toEqual(['v-1', 'v-2'])
    expect(updatesOf(db, 'v-2')).toHaveLength(1) // a linha do vídeo foi regravada antes da captura
    expect(stamps(db)).toEqual([['v-1']]) // o carimbo do v-2 não vai: a captura dele falhou
    const upd = db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!)
    expect(upd.at(-1)).toMatchObject({ sync_status: 'error', sync_error: expect.stringMatching(FRASE) })
    expect(upd.some(u => 'last_ok_synced_at' in u)).toBe(false)
  })
  it('I1: erro de captura nos fixados vai para o erro guardado sem custar o resto (a linha do fixado e a marca de ausência seguem)', async () => {
    const gone = { id: 'v-gone', video_id: 'vid-gone', title: 'Sumido', thumbnail_url: null, last_seen_at: '2026-10-24T03:00:00.000Z' }
    const db = setup({ pinned: [PIN, gone], existing: [ROW1], rpcFailFor: { fn: FIELD_PLAN, videoId: 'v-pin' }, missed: [{ id: 'v-gone', miss_streak: 1, miss_first_at: EARLY.toISOString(), missing_since: null, last_seen_at: gone.last_seen_at }] })
    const e = await caught(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).filter(i => i === 'vid-pin').map(i => item(i)) }), ...quiet }))
    expect((e as Error).message).toMatch(FRASE)
    expect(updatesOf(db, 'v-pin')).toHaveLength(1)
    expect(rpcCalls(db, 'competitor_mark_missing')).toHaveLength(1)
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)).toMatchObject({ sync_status: 'error' })
  })

  it('M2: o PRIMEIRO erro vale também contra o erro da captura e o da marca de ausência', async () => {
    setup({ lastDaily: '2026-10-24', existing: [ROW1], failUpdateOf: 'v-1', rpcFailFor: { fn: FIELD_PLAN, videoId: 'v-1' } })
    const e1 = await caught(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet }))
    expect((e1 as Error).message).toBe('não foi possível atualizar a linha do vídeo: boom')
    setup({ pinned: [{ ...PIN, last_seen_at: '2026-10-24T03:00:00.000Z' }], existing: [ROW1], failUpdateOf: 'v-1', rpcFail: 'competitor_mark_missing' })
    const e2 = await caught(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: () => [] }), ...quiet }))
    expect((e2 as Error).message).toBe('não foi possível atualizar a linha do vídeo: boom')
  })
  it('M9: a janela da mudança do canal começa na última leitura boa do canal (last_seen_at da linha lida na trava)', async () => {
    const prev = '2026-10-24T03:00:00.000Z'
    const chItem = { id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal', description: 'nova' }, statistics: { subscriberCount: '10' } }
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1], lock: { last_seen_at: prev }, fields: [{ id: 31, video_id: null, field: 'description', value_hash: fieldHash('antiga') }] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [chItem] }), ...quiet })
    const plan = rpcCalls(db, FIELD_PLAN).find(a => (a.p_open as Array<{ field: string; video_id: unknown }>).some(o => o.field === 'description' && o.video_id === null))!
    expect(plan.p_close).toEqual([{ id: 31, last_seen_at: prev }])
    expect((plan.p_open as Array<Record<string, unknown>>).find(o => o.field === 'description')).toMatchObject({ window_start: prev, precision: '6h' })
  })
  it('M14: erro ao carimbar a última leitura dos vídeos termina o canal em erro, com a frase', async () => {
    setup({ lastDaily: '2026-10-24', existing: [ROW1], failStamp: true })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })).rejects.toThrow(/^não foi possível guardar a última leitura dos vídeos: boom$/)
  })
  it('M18: erro ao gravar a linha do canal termina o canal em erro, com a frase, e a série do dia é gravada', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], failChannelUpdate: true })
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page()), ...quiet })).rejects.toThrow(/^não foi possível atualizar a linha do canal: boom$/)
    expect(dailyRows(db)).toEqual(['v-1'])
  })

  it('I3: a captura do canal falha → nenhuma leitura nem gravação de captura nos blocos seguintes; série, marca e erro seguem; captureSkipped conta os itens', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked: TRACKED2, selectFail: 'competitor_field_versions' })
    const e = await caught(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).map(i => item(i)) }), ...quiet }))
    expect((e as Error).message).toBe('não foi possível ler o histórico de campos (competitor_field_versions: boom)') // a primeira falha
    expect(db.calls.filter(c => c.table === 'competitor_field_versions')).toHaveLength(1)
    expect(db.calls.filter(c => c.table === 'competitor_raw')).toHaveLength(0)
    expect(rpcCalls(db, FIELD_PLAN)).toEqual([])
    expect(rpcCalls(db, 'apply_competitor_raw_plan')).toEqual([])
    expect(stamps(db)).toEqual([])
    expect(dailyRows(db).sort()).toEqual(['v-1', 'v-2'])
    expect(syncStatsOf(e)).toMatchObject({ captureSkipped: 2 }) // v-1 (página e passada, um só) e v-2
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)).toMatchObject({ sync_status: 'error' })
  })
  it('I3: a captura de um bloco da página falha → passada diária e fixados não capturam; só conta quem nunca foi tentado', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked: TRACKED2, rpcFailFor: { fn: FIELD_PLAN, videoId: 'v-1' } })
    const e = await caught(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).map(i => item(i)) }), ...quiet }))
    expect((e as Error).message).toMatch(FRASE)
    expect(db.calls.filter(c => c.table === 'competitor_field_versions')).toHaveLength(2) // o canal e o bloco da página
    expect(rpcCalls(db, FIELD_PLAN)).toHaveLength(2)
    expect(opened(db).some(x => x.video_id === 'v-2')).toBe(false)
    expect(stamps(db)).toEqual([])
    expect(dailyRows(db).sort()).toEqual(['v-1', 'v-2'])
    expect(syncStatsOf(e)).toMatchObject({ captureSkipped: 1 })
    const db2 = setup({ pinned: [PIN], existing: [ROW1], rpcFailFor: { fn: FIELD_PLAN, videoId: 'v-1' } })
    const e2 = await caught(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).map(i => item(i)) }), ...quiet }))
    expect(syncStatsOf(e2)).toMatchObject({ captureSkipped: 1 })
    expect(opened(db2).some(x => x.video_id === 'v-pin')).toBe(false)
    expect(updatesOf(db2, 'v-pin')).toHaveLength(1) // o fixado foi lido e regravado, só não capturado
  })
  it('sem falha de captura não há captureSkipped; o campo não aparece', async () => {
    setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    expect('captureSkipped' in r).toBe(false)
  })

  it('m2/m3: fieldsClosed e rawClosed chegam ao resultado; rawTooBig também (nível da sincronização)', async () => {
    const prev = '2026-10-24T03:00:00.000Z'
    setup({ lastDaily: '2026-10-24', existing: [{ ...ROW1, last_seen_at: prev }], fields: [{ id: 41, video_id: 'v-1', field: 'tags', value_hash: fieldHash(['a']) }], raws: [{ id: 7, video_id: 'v-1', raw_sha256: 'antigo' }] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, tags: ['b'] } })), ...quiet })
    expect(r).toMatchObject({ fieldsClosed: 1, rawClosed: 1 })
    setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const r2 = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, description: 'x'.repeat(120_000) } })), ...quiet })
    expect(r2.rawTooBig).toBe(1)
    expect('fieldsClosed' in r2).toBe(false)
  })
})

describe('A5 E1 (conserto da Tarefa 8): newlyMissing é a versão "sumiu" aberta nesta execução', () => {
  const PINROW = { ...PIN, last_seen_at: '2026-10-24T03:00:00.000Z' }
  const PINROW2 = { id: 'v-pin2', video_id: 'vid-pin2', title: 'Fixado 2', thumbnail_url: null, last_seen_at: '2026-10-24T03:00:00.000Z' }
  const caught = async (p: Promise<unknown>): Promise<unknown> => { try { await p } catch (e) { return e } throw new Error('não lançou') }
  const gone = (id: string, streak: number) => ({ id, miss_streak: streak, miss_first_at: '2026-10-24T00:00:00.000Z', missing_since: '2026-10-24', last_seen_at: PINROW.last_seen_at })
  const run = (opts: Parameters<typeof setup>[0]) => { const db = setup({ pinned: [PINROW, PINROW2], existing: [ROW1], ...opts }); return { db, r: syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: () => [] }), ...quiet }) } }
  it('(a) o que cruza para missing_since e ainda estava "no_ar" conta; o que já tinha a versão "sumiu" não', async () => {
    const { r } = run({ missed: [gone('v-pin', 2), gone('v-pin2', 2)], fields: [{ id: 9, video_id: 'v-pin', field: 'availability', value_hash: fieldHash('no_ar') }, { id: 10, video_id: 'v-pin2', field: 'availability', value_hash: fieldHash('sumiu') }] })
    expect(await r).toMatchObject({ missed: 2, newlyMissing: 1 })
  })
  it('(b) a mesma situação reexecutada (a versão "sumiu" já está gravada) → 0 e nenhuma gravação de versão', async () => {
    const { db, r } = run({ missed: [gone('v-pin', 3)], fields: [{ id: 9, video_id: 'v-pin', field: 'availability', value_hash: fieldHash('sumiu') }] })
    const res = await r
    expect(res).toMatchObject({ missed: 1 })
    expect('newlyMissing' in res).toBe(false)
    expect(rpcCalls(db, 'apply_competitor_field_plan').flatMap(a => a.p_open as Array<{ value: unknown }>).some(o => o.value === 'sumiu')).toBe(false)
  })
  it('(c) a execução anterior marcou missing_since e falhou antes de abrir a versão: esta abre e conta 1 (o evento não se perde, mesmo com miss_streak além de 2)', async () => {
    const { db, r } = run({ missed: [gone('v-pin', 4)], fields: [{ id: 9, video_id: 'v-pin', field: 'availability', value_hash: fieldHash('no_ar') }] })
    expect(await r).toMatchObject({ missed: 1, newlyMissing: 1 })
    expect(rpcCalls(db, 'apply_competitor_field_plan').flatMap(a => a.p_open as Array<Record<string, unknown>>).find(o => o.value === 'sumiu')).toMatchObject({ video_id: 'v-pin', field: 'availability' })
  })
  it('(d) falta ainda única (sem missing_since): conta falta, não "sumiu"', async () => {
    const { r } = run({ missed: [{ id: 'v-pin', miss_streak: 2, miss_first_at: EARLY.toISOString(), missing_since: null, last_seen_at: PINROW.last_seen_at }] })
    const res = await r
    expect(res).toMatchObject({ missed: 1 })
    expect('newlyMissing' in res).toBe(false)
  })
  it('a gravação da versão "sumiu" falha depois da marca: missed chega ao erro (a marca já estava no banco), newlyMissing só conta o confirmado', async () => {
    const { r } = run({ missed: [gone('v-pin', 2), gone('v-pin2', 2)], rpcFailFor: { fn: 'apply_competitor_field_plan', videoId: 'v-pin2' } })
    const e = await caught(r)
    expect((e as Error).message).toMatch(/deixou de vir do YouTube|guardar o histórico de campos/)
    expect(syncStatsOf(e)).toMatchObject({ missed: 2 })
    expect(syncStatsOf(e)?.newlyMissing ?? 0).toBe(0)
  })
})

describe('A5 E1 (conserto da Tarefa 8, D2): contagem ausente do canal nunca vira zero', () => {
  const base = { id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' } }
  const chUpdate = (db: ReturnType<typeof setup>) => db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!).find(u => 'last_seen_at' in u)!
  const snap = (db: ReturnType<typeof setup>) => arg(db.calls.find(c => c.table === 'competitor_channel_snapshots')!, 'upsert')
  const run = async (statistics: Record<string, unknown>) => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ ...base, statistics }] }), ...quiet })
    return db
  }
  it('statistics presente e vazio: a contagem de vídeos é nula na linha do canal (e as outras também); o retrato do dia nem é gravado', async () => {
    const db = await run({})
    expect(db.calls.some(c => c.table === 'competitor_channel_snapshots')).toBe(false) // retrato todo nulo não é gravado (acréscimo da Tarefa 9)
    expect(chUpdate(db)).toMatchObject({ youtube_video_count: null, subscriber_count: null })
  })
  it('statistics sem videoCount mas com as outras: só a contagem de vídeos é nula', async () => {
    const db = await run({ subscriberCount: '10', viewCount: '99' })
    expect(snap(db)).toMatchObject({ video_count: null, subscriber_count: 10, view_count: 99 })
    expect(chUpdate(db)).toMatchObject({ youtube_video_count: null, subscriber_count: 10 })
  })
  it('videoCount "0" presente é zero medido e grava 0', async () => {
    const db = await run({ videoCount: '0', subscriberCount: '0', viewCount: '0' })
    expect(snap(db)).toMatchObject({ video_count: 0, subscriber_count: 0, view_count: 0 })
    expect(chUpdate(db)).toMatchObject({ youtube_video_count: 0, subscriber_count: 0 })
  })
  it('subscriberCount ausente sem hiddenSubscriberCount é nulo, não zero; escondido também', async () => {
    const db = await run({ videoCount: '4' })
    expect(snap(db)).toMatchObject({ subscriber_count: null, video_count: 4, view_count: null })
    const db2 = await run({ videoCount: '4', hiddenSubscriberCount: true, subscriberCount: '12' })
    expect(snap(db2)).toMatchObject({ subscriber_count: null, subscribers_hidden: true })
  })
})

describe('A5 E1 (revisão da Tarefa 8, I1 e I2): só a resposta com a lista de itens conta ausência', () => {
  const PINROW = { ...PIN, last_seen_at: '2026-10-24T03:00:00.000Z' }
  const ids = (u: string) => decodeURIComponent(u.match(/[?&]id=([^&]*)/)![1]!).split(',')
  const MALFORMED = [['sem items', {}], ['com error', { error: { code: 403, message: 'quotaExceeded' } }], ['items não é lista', { items: 'x' }], ['items nulo', { items: null }], ['items com error', { items: [], error: { code: 500 } }]] as const
  /** Troca o corpo (200) da n-ésima chamada a videos.list; as demais seguem o falso de sempre. */
  const videosBody = (inner: typeof fetch, which: number, body: unknown): typeof fetch => {
    let n = 0
    return (async (input: RequestInfo | URL, init?: RequestInit) => (String(input).includes('/videos?') && ++n === which ? Response.json(body) : inner(input, init))) as typeof fetch
  }
  const channelBody = (inner: typeof fetch, body: unknown): typeof fetch =>
    (async (input: RequestInfo | URL, init?: RequestInit) => (String(input).includes('/channels?') ? Response.json(body) : inner(input, init))) as typeof fetch

  it('página: videos.list 200 malformado não marca ninguém e a chamada falha como um 500', async () => {
    for (const [, body] of MALFORMED) {
      const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
      await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: videosBody(apiFetch(page()), 1, body), ...quiet })).rejects.toThrow(/resposta sem a lista de vídeos/)
      expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([])
    }
  })
  it('passada diária: videos.list 200 malformado não marca ninguém (nem os da página) e o canal termina em erro', async () => {
    for (const [, body] of MALFORMED) {
      const tracked = [{ id: 'v-1', video_id: 'vid-1', title: 'T', thumbnail_url: null }, { id: 'v-2', video_id: 'vid-2', title: 'X', thumbnail_url: null }]
      const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked })
      await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: videosBody(apiFetch(page(), 200, { daily: (_n, u) => ids(u).map(id => ({ id, statistics: { viewCount: '5' } })) }), 2, body), ...quiet })).rejects.toThrow(/resposta sem a lista de vídeos/)
      expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([])
      expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)).toMatchObject({ sync_status: 'error' })
    }
  })
  it('fixados: videos.list 200 malformado não marca ninguém', async () => {
    for (const [, body] of MALFORMED) {
      const db = setup({ pinned: [PINROW], existing: [ROW1] })
      await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: videosBody(apiFetch(page()), 2, body), ...quiet })).rejects.toThrow(/resposta sem a lista de vídeos/)
      expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([])
    }
  })
  it('canal: channels.list 200 sem items (ou com error) é falha da chamada, não sumiço; items [] e totalResults 0 são sumiço', async () => {
    for (const body of [{}, { error: { code: 500 } }, { items: 'x' }, { items: [], error: { code: 500 } }, { pageInfo: { totalResults: 3 } }]) {
      const db = setup({})
      await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: channelBody(apiFetch(page()), body), ...quiet })).rejects.toThrow(/resposta sem o canal/)
      expect(rpcCalls(db, 'competitor_channel_mark_missing')).toEqual([])
    }
    for (const body of [{ items: [] }, { pageInfo: { totalResults: 0, resultsPerPage: 5 } }]) {
      const db = setup({})
      await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: channelBody(apiFetch(page()), body), ...quiet })).rejects.toThrow(/404/)
      expect(rpcCalls(db, 'competitor_channel_mark_missing')).toHaveLength(1)
    }
  })
  it('legítimo: items [] em cada chamada de videos.list conta a falta (página, passada diária e fixados)', async () => {
    const tracked = [{ id: 'v-1', video_id: 'vid-1', title: 'T', thumbnail_url: null }, { id: 'v-2', video_id: 'vid-2', title: 'X', thumbnail_url: null }]
    const d = setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked })
    await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: videosBody(apiFetch(page()), 2, { items: [] }), ...quiet })
    expect(rpcCalls(d, 'competitor_mark_missing')[0]!.p_video_ids).toEqual(['v-2']) // v-1 veio na página
    const p = setup({ pinned: [PINROW], existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: videosBody(apiFetch(page()), 2, { items: [] }), ...quiet })
    expect(rpcCalls(p, 'competitor_mark_missing')[0]!.p_video_ids).toEqual(['v-pin'])
  })
  it('I2: vídeo que SÓ a página de uploads pede (sem passada diária, sem fixar) e vem com items [] → uma falta', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: videosBody(apiFetch(page()), 1, { items: [] }), ...quiet })
    expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([{ p_channel_id: 'cc-1', p_video_ids: ['v-1'], p_now: EARLY.toISOString() }])
  })
})

describe('A5 E1: cota (item 10)', () => {
  it('a sincronização grava as unidades gastas, uma vez, com o site e o modo', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1] })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page()), ...quiet })
    expect(rpcCalls(db, 'youtube_quota_add')).toEqual([expect.objectContaining({ p_site_id: 'site-1', p_units: r.unitsUsed, p_add: { competitors: r.unitsUsed } })])
    expect(r.unitsUsed).toBe(4)
  })
  it('a sincronização que falha também grava o que gastou', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 500), ...quiet })).rejects.toThrow()
    expect(rpcCalls(db, 'youtube_quota_add')).toEqual([expect.objectContaining({ p_units: 1 })])
  })
  it('a gravação da cota falhando não derruba a sincronização, e o resultado diz quotaError', async () => {
    setup({ lastDaily: '2026-10-24', existing: [ROW1], rpcFail: 'youtube_quota_add' })
    expect(await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })).toMatchObject({ quotaError: true })
  })
  it('quotaError traz as unidades que não foram gravadas (quotaUnitsLost), e sem falha nenhum dos dois aparece', async () => {
    setup({ lastDaily: '2026-10-24', existing: [ROW1], rpcFail: 'youtube_quota_add' })
    const bad = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    expect(bad).toMatchObject({ quotaError: true, quotaUnitsLost: bad.unitsUsed })
    expect(bad.unitsUsed).toBeGreaterThan(0)
    setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const ok = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    expect('quotaError' in ok).toBe(false)
    expect('quotaUnitsLost' in ok).toBe(false)
  })
  it('a cota que falha NÃO custa a série do dia: a passada diária é gravada antes, e o canal termina bem', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], rpcFail: 'youtube_quota_add' })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page()), ...quiet })
    expect(r.dailyRecorded).toBeGreaterThan(0)
    expect(db.calls.some(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')).toBe(true)
    const last = db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)
    expect(last).toMatchObject({ sync_status: 'idle', sync_error: null })
  })
  it('canal que termina em erro de gravação tardia: a cota gasta até ali é gravada UMA vez (e a série do dia também)', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], failUpdateOf: 'v-1' })
    const err = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page()), ...quiet }).catch(e => e as Error)
    expect(err).toBeInstanceOf(Error)
    expect(db.calls.some(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')).toBe(true)
    expect(rpcCalls(db, 'youtube_quota_add')).toEqual([expect.objectContaining({ p_units: 4, p_add: { competitors: 4 } })])
  })
  it('a chamada que falha com custo conta: HTTP 500 em videos.list e rede caída (a chamada foi feita)', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const inner = apiFetch(page())
    let n = 0
    const f = (async (input: RequestInfo | URL, init?: RequestInit) => { n++; if (String(input).includes('/videos?')) throw new Error('fetch failed'); return inner(input, init) }) as typeof fetch
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: f, ...quiet })).rejects.toThrow(/fetch failed/)
    // canal + uploads + videos (a que caiu): três chamadas feitas, três unidades
    expect(n).toBe(3)
    expect(rpcCalls(db, 'youtube_quota_add')).toEqual([expect.objectContaining({ p_units: 3 })])
  })
  it('o erro ao gravar a cota de um canal em erro não troca o erro do canal, e chega nos contadores (syncStatsOf)', async () => {
    setup({ lastDaily: '2026-10-24', existing: [ROW1], rpcFail: 'youtube_quota_add' })
    const err = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 500), ...quiet }).catch(e => e as Error)
    expect((err as Error).message).toMatch(/YouTube API 500/)
    expect(syncStatsOf(err)).toMatchObject({ quotaError: true, quotaUnitsLost: 1 })
  })
  it('o dia da cota é o do Pacífico (verão e inverno de lá), não o de São Paulo', async () => {
    // 03:30 em São Paulo (06:30Z): ainda é o dia anterior no Pacífico, com e sem horário de verão
    for (const [iso, day] of [['2026-09-10T06:30:00Z', '2026-09-09'], ['2026-01-10T06:30:00Z', '2026-01-09']] as const) {
      const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
      await syncCompetitorChannel(ch, 'k', { now: new Date(iso), fetchImpl: apiFetch(page()), ...quiet })
      expect(rpcCalls(db, 'youtube_quota_add')).toEqual([expect.objectContaining({ p_day: day })])
    }
  })
  it('partes_ausentes vai junto na linha do dia (o único lugar durável desse número)', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const { statistics: _s, ...noStats } = page()
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(noStats), ...quiet })
    expect(rpcCalls(db, 'youtube_quota_add')).toEqual([expect.objectContaining({ p_add: expect.objectContaining({ partes_ausentes: 1 }) })])
  })
  it('a sincronização pulada (outro processo segura a trava) não gasta nem grava cota', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1], lockTaken: true })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    expect(r).toMatchObject({ skipped: true, unitsUsed: 0 })
    expect(rpcCalls(db, 'youtube_quota_add')).toEqual([])
  })
})

describe('A5 E2: faixas da série', () => {
  const DAY = 86_400_000
  const dailyUpsert = (db: ReturnType<typeof setup>) => db.calls.filter(c => c.table === 'competitor_video_daily' && first(c) === 'upsert').flatMap(c => (c.ops[0]![1][0] as Array<{ video_id: string }>).map(r => r.video_id))

  it('item 222: toda sincronização classifica o canal inteiro e grava só o que mudou, numa chamada, com a data de São Paulo', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [], all: [row(1, 1), row(2, 400, { series_tier: 'diaria' }), row(3, 500)] }) // 3 vídeos e limite 50: os três são "os N mais recentes"
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(null), ...quiet })
    expect(rpcCalls(db, 'apply_competitor_tier_plan')).toEqual([{ p_site_id: 'site-1', p_channel_id: 'cc-1', p_changes: [{ video_id: 'v-1', tier: 'diaria' }, { video_id: 'v-3', tier: 'diaria' }], p_today: '2026-10-24' }])
    expect(r.tierChanges).toBe(2)
  })
  it('nada mudou de faixa: nenhuma chamada', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [], all: [row(1, 1, { series_tier: 'diaria' })] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(null), ...quiet })
    expect(rpcCalls(db, 'apply_competitor_tier_plan')).toEqual([])
  })
  it('item 14: a passada diária pede todos os da faixa diária, inclusive os de até 30 dias fora dos N mais recentes; os semanais não', async () => {
    const all = [...Array.from({ length: 60 }, (_, i) => row(i + 1, i * 0.4)), row(900, 400)] // 60 em 24 dias, 1 antigo
    setup({ dailyHave: [], existing: [], all })
    const log = { dailyCalls: [] as string[] }
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo, log }), ...quiet })
    const asked = log.dailyCalls.flatMap(idsOf)
    expect(asked).toHaveLength(60)
    expect(asked).not.toContain('vid-900')
    expect(asked[0]).toBe('vid-1') // mais recente primeiro
    expect(r.dailyRecorded).toBe(60)
  })
  it('item 18: mais de 200 na regra diária → 200 pedidos, e o corte vai para o resultado e para a linha da cota', async () => {
    const all = Array.from({ length: 230 }, (_, i) => row(i + 1, i * 0.1))
    const db = setup({ dailyHave: [], existing: [], all })
    const log = { dailyCalls: [] as string[] }
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo, log }), ...quiet })
    expect(log.dailyCalls.flatMap(idsOf)).toHaveLength(200)
    expect(r.cutByCap).toBe(30)
    expect(rpcCalls(db, 'youtube_quota_add')[0]).toMatchObject({ p_max: { teto_diario_cortados: 30 } })
  })
  it('itens 13 e 225: vídeo sem contagem e estreia agendada continuam sendo pedidos, mas não mantêm a passada "devida" nem ganham linha de série; o resultado diz quantos ficaram fora', async () => {
    const all = [row(1, 1), row(2, 2, { views_hidden: true }), row(3, 0, { live_broadcast_content: 'upcoming' })]
    const db = setup({ dailyHave: ['v-1'], existing: [], all })
    const noCount = (_n: number, u: string) => idsOf(u).map(id => ({ id, snippet: { title: 'x' }, statistics: {}, contentDetails: {} }))
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: noCount }), ...quiet })
    expect(db.calls.some(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')).toBe(false)
    expect(r.excludedNoCount).toBe(2)
    expect(updatesOf(db, 'v-2').at(-1)).toMatchObject({ views_hidden: true, view_count: null })
  })
  it('revisão da Tarefa 10: a passada "devida" só conta vídeo que entra na prova; o que está fora (sem contagem, estreia agendada, ausente) não faz a página reconciliar os antigos', async () => {
    // v-1 (antigo, já com o ponto de hoje) vem na página; v-2 e v-3 estão fora da prova e SEM ponto. Se o filtro não existisse, v-2 e v-3
    // manteriam a passada devida e o vídeo antigo da página seria reconciliado (a regra: antigo só quando a passada diária é devida).
    const old = page({ snippet: { ...page().snippet, publishedAt: OLD } })
    const all = [row(1, 400, { series_tier: 'diaria', series_tier_since: '2026-09-01' }), row(2, 2, { views_hidden: true }), row(3, 0, { live_broadcast_content: 'upcoming' }), row(4, 3, { missing_since: '2026-10-20' })]
    const noCount = (_n: number, u: string) => idsOf(u).map(id => ({ id, snippet: { title: 'x' }, statistics: {}, contentDetails: {} }))
    const db = setup({ dailyHave: ['v-1'], existing: [{ ...ROW1, discovered_at: OLD }], all })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(old, 200, { daily: noCount }), ...quiet })
    expect(r.excludedNoCount).toBe(3)                                           // os três foram pedidos (é como se descobre que voltaram)...
    expect(rpcs(db).some(p => p.p_video_id === 'v-1')).toBe(false)              // ...mas a página não reconciliou o antigo
    expect(vi.mocked(probeThumb)).not.toHaveBeenCalledWith('vid-1', expect.anything(), expect.anything())
  })
  it('erro na leitura dos vídeos do canal lança (nunca "canal sem vídeos") e o canal fica em erro', async () => {
    const db = setup({ allError: 'boom' })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(null), ...quiet })).rejects.toThrow('não foi possível ler os vídeos do canal: boom')
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)).toMatchObject({ sync_status: 'error' })
    expect(db.calls.some(c => c.table === 'competitor_video_daily')).toBe(false)
  })
  it('a leitura sem dado (resposta nula, não lista) é falha da leitura, nunca "canal sem vídeos"', async () => {
    const db = setup({ lastDaily: '2026-10-23', allNull: true })
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null), ...quiet })).rejects.toThrow(/vídeos do canal.*nula/)
    expect(db.calls.some(c => c.table === 'competitor_video_daily')).toBe(false)
  })
  it('canal com mais de 1.000 vídeos guardados: a leitura pagina até a página curta (nenhum corte em 1.000)', async () => {
    // 1.003 vídeos: os 3 novos e os 47 antigos mais recentes são "os 50 mais recentes"; os 47 já estão em diária, os outros 953 em semanal
    const big = Array.from({ length: 1000 }, (_, i) => row(i + 1, 400 + i, { series_tier: i < 47 ? 'diaria' : 'semanal' }))
    const db = setup({ lastDaily: '2026-10-24', existing: [], allPages: [big, [row(2001, 1), row(2002, 2), row(2003, 3)]] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(null), ...quiet })
    // duas leituras do canal por sincronização (antes da página e depois dela), cada uma em duas páginas
    expect(db.calls.filter(c => c.table === 'competitor_videos' && c.ops.some(o => o[0] === 'range')).map(c => c.ops.find(o => o[0] === 'range')![1])).toEqual([[0, 999], [1000, 1999], [0, 999], [1000, 1999]])
    expect(r.tierChanges).toBe(3) // só os 3 que ainda não tinham faixa
    expect(rpcCalls(db, 'apply_competitor_tier_plan')[0]!.p_changes as unknown[]).toHaveLength(3)
  })
  it('a leitura de uma página exatamente cheia (1.000) pede a seguinte: a página vazia encerra', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => row(i + 1, 400 + i, { series_tier: 'semanal' }))
    const db = setup({ lastDaily: '2026-10-24', existing: [], allPages: [full] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(null), ...quiet })
    expect(db.calls.filter(c => c.table === 'competitor_videos' && c.ops.some(o => o[0] === 'range')).map(c => c.ops.find(o => o[0] === 'range')![1])).toEqual([[0, 999], [1000, 1999], [0, 999], [1000, 1999]])
  })

  describe('o dia do deploy: nenhum vídeo tem faixa gravada', () => {
    it('a série do dia não tem buraco: os vídeos que já eram lidos todo dia ganham o ponto, e as faixas nascem nessa execução', async () => {
      // limite 2: os 2 mais recentes + o fixado antigo eram os "acompanhados" de antes; v-3 (10 dias) entra pela idade; v-old (400 dias) é semanal
      const all = [row(1, 1), row(2, 2), row(3, 10), row('pin', 400, { pinned_at: '2026-10-01T00:00:00.000Z' }), row('old', 401)]
      expect(all.every(r => r.series_tier === null)).toBe(true)
      const db = setup({ dailyHave: [], existing: [], all, videoLimit: 2 })
      const log = { dailyCalls: [] as string[] }
      const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo, log }), ...quiet })
      const points = dailyUpsert(db)
      for (const before of ['v-1', 'v-2', 'v-pin']) expect(points).toContain(before)
      expect(points).not.toContain('v-old')
      expect(r.dailyRecorded).toBe(points.length)
      const plan = rpcCalls(db, 'apply_competitor_tier_plan')
      expect(plan).toHaveLength(1)
      expect((plan[0]!.p_changes as Array<{ video_id: string; tier: string }>).map(c => c.video_id).sort()).toEqual(['v-1', 'v-2', 'v-3', 'v-old', 'v-pin'])
      expect((plan[0]!.p_changes as Array<{ video_id: string; tier: string }>).find(c => c.video_id === 'v-old')).toEqual({ video_id: 'v-old', tier: 'semanal' })
    })
    it('com a gravação das faixas falhando no banco, a série do dia ainda é gravada (mesmos vídeos) e o canal termina em erro', async () => {
      const all = [row(1, 1), row(2, 2), row(3, 10)]
      const db = setup({ dailyHave: [], existing: [], all, rpcFail: 'apply_competitor_tier_plan' })
      await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo }), ...quiet })).rejects.toThrow(/faixa da série/)
      expect(dailyUpsert(db).sort()).toEqual(['v-1', 'v-2', 'v-3'])
      const ups = db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!)
      expect(ups.some(u => 'last_ok_synced_at' in u)).toBe(false)
      expect(ups.at(-1)).toMatchObject({ sync_status: 'error' })
    })
  })

  it('a troca de faixa falhando no banco: a passada diária grava os pontos e o canal termina em erro', async () => {
    const db = setup({ dailyHave: [], existing: [], all: [row(1, 1)], rpcFail: 'apply_competitor_tier_plan' })
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo }), ...quiet })).rejects.toThrow(/faixa da série/)
    expect(db.calls.some(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')).toBe(true)
  })
  it('vídeo que passa de diária para semanal: a troca leva a data de São Paulo de hoje (22:00 SP de 24/10 é 25/10 em UTC) e nenhum ponto é apagado', async () => {
    const lateNight = new Date(NOW.getTime() + 10 * 3_600_000) // 01:00 UTC do dia 25 = 22:00 de 24/10 em São Paulo
    const db = setup({ lastDaily: '2026-10-24', existing: [], videoLimit: 1, all: [row(1, 1, { series_tier: 'diaria', series_tier_since: '2026-10-01' }), row(2, 100, { series_tier: 'diaria', series_tier_since: '2026-08-01' })] })
    await syncCompetitorChannel(ch, 'k', { now: lateNight, fetchImpl: apiFetch(null), ...quiet })
    expect(rpcCalls(db, 'apply_competitor_tier_plan')).toEqual([{ p_site_id: 'site-1', p_channel_id: 'cc-1', p_changes: [{ video_id: 'v-2', tier: 'semanal' }], p_today: '2026-10-24' }])
    expect(db.calls.some(c => c.table === 'competitor_video_daily' && ['delete', 'update'].includes(String(first(c))))).toBe(false)
  })
  it('uma sincronização às 12:00 com 50 vídeos diários faz 4 chamadas à API (canal, página, detalhes, 1 lote da passada) e NENHUMA para os semanais', async () => {
    const all = [...Array.from({ length: 50 }, (_, i) => row(i + 1, i * 0.1, { series_tier: 'diaria' })), ...Array.from({ length: 30 }, (_, i) => row(100 + i, 300 + i, { series_tier: 'semanal' }))]
    setup({ dailyHave: [], existing: [ROW1], all })
    const t = traced(apiFetch(page(), 200, { daily: echo }))
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: t.f, ...quiet })
    const calls = t.api()
    expect(calls).toHaveLength(4)
    expect(calls.slice(0, 3)).toEqual(['channels?part=contentDetails,snippet,statistics&id=UC_test', 'playlistItems?part=snippet&playlistId=UU&maxResults=50', 'videos?part=' + VIDEO_PARTS + '&id=vid-1'])
    expect(idsOf(calls[3]!)).toHaveLength(50)
    expect(calls[3]).not.toContain('vid-100')
    expect(r.unitsUsed).toBe(4)
  })
})

describe('A5 E2: primeiras horas', () => {
  const H = 3_600_000
  const iso = (ms: number) => new Date(ms).toISOString()
  const earlyCalls = (db: ReturnType<typeof setup>) => db.calls.filter(c => c.table === 'competitor_video_early')
  const withPub = (publishedAt: unknown, over: Record<string, unknown> = {}) => page({ snippet: { ...page().snippet, publishedAt }, ...over })

  it('item 16: vídeo descoberto até 24 h depois de publicado ganha uma leitura por sincronização enquanto tiver menos de 72 h; os outros, nenhuma', async () => {
    const fresh = { ...ROW1, discovered_at: iso(EARLY.getTime() - 5 * H), published_at: iso(EARLY.getTime() - 10 * H) }
    const db = setup({ lastDaily: '2026-10-24', existing: [fresh] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, publishedAt: fresh.published_at } })), ...quiet })
    expect(arg(db.calls.find(c => c.table === 'competitor_video_early')!, 'upsert')).toEqual([{ video_id: 'v-1', taken_at: EARLY.toISOString(), site_id: 'site-1', views: 7, likes: 1, comments: 2 }])
    expect(r.earlyRecorded).toBe(1)
    for (const late of [{ ...fresh, discovered_at: null }, { ...fresh, published_at: iso(EARLY.getTime() - 80 * H) }, { ...fresh, discovered_at: iso(EARLY.getTime() - 5 * H), published_at: iso(EARLY.getTime() - 40 * H) }]) {
      const d2 = setup({ lastDaily: '2026-10-24', existing: [late] })
      await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, publishedAt: late.published_at } })), ...quiet })
      expect(d2.calls.some(c => c.table === 'competitor_video_early')).toBe(false)
    }
  })
  it('vídeo novo, descoberto agora com 3 h de vida: a primeira leitura das primeiras horas é a da descoberta', async () => {
    const pub = new Date(EARLY.getTime() - 3 * 3_600_000).toISOString()
    const db = setup({ lastDaily: '2026-10-24', existing: [] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, publishedAt: pub } })), ...quiet })
    expect(arg(db.calls.find(c => c.table === 'competitor_video_early')!, 'upsert')).toEqual([expect.objectContaining({ video_id: 'v-new', views: 7 })])
  })
  it('primeiras horas sem contagem de views: nenhuma linha (a coluna é not null), e nada lança', async () => {
    const fresh = { ...ROW1, discovered_at: new Date(EARLY.getTime() - 3_600_000).toISOString(), published_at: new Date(EARLY.getTime() - 2 * 3_600_000).toISOString() }
    const db = setup({ lastDaily: '2026-10-24', existing: [fresh] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, publishedAt: fresh.published_at }, statistics: {} })), ...quiet })
    expect(db.calls.some(c => c.table === 'competitor_video_early')).toBe(false)
  })

  it('dado ausente: publishedAt nulo, no futuro ou malformado não ganha leitura, e nada lança', async () => {
    for (const bad of [undefined, null, iso(EARLY.getTime() + 2 * H), 'ontem de manhã', '']) {
      const fresh = { ...ROW1, discovered_at: iso(EARLY.getTime() - H), published_at: iso(EARLY.getTime() - 2 * H) }
      const db = setup({ lastDaily: '2026-10-24', existing: [fresh] })
      await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(withPub(bad)), ...quiet })
      expect(earlyCalls(db), String(bad)).toEqual([])
      const db2 = setup({ lastDaily: '2026-10-24', existing: [] })
      await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(withPub(bad)), ...quiet })
      expect(earlyCalls(db2), 'novo ' + String(bad)).toEqual([])
    }
  })
  it('descoberta tarde: vídeo novo que já tinha mais de 24 h (ou mais de 72 h) ao ser descoberto não ganha primeiras horas', async () => {
    for (const ageH of [25, 30, 73, 500]) {
      const db = setup({ lastDaily: '2026-10-24', existing: [] })
      await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(withPub(iso(EARLY.getTime() - ageH * H))), ...quiet })
      expect(earlyCalls(db), ageH + ' h').toEqual([])
    }
    // e a fronteira: 24 h exatas ainda vale
    const db = setup({ lastDaily: '2026-10-24', existing: [] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(withPub(iso(EARLY.getTime() - 24 * H))), ...quiet })
    expect(earlyCalls(db)).toHaveLength(1)
  })
  it('a janela é a de RULES: com 71 h de vida ainda grava, com 72 h não', async () => {
    for (const [ageH, want] of [[71, 1], [72, 0]] as const) {
      const fresh = { ...ROW1, discovered_at: iso(EARLY.getTime() - ageH * H), published_at: iso(EARLY.getTime() - ageH * H) }
      const db = setup({ lastDaily: '2026-10-24', existing: [fresh] })
      await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(withPub(fresh.published_at)), ...quiet })
      expect(earlyCalls(db), ageH + ' h').toHaveLength(want)
    }
  })
  it('views ausentes viram nenhuma linha; likes e comentários ausentes viram nulo, nunca zero', async () => {
    const fresh = { ...ROW1, discovered_at: iso(EARLY.getTime() - H), published_at: iso(EARLY.getTime() - 2 * H) }
    const db = setup({ lastDaily: '2026-10-24', existing: [fresh] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(withPub(fresh.published_at, { statistics: { viewCount: '7' } })), ...quiet })
    expect(arg(earlyCalls(db)[0]!, 'upsert')).toEqual([{ video_id: 'v-1', taken_at: EARLY.toISOString(), site_id: 'site-1', views: 7, likes: null, comments: null }])
  })
  it('a mesma leitura repetida: o upsert ignora o conflito em (video_id, taken_at), e o vídeo que a resposta traz duas vezes vale uma vez', async () => {
    const fresh = { ...ROW1, discovered_at: iso(EARLY.getTime() - H), published_at: iso(EARLY.getTime() - 2 * H) }
    const db = setup({ lastDaily: '2026-10-24', existing: [fresh] })
    const inner = apiFetch(withPub(fresh.published_at))
    const twice = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await inner(input, init)
      if (!String(input).includes('/videos?')) return res
      const body = await res.json() as { items: unknown[] }
      return Response.json({ items: [...body.items, ...body.items] })
    }) as typeof fetch
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: twice, ...quiet })
    const call = earlyCalls(db)[0]!
    expect(call.ops.find(o => o[0] === 'upsert')![1][1]).toEqual({ onConflict: 'video_id,taken_at', ignoreDuplicates: true })
    expect(arg(call, 'upsert')).toHaveLength(1)
    expect(r.earlyRecorded).toBe(1)
    // uma nova tentativa com o mesmo `now` manda a mesma chave: o banco a ignora
    const db2 = setup({ lastDaily: '2026-10-24', existing: [fresh] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(withPub(fresh.published_at)), ...quiet })
    expect(arg(earlyCalls(db2)[0]!, 'upsert')).toEqual(arg(call, 'upsert'))
  })
  it('sem vídeo elegível não há chamada ao banco nem campo no resultado', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    expect(earlyCalls(db)).toEqual([])
    expect('earlyRecorded' in r).toBe(false)
  })
})

// A série do dia só existe hoje (a API dá o valor de agora): nenhuma gravação nova pode lançar na frente da passada diária.
describe('A5 E2: nenhuma gravação nova fica na frente da série do dia', () => {
  const H = 3_600_000
  const idsIn = (u: string) => decodeURIComponent(u.match(/[?&]id=([^&]*)/)![1]!).split(',')
  const echo = (_n: number, u: string) => idsIn(u).map(id => ({ id, snippet: { title: 'T' }, statistics: { viewCount: '5', likeCount: '1', commentCount: '0' }, contentDetails: { duration: 'PT10M' } }))
  const tr = (n: number) => ({ id: 'v-' + n, video_id: 'vid-' + n, title: 'T', thumbnail_url: null })
  const fresh = { ...ROW1, discovered_at: new Date(NOW.getTime() - H).toISOString(), published_at: new Date(NOW.getTime() - 2 * H).toISOString() }
  const freshPage = page({ snippet: { ...page().snippet, publishedAt: fresh.published_at } })
  /** Cenas: o que o canal tem e o que a API devolve. `fresh` = um vídeo de 2 h de vida na página; `novo` = o mesmo, ainda sem linha; `dois` = mais um só na passada diária; `fixado` = um fixado que só a passada dos fixados lê; `ausente` = um pedido que não volta; `completa` = passada diária de três, um fixado e um pedido que não volta (v-3): tudo o que vem DEPOIS de uma linha da passada diária ou dos fixados existe nela. */
  type Scene = { opts: SetupOpts; fetch: typeof fetch; log: { dailyCalls: string[] } }
  const scene = (opts: SetupOpts, daily?: (n: number, u: string) => Response | Record<string, unknown>[]): Scene => {
    const log = { dailyCalls: [] as string[] }
    return { opts, log, fetch: apiFetch(freshPage, 200, { ...(daily ? { daily } : {}), log }) }
  }
  const scenes: Record<'fresh' | 'novo' | 'dois' | 'fixado' | 'ausente' | 'completa', () => Scene> = {
    fresh: () => scene({ lastDaily: '2026-10-23', existing: [fresh] }),
    novo: () => scene({ lastDaily: '2026-10-23', existing: [] }),
    dois: () => scene({ lastDaily: '2026-10-23', existing: [fresh], tracked: [tr(1), tr(2)] }, echo),
    fixado: () => scene({ lastDaily: '2026-10-23', existing: [fresh], tracked: [tr(1), tr(2)], pinned: [PIN], dailyHave: ['v-pin'] }, echo),
    ausente: () => scene({ lastDaily: '2026-10-23', existing: [fresh], tracked: [tr(1), tr(2)] }, (_n, u) => echo(_n, u).filter(i => i.id === 'vid-1')),
    completa: () => scene({ lastDaily: '2026-10-23', existing: [fresh], tracked: [tr(1), tr(2), tr(3)], pinned: [PIN], dailyHave: ['v-pin'] }, (_n, u) => echo(_n, u).filter(i => i.id !== 'vid-3')),
  }
  /** O ponto do dia que cada cena grava (exato: ids e valores). `echo` dá 5/1/0; a passada de `fresh`/`novo` devolve o vídeo da página com `viewCount` 7 e mais nada (o falso do `apiFetch` troca as estatísticas): curtidas e comentários nulos, nunca 0. */
  const P = (video_id: string, views: number, likes: number | null, comments: number | null) => ({ video_id, snap_date: '2026-10-24', views, likes, comments, taken_at: NOW_ISO })
  const SERIE: Record<keyof typeof scenes, Array<ReturnType<typeof P>>> = {
    fresh: [P('v-1', 7, null, null)],
    novo: [P('v-1', 7, null, null)],
    dois: [P('v-1', 5, 1, 0), P('v-2', 5, 1, 0)],
    fixado: [P('v-1', 5, 1, 0), P('v-2', 5, 1, 0)],
    ausente: [P('v-1', 5, 1, 0)],
    completa: [P('v-1', 5, 1, 0), P('v-2', 5, 1, 0)],
  }
  /** O que só vem DEPOIS da linha que falhou, e só existe porque ela é `late` e não `fail` (`fail` cairia no `dailyFailure`/lançaria e pularia tudo isto). */
  const depoisDaFalha = (db: ReturnType<typeof setup>, log: { dailyCalls: string[] }): void => {
    // os fixados ainda são lidos (uma chamada só deles, depois da passada diária)
    expect(log.dailyCalls.flatMap(idsOf)).toContain('vid-pin')
    // a captura do bloco ainda roda: canal, página, passada diária e fixados = quatro leituras de campos
    expect(rpcCalls(db, 'apply_competitor_field_plan')).toHaveLength(4)
    // a marca de ausência ainda acontece, uma só vez, com o que não voltou
    expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([{ p_channel_id: 'cc-1', p_video_ids: ['v-3'], p_now: NOW_ISO }])
  }
  // Todas as gravações novas do sync de hoje, uma por vez. `skip` é a ordem da chamada que falha entre as que casam (a captura vai canal, página, passada diária, fixados).
  type Row = { name: string; scene: keyof typeof scenes; msg: RegExp; opts: Partial<SetupOpts>; after?: (db: ReturnType<typeof setup>, log: { dailyCalls: string[] }) => void }
  const verAntigas = (id: string) => [{ id: 'ver-' + id, video_id: id, field: 'title', value_text: 'T', value_hash: hashValue('T'), thumb_etag: null, thumb_dhash: null, first_seen_at: OLD, last_seen_at: OLD }]
  const ROWS: Row[] = [
    { name: 'inserir o vídeo novo', scene: 'novo', msg: /não foi possível gravar o vídeo novo/, opts: { failWrite: 'competitor_videos:insert' } },
    { name: 'regravar a linha do vídeo (página)', scene: 'fresh', msg: /não foi possível atualizar a linha do vídeo/, opts: { failWrite: 'competitor_videos:update' } },
    { name: 'regravar a linha do vídeo (passada diária)', scene: 'completa', msg: /não foi possível atualizar a linha do vídeo/, opts: { failUpdateOf: 'v-2' }, after: (db, log) => depoisDaFalha(db, log) },
    { name: 'regravar a linha do vídeo (fixados)', scene: 'completa', msg: /não foi possível atualizar a linha do vídeo/, opts: { failUpdateOf: 'v-pin' }, after: (db, log) => depoisDaFalha(db, log) },
    { name: 'a linha do canal', scene: 'fresh', msg: /não foi possível atualizar a linha do canal/, opts: { failWrite: 'competitor_channels:patch' } },
    { name: 'o retrato diário do canal', scene: 'fresh', msg: /não foi possível gravar o retrato diário do canal/, opts: { failWrite: 'competitor_channel_snapshots' } },
    { name: 'carimbar as versões (página)', scene: 'fresh', msg: /não foi possível carimbar as versões/, opts: { failWrite: 'competitor_video_versions:update', versions: verAntigas('v-1') } },
    { name: 'carimbar as versões (passada diária)', scene: 'dois', msg: /não foi possível carimbar as versões/, opts: { failWrite: 'competitor_video_versions:update', versions: verAntigas('v-2') } },
    { name: 'as primeiras horas', scene: 'fresh', msg: /não foi possível gravar as primeiras horas/, opts: { failWrite: 'competitor_video_early' } },
    { name: 'a gravação das faixas', scene: 'fresh', msg: /não foi possível gravar a faixa da série/, opts: { failWrite: 'rpc:apply_competitor_tier_plan' } },
    { name: 'a captura do canal (campos)', scene: 'fresh', msg: /histórico de campos/, opts: { failWrite: 'rpc:apply_competitor_field_plan', failWriteSkip: 0 } },
    { name: 'a captura do canal (texto bruto)', scene: 'fresh', msg: /texto bruto/, opts: { failWrite: 'rpc:apply_competitor_raw_plan', failWriteSkip: 0 } },
    { name: 'a captura dos vídeos (página, campos)', scene: 'fresh', msg: /histórico de campos/, opts: { failWrite: 'rpc:apply_competitor_field_plan', failWriteSkip: 1 } },
    { name: 'a captura dos vídeos (página, texto bruto)', scene: 'fresh', msg: /texto bruto/, opts: { failWrite: 'rpc:apply_competitor_raw_plan', failWriteSkip: 1 } },
    { name: 'a captura dos vídeos (passada diária)', scene: 'dois', msg: /histórico de campos/, opts: { failWrite: 'rpc:apply_competitor_field_plan', failWriteSkip: 2 } },
    { name: 'a captura dos vídeos (fixados)', scene: 'fixado', msg: /histórico de campos/, opts: { failWrite: 'rpc:apply_competitor_field_plan', failWriteSkip: 3 } },
    { name: 'o carimbo de última leitura dos vídeos', scene: 'fresh', msg: /não foi possível guardar a última leitura dos vídeos/, opts: { failStamp: true } },
    { name: 'a marca de ausência', scene: 'ausente', msg: /não foi possível marcar o que deixou de vir do YouTube/, opts: { failWrite: 'rpc:competitor_mark_missing' } },
  ]
  it.each(ROWS)('gravação nova falhando ($name): a série do dia é gravada e o canal termina em erro', async ({ scene: sc, msg, opts, after }) => {
    const s = scenes[sc]()
    const db = setup({ ...s.opts, ...opts })
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: s.fetch, ...quiet })).rejects.toThrow(msg)
    // a passada diária rodou e gravou o ponto de hoje, apesar da falha: os mesmos vídeos e os mesmos valores
    const ups = db.calls.filter(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')
    expect(ups.length, 'a série do dia não foi gravada').toBeGreaterThan(0)
    expect(arg(ups[0]!, 'upsert')).toEqual(SERIE[sc])
    after?.(db, s.log)
    // o canal termina em erro, com a frase em português, e não é carimbado como sincronizado
    const chUps = db.calls.filter(c => c.table === 'competitor_channels' && first(c) === 'update').map(c => arg(c, 'update') ?? {})
    expect(chUps.some(u => 'last_ok_synced_at' in u)).toBe(false)
    expect(chUps.at(-1)).toMatchObject({ sync_status: 'error' })
    expect(String(chUps.at(-1)!.sync_error)).toMatch(msg)
  })
  it('a falha da gravação da cota é a exceção: a série do dia é gravada, o canal termina bem e o resultado leva quotaError', async () => {
    const s = scenes.fresh()
    const db = setup({ ...s.opts, rpcFail: 'youtube_quota_add' })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: s.fetch, ...quiet })
    expect(r).toMatchObject({ quotaError: true, quotaUnitsLost: r.unitsUsed, dailyRecorded: 1 })
    expect(db.calls.some(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')).toBe(true)
    const ups = db.calls.filter(c => c.table === 'competitor_channels' && first(c) === 'update').map(c => arg(c, 'update') ?? {})
    expect(ups.at(-1)).toMatchObject({ sync_status: 'idle', sync_error: null, last_ok_synced_at: NOW_ISO })
  })
  it('várias gravações novas falhando de uma vez: o primeiro erro é o que o dono lê, e a série do dia é gravada inteira', async () => {
    const s = scenes.fresh()
    const db = setup({ ...s.opts, rpcFail: 'apply_competitor_tier_plan', failWrite: 'competitor_video_early' })
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: s.fetch, ...quiet })).rejects.toThrow('não foi possível gravar as primeiras horas: boom')
    expect(db.calls.some(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')).toBe(true)
  })
})

// A leitura semanal (OP-15): os vídeos em faixa semanal devidos hoje, lidos de UM canal por vez, sem sincronizar o canal.
describe('A5 E2: leitura semanal (syncCompetitorWeekly)', () => {
  beforeEach(() => { vi.mocked(createNotification).mockClear(); vi.mocked(archiveThumb).mockClear() })
  const slotDate = (ytId: string) => { let d = '2026-10-24'; while (dayNumber(d) % 7 !== weekSlotOf(ytId)) d = addDays(d, 1); return d }
  const at12 = (date: string) => new Date(date + 'T15:00:00.000Z')
  const weeklyRow = (i: number, over: Record<string, unknown> = {}) => row(i, 400 + i, { series_tier: 'semanal', series_tier_since: '2026-09-01', ...over })
  const dailyRow = row(1, 1, { series_tier: 'diaria', series_tier_since: '2026-09-01' })
  const stamp = (db: { calls: Call[] }) => db.calls.filter(c => c.table === 'competitor_channels' && first(c) === 'update' && 'weekly_pass_date' in (arg(c, 'update') ?? {})).map(c => arg(c, 'update'))
  const pointsOf = (db: { calls: Call[] }) => db.calls.filter(c => c.table === 'competitor_video_daily' && first(c) === 'upsert').flatMap(c => arg(c, 'upsert') as unknown as Array<{ video_id: string }>).map(p => p.video_id)
  /** Os n primeiros vídeos semanais (em ordem de id) cujo dia fixo é o de `day`; todos são devidos nesse dia. */
  const dueRows = (day: string, n: number) => Array.from({ length: 3000 }, (_, i) => weeklyRow(1000 + i)).filter(r => dayNumber(day) % 7 === weekSlotOf(r.video_id as string)).slice(0, n)

  it('OP-15: no dia fixo o vídeo semanal é lido: uma chamada, a linha, os campos, o raw, a miniatura conferida, o ponto, e o canal carimbado', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [dailyRow, weeklyRow(7)] })
    const log = { dailyCalls: [] as string[] }
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log }) })
    expect(log.dailyCalls.flatMap(idsOf)).toEqual(['vid-7'])                // só o semanal: o diário não é desta função
    expect(arg(db.calls.find(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')!, 'upsert')).toEqual([{ video_id: 'v-7', snap_date: day, views: 5, likes: 1, comments: 0, taken_at: at12(day).toISOString() }])
    expect(r).toMatchObject({ due: 1, recorded: 1, deferred: 0, complete: true, unitsUsed: 1 })
    expect(updatesOf(db, 'v-7').some(u => u.view_count === 5)).toBe(true)
    expect(rpcCalls(db, 'apply_competitor_raw_plan').flatMap(a => a.p_open as Array<{ video_id: string }>).some(o => o.video_id === 'v-7')).toBe(true)
    expect(vi.mocked(probeThumb)).toHaveBeenCalledWith('vid-7', null, expect.anything())   // D-I4: a miniatura do semanal É conferida
    expect(stamp(db)).toEqual([{ weekly_pass_date: day }])
    // não é uma sincronização do canal: nem channels.list, nem página, nem cursor, nem estado
    expect(db.calls.some(c => c.table === 'competitor_channels' && first(c) === 'update' && ('last_synced_at' in (arg(c, 'update') ?? {}) || 'sync_status' in (arg(c, 'update') ?? {})))).toBe(false)
  })
  it('só a chamada de videos.list: nada de channels.list nem de página de uploads, e as quatro partes pedidas', async () => {
    const day = slotDate('vid-7')
    setup({ all: [weeklyRow(7)] })
    const t = traced(apiFetch(null, 200, { daily: echo }))
    await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: t.f })
    expect(t.api()).toEqual(['videos?part=' + VIDEO_PARTS + '&id=vid-7'])
  })
  it('D-I4: a primeira leitura de um vídeo sem versão de miniatura abre a linha de base e guarda a cópia; thumbs: false não sonda', async () => {
    const day = slotDate('vid-7')
    vi.mocked(probeThumb).mockResolvedValue({ etag: '"e1"', lastModified: null, dhash: 'abcd', bytes: Buffer.from('x'), url: 'https://i.ytimg.com/vi/vid-7/hqdefault.jpg' })
    const db = setup({ all: [weeklyRow(7)] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    const plan = rpcs(db).find(p => p.p_video_id === 'v-7')!
    expect(plan.p_open.find(o => o.field === 'thumb')).toMatchObject({ precision: 'first', thumb_dhash: 'abcd', thumb_blob_url: 'https://blob.test/t.jpg' })
    expect(plan.p_changes).toEqual([])               // linha de base não é troca
    expect(r).toMatchObject({ changesDetected: 0, longWindowChanges: 0 })
    expect(vi.mocked(createNotification)).not.toHaveBeenCalled()
    expect(vi.mocked(archiveThumb)).toHaveBeenCalledTimes(1)
    vi.mocked(probeThumb).mockClear()
    setup({ all: [weeklyRow(7)] })
    await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }), thumbs: false })
    expect(vi.mocked(probeThumb)).not.toHaveBeenCalled()
  })
  it('a sonda da miniatura lançando: o ponto e a linha do vídeo são gravados, a falha é contada e o canal é carimbado', async () => {
    const day = slotDate('vid-7')
    vi.mocked(probeThumb).mockRejectedValue(new Error('rede'))
    const db = setup({ all: [weeklyRow(7)] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    expect(pointsOf(db)).toEqual(['v-7'])
    expect(updatesOf(db, 'v-7').some(u => u.view_count === 5)).toBe(true)
    expect(r).toMatchObject({ recorded: 1, complete: true, thumbFailed: 1 })
    expect(rpcs(db).find(p => p.p_video_id === 'v-7')!.p_open.some(o => o.field === 'thumb')).toBe(false)
  })
  it('o download/arquivo da miniatura falhando: a versão abre sem a cópia, o ponto e a linha do vídeo são gravados, e a falha é contada', async () => {
    const day = slotDate('vid-7')
    vi.mocked(probeThumb).mockResolvedValue({ etag: '"e1"', lastModified: null, dhash: 'abcd', bytes: Buffer.from('x'), url: 'u' })
    vi.mocked(archiveThumb).mockRejectedValueOnce(new Error('blob fora'))
    const db = setup({ all: [weeklyRow(7)] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    expect(rpcs(db).find(p => p.p_video_id === 'v-7')!.p_open.find(o => o.field === 'thumb')).toMatchObject({ thumb_blob_url: null, thumb_dhash: 'abcd' })
    expect(pointsOf(db)).toEqual(['v-7'])
    expect(r).toMatchObject({ recorded: 1, complete: true, thumbFailed: 1 })
  })
  it('OP-15: fora do dia fixo e com ponto há menos de 7 dias, não é pedido (e o canal é carimbado na hora); com 7 dias ou mais, é', async () => {
    const day = addDays(slotDate('vid-7'), 1)
    const log1 = { dailyCalls: [] as string[] }
    const db1 = setup({ all: [dailyRow, weeklyRow(7)], recentDaily: [{ video_id: 'v-7', snap_date: addDays(day, -6), views: 100 }] })
    const r1 = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log: log1 }) })
    expect(log1.dailyCalls).toEqual([])
    expect(r1).toMatchObject({ due: 0, complete: true, unitsUsed: 0 })
    expect(stamp(db1)).toEqual([{ weekly_pass_date: day }])
    const log2 = { dailyCalls: [] as string[] }
    setup({ all: [dailyRow, weeklyRow(7)], recentDaily: [{ video_id: 'v-7', snap_date: addDays(day, -7), views: 100 }] })
    await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log: log2 }) })
    expect(log2.dailyCalls.flatMap(idsOf)).toEqual(['vid-7'])
  })
  it('OP-15, D0: de 70 semanais, só os do dia fixo de hoje são lidos (a carga se espalha)', async () => {
    const all = Array.from({ length: 70 }, (_, i) => weeklyRow(100 + i, { series_tier_since: '2026-10-24' }))
    setup({ all })
    const log = { dailyCalls: [] as string[] }
    await syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo, log }) })
    const got = log.dailyCalls.flatMap(idsOf)
    expect(got).toEqual(all.filter(r => dayNumber('2026-10-24') % 7 === weekSlotOf(r.video_id as string)).map(r => r.video_id))
    expect(got.length).toBeLessThan(30)
  })
  it('dado ausente: vídeo cujo último ponto é de hoje não é relido, mesmo no dia fixo; o canal é carimbado', async () => {
    const day = slotDate('vid-7')
    const log = { dailyCalls: [] as string[] }
    const db = setup({ all: [weeklyRow(7)], recentDaily: [{ video_id: 'v-7', snap_date: day, views: 100 }] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log }) })
    expect(log.dailyCalls).toEqual([])
    expect(r).toMatchObject({ due: 0, recorded: 0, unitsUsed: 0, complete: true })
    expect(stamp(db)).toEqual([{ weekly_pass_date: day }])
  })
  it('dado ausente: vídeo que mudou de faixa HOJE (faixa desde hoje, sem ponto) fora do dia fixo não é devido; no dia fixo, é', async () => {
    const day = addDays(slotDate('vid-7'), 1)
    const log = { dailyCalls: [] as string[] }
    const db = setup({ all: [weeklyRow(7, { series_tier_since: day })] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log }) })
    expect(log.dailyCalls).toEqual([])
    expect(r).toMatchObject({ due: 0, complete: true })
    expect(stamp(db)).toEqual([{ weekly_pass_date: day }])
    const slot = slotDate('vid-7')
    const log2 = { dailyCalls: [] as string[] }
    setup({ all: [weeklyRow(7, { series_tier_since: slot })] })
    await syncCompetitorWeekly(ch, 'k', { now: at12(slot), fetchImpl: apiFetch(null, 200, { daily: echo, log: log2 }) })
    expect(log2.dailyCalls.flatMap(idsOf)).toEqual(['vid-7'])
  })
  it('dado ausente: canal com mais de 1.000 vídeos (duas páginas) é lido inteiro, e os devidos das duas páginas são pedidos; a leitura dos pontos vai em lotes de 100', async () => {
    const day = '2026-10-24'
    const total = 1200
    const everyone = Array.from({ length: total }, (_, i) => weeklyRow(5000 + i, { series_tier_since: day })) // faixa desde hoje: só o dia fixo é devido
    const expected = everyone.filter(r => dayNumber(day) % 7 === weekSlotOf(r.video_id as string)).map(r => r.video_id)
    expect(expected.some(id => everyone.findIndex(r => r.video_id === id) >= 1000)).toBe(true) // a prova só vale se há devido na 2ª página
    const db = setup({ allPages: [everyone.slice(0, 1000), everyone.slice(1000)] })
    const log = { dailyCalls: [] as string[] }
    const r = await syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo, log }) })
    expect(log.dailyCalls.flatMap(idsOf)).toEqual(expected)
    expect(r.due).toBe(expected.length)
    expect(db.calls.filter(c => c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'range')).length).toBe(2)
    expect(db.calls.filter(c => c.table === 'competitor_video_daily' && first(c) === 'select' && c.ops.some(o => o[0] === 'gte')).length).toBe(12) // 1200 ids / 100
  })
  describe('a reconciliação de versões de UM vídeo falhando (11b, preocupação 1): isolada por vídeo', () => {
    const DIA = '2026-10-24'
    const comMiniatura = (n: number, u: string) => echo(n, u).map(it => ({ ...it, snippet: { ...it.snippet, thumbnails: { high: { url: 'https://i.ytimg.com/vi/' + it.id + '/hq.jpg' } } } }))
    const lidos = (db: ReturnType<typeof setup>, uuid: string) => updatesOf(db, uuid).filter(u => 'view_count' in u)
    const rodar = async (db: ReturnType<typeof setup>): Promise<WeeklyVersionError> => {
      const e = await syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: comMiniatura }) }).then(() => null, (x: unknown) => x)
      expect(e).toBeInstanceOf(WeeklyVersionError)
      void db
      return e as WeeklyVersionError
    }
    it('3 vídeos numa chamada, o do meio falha na versão: 3 pontos, 2 linhas inteiras, a do meio sem a miniatura, versionFailed 1, e o canal é carimbado mesmo assim', async () => {
      const [a, b, c] = dueRows(DIA, 3)
      const db = setup({ all: [a!, b!, c!], versionPlanFailOf: [b!.id as string] })
      const e = await rodar(db)
      expect(pointsOf(db).sort()).toEqual([a!.id, b!.id, c!.id].sort())                       // (a) o ponto do vídeo que falhou é gravado
      for (const r of [a!, c!]) expect(lidos(db, r.id as string).at(-1)).toMatchObject({ view_count: 5, thumbnail_url: 'https://i.ytimg.com/vi/' + r.video_id + '/hq.jpg' }) // (c) os outros por inteiro
      expect(lidos(db, b!.id as string)).toHaveLength(1)                                      // (b) a linha do meio é regravada...
      expect(lidos(db, b!.id as string)[0]).toMatchObject({ view_count: 5, ...SINAIS })      //     ...com as contagens e os sinais...
      expect(lidos(db, b!.id as string)[0]).not.toHaveProperty('thumbnail_url')               //     ...e SEM a miniatura que a versão cobre
      expect(e.result).toMatchObject({ due: 3, recorded: 3, deferred: 0, complete: true, versionFailed: 1 }) // (d)
      expect(e.message).toMatch(new RegExp('^não foi possível gravar as versões do vídeo ' + (b!.video_id as string) + ': ')) // (e) português, a primeira falha
      expect(stamp(db)).toEqual([{ weekly_pass_date: DIA }])                                  // (e) carimbado: o recibo é o ponto
    })
    it('dois vídeos falhando: versionFailed 2 e o erro é o do PRIMEIRO; os dois pontos saem', async () => {
      const [a, b, c] = dueRows(DIA, 3)
      const db = setup({ all: [a!, b!, c!], versionPlanFailOf: [a!.id as string, c!.id as string] })
      const e = await rodar(db)
      expect(e.result).toMatchObject({ recorded: 3, versionFailed: 2, complete: true })
      expect(e.message).toContain(a!.video_id as string)
      expect(e.message).not.toContain(c!.video_id as string)
      expect(lidos(db, b!.id as string).at(-1)).toHaveProperty('thumbnail_url')
      expect(lidos(db, a!.id as string)[0]).not.toHaveProperty('thumbnail_url')
      expect(lidos(db, c!.id as string)[0]).not.toHaveProperty('thumbnail_url')
    })
    it('sem falha de versão: a linha leva a miniatura, o resultado volta (não lança) e não traz versionFailed', async () => {
      const [a] = dueRows(DIA, 1)
      const db = setup({ all: [a!] })
      const r = await syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: comMiniatura }) })
      expect(r).toMatchObject({ recorded: 1, complete: true })
      expect(r).not.toHaveProperty('versionFailed')
      expect(lidos(db, a!.id as string)[0]).toHaveProperty('thumbnail_url')
    })
    it('falha de captura (gravação que não é de versão) continua sem carimbar: só a versão isolada tem o recibo pelo ponto', async () => {
      const [a, b] = dueRows(DIA, 2)
      const db = setup({ all: [a!, b!], versionPlanFailOf: [a!.id as string], failWrite: 'rpc:apply_competitor_field_plan' })
      await expect(syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: comMiniatura }) })).rejects.toThrow(/histórico de campos/)
      expect(stamp(db)).toEqual([])
    })
  })
  it('dado ausente: a leitura dos vídeos falha: lança, nada é pedido ao YouTube, nada é carimbado, o estado do canal não é tocado', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)], allError: 'boom' })
    const log = { dailyCalls: [] as string[] }
    await expect(syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log }) })).rejects.toThrow(/não foi possível ler os vídeos do canal/)
    expect(log.dailyCalls).toEqual([])
    expect(db.calls.some(c => c.table === 'competitor_channels' && first(c) === 'update')).toBe(false)
  })
  it('dado ausente: a leitura dos pontos recentes falha: lança, nunca "nenhum ponto" (que releria tudo), nada é pedido e nada é carimbado', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)], recentDailyError: 'boom' })
    const log = { dailyCalls: [] as string[] }
    await expect(syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log }) })).rejects.toThrow(/não foi possível ler os pontos recentes da série: boom/)
    expect(log.dailyCalls).toEqual([])
    expect(stamp(db)).toEqual([])
  })
  it('a conta de cota: 34 devidos = 1 chamada; 120 devidos = 3 chamadas', async () => {
    const day = '2026-10-24'
    for (const [n, calls] of [[34, 1], [120, 3]] as const) {
      setup({ all: dueRows(day, n) })
      const r = await syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo }) })
      expect(r).toMatchObject({ due: n, recorded: n, unitsUsed: calls, complete: true })
    }
  })
  it('Review Focus 4: o relógio acaba no meio: o vídeo NÃO conferido não ganha ponto (o ponto é o recibo), o canal NÃO é carimbado, e os adiados são contados', async () => {
    const day = '2026-10-24'
    const due = dueRows(day, 34)
    const db = setup({ all: due })
    let checked = 0
    vi.mocked(probeThumb).mockImplementation(async () => { checked++; return { etag: null, lastModified: null, dhash: null, bytes: null, url: '' } })
    const r = await syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo }), deadline: () => checked >= 10 })
    expect(r).toMatchObject({ due: 34, recorded: 10, deferred: 24, complete: false })
    expect(pointsOf(db)).toEqual(due.slice(0, 10).map(x => x.id))        // só os 10 conferidos têm ponto
    expect(stamp(db)).toEqual([])
    // os 24 que vieram do YouTube e não foram conferidos NÃO contam como ausentes
    expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([])
    // os 10 conferidos tiveram a linha regravada; os 24 não (sem ponto, sem linha, sem captura)
    expect(due.slice(0, 10).every(x => updatesOf(db, x.id as string).some(u => u.view_count === 5))).toBe(true)
    expect(due.slice(10).every(x => updatesOf(db, x.id as string).length === 0)).toBe(true)
    // o teto que cortou registra quantos cortou, na linha do dia
    expect(rpcCalls(db, 'youtube_quota_add').at(-1)).toMatchObject({ p_units: 1, p_max: { semanais_adiados: 24 } })
  })
  it('o relógio corta no meio de um canal de 3 chamadas: lê 2, NÃO faz a 3ª (confere antes da chamada), adia 50, não carimba; o disparo seguinte lê só o que falta e carimba', async () => {
    const day = '2026-10-24'
    const due = dueRows(day, 120)                                          // 50 + 50 + 20
    const log = { dailyCalls: [] as string[] }
    const db = setup({ all: due })
    // o relógio fecha depois do 100º vídeo conferido, isto é, entre a 2ª e a 3ª chamada
    const r = await syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo, log }), deadline: () => vi.mocked(probeThumb).mock.calls.length >= 100 })
    expect(log.dailyCalls).toHaveLength(2)
    expect(r).toMatchObject({ due: 120, recorded: 100, deferred: 20, unitsUsed: 2, complete: false })
    expect(pointsOf(db)).toEqual(due.slice(0, 100).map(x => x.id))
    expect(stamp(db)).toEqual([])
    // retoma de onde parou: os 100 já têm o ponto de hoje (mesmo dia fixo ou não), só os 20 são pedidos
    const log2 = { dailyCalls: [] as string[] }
    const db2 = setup({ all: due, recentDaily: due.slice(0, 100).map(x => ({ video_id: x.id, snap_date: day, views: 5 })) })
    const r2 = await syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo, log: log2 }) })
    expect(log2.dailyCalls.flatMap(idsOf)).toEqual(due.slice(100).map(x => x.video_id))
    expect(r2).toMatchObject({ due: 20, recorded: 20, deferred: 0, complete: true })
    expect(stamp(db2)).toEqual([{ weekly_pass_date: day }])
  })
  it('relógio fechado desde o começo: nenhuma chamada à API, tudo adiado', async () => {
    const day = slotDate('vid-7')
    setup({ all: [weeklyRow(7)] })
    const log = { dailyCalls: [] as string[] }
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log }), deadline: () => true })
    expect(log.dailyCalls).toEqual([])
    expect(r).toMatchObject({ due: 1, recorded: 0, deferred: 1, complete: false, unitsUsed: 0 })
  })
  it('o canal está sendo sincronizado agora (syncing há menos de 10 minutos): não faz nada e diz skipped', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)], channelStatus: 'syncing', channelStartedAt: new Date(at12(day).getTime() - 60_000).toISOString() })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    expect(r).toMatchObject({ skipped: true, complete: false })
    expect(db.calls.some(c => first(c) === 'upsert' || c.table.startsWith('rpc:'))).toBe(false)
  })
  it('syncing há mais de 10 minutos (trava velha): a leitura segue', async () => {
    const day = slotDate('vid-7')
    setup({ all: [weeklyRow(7)], channelStatus: 'syncing', channelStartedAt: new Date(at12(day).getTime() - 11 * 60_000).toISOString() })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    expect(r).toMatchObject({ recorded: 1, complete: true })
    expect(r.skipped).toBeUndefined()
  })
  it('vídeo semanal pedido e não devolvido: uma falta (é assim que se descobre que saiu do ar); o canal é carimbado (ele foi PEDIDO)', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)], missed: [{ id: 'v-7', miss_streak: 1, miss_first_at: at12(day).toISOString(), missing_since: null, last_seen_at: null }] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: () => [] }) })
    expect(rpcCalls(db, 'competitor_mark_missing')[0]!.p_video_ids).toEqual(['v-7'])
    expect(r).toMatchObject({ due: 1, recorded: 0, deferred: 0, complete: true })
  })
  it('a API falha (HTTP 500): lança, o canal NÃO vai para erro, NÃO é carimbado, e nenhum vídeo conta como ausente', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)] })
    await expect(syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: () => new Response('x', { status: 500 }) }) })).rejects.toThrow(/500/)
    expect(db.calls.some(c => c.table === 'competitor_channels' && first(c) === 'update')).toBe(false)
    expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([])
  })
  it.each([
    ['200 sem a lista de vídeos', () => Response.json({})],
    ['200 com error no corpo', () => Response.json({ error: { code: 403, message: 'quota' } })],
    ['200 com items que não é lista', () => Response.json({ items: 'x' })],
  ])('regra 1: %s é falha da chamada, não sumiço: lança, ninguém ausente, nenhum ponto, não carimba', async (_nome, resposta) => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)] })
    await expect(syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: resposta }) })).rejects.toThrow(/resposta sem a lista de vídeos/)
    expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([])
    expect(pointsOf(db)).toEqual([])
    expect(stamp(db)).toEqual([])
  })
  it('regra 5: a cota é somada na linha do dia na chave competitors_semanal, inclusive as chamadas que falham (a 2ª de 2 chamadas dá 500: 2 unidades)', async () => {
    const day = '2026-10-24'
    const due = dueRows(day, 60)                                           // 50 + 10
    const db = setup({ all: due })
    await expect(syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: (n, u) => (n === 1 ? echo(n, u) : new Response('x', { status: 500 })) }) })).rejects.toThrow(/500/)
    expect(rpcCalls(db, 'youtube_quota_add').at(-1)).toMatchObject({ p_day: expect.stringMatching(/^2026-10-2[34]$/), p_units: 2, p_add: { competitors_semanal: 2 } })
    expect(pointsOf(db)).toEqual(due.slice(0, 50).map(x => x.id))          // o que já foi lido ficou gravado
    expect(stamp(db)).toEqual([])
  })
  it('regra 2: contagem ausente é nulo mais o sinalizador, nunca zero (e sem contagem de views não há ponto); "0" é zero medido', async () => {
    const day = slotDate('vid-7')
    // statistics presente e vazio: não medido
    const db = setup({ all: [weeklyRow(7)] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: (_n, u) => idsOf(u).map(id => ({ id, snippet: { title: 'T' }, statistics: {} })) }) })
    expect(updatesOf(db, 'v-7').at(-1)).toMatchObject({ view_count: null, views_hidden: true, like_count: null, likes_hidden: true, comment_count: null, comments_disabled: true })
    expect(pointsOf(db)).toEqual([])
    expect(r).toMatchObject({ due: 1, recorded: 0, deferred: 0, complete: true })
    // like e comment ausentes com views presente: ponto com nulo; "0" é zero
    const db2 = setup({ all: [weeklyRow(7)] })
    await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: (_n, u) => idsOf(u).map(id => ({ id, snippet: { title: 'T' }, statistics: { viewCount: '0' } })) }) })
    expect(arg(db2.calls.find(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')!, 'upsert')).toEqual([expect.objectContaining({ views: 0, likes: null, comments: null })])
    expect(updatesOf(db2, 'v-7').at(-1)).toMatchObject({ view_count: 0, views_hidden: false, like_count: null, likes_hidden: true })
  })
  it('regra 3: o vídeo devolvido grava de volta o MESMO patch do diário (faltas e marca de ausência zeradas)', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7, { missing_since: '2026-10-01T00:00:00.000Z' })] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    expect(updatesOf(db, 'v-7')).toEqual([{ ...SINAIS, ...SNIPPET0, last_checked_at: at12(day).toISOString(), view_count: 5, like_count: 1, comment_count: 0, views_hidden: false, likes_hidden: false, comments_disabled: false, duration_seconds: 600 }])
    expect(r).toMatchObject({ recorded: 1, complete: true })
  })
  it('regra 6: sem miniatura utilizável na resposta a chave thumbnail_url fica fora do patch (o gravado não é anulado)', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7, { thumbnail_url: 'https://gravada' })] })
    await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    expect('thumbnail_url' in updatesOf(db, 'v-7').at(-1)!).toBe(false)
  })
  it('regra 4: a captura falhando (disjuntor) não fica na frente do ponto: o ponto é gravado, o resto da captura é pulado e contado, o canal NÃO é carimbado e a leitura lança no fim', async () => {
    const day = '2026-10-24'
    const due = dueRows(day, 60)                                           // 2 chamadas: o disjuntor abre na captura da 1ª
    const db = setup({ all: due, failWrite: 'rpc:apply_competitor_field_plan' })
    await expect(syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo }) })).rejects.toThrow(/boom/)
    expect(pointsOf(db)).toEqual(due.map(x => x.id))                       // os 60 têm ponto
    expect(rpcCalls(db, 'apply_competitor_field_plan')).toHaveLength(1)    // a 2ª captura nem tentou
    expect(stamp(db)).toEqual([])
  })
  it('a linha do vídeo que não grava: o ponto é gravado, o erro sobe no fim e o canal NÃO é carimbado', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)], failUpdateOf: 'v-7' })
    await expect(syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })).rejects.toThrow(/não foi possível atualizar a linha do vídeo/)
    expect(pointsOf(db)).toEqual(['v-7'])
    expect(stamp(db)).toEqual([])
    expect(db.calls.some(c => c.table === 'competitor_channels' && first(c) === 'update' && 'sync_status' in (arg(c, 'update') ?? {}))).toBe(false)
  })
  it('o ponto que não grava lança (com frase em português) e o canal não é carimbado', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)], failWrite: 'competitor_video_daily:upsert' })
    await expect(syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })).rejects.toThrow(/^não foi possível gravar a leitura semanal/)
    expect(stamp(db)).toEqual([])
  })
  it('S-M8: troca de título vista num semanal com a janela de 7 dias: versão, linha de mudança com a janela, e conta para o aviso', async () => {
    const day = slotDate('vid-7')
    const lastSeen = new Date(at12(day).getTime() - 7 * 86_400_000).toISOString()
    const db = setup({ all: [weeklyRow(7)], versions: [{ id: 'tv7', video_id: 'v-7', field: 'title', value_text: 'Antigo', value_hash: hashValue('Antigo'), thumb_etag: null, thumb_dhash: null, last_seen_at: lastSeen }] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    const plan = rpcs(db).find(p => p.p_video_id === 'v-7')!
    expect(plan.p_changes).toHaveLength(1)
    expect(plan.p_changes[0]).toMatchObject({ window_start: lastSeen, window_end: at12(day).toISOString(), precision: '1d' }) // desvio D-12
    expect(r).toMatchObject({ changesDetected: 1, longWindowChanges: 0 })
  })
  it('S-M8, janela longa (60 dias): a versão E a linha de mudança são gravadas com a janela verdadeira (tela e Cowork contam igual), mas não conta para o aviso', async () => {
    const day = slotDate('vid-7')
    const lastSeen = new Date(at12(day).getTime() - 60 * 86_400_000).toISOString()
    const db = setup({ all: [weeklyRow(7)], versions: [{ id: 'tv7', video_id: 'v-7', field: 'title', value_text: 'Antigo', value_hash: hashValue('Antigo'), thumb_etag: null, thumb_dhash: null, last_seen_at: lastSeen }] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    const plan = rpcs(db).find(p => p.p_video_id === 'v-7')!
    expect(plan.p_open.find(o => o.field === 'title')).toMatchObject({ window_start: lastSeen })
    expect(plan.p_changes).toHaveLength(1)
    expect(plan.p_changes[0]).toMatchObject({ window_start: lastSeen })
    expect(r).toMatchObject({ changesDetected: 0, longWindowChanges: 1 })
    expect(vi.mocked(createNotification)).not.toHaveBeenCalled()
    expect(rpcCalls(db, 'youtube_quota_add').at(-1)).toMatchObject({ p_add: { competitors_semanal: 1, mudancas_janela_longa: 1 } })
  })
  // o dia do deploy e o canal novo: a fase roda antes de a sincronização gravar as faixas
  it('fecho F-1: canal em que ainda há vídeo SEM faixa não é carimbado: o que já tem faixa é lido, e complete é falso', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7), row(8, 408)] })                  // row() nasce com series_tier nulo
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    expect(r).toMatchObject({ due: 1, recorded: 1, deferred: 0, complete: false })
    expect(pointsOf(db)).toEqual(['v-7'])
    expect(stamp(db)).toEqual([])
  })
  it('fecho F-1: canal em que NENHUM vídeo tem faixa (antes da primeira sincronização com o código novo): nenhuma chamada à API, nada carimbado', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [row(1, 1), row(7, 407)] })
    const log = { dailyCalls: [] as string[] }
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log }) })
    expect(log.dailyCalls).toEqual([])
    expect(r).toMatchObject({ due: 0, recorded: 0, deferred: 0, unitsUsed: 0, complete: false })
    expect(stamp(db)).toEqual([])
  })
  it('fecho F-1: canal sem vídeo nenhum não tem o que esperar: é carimbado', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [] })
    expect(await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })).toMatchObject({ due: 0, complete: true })
    expect(stamp(db)).toEqual([{ weekly_pass_date: day }])
  })
  it('a cota da leitura semanal vai para a linha do dia, na chave competitors_semanal', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)] })
    await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    expect(rpcCalls(db, 'youtube_quota_add').at(-1)).toMatchObject({ p_units: 1, p_add: { competitors_semanal: 1 } })
  })
  it('a cota que não grava não derruba a leitura (Sentry) e o canal é carimbado', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)], rpcFail: 'youtube_quota_add' })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    expect(r).toMatchObject({ recorded: 1, complete: true })
    expect(stamp(db)).toEqual([{ weekly_pass_date: day }])
  })
})
