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

import { syncCompetitorChannel, VIDEO_PARTS } from '@/lib/youtube/competitor-sync'
import { probeThumb } from '@/lib/youtube/thumb-fingerprint'
import { fieldHash, rawOf } from '@/lib/youtube/competitor-capture'
import { setup, apiFetch, traced, updatesOf, rpcCalls, first, arg, NOW, NOW_ISO, EARLY, ch, recent, quiet } from './competitor-sync-harness'

beforeEach(() => {
  vi.mocked(probeThumb).mockReset()
  vi.mocked(probeThumb).mockResolvedValue({ etag: null, lastModified: null, dhash: null, bytes: null, url: 'u' })
})

const OLD = new Date(NOW.getTime() - 400 * 86_400_000).toISOString()
const page = (over: Record<string, unknown> = {}) => ({ id: 'vid-1', snippet: { title: 'T', description: '', publishedAt: recent(), tags: ['a'], categoryId: '19' }, statistics: { viewCount: '7', likeCount: '1', commentCount: '2' }, contentDetails: { duration: 'PT10M' }, ...over })
const ROW1 = { id: 'v-1', video_id: 'vid-1', title: 'T', description_hash: 'x', thumbnail_url: null, view_count: 1, is_short: false }
const PIN = { id: 'v-pin', video_id: 'vid-pin', title: 'Fixado', thumbnail_url: null }
const inserts = (db: ReturnType<typeof setup>) => db.calls.filter(c => c.table === 'competitor_videos' && first(c) === 'insert').map(c => arg(c, 'insert')!)

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
    expect(updatesOf(db, 'v-2')).toEqual([expect.objectContaining({ view_count: 5, comment_count: 0, comments_disabled: false, last_checked_at: NOW_ISO })])
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
    expect(updatesOf(db, 'v-3')).toEqual([expect.objectContaining({ view_count: 5, last_checked_at: NOW_ISO })])
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
    expect(updatesOf(db2, 'v-1').at(-1)).toMatchObject({ tags: ['a'], category_id: '19', thumbnail_url: null })
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
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page()), ...quiet })).rejects.toThrow(/captura|histórico de campos/)
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
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { hiddenSubscriberCount: true } }] }), ...quiet })
    expect(arg(db.calls.find(c => c.table === 'competitor_channel_snapshots')!, 'upsert')).toMatchObject({ subscribers_hidden: true, subscriber_count: null })
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
