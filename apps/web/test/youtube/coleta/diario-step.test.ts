// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))
vi.mock('@/lib/youtube/coleta/analytics-diario', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/coleta/analytics-diario')>()),
  diarioDoVideo: vi.fn(),
}))

import * as Sentry from '@sentry/nextjs'
import { passoDiario } from '@/lib/youtube/coleta/diario-step'
import { diarioDoVideo, AnalyticsApiError, type DiaDoVideo } from '@/lib/youtube/coleta/analytics-diario'
import { ensureFreshToken, NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import { SemTempoError } from '@/lib/youtube/coleta/clock'
import { ehMotivo } from '@/lib/youtube/coleta/motivo'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-09T12:05:00.000Z')
const DIA_MS = 86_400_000
const ha = (dias: number) => new Date(AGORA.getTime() - dias * DIA_MS).toISOString()
const diaDe = (dias: number) => ha(dias).slice(0, 10)

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'ok' as const, video_count: 3 }
const v = (n: number, publicadoEm: string | null = '2024-12-10T15:00:00.000Z'): Row => ({
  id: `vid-${n}`, youtube_video_id: `yt${n}`, channel_id: 'ch-1', site_id: 'site-1', published_at: publicadoEm,
})
// Por padrão o dia traz `engaged_views`: sem ele o passo grava só a base e anota "estendidas ausentes".
const dia = (day: string, valores: DiaDoVideo['valores'] = { views: 10, engaged_views: 8 }): DiaDoVideo => ({ day, valores })
const resposta = (dias: DiaDoVideo[], estendidas: 'ok' | 'recusadas' = 'ok') => ({ dias, estendidas })
const ctxDe = (db: FakeDb, prazoMs = 50_000): StepCtx => ({
  // Cópia: o passo muda `collection_status` do canal em memória e isso não pode vazar para outro teste.
  supabase: db.client, channels: [{ ...canal }], deadline: Date.now() + prazoMs, falhas: [], tentativas: [],
  autorizados: new Set(), negados: new Set(),
})
const bd = (videos: Row[], cobertura: Row[] = [], daily: Row[] = []): FakeDb =>
  fakeSupabase({ youtube_channels: [{ ...canal }], youtube_videos: videos, yt_own_video_daily: daily, yt_own_video_coverage: cobertura })
/** Um intervalo `base` do vídeo n, até o dia `ate`. */
const cob = (n: number, ate: string, extra: Row = {}): Row => ({
  youtube_video_id: `yt${n}`, metric_set: 'base', covered_from: '2025-01-01', covered_to: ate,
  site_id: 'site-1', channel_id: 'ch-1', collected_at: ha(1), ...extra,
})
const dailyDe = (n: number, day: string, extra: Row = {}): Row => ({
  youtube_video_id: `yt${n}`, day_pt: day, site_id: 'site-1', channel_id: 'ch-1', collected_at: ha(1), ...extra,
})
const HOJE = '2026-10-09'
const chamadas = (db: FakeDb) => db.rpcCalls.filter(c => c.name === 'yt_own_daily_apply')
const semHora = (rs: Row[]): Row[] => rs.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'collected_at')))
const coberturaDe = (db: FakeDb, n: number, conjunto = 'base') =>
  (db.tables.yt_own_video_coverage ?? []).filter(r => r.youtube_video_id === `yt${n}` && r.metric_set === conjunto)
