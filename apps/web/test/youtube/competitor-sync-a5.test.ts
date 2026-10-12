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

import { syncCompetitorChannel, syncStatsOf, VIDEO_PARTS } from '@/lib/youtube/competitor-sync'
import { probeThumb } from '@/lib/youtube/thumb-fingerprint'
import { fieldHash, rawOf } from '@/lib/youtube/competitor-capture'
import { setup, apiFetch, traced, updatesOf, rpcCalls, first, arg, NOW, NOW_ISO, EARLY, ch, recent, quiet, SINAIS, SNIPPET0 } from './competitor-sync-harness'

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
    expect(chUpdate(db3)).toMatchObject({ channel_name: '', thumbnail_url: null, subscriber_count: null, youtube_video_count: 0 })
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
  it('com a parte statistics (mesmo vazia): o retrato é gravado como sempre foi', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ ...base, statistics: { subscriberCount: '10', videoCount: '4', viewCount: '99' } }] }), ...quiet })
    expect(arg(snapshots(db)[0]!, 'upsert')).toMatchObject({ subscriber_count: 10, video_count: 4, view_count: 99 })
    const db2 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ ...base, statistics: {} }] }), ...quiet })
    expect(snapshots(db2)).toHaveLength(1)
  })
})
