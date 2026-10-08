// @vitest-environment node
// Veredito único da rota: a parte antiga e os passos novos só acumulam falhas[]; a última linha
// chama recordCronFailure UMA vez ou recordCronSuccess. Antes, o sucesso da parte antiga zerava
// a falha de qualquer passo novo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/analytics-sync', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/analytics-sync')>()),
  detectViral: vi.fn(() => false),
}))
vi.mock('@/lib/youtube/ab-fatigue', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/ab-fatigue')>()),
  detectFatigue: vi.fn(() => null),
}))
// O guarda ehMetadadosAntes é o de verdade: a rota decide com ele o que repassa à fase 'depois'.
vi.mock('@/lib/youtube/coleta', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/coleta')>()),
  rodarColeta: vi.fn(),
}))

import { GET, maxDuration } from '../../src/app/api/cron/sync-analytics-metrics/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken, NoActiveConnectionError } from '@/lib/social/token-refresh'
import * as Sentry from '@sentry/nextjs'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import { detectViral } from '@/lib/youtube/analytics-sync'
import { detectFatigue } from '@/lib/youtube/ab-fatigue'
import { rodarColeta } from '@/lib/youtube/coleta'
import { CHAVES_UNICAS_L1A, fakeSupabase, type FakeDb, type Row } from '../youtube/coleta/fake-supabase'

// Publicado há muito tempo: fica fora das janelas de marco (24h/48h/7d/30d).
const PUBLICADO = new Date(Date.now() - 400 * 86_400_000).toISOString()
const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', subscriber_count: 1000, name: 'Canal Um', sync_enabled: true }
const video = { id: 'v-1', youtube_video_id: 'yt-1', channel_id: 'ch-1', site_id: 'site-1', title: 'Vídeo', view_count: 500, view_count_yesterday: 10, view_count_delta_today: 5, published_at: PUBLICADO }
const canal2 = { ...canal, id: 'ch-2', channel_id: 'UC2', name: 'Canal Dois' }
const video2 = { ...video, id: 'v-2', youtube_video_id: 'yt-2', channel_id: 'ch-1' }
const video3 = { ...video, id: 'v-3', youtube_video_id: 'yt-3', channel_id: 'ch-2' }

// O banco em memória é estrito como o PostgREST: upsert com onConflict exige a chave única da tabela.
const CHAVES = { ...CHAVES_UNICAS_L1A, youtube_video_analytics: [['youtube_video_id', 'date']] }