const linhas = (db: FakeDb) => db.tables.yt_own_video_daily ?? []
const tentativa = (db: FakeDb, scope: string, scopeId: string) =>
  db.tables.yt_own_collection_attempts?.find(r => r.scope_type === scope && r.scope_id === scopeId && r.kind === 'diario')

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' } as never)
  vi.mocked(diarioDoVideo).mockReset()
  vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2026-10-07')]))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('passoDiario: janela', () => {
  it('vídeo nunca coletado pede desde a publicação (Pacífico) e vai até hoje', async () => {
    const db = bd([v(1)])
    await passoDiario(ctxDe(db))
    expect(diarioDoVideo).toHaveBeenCalledWith(expect.objectContaining({
      inicio: '2024-12-10', fim: HOJE, canalUc: 'UC1', videoId: 'yt1', token: 'tok',
    }))
  })

  it('vídeo sem view há dois anos (cobertura até hoje − 3) pede só os últimos 10 dias (item 45)', async () => {
    const db = bd([v(1, '2024-10-01T00:00:00.000Z')], [cob(1, addDays(HOJE, -3))])
    await passoDiario(ctxDe(db))
    expect(diarioDoVideo).toHaveBeenCalledWith(expect.objectContaining({ inicio: addDays(HOJE, -10) }))
  })

  it('vídeo com a cobertura parada há 40 dias pede desde o último dia coberto', async () => {
    const db = bd([v(1)], [cob(1, addDays(HOJE, -40))])
    await passoDiario(ctxDe(db))
    expect(diarioDoVideo).toHaveBeenCalledWith(expect.objectContaining({ inicio: addDays(HOJE, -40) }))
  })

  it('publicação no futuro não gera janela invertida', async () => {
    const db = bd([v(1, new Date(AGORA.getTime() + 2 * DIA_MS).toISOString())])
    await passoDiario(ctxDe(db))
    expect(diarioDoVideo).toHaveBeenCalledWith(expect.objectContaining({ inicio: HOJE, fim: HOJE }))
  })

  it('a janela vem da cobertura, não do diário: dia gravado sem cobertura não encurta a janela', async () => {
    const db = bd([v(1)], [], [dailyDe(1, '2026-10-08', { views: 3 })])
    await passoDiario(ctxDe(db))
    expect(diarioDoVideo).toHaveBeenCalledWith(expect.objectContaining({ inicio: '2024-12-10' }))
  })
})

