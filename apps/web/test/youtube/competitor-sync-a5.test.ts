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
import { setup, apiFetch, traced, updatesOf, first, arg, NOW, NOW_ISO, EARLY, ch, recent, quiet } from './competitor-sync-harness'

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