function banco(seed: Record<string, Row[]> = { youtube_channels: [canal], youtube_videos: [video] }): FakeDb {
  const db = fakeSupabase(seed, CHAVES)
  vi.mocked(getSupabaseServiceClient).mockReturnValue(db.client as never)
  return db
}
const pedido = () => new Request('http://localhost/api/cron/sync-analytics-metrics', { headers: { authorization: `Bearer ${CRON_SECRET}` } })
const relatorio = (rows: (string | number)[][]) => ({ ok: true, status: 200, json: async () => ({ rows }) }) as unknown as Response
const coletaLimpa = async () => ({ falhas: [] as string[], resumo: {} })
const nota = () => vi.mocked(recordCronFailure).mock.calls[0]![1] as string
const fases = () => vi.mocked(rodarColeta).mock.calls.map(c => c[0].fase)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' } as never)
  vi.mocked(rodarColeta).mockImplementation(coletaLimpa)
  vi.mocked(detectViral).mockReturnValue(false)
  vi.mocked(detectFatigue).mockReturnValue(null)
  vi.mocked(fanOutToSiteAdmins).mockResolvedValue(1)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(relatorio([['yt-1', 120, 30, 45, 5, 2, 1, 0]])))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('sync-analytics-metrics: veredito único', () => {
  it('maxDuration é 300', () => {
    expect(maxDuration).toBe(300)
  })

  it('tudo certo: recordCronSuccess uma vez, as duas fases da coleta rodam em volta da parte antiga', async () => {
    const db = banco()
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ synced: 1, errors: 0, emptyReports: 0, skipped_no_connection: 0, notifications: 0, fatigueAlerts: 0, coleta: {}, acao_do_dono: [] })
    expect(typeof body.ms_existente).toBe('number')
    expect(body.falhas).toBeUndefined()
    expect(body.errorDetails).toBeUndefined()
    expect(fases()).toEqual(['antes', 'depois'])
    expect(db.tables.youtube_video_analytics).toHaveLength(1)
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
    expect(recordCronSuccess).toHaveBeenCalledWith('sync-analytics-metrics')
    expect(recordCronFailure).not.toHaveBeenCalled()
  })

  it('a fase antes roda antes da parte antiga e a fase depois, depois dela', async () => {
    banco()
    const ordem: string[] = []
    vi.mocked(rodarColeta).mockImplementation(async (ctx) => { ordem.push(ctx.fase); return { falhas: [], resumo: {} } })
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { ordem.push('antiga'); return relatorio([['yt-1', 120, 30, 45, 5, 2, 1, 0]]) }))
    await GET(pedido() as never)
    expect(ordem).toEqual(['antes', 'antiga', 'depois'])
  })

  it('passo novo falha e a parte antiga dá certo: recordCronFailure uma vez, recordCronSuccess nenhuma', async () => {
    banco()
    vi.mocked(rodarColeta).mockImplementation(async (ctx) =>
      ctx.fase === 'antes'
        ? { falhas: ['metadados: Canal Um tem 0 de 2 vídeos com linha no dia'], resumo: { metadados: { gravados: 0 } } }
        : { falhas: [], resumo: {} })
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.synced).toBe(1)
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(vi.mocked(recordCronFailure).mock.calls[0]![0]).toBe('sync-analytics-metrics')
    expect(nota()).toBe('metadados: Canal Um tem 0 de 2 vídeos com linha no dia')
    expect(recordCronSuccess).not.toHaveBeenCalled()
    expect(body.falhas).toEqual(['metadados: Canal Um tem 0 de 2 vídeos com linha no dia'])
  })

  it('schema_ausente num passo novo: falha crítica, os demais passos rodam, a rota responde 200 e a escrita antiga não é perdida', async () => {
    const db = banco()
    vi.mocked(rodarColeta).mockImplementation(async (ctx) =>
      ctx.fase === 'antes' ? { falhas: ['schema_ausente: yt_own_video_meta_daily'], resumo: {} } : { falhas: [], resumo: { relatorios: { baixados: 0 } } })
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(rodarColeta).toHaveBeenCalledTimes(2)
    expect(db.tables.youtube_video_analytics).toHaveLength(1)
    expect(db.tables.youtube_videos![0]).toMatchObject({ view_count_delta_today: 120 })
    expect(nota()).toBe('schema_ausente: yt_own_video_meta_daily')
    expect(body.coleta).toEqual({ relatorios: { baixados: 0 } })
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('falha da parte antiga e falha de passo novo saem juntas, numa chamada só', async () => {
    banco()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('corpo ya29.SEGREDO', { status: 503 })))
    vi.mocked(rodarColeta).mockImplementation(async (ctx) =>
      ctx.fase === 'depois' ? { falhas: ['relatórios: 2 relatório(s) listado(s) há mais de 14 dias sem baixar'], resumo: {} } : { falhas: [], resumo: {} })
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ synced: 0, errors: 1 })
    expect(body.errorDetails).toHaveLength(1)
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toContain('Canal Um (UC1): YouTube API 503')
    expect(nota()).toContain('relatórios: 2 relatório(s) listado(s) há mais de 14 dias sem baixar')
    expect(nota()).not.toContain('SEGREDO')
  })

  it('a mesma falha vinda das duas fases e da parte antiga entra uma vez só', async () => {
    const db = banco()
    db.writeErrors.youtube_video_analytics = { code: '42P01', message: 'relation does not exist' }
    vi.mocked(rodarColeta).mockResolvedValue({ falhas: ['schema_ausente: youtube_video_analytics', 'coleta: x'], resumo: {} })
    const body = await (await GET(pedido() as never)).json()
    expect(body.falhas).toEqual(['schema_ausente: youtube_video_analytics', 'coleta: x'])
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toBe('schema_ausente: youtube_video_analytics; coleta: x')
  })

  it('todos os canais com relatório vazio continua sendo falha, agora pelo veredito', async () => {
    banco()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(relatorio([])))
    const body = await (await GET(pedido() as never)).json()
    expect(body).toMatchObject({ synced: 0, emptyReports: 1 })
    expect(fases()).toEqual(['antes', 'depois'])
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toMatch(/^all 1 channel\(s\) returned an empty analytics report for the \d+-day window$/)
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('escrita antiga em tabela ausente (42P01): schema_ausente em falhas, sem lançar, e o laço segue para o próximo vídeo e o próximo canal', async () => {
    const db = banco({ youtube_channels: [canal, canal2], youtube_videos: [video, video2, video3] })
    db.writeErrors.youtube_video_analytics = { code: '42P01', message: 'relation "youtube_video_analytics" does not exist' }
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) =>
      new URL(url).searchParams.get('ids') === 'channel==UC1'
        ? relatorio([['yt-1', 120, 30, 45, 5, 2, 1, 0], ['yt-2', 80, 30, 45, 5, 2, 1, 0]])
        : relatorio([['yt-3', 60, 30, 45, 5, 2, 1, 0]])))
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.synced).toBe(2)
    expect(db.tables.youtube_videos!.map(v => v.view_count_delta_today)).toEqual([120, 80, 60])
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toBe('schema_ausente: youtube_video_analytics')
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('escrita antiga com coluna ausente (PGRST204) e com outro erro de banco: as duas ficam visíveis, sem o texto do Postgres', async () => {
    const db = banco()
    db.writeErrors.youtube_videos = { code: 'PGRST204', message: "Could not find the 'x' column" }
    db.writeErrors.youtube_video_analytics = { code: '23505', message: 'duplicate key value violates unique constraint "segredo"' }
    await GET(pedido() as never)
    expect(nota()).toBe('schema_ausente: youtube_videos; erro de banco ao gravar youtube_video_analytics')
  })

  it('leitura dos vídeos do canal falha: não conta como sincronizado nem como "sem vídeos"; vira falha', async () => {
    const db = banco()
    db.errors.youtube_videos = { code: '57014', message: 'statement timeout' }
    const body = await (await GET(pedido() as never)).json()
    expect(body.synced).toBe(0)
    expect(db.tables.youtube_video_analytics ?? []).toHaveLength(0)
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toBe('erro de banco ao ler youtube_videos')
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('leitura do marco falha: não é tratada como "sem linha"; vira falha', async () => {
    // 30 h de idade: dentro da janela views_at_24h e fora da fadiga (que exige 30 dias).
    const novo = { ...video, published_at: new Date(Date.now() - 30 * 3_600_000).toISOString() }
    const db = banco({ youtube_channels: [canal], youtube_videos: [novo] })
    const original = db.client.from.bind(db.client)
    let leituras = 0
    vi.spyOn(db.client, 'from').mockImplementation(((t: string) => {
      const q = original(t)
      if (t !== 'youtube_video_analytics') return q
      return new Proxy(q, {
        get(alvo, prop, r) {
          if (prop === 'select') {
            return () => { leituras++; return { eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: { code: '57014', message: 'statement timeout' } }) }) }) }) } }
          }
          const v = Reflect.get(alvo, prop, r)
          return typeof v === 'function' ? v.bind(alvo) : v
        },
      })
    }) as never)
    await GET(pedido() as never)
    expect(leituras).toBe(1)
    expect(db.tables.youtube_video_analytics).toHaveLength(1)
    expect(nota()).toBe('erro de banco ao ler youtube_video_analytics')
  })

  it('marco: grava views_at_24h quando a linha do dia existe e a escrita é conferida', async () => {
    const novo = { ...video, published_at: new Date(Date.now() - 30 * 3_600_000).toISOString() }
    const db = banco({ youtube_channels: [canal], youtube_videos: [novo] })
    await GET(pedido() as never)
    expect(db.tables.youtube_video_analytics![0]).toMatchObject({ views_at_24h: 500 })
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
  })

  it('fadiga: leitura dos testes A/B falha: nenhum alerta é criado às cegas; vira falha', async () => {
    const db = banco()
    db.errors.ab_tests = { code: '57014', message: 'statement timeout' }
    vi.mocked(detectFatigue).mockReturnValue({ isFatigued: true, zScore: -2, expectedViews: 60, actualViews: 55 })
    const body = await (await GET(pedido() as never)).json()
    expect(body.fatigueAlerts).toBe(0)
    expect(db.tables.youtube_fatigue_alerts ?? []).toHaveLength(0)
    expect(nota()).toBe('erro de banco ao ler ab_tests')
  })

  it('fadiga: leitura do alerta pendente falha: não insere duplicado; vira falha de leitura', async () => {
    const db = banco()
    db.errors.youtube_fatigue_alerts = { code: '57014', message: 'statement timeout' }
    vi.mocked(detectFatigue).mockReturnValue({ isFatigued: true, zScore: -2, expectedViews: 60, actualViews: 55 })
    const body = await (await GET(pedido() as never)).json()
    expect(body.fatigueAlerts).toBe(0)
    expect(nota()).toBe('erro de banco ao ler youtube_fatigue_alerts')
  })

  it('fadiga: insert conferido — conta só o que gravou; erro vira falha', async () => {
    // youtube_fatigue_alerts.expected_ctr/actual_ctr são numeric(6,4): o teto é 99,9999. A rota grava
    // ali contagens de views, então em produção qualquer valor >= 100 dá 22003 (caso abaixo). O banco
    // em memória não tem tipos: os valores daqui cabem na coluna de propósito.
    vi.mocked(detectFatigue).mockReturnValue({ isFatigued: true, zScore: -2, expectedViews: 60, actualViews: 55 })
    const ok = banco()
    const corpoOk = await (await GET(pedido() as never)).json()
    expect(corpoOk.fatigueAlerts).toBe(1)
    expect(ok.tables.youtube_fatigue_alerts).toHaveLength(1)
    expect(recordCronFailure).not.toHaveBeenCalled()

    const ruim = banco()
    ruim.writeErrors.youtube_fatigue_alerts = { code: 'PGRST205', message: 'Could not find the table' }
    const corpoRuim = await (await GET(pedido() as never)).json()
    expect(corpoRuim.fatigueAlerts).toBe(0)
    expect(nota()).toBe('schema_ausente: youtube_fatigue_alerts')
  })

  it('fadiga: alerta gravado avisa no sininho, com texto que não promete CTR nem causa, uma vez por vídeo e semana', async () => {
    banco()
    vi.mocked(detectFatigue).mockReturnValue({ isFatigued: true, zScore: -2.13, expectedViews: 240, actualViews: 90 })
    const body = await (await GET(pedido() as never)).json()
    expect(body.fatigueAlerts).toBe(1)
    expect(recordCronFailure).not.toHaveBeenCalled()
    expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
    const n = vi.mocked(fanOutToSiteAdmins).mock.calls[0]![0]
    expect(n).toMatchObject({
      siteId: 'site-1',
      domain: 'youtube',
      type: 'youtube.views_below_trend',
      priority: 3,
      title: 'Vídeo abaixo da própria tendência',
      actionHref: '/cms/youtube/ab-lab',
      payload: { videoId: 'v-1' },
    })
    expect(n.message).toBe('"Vídeo" soma 90 views na janela de 90 dias; a curva do próprio vídeo esperava cerca de 240. Sinal fraco: é só views abaixo da tendência, não mede CTR nem aponta a causa.')
    expect(n.dedupKey).toMatch(/^views_below_trend:v-1:\d{4}-W\d{2}$/)
  })

  it('fadiga: alerta pendente já existe — não grava outro nem avisa de novo', async () => {
    const db = banco({ youtube_channels: [canal], youtube_videos: [video], youtube_fatigue_alerts: [{ id: 'a-1', video_id: 'v-1', site_id: 'site-1', status: 'pending' }] })
    vi.mocked(detectFatigue).mockReturnValue({ isFatigued: true, zScore: -2, expectedViews: 240, actualViews: 90 })
    const body = await (await GET(pedido() as never)).json()
    expect(body.fatigueAlerts).toBe(0)
    expect(db.tables.youtube_fatigue_alerts).toHaveLength(1)
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
    expect(recordCronFailure).not.toHaveBeenCalled()
  })

  it('fadiga: alerta que não gravou não avisa', async () => {
    const db = banco()
    db.writeErrors.youtube_fatigue_alerts = { code: '22003', message: 'numeric field overflow' }
    vi.mocked(detectFatigue).mockReturnValue({ isFatigued: true, zScore: -2, expectedViews: 240, actualViews: 90 })
    await GET(pedido() as never)
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
  })

  it('fadiga: aviso que não sai, ou que não tem para quem ir, é falha visível; o alerta fica gravado', async () => {
    const semDestino = banco()
    vi.mocked(detectFatigue).mockReturnValue({ isFatigued: true, zScore: -2, expectedViews: 240, actualViews: 90 })
    vi.mocked(fanOutToSiteAdmins).mockResolvedValue(0)
    const corpo = await (await GET(pedido() as never)).json()
    expect(corpo.fatigueAlerts).toBe(1)
    expect(semDestino.tables.youtube_fatigue_alerts).toHaveLength(1)
    expect(nota()).toBe('aviso de fadiga: sem destinatário')

    vi.mocked(recordCronFailure).mockClear()
    banco()
    vi.mocked(fanOutToSiteAdmins).mockRejectedValue(new Error('boom'))
    await GET(pedido() as never)
    expect(nota()).toBe('aviso de fadiga: unexpected error (Error)')
  })

  it('fadiga: insert recusado por overflow da coluna (22003) é falha crítica, não conta, e o laço segue para o próximo vídeo', async () => {
    const db = banco({ youtube_channels: [canal], youtube_videos: [video, video2] })
    // O que o Postgres responde hoje a expected_ctr = 100 ou mais.
    db.writeErrors.youtube_fatigue_alerts = { code: '22003', message: 'numeric field overflow' }
    vi.mocked(detectFatigue).mockReturnValue({ isFatigued: true, zScore: -2, expectedViews: 100, actualViews: 500 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(relatorio([['yt-1', 120, 30, 45, 5, 2, 1, 0], ['yt-2', 80, 30, 45, 5, 2, 1, 0]])))
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(detectFatigue).toHaveBeenCalledTimes(2)
    expect(body.fatigueAlerts).toBe(0)
    expect(body.falhas).toEqual(['erro de banco ao gravar youtube_fatigue_alerts'])
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toBe('erro de banco ao gravar youtube_fatigue_alerts')
    expect(nota()).not.toContain('overflow')
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('leitura da rota vazia: ainda chama a coleta nas duas fases, dá o veredito e só então responde no_channels', async () => {
    banco({ youtube_channels: [{ ...canal, sync_enabled: false }] })
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ status: 'no_channels', ms_existente: 0, coleta: {}, acao_do_dono: [] })
    expect(body.synced).toBeUndefined()
    expect(fases()).toEqual(['antes', 'depois'])
    expect(fetch).not.toHaveBeenCalled()
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
    expect(recordCronFailure).not.toHaveBeenCalled()
  })

  it('leitura da rota vazia e a coleta falha: no_channels com recordCronFailure', async () => {
    banco({ youtube_channels: [] })
    vi.mocked(rodarColeta).mockResolvedValue({ falhas: ['coleta: erro de banco ao ler os canais'], resumo: {} })
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(body.status).toBe('no_channels')
    expect(body.falhas).toEqual(['coleta: erro de banco ao ler os canais'])
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toBe('coleta: erro de banco ao ler os canais')
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('erro ao ler os canais: 500 e o registro antigo, fora do veredito; a coleta não roda', async () => {
    const db = banco({})
    db.errors.youtube_channels = { code: '57014', message: 'statement timeout' }
    const res = await GET(pedido() as never)
    expect(res.status).toBe(500)
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(recordCronFailure).toHaveBeenCalledWith('sync-analytics-metrics', 'database error listing the YouTube channels')
    expect(recordCronSuccess).not.toHaveBeenCalled()
    expect(rodarColeta).not.toHaveBeenCalled()
  })

  it('rodarColeta lança: vira falha, a parte antiga roda e a rota responde 200', async () => {
    const db = banco()
    vi.mocked(rodarColeta).mockRejectedValueOnce(new Error('boom')).mockImplementation(coletaLimpa)
    const res = await GET(pedido() as never)
    expect(res.status).toBe(200)
    expect(db.tables.youtube_video_analytics).toHaveLength(1)
    expect(fases()).toEqual(['antes', 'depois'])
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toBe('coleta (antes): unexpected error (Error)')
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('rodarColeta devolve lixo (undefined): vira falha, não derruba a rota', async () => {
    banco()
    vi.mocked(rodarColeta).mockResolvedValue(undefined as never)
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.synced).toBe(1)
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toContain('coleta (antes)')
    expect(nota()).toContain('coleta (depois)')
  })

  it('a parte antiga lança no canal 2: o detalhe do canal 1 (403) e a exceção saem juntos, e a fase depois roda', async () => {
    banco({ youtube_channels: [canal, canal2], youtube_videos: [video] })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('quota', { status: 403 })))
    vi.mocked(ensureFreshToken).mockImplementation(async (_s: string, _p: string, conta?: string) => {
      if (conta === 'UC2') throw new Error('falha qualquer')
      return { accessToken: 'tok', connectionId: 'c1' } as never
    })
    // O catch por canal chama o Sentry; se ele lançar, a exceção escapa do laço e da parte antiga.
    vi.mocked(Sentry.captureException).mockImplementationOnce(() => { throw new Error('boom') })
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(fases()).toEqual(['antes', 'depois'])
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toBe('Canal Um (UC1): YouTube API 403 — permission denied or quota exceeded; parte existente: unexpected error (Error)')
    expect(recordCronSuccess).not.toHaveBeenCalled()
    expect(typeof body.ms_existente).toBe('number')
  })

  it('aviso de vídeo em alta que não sai: falha nomeada, e a fadiga e a fase depois rodam', async () => {
    const db = banco()
    vi.mocked(detectViral).mockReturnValue(true)
    vi.mocked(fanOutToSiteAdmins).mockRejectedValue(new Error('boom'))
    vi.mocked(detectFatigue).mockReturnValue({ isFatigued: true, zScore: -2, expectedViews: 60, actualViews: 55 })
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ synced: 1, notifications: 1, fatigueAlerts: 1 })
    expect(db.tables.youtube_fatigue_alerts).toHaveLength(1)
    expect(fases()).toEqual(['antes', 'depois'])
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toContain('aviso de vídeo em alta: unexpected error (Error)')
    expect(nota()).toContain('aviso de fadiga: unexpected error (Error)')
    expect(Sentry.captureException).toHaveBeenCalledTimes(2)
  })

  it('aviso de canal sem conexão que não sai: deixa de ser falha verde', async () => {
    banco()
    vi.mocked(ensureFreshToken).mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
    vi.mocked(fanOutToSiteAdmins).mockRejectedValue(new Error('boom'))
    const body = await (await GET(pedido() as never)).json()
    expect(body).toMatchObject({ skipped_no_connection: 1, errors: 0 })
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toBe('aviso de canal sem conexão: unexpected error (Error)')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('exceção no bloco da fadiga: deixa de ser falha verde', async () => {
    banco()
    vi.mocked(detectFatigue).mockImplementation(() => { throw new Error('boom') })
    const body = await (await GET(pedido() as never)).json()
    expect(body).toMatchObject({ synced: 1, fatigueAlerts: 0 })
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toBe('fadiga: unexpected error (Error)')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('a fase depois recebe o metadados da fase antes, e as duas recebem o MESMO relógio (270 s)', async () => {
    banco()
    const metadados = { day_pt: '2020-01-01', dias_sem_meta: { 'ch-1': 0 }, gravados: 3 }
    vi.mocked(rodarColeta).mockImplementation(async (ctx) =>
      ctx.fase === 'antes' ? { falhas: [], resumo: { metadados } } : { falhas: [], resumo: {} })
    await GET(pedido() as never)
    const [antes, depois] = vi.mocked(rodarColeta).mock.calls.map(c => c[0])
    expect(antes!.metadadosAntes).toBeUndefined()
    expect(depois!.metadadosAntes).toBe(metadados)
    expect(depois!.relogio).toBe(antes!.relogio)
    expect(antes!.relogio.fim - antes!.relogio.inicio).toBe(270_000)
    expect(depois!.supabase).toBe(antes!.supabase)
  })

  it.each([
    ['passo pulado, sem day_pt', { gravados: 0, sem_tempo: true }],
    ['sem dias_sem_meta', { day_pt: '2020-01-01' }],
    ['lista', [{ day_pt: '2020-01-01', dias_sem_meta: {} }]],
    ['texto', 'lixo'],
    ['ausente', undefined],
  ])('metadados que não passa no guarda (%s): a fase depois recebe undefined', async (_nome, metadados) => {
    banco()
    vi.mocked(rodarColeta).mockImplementation(async (ctx) =>
      ctx.fase === 'antes' ? { falhas: [], resumo: { metadados } } : { falhas: [], resumo: {} })
    await GET(pedido() as never)
    const depois = vi.mocked(rodarColeta).mock.calls[1]![0]
    expect(depois.fase).toBe('depois')
    expect(depois.metadadosAntes).toBeUndefined()
    expect('metadadosAntes' in depois).toBe(false)
  })

  it('o fetch da parte antiga leva timeout de 15 s quando sobra relógio', async () => {
    banco()
    const espia = vi.spyOn(AbortSignal, 'timeout')
    await GET(pedido() as never)
    const init = vi.mocked(fetch).mock.calls[0]![1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(espia).toHaveBeenCalledTimes(1)
    expect(espia).toHaveBeenCalledWith(15_000)
  })

  it('o timeout do fetch é o que resta do relógio global quando resta menos de 15 s', async () => {
    const agora = Date.now()
    vi.useFakeTimers({ now: agora, toFake: ['Date'] })
    banco()
    // A fase 'antes' "gasta" 265 s: sobram 5 s dos 270 s.
    vi.mocked(rodarColeta).mockImplementation(async (ctx) => {
      if (ctx.fase === 'antes') vi.setSystemTime(agora + 265_000)
      return { falhas: [], resumo: {} }
    })
    const espia = vi.spyOn(AbortSignal, 'timeout')
    await GET(pedido() as never)
    expect(espia).toHaveBeenCalledWith(5_000)
  })

  it('ms_existente mede só a parte antiga', async () => {
    const agora = Date.now()
    vi.useFakeTimers({ now: agora, toFake: ['Date'] })
    banco()
    vi.mocked(rodarColeta).mockImplementation(async (ctx) => {
      vi.setSystemTime(Date.now() + (ctx.fase === 'antes' ? 7_000 : 9_000))
      return { falhas: [], resumo: {} }
    })
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 1_234)
      return relatorio([['yt-1', 120, 30, 45, 5, 2, 1, 0]])
    }))
    const body = await (await GET(pedido() as never)).json()
    expect(body.ms_existente).toBe(1_234)
  })

  it('acao_do_dono: união das duas fases, sem duplicatas, na resposta; nunca na nota nem em falhas', async () => {
    banco()
    vi.mocked(rodarColeta).mockImplementation(async (ctx) =>
      ctx.fase === 'antes'
        ? { falhas: [], resumo: { jobs: { gravados: 1 }, acao_do_dono: ['Canal Um: api_nao_ativada', 'Canal Um: sem_acesso'] } }
        : { falhas: [], resumo: { perdidos: 2, acao_do_dono: ['Canal Um: sem_acesso', 'Canal Um: channel_reach_basic_a1 em sem_acesso'] } })
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(body.acao_do_dono).toEqual(['Canal Um: api_nao_ativada', 'Canal Um: sem_acesso', 'Canal Um: channel_reach_basic_a1 em sem_acesso'])
    expect(body.coleta).toEqual({ jobs: { gravados: 1 }, perdidos: 2 })
    expect(body.falhas).toBeUndefined()
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
    expect(recordCronFailure).not.toHaveBeenCalled()
  })

  it('vazios_sem_publicacao da fase depois sai em coleta na resposta e não deixa o cron vermelho', async () => {
    banco()
    vi.mocked(rodarColeta).mockImplementation(async (ctx) =>
      ctx.fase === 'antes'
        ? { falhas: [], resumo: {} }
        : { falhas: [], resumo: { perdidos: 0, atrasados: 0, vazios_sem_publicacao: ['Canal Sem Vídeo'] } })
    const body = await (await GET(pedido() as never)).json()
    expect(body.coleta.vazios_sem_publicacao).toEqual(['Canal Sem Vídeo'])
    expect(body.falhas).toBeUndefined()
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
    expect(recordCronFailure).not.toHaveBeenCalled()
  })

  it('acao_do_dono com falha ao lado: a nota leva só a falha', async () => {
    banco()
    vi.mocked(rodarColeta).mockImplementation(async (ctx) =>
      ctx.fase === 'antes'
        ? { falhas: ['jobs: x'], resumo: { acao_do_dono: ['Canal Um: api_nao_ativada'] } }
        : { falhas: [], resumo: {} })
    const body = await (await GET(pedido() as never)).json()
    expect(body.acao_do_dono).toEqual(['Canal Um: api_nao_ativada'])
    expect(nota()).toBe('jobs: x')
    expect(nota()).not.toContain('api_nao_ativada')
  })

  it('sem o segredo: 401, nada roda', async () => {
    banco()
    const res = await GET(new Request('http://localhost/api/cron/sync-analytics-metrics') as never)
    expect(res.status).toBe(401)
    expect(rodarColeta).not.toHaveBeenCalled()
    expect(recordCronSuccess).not.toHaveBeenCalled()
    expect(recordCronFailure).not.toHaveBeenCalled()
  })
})