describe('passoDiario: gravação pela função', () => {
  const oitoDias = () => Array.from({ length: 8 }, (_, k) =>
    dia(addDays(HOJE, -8 + k), k === 3 ? { views: 4, likes: 1 } : { views: 0, avg_view_percentage: null, avg_view_duration_seconds: null }))

  it('manda todos os dias devolvidos, zeros inclusive, e os mesmos dias em p_days_returned', async () => {
    const dias = oitoDias()
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta(dias))
    const db = bd([v(1)])
    await passoDiario(ctxDe(db))
    expect(chamadas(db)).toHaveLength(1)
    const a = chamadas(db)[0]!.args
    expect(a.p_video).toBe('yt1')
    expect(a.p_ids).toEqual({ site_id: 'site-1', channel_id: 'ch-1', video_id: 'vid-1' })
    expect(a.p_rows as Row[]).toHaveLength(8)
    expect((a.p_rows as Row[]).map(r => r.day_pt)).toEqual(dias.map(d => d.day))
    expect(a.p_days_returned).toEqual(dias.map(d => d.day))
    // as médias nulas de dia sem view vão com a chave presente
    expect((a.p_rows as Row[])[0]).toMatchObject({ views: 0, avg_view_percentage: null, avg_view_duration_seconds: null })
    // só o dia com atividade vira linha; os 8 ficam cobertos
    expect(linhas(db)).toHaveLength(1)
    expect(coberturaDe(db, 1)).toHaveLength(1)
    expect(coberturaDe(db, 1)[0]).toMatchObject({ covered_from: dias[0]!.day, covered_to: dias[7]!.day })
  })

  it('grava a versão de métrica de cada dia e carimba a autorização uma vez só (4 vídeos em paralelo)', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2025-03-30'), dia('2026-10-07')]))
    const db = bd([v(1), v(2), v(3), v(4)])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    const rows = chamadas(db)[0]!.args.p_rows as Row[]
    expect(rows.map(r => r.metric_version)).toEqual(['views_ate_2025-03-30', 'views_desde_2026-08-27'])
    expect(linhas(db).find(r => r.youtube_video_id === 'yt1' && r.day_pt === '2025-03-30')).toMatchObject({
      video_id: 'vid-1', channel_id: 'ch-1', site_id: 'site-1', source: 'analytics_api', views: 10,
    })
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'ok' })
    expect(resumo.gravados).toBe(8)
    expect(resumo.ate).toBe(HOJE)
    expect(ctx.autorizados!.has('ch-1')).toBe(true)
    const carimbos = db.writes.filter(w => w.table === 'youtube_channels' && w.op === 'update' && 'authorization_verified_at' in (w.payload as Row))
    expect(carimbos).toHaveLength(1)
  })

  it('nenhum upsert e nenhuma leitura do diário: só youtube_videos, a cobertura e as rpc', async () => {
    const db = bd([v(1), v(2)], [cob(1, '2026-10-05')], [dailyDe(1, '2026-10-05', { views: 1 })])
    await passoDiario(ctxDe(db))
    expect(db.writes.filter(w => w.table === 'yt_own_video_daily')).toEqual([])
    expect(db.leituras.yt_own_video_daily).toBeUndefined()
    expect(Object.keys(db.leituras).sort()).toEqual(['youtube_videos', 'yt_own_video_coverage'])
    expect(chamadas(db)).toHaveLength(2)
  })

  it('resposta sem dias não chama a função: vídeo antigo é sem_dado_na_janela, vídeo de 2 dias é video_novo, sem falha', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([]))
    const db = bd([v(1), v(2, ha(2))])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(chamadas(db)).toHaveLength(0)
    expect(linhas(db)).toHaveLength(0)
    expect(db.tables.yt_own_video_coverage ?? []).toHaveLength(0)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'sem_dado_na_janela' })
    expect(tentativa(db, 'video', 'yt2')).toMatchObject({ outcome: 'video_novo' })
    expect(ctx.falhas).toEqual([])
  })

  it('duas execuções com a mesma resposta: mesmas linhas, mesma cobertura (atualizadas, sem inseridas), attempts 2', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2026-10-06', { views: 4 }), dia('2026-10-07', { views: 5 })]))
    const db = bd([v(1)])
    await passoDiario(ctxDe(db))
    const linhasAntes = semHora(structuredClone(linhas(db)))
    const coberturaAntes = semHora(structuredClone(coberturaDe(db, 1)))
    await passoDiario(ctxDe(db))
    expect(semHora(linhas(db))).toEqual(linhasAntes)
    expect(semHora(coberturaDe(db, 1))).toEqual(coberturaAntes)
    expect(linhas(db)).toHaveLength(2)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'ok', attempts: 2 })
  })

  it('nunca de não nulo a nulo: coluna que não veio fica intacta', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2026-10-07', { views: 6 })]))
    const db = bd([v(1)], [cob(1, '2026-10-07')], [dailyDe(1, '2026-10-07', { views: 5, avg_view_percentage: 41.5 })])
    await passoDiario(ctxDe(db))
    expect(linhas(db)).toHaveLength(1)
    expect(linhas(db)[0]).toMatchObject({ views: 6, avg_view_percentage: 41.5 })
  })

  it('dia revisado para zero: a linha sai e o dia continua coberto; dia com view zero mas com like fica, com médias nulas', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([
      dia('2026-10-06', { views: 0, likes: 1, avg_view_percentage: null, avg_view_duration_seconds: null }),
      dia('2026-10-07', { views: 0, avg_view_percentage: null, avg_view_duration_seconds: null }),
    ]))
    const db = bd([v(1)], [cob(1, '2026-10-05')], [
      dailyDe(1, '2026-10-06', { views: 5, likes: 1, avg_view_percentage: 42.5, avg_view_duration_seconds: 31 }),
      dailyDe(1, '2026-10-07', { views: 2, avg_view_percentage: 40, avg_view_duration_seconds: 20 }),
    ])
    const resumo = await passoDiario(ctxDe(db))
    expect(linhas(db).map(r => r.day_pt)).toEqual(['2026-10-06'])
    expect(linhas(db)[0]).toMatchObject({ views: 0, likes: 1, avg_view_percentage: null, avg_view_duration_seconds: null })
    expect(coberturaDe(db, 1)).toHaveLength(1)
    expect(coberturaDe(db, 1)[0]).toMatchObject({ covered_from: '2025-01-01', covered_to: '2026-10-07' })
    expect(resumo.apagadas).toBe(1)
    expect(resumo.gravados).toBe(1) // 2 atualizadas + 0 inseridas − 1 apagada
  })

  it('o resumo soma apagadas, intervalos e gravados de dois vídeos', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([
      dia('2026-10-06', { views: 3 }),
      dia('2026-10-07', { views: 0, avg_view_percentage: null, avg_view_duration_seconds: null }),
    ]))
    const db = bd([v(1), v(2)], [], [dailyDe(1, '2026-10-07', { views: 0 }), dailyDe(2, '2026-10-07', { views: 0 })])
    const resumo = await passoDiario(ctxDe(db))
    expect(resumo.apagadas).toBe(2)
    expect(resumo.intervalos).toBe(2)
    expect(resumo.gravados).toBe(2) // por vídeo: 1 inserida + 1 atualizada − 1 apagada
    expect(resumo.com_buraco).toBe(0)
  })

  it('com_buraco conta o vídeo com mais de um intervalo base na cobertura', async () => {
    const db = bd([v(1), v(2)], [
      cob(1, '2026-09-01', { covered_from: '2026-08-01' }), cob(1, '2026-10-05', { covered_from: '2026-09-10' }),
      cob(2, '2026-10-05'),
    ])
    const resumo = await passoDiario(ctxDe(db))
    expect(resumo.com_buraco).toBe(1)
  })

  it('vídeo sem published_at não entra; canal sem vídeos não gera tentativa', async () => {
    const db = bd([v(1, null)])
    await passoDiario(ctxDe(db))
    expect(diarioDoVideo).not.toHaveBeenCalled()
    expect(db.tables.yt_own_collection_attempts ?? []).toHaveLength(0)
  })

  it('canal com sync desligado é ignorado', async () => {
    const db = bd([v(1)])
    const ctx = { ...ctxDe(db), channels: [{ ...canal, sync_enabled: false }] }
    await passoDiario(ctx)
    expect(diarioDoVideo).not.toHaveBeenCalled()
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(db.tables.yt_own_collection_attempts ?? []).toHaveLength(0)
  })
})

describe('passoDiario: o que veio é conferido antes de chamar a função', () => {
  it('cabeçalho sem views não avança a cobertura: nenhuma rpc de gravação, forma_inesperada, nota própria', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2026-10-06', { likes: 1 }), dia('2026-10-07', { likes: 2 })]))
    const db = bd([v(1, ha(2))])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(chamadas(db)).toHaveLength(0)
    expect(linhas(db)).toHaveLength(0)
    expect(db.tables.yt_own_video_coverage ?? []).toHaveLength(0)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http', error: 'forma_inesperada', http_status: 200 })
    expect(ctx.falhas).toEqual(['diário: Canal Um: 1 de 1 vídeos com erro (a resposta veio em forma inesperada)'])
    expect(resumo.gravados).toBe(0)
  })

  it('um dia com views nulo no meio de oito: nada é aplicado, nem os outros sete dias', async () => {
    const dias = Array.from({ length: 8 }, (_, k) => dia(addDays(HOJE, -8 + k), k === 4 ? { likes: 1 } : { views: 3 }))
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta(dias))
    const db = bd([v(1)])
    await passoDiario(ctxDe(db))
    expect(chamadas(db)).toHaveLength(0)
    expect(linhas(db)).toHaveLength(0)
    expect(coberturaDe(db, 1)).toHaveLength(0)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http', error: 'forma_inesperada' })
  })

  it('engaged_views ausente em algum dia manda só a base, conta estendidas_ausentes e anota', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([
      dia('2026-10-06', { views: 3, engaged_views: 2 }),
      dia('2026-10-07', { views: 4 }),
    ]))
    const db = bd([v(1), v(2)])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(chamadas(db).map(c => c.args.p_sets)).toEqual([['base'], ['base']])
    expect(resumo.estendidas_ausentes).toBe(2)
    expect(ctx.falhas).toEqual(['diário: Canal Um: estendidas ausentes na resposta de 2 vídeo(s)'])
    expect(coberturaDe(db, 1, 'estendidas')).toHaveLength(0)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'ok' })
  })

  it('engaged_views em todos os dias manda os dois conjuntos, sem nota', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([
      dia('2026-10-06', { views: 3, engaged_views: 2 }),
      dia('2026-10-07', { views: 0, engaged_views: 0, avg_view_percentage: null, avg_view_duration_seconds: null }),
    ]))
    const db = bd([v(1)])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(chamadas(db)[0]!.args.p_sets).toEqual(['base', 'estendidas'])
    expect(resumo.estendidas_ausentes).toBe(0)
    expect(ctx.falhas).toEqual([])
    expect(coberturaDe(db, 1, 'estendidas')).toHaveLength(1)
  })

  it('estendidas recusadas: só o conjunto base, a nota de recusadas uma vez por canal e nenhuma de ausentes', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2026-10-07')], 'recusadas'))
    const db = bd([v(1), v(2), v(3)])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(chamadas(db).map(c => c.args.p_sets)).toEqual([['base'], ['base'], ['base']])
    expect(resumo.estendidas_recusadas).toBe(3)
    expect(resumo.estendidas_ausentes).toBe(0)
    expect(linhas(db)).toHaveLength(3)
    expect(ctx.falhas).toEqual(['diário: Canal Um: a Analytics API recusou as métricas estendidas'])
  })
})

describe('passoDiario: ordem', () => {
  it('nunca coletado primeiro, depois o coletado há mais tempo (coletadoEm da cobertura)', async () => {
    const db = bd(
      [v(1), v(2), v(3)],
      [cob(1, '2026-10-08', { collected_at: ha(1) }), cob(2, '2026-10-08', { collected_at: ha(2) })],
    )
    await passoDiario(ctxDe(db))
    const ordem = vi.mocked(diarioDoVideo).mock.calls.map(c => c[0].videoId)
    expect(ordem).toEqual(['yt3', 'yt2', 'yt1'])
  })
})

describe('passoDiario: erros da Analytics API', () => {
  it('401: canal vira reautorizar, o resto do canal não chama a API, falhas vazia', async () => {
    vi.mocked(diarioDoVideo).mockRejectedValue(new AnalyticsApiError(401, null))
    const db = bd([v(1), v(2), v(3), v(4), v(5), v(6)])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(db.tables.youtube_channels![0]!.collection_status).toBe('reautorizar')
    expect(ctx.negados!.has('ch-1')).toBe(true)
    expect(vi.mocked(diarioDoVideo).mock.calls.length).toBeLessThanOrEqual(4)
    expect(tentativa(db, 'video', 'yt3')).toMatchObject({ outcome: 'sem_autorizacao', http_status: 401 })
    expect(tentativa(db, 'video', 'yt6')).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(ctx.falhas).toEqual([])
    expect(resumo.gravados).toBe(0)
  })

  it('403 insufficientPermissions: igual ao 401', async () => {
    vi.mocked(diarioDoVideo).mockRejectedValue(new AnalyticsApiError(403, 'insufficientPermissions'))
    const db = bd([v(1)])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(db.tables.youtube_channels![0]!.collection_status).toBe('reautorizar')
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'sem_autorizacao', http_status: 403 })
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(ctx.falhas).toEqual([])
  })

  it('403 quotaExceeded: erro_http com o código, canal continua ok, nota em português', async () => {
    vi.mocked(diarioDoVideo).mockRejectedValue(new AnalyticsApiError(403, 'quotaExceeded'))
    const db = bd([v(1)], [cob(1, addDays(HOJE, -2))])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http', http_status: 403, error: 'http_403_quotaExceeded' })
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'ok' })
    expect(db.tables.youtube_channels![0]!.collection_status).toBe('ok')
    expect(ctx.falhas).toContain('diário: Canal Um: 1 de 1 vídeos com erro (o YouTube recusou por cota (403))')
  })

  it('500 em 2 de 3 vídeos: o terceiro é gravado', async () => {
    vi.mocked(diarioDoVideo).mockImplementation(async (i) => {
      if (i.videoId === 'yt3') return resposta([dia('2026-10-07')])
      throw new AnalyticsApiError(500, null)
    })
    const db = bd([v(1), v(2), v(3)], [cob(1, addDays(HOJE, -1)), cob(2, addDays(HOJE, -1))])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(linhas(db).map(r => r.youtube_video_id)).toEqual(['yt3'])
    expect(ctx.falhas).toEqual(['diário: Canal Um: 2 de 3 vídeos com erro (erro do YouTube (500))'])
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'ok' })
  })

  it('http_status e error da tentativa: 404 e 500 com status; exceção e erro da rpc sem status', async () => {
    vi.mocked(diarioDoVideo).mockImplementation(async (i) => {
      if (i.videoId === 'yt1') throw new AnalyticsApiError(404, null)
      if (i.videoId === 'yt2') throw new AnalyticsApiError(500, null)
      if (i.videoId === 'yt3') throw new TypeError('boom')
      return resposta([dia('2026-10-07')])
    })
    const db = bd([v(1), v(2), v(3), v(4)])
    const gravador = db.rpcHandlers.yt_own_daily_apply!
    db.rpcHandlers.yt_own_daily_apply = (a) => (a.p_video === 'yt4' ? { data: null, error: { code: 'P0001', message: 'texto do postgres' } } : gravador(a))
    await passoDiario(ctxDe(db))
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http', http_status: 404, error: 'http_404' })
    expect(tentativa(db, 'video', 'yt2')).toMatchObject({ outcome: 'erro_http', http_status: 500, error: 'http_500' })
    expect(tentativa(db, 'video', 'yt3')).toMatchObject({ outcome: 'erro_http', http_status: null, error: 'excecao' })
    expect(tentativa(db, 'video', 'yt4')).toMatchObject({ outcome: 'erro_http', http_status: null, error: 'erro_de_banco' })
  })

  it('a coluna error recebe código, nunca o texto: a exceção vai só ao Sentry', async () => {
    const texto = 'texto com dado de terceiro'
    vi.mocked(diarioDoVideo).mockRejectedValue(new Error(texto))
    const db = bd([v(1), v(2)])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http', error: 'excecao' })
    for (const t of db.tables.yt_own_collection_attempts ?? []) {
      if (t.error != null) expect(ehMotivo(t.error as string), String(t.error)).toBe(true)
    }
    expect(JSON.stringify(db.tables.yt_own_collection_attempts)).not.toContain(texto)
    expect(ctx.falhas.join('|')).not.toContain(texto)
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: texto }), expect.objectContaining({ extra: { video: 'yt1' } }))
  })

  it('erro do token que não é de autorização: nota em português, motivo na tentativa do canal', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new TypeError('texto interno'))
    const db = bd([v(1)])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'erro_http', error: 'excecao' })
    expect(ctx.falhas).toEqual(['diário: Canal Um: erro interno (detalhe no Sentry)'])
    expect(diarioDoVideo).not.toHaveBeenCalled()
  })

  it('erro em vídeo atrasado há mais de 8 dias não entra na nota do passo, mas a tentativa é erro_http', async () => {
    vi.mocked(diarioDoVideo).mockRejectedValue(new AnalyticsApiError(500, null))
    const db = bd([v(1), v(2)], [cob(1, addDays(HOJE, -3)), cob(2, addDays(HOJE, -20))])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(ctx.falhas).toEqual(['diário: Canal Um: 1 de 2 vídeos com erro (erro do YouTube (500))'])
    expect(resumo.atrasados_antigos).toBe(1)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http' })
    expect(tentativa(db, 'video', 'yt2')).toMatchObject({ outcome: 'erro_http' })
  })

  it('erro em vídeo atrasado há 8 dias exatos ainda entra (o limite é "anterior a hoje − 8")', async () => {
    vi.mocked(diarioDoVideo).mockRejectedValue(new AnalyticsApiError(500, null))
    const db = bd([v(1)], [cob(1, addDays(HOJE, -8))])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(ctx.falhas).toEqual(['diário: Canal Um: 1 de 1 vídeos com erro (erro do YouTube (500))'])
    expect(resumo.atrasados_antigos).toBe(0)
  })

  it('sem cobertura: publicado há 8 dias ou mais não entra na nota; publicado há 2 dias entra', async () => {
    vi.mocked(diarioDoVideo).mockRejectedValue(new AnalyticsApiError(500, null))
    const db = bd([v(1, ha(8)), v(2, ha(2))])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(ctx.falhas).toEqual(['diário: Canal Um: 1 de 2 vídeos com erro (erro do YouTube (500))'])
    expect(resumo.atrasados_antigos).toBe(1)
  })

  it('vídeo atrasado há muito tempo que volta sem dias conta em atrasados_antigos, sem falha', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([]))
    const db = bd([v(1), v(2)], [cob(1, addDays(HOJE, -3)), cob(2, addDays(HOJE, -20))])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(resumo.atrasados_antigos).toBe(1)
    expect(ctx.falhas).toEqual([])
    expect(chamadas(db)).toHaveLength(0)
  })
})

describe('passoDiario: relógio', () => {
  it('estourado no começo: pendentes = vídeos, nenhuma chamada', async () => {
    const db = bd([v(1), v(2)])
    const resumo = await passoDiario(ctxDe(db, 0))
    expect(diarioDoVideo).not.toHaveBeenCalled()
    expect(resumo.pendentes).toBe(2)
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
  })

  it('SemTempoError no meio: o vídeo e o canal ficam nao_alcancado_orcamento, sem falha e sem gravação do vídeo em curso', async () => {
    vi.mocked(diarioDoVideo)
      .mockResolvedValueOnce(resposta([dia('2026-10-07')]))
      .mockRejectedValueOnce(new SemTempoError())
    const db = bd([v(1), v(2)])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(resumo.pendentes).toBe(1)
    expect(resumo.gravados).toBe(1)
    expect(chamadas(db)).toHaveLength(1)
    expect(coberturaDe(db, 2)).toHaveLength(0)
    expect(tentativa(db, 'video', 'yt2')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(ctx.falhas).toEqual([])
  })
})

describe('passoDiario: token', () => {
  it('sem conexão: tentativa de canal sem_conexao, nenhuma de vídeo, sem falha', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new NoActiveConnectionError('youtube'))
    const db = bd([v(1)])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'sem_conexao' })
    expect(tentativa(db, 'video', 'yt1')).toBeUndefined()
    expect(diarioDoVideo).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual([])
  })

  it('token revogado: sem_autorizacao e canal em reautorizar', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube'))
    const db = bd([v(1)])
    await passoDiario(ctxDe(db))
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(db.tables.youtube_channels![0]!.collection_status).toBe('reautorizar')
  })
})

describe('passoDiario: banco', () => {
  it('sem a tabela de cobertura: schema_ausente, nenhuma chamada à API, nada gravado', async () => {
    const db = bd([v(1)])
    db.errors.yt_own_video_coverage = { code: '42P01', message: 'x' }
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(ctx.falhas).toEqual(['schema_ausente: yt_own_video_coverage'])
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'schema_ausente' })
    expect(diarioDoVideo).not.toHaveBeenCalled()
    expect(db.writes.filter(w => w.table === 'yt_own_video_daily')).toEqual([])
  })

  it('função ausente para tudo: schema_ausente por canal, no máximo os 4 em voo chamam a API, nenhum upsert no diário', async () => {
    const db = bd([1, 2, 3, 4, 5, 6].map(n => v(n)))
    db.errors['rpc:yt_own_daily_apply'] = { code: 'PGRST202', message: 'x' }
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(ctx.falhas).toEqual(['schema_ausente: yt_own_daily_apply'])
    expect(vi.mocked(diarioDoVideo).mock.calls.length).toBeLessThanOrEqual(4)
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'schema_ausente' })
    expect(db.writes.filter(w => w.table === 'yt_own_video_daily')).toEqual([])
    expect(linhas(db)).toHaveLength(0)
    expect(resumo.gravados).toBe(0)
  })

  it('erro da função num vídeo não para os outros: a transação volta e só ele é erro', async () => {
    const db = bd([v(1, ha(2)), v(2, ha(2)), v(3, ha(2))])
    const gravador = db.rpcHandlers.yt_own_daily_apply!
    db.rpcHandlers.yt_own_daily_apply = (a) => (a.p_video === 'yt2' ? { data: null, error: { code: 'P0001', message: 'x' } } : gravador(a))
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(tentativa(db, 'video', 'yt2')).toMatchObject({ outcome: 'erro_http', error: 'erro_de_banco' })
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'ok' })
    expect(tentativa(db, 'video', 'yt3')).toMatchObject({ outcome: 'ok' })
    expect(linhas(db).map(r => r.youtube_video_id).sort()).toEqual(['yt1', 'yt3'])
    expect(coberturaDe(db, 2)).toHaveLength(0)
    expect(ctx.falhas).toContain('erro de banco ao gravar yt_own_daily_apply')
    expect(ctx.falhas).toContain('diário: Canal Um: 1 de 3 vídeos com erro (erro de banco)')
    expect(resumo.gravados).toBe(2)
  })

  it('a função recusa a chamada (dias divergentes): nada do vídeo é gravado e o erro é de banco', async () => {
    const db = bd([v(1)])
    const gravador = db.rpcHandlers.yt_own_daily_apply!
    // Quebra de propósito a igualdade de p_rows e p_days_returned: a função (e o fake) recusam com 22023.
    db.rpcHandlers.yt_own_daily_apply = (a) => gravador({ ...a, p_days_returned: [] })
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(linhas(db)).toHaveLength(0)
    expect(coberturaDe(db, 1)).toHaveLength(0)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http', http_status: null, error: 'erro_de_banco' })
  })

  it('retorno da função em forma inesperada conta como erro do vídeo', async () => {
    const db = bd([v(1)])
    db.rpcHandlers.yt_own_daily_apply = () => ({ data: { dias: 1 }, error: null })
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http', http_status: null, error: 'erro_de_banco' })
    expect(ctx.falhas).toContain('erro de banco ao gravar yt_own_daily_apply')
    expect(resumo.gravados).toBe(0)
  })

  it('erro ao ler a cobertura: o canal não é coletado, nota própria, tentativa de canal erro_http', async () => {
    const db = bd([v(1)])
    db.errors.yt_own_video_coverage = { code: 'XX000', message: 'texto do postgres' }
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(ctx.falhas).toEqual(['erro de banco ao ler yt_own_video_coverage'])
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'erro_http', error: 'erro_de_banco' })
    expect(tentativa(db, 'canal', 'ch-1')!.http_status ?? null).toBeNull()
    expect(diarioDoVideo).not.toHaveBeenCalled()
    expect(tentativa(db, 'video', 'yt1')).toBeUndefined()
  })

  it('cobertura cortada (5.001 intervalos): falha "cortada em 5000" e o canal não é coletado', async () => {
    const intervalos = Array.from({ length: 5001 }, (_, k) =>
      cob(1, '2025-06-01', { covered_from: addDays('2000-01-01', k * 2), covered_to: addDays('2000-01-01', k * 2) }))
    const db = bd([v(1)], intervalos)
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(ctx.falhas).toEqual(['diário: cobertura de Canal Um cortada em 5000'])
    expect(diarioDoVideo).not.toHaveBeenCalled()
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'erro_http', error: 'erro_de_banco' })
  })

  it('só lê a cobertura do próprio canal e do conjunto base', async () => {
    const db = bd([v(1)], [
      cob(1, addDays(HOJE, -3)),
      cob(1, '2020-01-01', { metric_set: 'estendidas', covered_from: '2019-01-01' }),
      cob(1, '2020-01-01', { channel_id: 'outro-canal', covered_from: '2019-06-01' }),
    ])
    await passoDiario(ctxDe(db))
    expect(diarioDoVideo).toHaveBeenCalledWith(expect.objectContaining({ inicio: addDays(HOJE, -10) }))
  })
})
