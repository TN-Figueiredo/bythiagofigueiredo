// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { passoRetencao } from '@/lib/youtube/coleta/retencao-step'
import { ensureFreshToken, NoActiveConnectionError } from '@/lib/social/token-refresh'
import { avisarEntrada } from '@/lib/youtube/coleta/alerts'
import { addDays, diffDias } from '@/lib/youtube/coleta/day-pt'
import { diaDaLeva, lerFatos, RETENCAO_JANELAS_DESDE } from '@/lib/youtube/coleta/retencao-regra'
import { ehMotivo } from '@/lib/youtube/coleta/motivo'
import type { ColetaChannel, StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'
import { comRetencao, fatoDe, idDoVideo } from './fake-retencao'

// Depois de RETENCAO_JANELAS_DESDE (2026-10-13): as janelas de 7 e 30 dias passam a valer.
const AGORA = new Date('2026-10-20T12:05:00.000Z')
const HOJE = '2026-10-20'
const DIA_MS = 86_400_000

const UC1 = 'UC' + 'a'.repeat(22)
const UC2 = 'UC' + 'b'.repeat(22)
const canal1: ColetaChannel = { id: 'ch-1', channel_id: UC1, site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'ok', video_count: 35 }
const canal2: ColetaChannel = { id: 'ch-2', channel_id: UC2, site_id: 'site-1', name: 'Canal Dois', sync_enabled: true, collection_status: 'ok', video_count: 3 }

const fato = (n: number, o: Parameters<typeof fatoDe>[2] = {}) => fatoDe(n, HOJE, o)
const bd = (fatos: readonly unknown[] | Record<string, readonly unknown[]>, canais: ColetaChannel[] = [canal1]): FakeDb =>
  comRetencao(fakeSupabase({ youtube_channels: canais.map(c => ({ ...c })) }), fatos)
const ctxDe = (db: FakeDb, canais: ColetaChannel[] = [canal1], prazoMs = 50_000): StepCtx => ({
  // Cópia: o passo muda `collection_status` do canal em memória e isso não pode vazar para outro teste.
  supabase: db.client, channels: canais.map(c => ({ ...c })), deadline: Date.now() + prazoMs, falhas: [], tentativas: [],
  autorizados: new Set(), negados: new Set(),
})

const CABECALHO3 = ['elapsedVideoTimeRatio', 'audienceWatchRatio', 'relativeRetentionPerformance', 'totalSegmentImpressions'].map(name => ({ name }))
const CABECALHO2 = CABECALHO3.slice(0, 3)
/** Uma curva de `n` pontos, com as três métricas. */
const curva = (n = 100, cabecalho = CABECALHO3) => ({
  columnHeaders: cabecalho,
  rows: Array.from({ length: n }, (_, k) => [(k + 1) / n, 1 - k / (2 * n), 0.5, 100 + k].slice(0, cabecalho.length)),
})
const VAZIA = { columnHeaders: CABECALHO3, rows: [] }
const json = (corpo: unknown, status = 200): Response => new Response(JSON.stringify(corpo), { status })
const erroGoogle = (status: number, reason: string): Response =>
  json({ error: { code: status, message: 'texto do Google que não pode vazar', errors: [{ reason }] } }, status)

type Resposta = Response | Error | (() => Response | Error | Promise<Response | Error>)
/** O `fetch` falso: padrão = uma curva boa; `porVideo` troca a resposta de um vídeo. Guarda as chamadas. */
function fetchFalso(porVideo: Record<string, Resposta> = {}, padrao: Resposta = () => json(curva())) {
  const f = vi.fn(async (url: RequestInfo | URL) => {
    const filtros = new URL(String(url)).searchParams.get('filters') ?? ''
    const id = /video==([^;]+)/.exec(filtros)?.[1] ?? ''
    const r = porVideo[id] ?? padrao
    const v = typeof r === 'function' ? await r() : r
    if (v instanceof Error) throw v
    return v
  })
  vi.stubGlobal('fetch', f)
  return f
}
const idsChamados = (f: ReturnType<typeof fetchFalso>): string[] =>
  f.mock.calls.map(c => /video==([^;]+)/.exec(new URL(String(c[0])).searchParams.get('filters') ?? '')![1]!)

const retencoes = (db: FakeDb): Row[] => db.tables.yt_own_video_retention ?? []
const tentativas = (db: FakeDb): Row[] => db.tables.yt_own_collection_attempts ?? []
const tentVideo = (db: FakeDb, id: string, kind = 'retencao_vida') =>
  tentativas(db).find(r => r.scope_type === 'video' && r.scope_id === id && r.kind === kind)
const tentCanal = (db: FakeDb, id = 'ch-1') =>
  tentativas(db).find(r => r.scope_type === 'canal' && r.scope_id === id && r.kind === 'retencao_vida')
const chamadasDeFatos = (db: FakeDb) => db.rpcCalls.filter(c => c.name === 'yt_own_retention_facts')
/** n vídeos nunca tentados, com view recente: todos são lidos hoje (prioridade 0), sem esperar a leva. */
const lidosHoje = (n: number, o: Parameters<typeof fatoDe>[2] = {}) =>
  Array.from({ length: n }, (_, k) => fato(k + 1, { ultimo_dia_com_view: addDays(HOJE, -1), ...o }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' } as never)
  delete process.env.YT_OWN_STEPS_OFF
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('passoRetencao: o que há para ler', () => {
  it('nada a ler: não pede token, não chama a API (item 60)', async () => {
    const f = fetchFalso()
    const db = bd([])
    const r = await passoRetencao(ctxDe(db))
    expect(f).not.toHaveBeenCalled()
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(r.chamadas).toBe(0)
    expect(r.gravados).toBe(0)
    expect(tentCanal(db)).toMatchObject({ outcome: 'ok' })
    expect(retencoes(db)).toEqual([])
  })

  it('a rpc de fatos recebe o canal e p_hoje_utc (o dia UTC do relógio)', async () => {
    fetchFalso()
    const db = bd([])
    await passoRetencao(ctxDe(db))
    expect(chamadasDeFatos(db)).toHaveLength(1)
    expect(chamadasDeFatos(db)[0]!.args).toEqual({ p_channel_id: 'ch-1', p_hoje_utc: '2026-10-20' })
  })

  it('p_hoje_utc é o dia UTC, não o do Pacífico (01:00 UTC ainda é ontem no Pacífico)', async () => {
    vi.setSystemTime(new Date('2026-10-21T01:00:00.000Z'))
    fetchFalso()
    const db = bd([])
    const r = await passoRetencao(ctxDe(db))
    expect(chamadasDeFatos(db)[0]!.args.p_hoje_utc).toBe('2026-10-21')
    expect(r.ate).toBe('2026-10-20')
  })

  it('um item de fatos escrito à mão com todos os campos do apêndice B passa por lerFatos (m-F3)', () => {
    expect(() => lerFatos([fato(1)])).not.toThrow()
    expect(lerFatos([fato(1)])).toHaveLength(1)
  })

  it('canal em reautorizar ou sem sincronização: nenhuma chamada, nenhuma tentativa, nenhuma nota deste passo (m-3)', async () => {
    const f = fetchFalso()
    const parado = { ...canal1, collection_status: 'reautorizar' as const }
    const db = bd(lidosHoje(3), [parado])
    const ctx = ctxDe(db, [parado])
    await passoRetencao(ctx)
    expect(f).not.toHaveBeenCalled()
    expect(chamadasDeFatos(db)).toHaveLength(0)
    expect(ctx.falhas).toEqual([])
    expect(tentativas(db)).toEqual([])
    const sem = { ...canal1, sync_enabled: false }
    const ctx2 = ctxDe(bd(lidosHoje(3), [sem]), [sem])
    await passoRetencao(ctx2)
    expect(f).not.toHaveBeenCalled()
  })

  it('canal sem conexão: nenhuma chamada à API e nenhuma nota', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
    const f = fetchFalso()
    const db = bd(lidosHoje(3))
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    expect(f).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual([])
    expect(tentCanal(db)).toMatchObject({ outcome: 'sem_conexao' })
    expect(r.gravados).toBe(0)
  })
})

describe('passoRetencao: gravação', () => {
  it('curva de 100 pontos é gravada com todas as colunas', async () => {
    const f = fetchFalso()
    const db = bd([fato(1, { ultimo_dia_com_view: addDays(HOJE, -1), views_total: 4321, fonte_ate: addDays(HOJE, -2) })])
    const r = await passoRetencao(ctxDe(db))
    expect(f).toHaveBeenCalledTimes(1)
    expect(r.gravados).toBe(1)
    expect(r.chamadas).toBe(1)
    expect(r.vazios).toBe(0)
    expect(retencoes(db)).toHaveLength(1)
    const l = retencoes(db)[0]!
    expect(l).toMatchObject({
      youtube_video_id: idDoVideo(1), window_kind: 'vida', segment: 'organico',
      window_end: addDays(HOJE, -2), window_start: addDays(HOJE, -30), requested_end: HOJE,
      site_id: 'site-1', video_id: 'uuid-vid-1', channel_id: 'ch-1',
      point_count: 100, views_at_read: 4321, source: 'analytics_api', metric_version: 'views_desde_2026-08-27',
    })
    expect(l.metrics_returned).toEqual(['audienceWatchRatio', 'relativeRetentionPerformance', 'totalSegmentImpressions'])
    expect(l.points as unknown[]).toHaveLength(100)
    expect(typeof l.collected_at).toBe('string')
    // as invariantes do CHECK da tabela
    expect(l.window_end as string >= (l.window_start as string)).toBe(true)
    expect(l.requested_end as string >= (l.window_end as string)).toBe(true)
    expect(tentVideo(db, idDoVideo(1))).toMatchObject({ outcome: 'ok' })
    expect(db.writes.find(w => w.table === 'yt_own_video_retention')).toBeTruthy()
  })

  it('o upsert usa a chave primária da tabela', async () => {
    fetchFalso()
    const db = bd(lidosHoje(1))
    await passoRetencao(ctxDe(db))
    const w = db.writes.find(x => x.table === 'yt_own_video_retention')!
    expect(w.op).toBe('upsert')
    // o falso recusa (42P10) um onConflict que não case com a PK: a linha só existe se a chave estava certa
    expect(retencoes(db)).toHaveLength(1)
  })

  it('duas execuções que decidiram ler a mesma janela regravam a mesma linha (item 60; execuções sobrepostas)', async () => {
    fetchFalso()
    const db = bd(lidosHoje(1))
    await passoRetencao(ctxDe(db))
    await passoRetencao(ctxDe(db))
    expect(db.writes.filter(w => w.table === 'yt_own_video_retention')).toHaveLength(2)
    expect(retencoes(db)).toHaveLength(1)
  })

  it('na semana seguinte, com views novas, cria outra linha', async () => {
    fetchFalso()
    const db = bd(lidosHoje(1, { views_total: 100 }))
    await passoRetencao(ctxDe(db))
    expect(retencoes(db)).toHaveLength(1)
    vi.setSystemTime(new Date(AGORA.getTime() + 7 * DIA_MS))
    const hoje2 = addDays(HOJE, 7)
    // os fatos da semana seguinte: a linha da vida existe, a fonte andou e há views novas
    comRetencao(db, [fatoDe(1, hoje2, {
      ultimo_dia_com_view: addDays(hoje2, -1), views_total: 160, vida_window_end: addDays(HOJE, -1),
      vida_collected_at: AGORA.toISOString(), vida_views_at_read: 100, vida_tent_dia: HOJE, vida_tent_resultado: 'ok', vida_resposta_dia: HOJE,
      publicado_dia_pt: addDays(HOJE, -30),
    })])
    await passoRetencao(ctxDe(db))
    expect(retencoes(db)).toHaveLength(2)
    expect(retencoes(db).map(r => r.window_end).sort()).toEqual([addDays(HOJE, -1), addDays(hoje2, -1)])
  })

  it('resposta vazia: tentativa sem_dado_na_janela e nenhuma linha (item 61)', async () => {
    fetchFalso({}, () => json(VAZIA))
    const db = bd(lidosHoje(2))
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    expect(retencoes(db)).toEqual([])
    expect(db.writes.filter(w => w.table === 'yt_own_video_retention')).toEqual([])
    expect(r.vazios).toBe(2)
    expect(r.gravados).toBe(0)
    expect(tentVideo(db, idDoVideo(1))).toMatchObject({ outcome: 'sem_dado_na_janela' })
    expect(r.tentativas.sem_dado_na_janela).toBe(2)
    expect(ctx.falhas).toEqual([])
    // curva vazia é leitura FEITA: o canal carimba a autorização
    expect(ctx.autorizados?.has('ch-1')).toBe(true)
  })

  it('37 pontos, ratio 1,3 e campo ausente: point_count 37, ratio preservado, ausente nulo no ponto', async () => {
    const corpo = curva(37, CABECALHO2)
    ;(corpo.rows[10] as number[])[1] = 1.3
    ;(corpo.rows[11] as unknown[])[2] = null
    fetchFalso({}, () => json(corpo))
    const db = bd(lidosHoje(1))
    await passoRetencao(ctxDe(db))
    const l = retencoes(db)[0]!
    expect(l.point_count).toBe(37)
    const pontos = l.points as Array<{ t: number; ratio: number; relative: number | null; segment_impressions: number | null }>
    expect(pontos).toHaveLength(37)
    expect(pontos[10]!.ratio).toBe(1.3)
    expect(pontos[11]!.relative).toBeNull()
    expect(pontos.every(p => p.segment_impressions === null)).toBe(true)
    expect(l.metrics_returned).toEqual(['audienceWatchRatio', 'relativeRetentionPerformance'])
  })

  it('janela de 7 dias grava com kind retencao_7d e window_kind primeiros_7_dias', async () => {
    const f = fetchFalso()
    const pub = '2026-10-10'
    const db = bd([fato(1, {
      publicado_dia_pt: pub, fonte_ate: addDays(HOJE, -1), ultimo_dia_com_view: addDays(HOJE, -1),
      tem_7d: false, tem_30d: true, vida_tent_dia: HOJE, vida_tent_resultado: 'ok', vida_resposta_dia: HOJE,
      vida_window_end: addDays(HOJE, -1), vida_collected_at: AGORA.toISOString(), vida_views_at_read: 1000,
    })])
    expect(addDays(pub, 6) >= RETENCAO_JANELAS_DESDE).toBe(true)
    const r = await passoRetencao(ctxDe(db))
    expect(f).toHaveBeenCalledTimes(1)
    const url = new URL(String(f.mock.calls[0]![0]))
    expect(url.searchParams.get('startDate')).toBe(pub)
    expect(url.searchParams.get('endDate')).toBe(addDays(pub, 6))
    expect(r.gravados).toBe(1)
    expect(retencoes(db)[0]).toMatchObject({ window_kind: 'primeiros_7_dias', window_start: pub, window_end: addDays(pub, 6), requested_end: addDays(pub, 6), views_at_read: 100 })
    expect(tentVideo(db, idDoVideo(1), 'retencao_7d')).toMatchObject({ outcome: 'ok' })
    expect(tentVideo(db, idDoVideo(1), 'retencao_vida')).toBeUndefined()
  })
})

describe('passoRetencao: token e leva', () => {
  it('deps.token é usado no lugar de obterToken (I-5, R6): o fetch recebe o token injetado e o banco não é tocado', async () => {
    const f = fetchFalso()
    const db = bd(lidosHoje(2))
    const token = vi.fn(async () => 'tok-injetado')
    await passoRetencao(ctxDe(db), { token })
    expect(token).toHaveBeenCalledTimes(1)
    expect(ensureFreshToken).not.toHaveBeenCalled()
    for (const c of f.mock.calls) {
      expect((c[1] as RequestInit).headers).toEqual({ Authorization: 'Bearer tok-injetado' })
    }
    expect(f).toHaveBeenCalledTimes(2)
    expect(db.leituras.social_connections).toBeUndefined()
    expect(db.writes.filter(w => w.table === 'social_connections')).toEqual([])
    expect(db.rpcCalls.filter(c => c.name.includes('social') || c.name.includes('token'))).toEqual([])
  })

  it('deps.token devolvendo null: canal pulado, sem chamada', async () => {
    const f = fetchFalso()
    const db = bd(lidosHoje(2))
    const r = await passoRetencao(ctxDe(db), { token: async () => null })
    expect(f).not.toHaveBeenCalled()
    expect(r.gravados).toBe(0)
  })

  it('sem deps: chama obterToken e a leva é de 7 dias (o padrão de produção)', async () => {
    const f = fetchFalso()
    const slotDeHoje = diffDias('1970-01-01', HOJE) % 7
    const fatos = Array.from({ length: 35 }, (_, k) => fato(k + 1))
    const esperados = fatos.filter(x => diaDaLeva(x.youtube_video_id) === slotDeHoje).map(x => x.youtube_video_id).sort()
    expect(esperados.length).toBeGreaterThan(0)
    expect(esperados.length).toBeLessThan(35)
    const db = bd(fatos)
    const r = await passoRetencao(ctxDe(db))
    expect(ensureFreshToken).toHaveBeenCalledTimes(1)
    expect(idsChamados(f).sort()).toEqual(esperados)
    expect(r.adiados_pela_leva).toBe(35 - esperados.length)
  })

  it('deps.levaDias: 1 lê todos os nunca tentados (35 leituras numa execução)', async () => {
    const f = fetchFalso()
    const db = bd(Array.from({ length: 35 }, (_, k) => fato(k + 1)))
    const r = await passoRetencao(ctxDe(db), { levaDias: 1 })
    expect(f).toHaveBeenCalledTimes(35)
    expect(r.gravados).toBe(35)
    expect(r.chamadas).toBe(35)
    expect(r.adiados_pela_leva).toBe(0)
  })
})

describe('passoRetencao: erros', () => {
  it('401 no primeiro vídeo: canal em reautorizar; todos os vídeos sem_autorizacao; os que ainda não tinham começado não chamam a API', async () => {
    const f = fetchFalso({}, () => erroGoogle(401, 'authError'))
    const db = bd(lidosHoje(7))
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    // 4 em voo (PARALELO); os outros 3 viram sem_autorizacao sem tocar a API
    expect(f.mock.calls.length).toBeLessThanOrEqual(4)
    expect(ctx.channels[0]!.collection_status).toBe('reautorizar')
    expect(db.tables.youtube_channels![0]!.collection_status).toBe('reautorizar')
    expect(avisarEntrada).toHaveBeenCalledTimes(1)
    for (let n = 1; n <= 7; n++) expect(tentVideo(db, idDoVideo(n))).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(tentCanal(db)).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(r.gravados).toBe(0)
    expect(retencoes(db)).toEqual([])
    // o 401 não vira "erro do vídeo": nenhuma nota de leituras com erro
    expect(ctx.falhas).toEqual([])
    expect(ctx.negados?.has('ch-1')).toBe(true)
    expect(ctx.autorizados?.has('ch-1')).toBe(false)
  })

  it('403 ACCESS_TOKEN_SCOPE_INSUFFICIENT é perda de autorização (pego antes de virar http_403)', async () => {
    fetchFalso({}, () => erroGoogle(403, 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'))
    const db = bd(lidosHoje(3))
    const ctx = ctxDe(db)
    await passoRetencao(ctx)
    expect(ctx.channels[0]!.collection_status).toBe('reautorizar')
    for (let n = 1; n <= 3; n++) expect(tentVideo(db, idDoVideo(n))).toMatchObject({ outcome: 'sem_autorizacao', http_status: 403 })
    expect(tentativas(db).filter(t => t.outcome === 'erro_http')).toEqual([])
    expect(ctx.falhas.join('|')).not.toContain('não devolveu')
    expect(ctx.falhas.join('|')).not.toContain('leituras com erro')
  })

  it('perda de autorização num canal não impede o canal seguinte', async () => {
    const f = fetchFalso({}, () => json(curva()))
    // o primeiro canal perde a autorização; o segundo lê
    f.mockImplementation(async (url: RequestInfo | URL) => {
      const u = new URL(String(url))
      return u.searchParams.get('ids') === `channel==${UC1}` ? erroGoogle(401, 'authError') : json(curva())
    })
    const db = bd({ 'ch-1': lidosHoje(2), 'ch-2': lidosHoje(2).map((x, k) => ({ ...x, youtube_video_id: idDoVideo(100 + k) })) }, [canal1, canal2])
    const r = await passoRetencao(ctxDe(db, [canal1, canal2]))
    expect(tentCanal(db, 'ch-1')).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(tentCanal(db, 'ch-2')).toMatchObject({ outcome: 'ok' })
    expect(r.gravados).toBe(2)
  })

  it('500 três vezes: erro_http, http_status 500, error http_500; nota do canal com "erro do YouTube (500)"; 3 chamadas', async () => {
    const f = fetchFalso({}, () => json({ error: { message: 'texto interno do Google' } }, 500))
    const db = bd(lidosHoje(1))
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    expect(f).toHaveBeenCalledTimes(3)
    expect(r.chamadas).toBe(3)
    expect(tentVideo(db, idDoVideo(1))).toMatchObject({ outcome: 'erro_http', http_status: 500, error: 'http_500' })
    expect(ctx.falhas).toContain('retenção: Canal Um: 1 de 1 leituras com erro (erro do YouTube (500))')
    expect(JSON.stringify(ctx.falhas)).not.toContain('texto interno')
    expect(retencoes(db)).toEqual([])
    // erro do vídeo não derruba o canal: o canal fecha ok
    expect(tentCanal(db)).toMatchObject({ outcome: 'ok' })
  })

  it('403 com reason fora do catálogo: error http_403; o texto do reason não aparece na tentativa nem na nota (R3)', async () => {
    fetchFalso({}, () => erroGoogle(403, 'segredoDoReasonXYZ'))
    const db = bd(lidosHoje(1))
    const ctx = ctxDe(db)
    await passoRetencao(ctx)
    expect(tentVideo(db, idDoVideo(1))).toMatchObject({ outcome: 'erro_http', http_status: 403, error: 'http_403' })
    expect(JSON.stringify(tentativas(db))).not.toContain('segredoDoReasonXYZ')
    expect(JSON.stringify(ctx.falhas)).not.toContain('segredoDoReasonXYZ')
    expect(ctx.falhas.join('|')).toContain('retenção: Canal Um: 1 de 1 leituras com erro')
  })

  it('cota estourada (403 quotaExceeded) é erro do vídeo, não perda de autorização; os outros seguem', async () => {
    fetchFalso({ [idDoVideo(2)]: () => erroGoogle(403, 'quotaExceeded') })
    const db = bd(lidosHoje(5))
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    expect(tentVideo(db, idDoVideo(2))).toMatchObject({ outcome: 'erro_http', http_status: 403, error: 'http_403_quotaExceeded' })
    expect(ctx.channels[0]!.collection_status).toBe('ok')
    expect(r.gravados).toBe(4)
    expect(ctx.falhas).toContain('retenção: Canal Um: 1 de 5 leituras com erro (o YouTube recusou por cota (403))')
    expect(tentCanal(db)).toMatchObject({ outcome: 'ok' })
  })

  it('erro no 2º de 5 vídeos: os outros seguem e o canal fecha ok', async () => {
    fetchFalso({ [idDoVideo(2)]: () => erroGoogle(404, 'notFound') })
    const db = bd(lidosHoje(5))
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    expect(r.gravados).toBe(4)
    expect(retencoes(db).map(l => l.youtube_video_id).sort()).toEqual([1, 3, 4, 5].map(idDoVideo))
    expect(tentVideo(db, idDoVideo(2))).toMatchObject({ outcome: 'erro_http', http_status: 404, error: 'http_404_notFound' })
    expect(ctx.falhas).toContain('retenção: Canal Um: 1 de 5 leituras com erro (o YouTube não encontrou o item (404))')
  })

  it('exceção com texto qualquer: error excecao; o texto só no Sentry, que recebe só o id do vídeo', async () => {
    const f = fetchFalso({ [idDoVideo(1)]: new Error('segredo-do-token-abc') })
    const db = bd(lidosHoje(1))
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    expect(tentVideo(db, idDoVideo(1))).toMatchObject({ outcome: 'erro_http', error: 'excecao' })
    expect(JSON.stringify(tentativas(db))).not.toContain('segredo-do-token-abc')
    expect(JSON.stringify(ctx.falhas)).not.toContain('segredo-do-token-abc')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [, opc] = vi.mocked(Sentry.captureException).mock.calls[0]!
    expect(opc).toEqual({ tags: { cron: 'sync-analytics-metrics', passo: 'retencao' }, extra: { video: idDoVideo(1) } })
    // o fetch lançou no meio: a chamada gasta conta mesmo assim
    expect(f).toHaveBeenCalledTimes(1)
    expect(r.chamadas).toBe(1)
  })

  it('o Sentry não recebe pontos nem corpo de resposta', async () => {
    fetchFalso({}, () => new Response('{"columnHeaders": 3, "rows": "corpo-cru-do-google"}', { status: 200 }))
    const db = bd(lidosHoje(1))
    await passoRetencao(ctxDe(db))
    const alvo = JSON.stringify([vi.mocked(Sentry.captureException).mock.calls, vi.mocked(Sentry.captureMessage).mock.calls])
    expect(alvo).not.toContain('corpo-cru-do-google')
    expect(alvo).not.toContain('"rows"')
  })

  it('forma inesperada da resposta: erro_http forma_inesperada; nada gravado', async () => {
    fetchFalso({}, () => json({ columnHeaders: CABECALHO3, rows: [[0.5, 'texto', 0.1, 1]] }))
    const db = bd(lidosHoje(2))
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    expect(r.gravados).toBe(0)
    expect(retencoes(db)).toEqual([])
    expect(tentVideo(db, idDoVideo(1))).toMatchObject({ outcome: 'erro_http', http_status: 200, error: 'forma_inesperada' })
    expect(ctx.falhas).toContain('retenção: Canal Um: 2 de 2 leituras com erro (a resposta veio em forma inesperada)')
  })

  it('erro de banco no upsert: erro_http "erro de banco"; nota; a tentativa não é ok', async () => {
    fetchFalso()
    const db = bd(lidosHoje(2))
    db.writeErrors.yt_own_video_retention = { code: 'XX000', message: 'detalhe interno do postgres' }
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    expect(r.gravados).toBe(0)
    expect(tentVideo(db, idDoVideo(1))).toMatchObject({ outcome: 'erro_http', error: 'erro_de_banco' })
    expect(tentVideo(db, idDoVideo(1))!.http_status).toBeNull()
    expect(ctx.falhas).toContain('erro de banco ao gravar yt_own_video_retention')
    expect(ctx.falhas).toContain('retenção: Canal Um: 2 de 2 leituras com erro (erro de banco)')
    expect(JSON.stringify(ctx.falhas)).not.toContain('detalhe interno')
  })

  it('upsert que LANÇA: erro_de_banco e o passo segue', async () => {
    fetchFalso()
    const db = bd(lidosHoje(2))
    const original = db.client.from.bind(db.client)
    ;(db.client as unknown as { from: (t: string) => unknown }).from = (t: string) => {
      if (t === 'yt_own_video_retention') throw new Error('rede caiu com segredo-xyz')
      return original(t)
    }
    const ctx = ctxDe(db)
    await expect(passoRetencao(ctx)).resolves.toBeDefined()
    expect(tentVideo(db, idDoVideo(1))).toMatchObject({ outcome: 'erro_http', error: 'erro_de_banco' })
    expect(JSON.stringify(ctx.falhas)).not.toContain('segredo-xyz')
  })

  it('tabela ausente na escrita: para o canal em curso e os seguintes', async () => {
    const f = fetchFalso()
    const db = bd({ 'ch-1': lidosHoje(3), 'ch-2': [fato(50, { ultimo_dia_com_view: addDays(HOJE, -1) })] }, [canal1, canal2])
    db.writeErrors.yt_own_video_retention = { code: '42P01', message: 'relation does not exist' }
    const ctx = ctxDe(db, [canal1, canal2])
    const r = await passoRetencao(ctx)
    expect(ctx.falhas).toContain('schema_ausente: yt_own_video_retention')
    expect(tentCanal(db, 'ch-1')).toMatchObject({ outcome: 'schema_ausente' })
    expect(tentCanal(db, 'ch-2')).toMatchObject({ outcome: 'schema_ausente' })
    expect(idsChamados(f)).not.toContain(idDoVideo(50))
    expect(r.gravados).toBe(0)
    expect(chamadasDeFatos(db).map(c => c.args.p_channel_id)).toEqual(['ch-1'])
  })

  it('função de fatos ausente: schema_ausente; nenhum token, nenhuma chamada', async () => {
    const f = fetchFalso()
    const db = bd(lidosHoje(2), [canal1, canal2])
    db.errors['rpc:yt_own_retention_facts'] = { code: 'PGRST202', message: 'Could not find the function' }
    const ctx = ctxDe(db, [canal1, canal2])
    const r = await passoRetencao(ctx)
    expect(ctx.falhas).toContain('schema_ausente: yt_own_retention_facts')
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(f).not.toHaveBeenCalled()
    expect(tentCanal(db, 'ch-1')).toMatchObject({ outcome: 'schema_ausente' })
    expect(tentCanal(db, 'ch-2')).toMatchObject({ outcome: 'schema_ausente' })
    expect(r.tentativas.schema_ausente).toBe(2)
    // não é "ok com zero": nada de tentativa ok
    expect(tentativas(db).filter(t => t.outcome === 'ok')).toEqual([])
  })

  it('erro de banco ao ler os fatos: o canal vira erro_http e o próximo segue', async () => {
    const f = fetchFalso()
    const db = bd({ 'ch-2': lidosHoje(1) }, [canal1, canal2])
    db.rpcHandlers.yt_own_retention_facts = ((orig) => (a: Row) =>
      a.p_channel_id === 'ch-1' ? { data: null, error: { code: 'XX000', message: 'interno' } } : orig(a))(db.rpcHandlers.yt_own_retention_facts!)
    const ctx = ctxDe(db, [canal1, canal2])
    const r = await passoRetencao(ctx)
    expect(ctx.falhas).toContain('erro de banco ao ler yt_own_retention_facts')
    expect(tentCanal(db, 'ch-1')).toMatchObject({ outcome: 'erro_http', error: 'erro_de_banco' })
    expect(f).toHaveBeenCalledTimes(1)
    expect(r.gravados).toBe(1)
  })

  it('fatos em forma inesperada (lerFatos lança): nota; nada gravado; o próximo canal segue', async () => {
    const f = fetchFalso()
    const quebrado = { ...fato(1), views_total: 'muitas' }
    const db = bd({ 'ch-1': [quebrado], 'ch-2': lidosHoje(1).map(x => ({ ...x, youtube_video_id: idDoVideo(77) })) }, [canal1, canal2])
    const ctx = ctxDe(db, [canal1, canal2])
    const r = await passoRetencao(ctx)
    expect(ctx.falhas).toContain('retenção: Canal Um: fatos em forma inesperada')
    expect(JSON.stringify(ctx.falhas)).not.toContain('muitas')
    expect(tentCanal(db, 'ch-1')).toMatchObject({ outcome: 'erro_http', error: 'forma_inesperada' })
    expect(tentCanal(db, 'ch-2')).toMatchObject({ outcome: 'ok' })
    expect(idsChamados(f)).toEqual([idDoVideo(77)])
    expect(r.gravados).toBe(1)
    // fila ilegível não é "nada a fazer": o canal NÃO fecha ok
    expect(tentCanal(db, 'ch-1')!.outcome).not.toBe('ok')
  })
})

describe('passoRetencao: o relógio', () => {
  it('sem tempo ao entrar: todos os canais nao_alcancado_orcamento, sem fatos, sem token, sem API', async () => {
    const f = fetchFalso()
    const db = bd(lidosHoje(2), [canal1, canal2])
    const ctx = ctxDe(db, [canal1, canal2], 50_000)
    ctx.deadline = Date.now() - 1
    await passoRetencao(ctx)
    expect(tentCanal(db, 'ch-1')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(tentCanal(db, 'ch-2')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(chamadasDeFatos(db)).toHaveLength(0)
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(f).not.toHaveBeenCalled()
  })

  it('o tempo acaba entre dois canais: o segundo fica nao_alcancado_orcamento', async () => {
    const f = fetchFalso()
    const db = bd({ 'ch-1': lidosHoje(1), 'ch-2': lidosHoje(1).map(x => ({ ...x, youtube_video_id: idDoVideo(9) })) }, [canal1, canal2])
    const ctx = ctxDe(db, [canal1, canal2])
    f.mockImplementation(async () => {
      vi.setSystemTime(new Date(AGORA.getTime() + 60_000))
      return json(curva())
    })
    const r = await passoRetencao(ctx)
    expect(tentCanal(db, 'ch-1')).toMatchObject({ outcome: 'ok' })
    expect(tentCanal(db, 'ch-2')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(r.gravados).toBe(1)
  })

  it('sem tempo no meio: os restantes ficam nao_alcancado_orcamento do kind certo; pendentes conta; o canal também', async () => {
    const pub = '2026-10-10'
    const f = fetchFalso()
    // 8 vídeos da vida e a janela de 7 dias do vídeo 1 (kind retencao_7d)
    const fatos = lidosHoje(8)
    fatos[0] = fato(1, {
      publicado_dia_pt: pub, fonte_ate: addDays(HOJE, -1), ultimo_dia_com_view: addDays(HOJE, -1), tem_7d: false, tem_30d: true,
    })
    const db = bd(fatos)
    const ctx = ctxDe(db)
    f.mockImplementation(async () => {
      vi.setSystemTime(new Date(AGORA.getTime() + 60_000))
      return json(curva())
    })
    const r = await passoRetencao(ctx)
    // só a 1ª leitura (a que estava em voo quando o relógio venceu) foi feita
    expect(f).toHaveBeenCalledTimes(1)
    expect(r.gravados).toBe(1)
    const orc = tentativas(db).filter(t => t.scope_type === 'video' && t.outcome === 'nao_alcancado_orcamento')
    const total = 9 // 8 da vida + a janela de 7 dias do vídeo 1
    expect(orc).toHaveLength(total - 1)
    expect(r.pendentes).toBe(total - 1)
    // cada uma leva o kind da sua janela: a de 7 dias do vídeo 1 é retencao_7d; as outras são da vida
    expect(orc.filter(t => t.kind === 'retencao_7d').map(t => t.scope_id)).toEqual([idDoVideo(1)])
    expect(orc.filter(t => t.kind === 'retencao_vida')).toHaveLength(total - 2)
    expect(tentCanal(db)).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(ctx.falhas).toEqual([])
  })

  it('o relógio acaba com a chamada no ar: SemTempoError vira orçamento, não erro', async () => {
    fetchFalso({ [idDoVideo(1)]: () => { vi.setSystemTime(new Date(AGORA.getTime() + 60_000)); return new Error('abortado') } })
    const db = bd(lidosHoje(1))
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    expect(tentVideo(db, idDoVideo(1))).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(r.pendentes).toBe(1)
    expect(ctx.falhas).toEqual([])
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})

describe('passoRetencao: notas', () => {
  it('vídeos sem diário em dia: nota com a contagem e os ids; nenhuma chamada para eles', async () => {
    const f = fetchFalso()
    const atrasados = [2, 3].map(n => fato(n, { fonte_ate: addDays(HOJE, -9), ultimo_dia_com_view: addDays(HOJE, -9) }))
    const db = bd([fato(1, { ultimo_dia_com_view: addDays(HOJE, -1) }), ...atrasados, ...[4, 5, 6, 7].map(n => fato(n, { ultimo_dia_com_view: addDays(HOJE, -30) }))])
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    expect(idsChamados(f)).not.toContain(idDoVideo(2))
    expect(idsChamados(f)).not.toContain(idDoVideo(3))
    expect(r.sem_diario_em_dia).toBe(2)
    expect(ctx.falhas).toContain(`retenção: Canal Um: 2 vídeo(s) sem diário em dia; a curva espera o diário (${idDoVideo(2)}, ${idDoVideo(3)})`)
  })

  it('a nota de sem diário lista no máximo 5 ids', async () => {
    fetchFalso()
    const db = bd(Array.from({ length: 8 }, (_, k) => fato(k + 1, { fonte_ate: addDays(HOJE, -9) })).concat([...Array(30)].map((_, k) => fato(100 + k))))
    const ctx = ctxDe(db)
    await passoRetencao(ctx)
    const nota = ctx.falhas.find(x => x.includes('sem diário em dia'))!
    expect(nota).toContain('8 vídeo(s) sem diário em dia')
    expect(nota.match(/vid\d{8}/g)).toHaveLength(5)
  })

  it('metade ou mais do canal sem diário: a nota termina em "é pane da coleta"', async () => {
    fetchFalso()
    const db = bd([1, 2, 3].map(n => fato(n, { fonte_ate: addDays(HOJE, -20), diario_falhas_4d: 4 })).concat([fato(4)]))
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    const nota = ctx.falhas.find(x => x.includes('sem diário em dia'))!
    expect(nota).toMatch(/; metade ou mais do canal: é pane da coleta$/)
    expect(r.sem_resposta_do_youtube).toEqual([])
  })

  it('vídeo de 2 dias sem diário é novo, não falha', async () => {
    fetchFalso()
    const db = bd([fato(1, { publicado_dia_pt: addDays(HOJE, -2), fonte_ate: null, ultimo_dia_com_view: null })])
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    expect(r.novos).toBe(1)
    expect(ctx.falhas).toEqual([])
  })

  it('vídeo sem resposta do YouTube há mais de 3 dias vira nota de ação do dono, não de falha (I4)', async () => {
    fetchFalso()
    const fatos = [
      fato(1, { fonte_ate: addDays(HOJE, -20), diario_falhas_4d: 4 }),
      ...Array.from({ length: 34 }, (_, k) => fato(k + 2)),
    ]
    const db = bd(fatos)
    const ctx = ctxDe(db)
    const r = await passoRetencao(ctx)
    expect(ctx.falhas.find(x => x.includes('sem diário em dia'))).toBeUndefined()
    expect(ctx.falhas.find(x => x.includes('não devolve mais'))).toBeUndefined()
    expect(r.sem_resposta_do_youtube).toEqual([`retenção: Canal Um: 1 vídeo(s) que o YouTube não devolve mais (${idDoVideo(1)}); a curva não é lida`])
    expect(r.sem_diario_em_dia).toBe(0)
  })

  it('a nota de ação do dono é uma por canal', async () => {
    fetchFalso()
    const um = [fato(1, { fonte_ate: addDays(HOJE, -20), diario_falhas_4d: 4 }), ...Array.from({ length: 20 }, (_, k) => fato(k + 2))]
    const dois = [fato(60, { fonte_ate: addDays(HOJE, -20), diario_falhas_4d: 4 }), ...Array.from({ length: 20 }, (_, k) => fato(k + 61))]
    const db = bd({ 'ch-1': um, 'ch-2': dois }, [canal1, canal2])
    const r = await passoRetencao(ctxDe(db, [canal1, canal2]))
    expect(r.sem_resposta_do_youtube).toHaveLength(2)
    expect(r.sem_resposta_do_youtube[0]).toContain('Canal Um')
    expect(r.sem_resposta_do_youtube[1]).toContain('Canal Dois')
  })

  it('o resumo soma as chamadas de sucesso, de erro e de fetch que lançou', async () => {
    const f = fetchFalso({
      [idDoVideo(2)]: () => json({ error: {} }, 500), // 3 chamadas
      [idDoVideo(3)]: new Error('rede'), // 1 chamada que lançou
    })
    const db = bd(lidosHoje(3))
    const r = await passoRetencao(ctxDe(db))
    expect(f).toHaveBeenCalledTimes(1 + 3 + 1)
    expect(r.chamadas).toBe(5)
    expect(r.gravados).toBe(1)
  })

  it('o resumo diz o dia (Pacífico) e fecha as tentativas por resultado', async () => {
    fetchFalso()
    const db = bd(lidosHoje(2))
    const r = await passoRetencao(ctxDe(db))
    expect(r.ate).toBe(HOJE)
    expect(r.tentativas.ok).toBe(3) // 2 vídeos + o canal
    expect(r.pendentes).toBe(0)
  })
})

describe('passoRetencao: interruptor', () => {
  it('YT_OWN_STEPS_OFF=retencao: não lê fatos, não pede token, não chama a API; o resumo diz desligado', async () => {
    process.env.YT_OWN_STEPS_OFF = 'retencao'
    const f = fetchFalso()
    const db = bd(lidosHoje(3))
    const r = await passoRetencao(ctxDe(db))
    expect(r.desligado).toBe(true)
    expect(chamadasDeFatos(db)).toHaveLength(0)
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(f).not.toHaveBeenCalled()
    expect(tentativas(db)).toEqual([])
    expect(r.gravados).toBe(0)
  })

  it('sem a variável o passo roda (o padrão é ligado)', async () => {
    delete process.env.YT_OWN_STEPS_OFF
    fetchFalso()
    const db = bd(lidosHoje(1))
    const r = await passoRetencao(ctxDe(db))
    expect(r.desligado).toBeUndefined()
    expect(r.gravados).toBe(1)
  })

  it('outro passo desligado (dimensoes) não desliga a retenção', async () => {
    process.env.YT_OWN_STEPS_OFF = 'dimensoes'
    fetchFalso()
    const db = bd(lidosHoje(1))
    const r = await passoRetencao(ctxDe(db))
    expect(r.gravados).toBe(1)
  })
})

describe('passoRetencao: tentativa sem resposta nunca conta como leitura (foco d)', () => {
  const modos: Array<[string, () => Response | Error, 'banco' | null]> = [
    ['401', () => erroGoogle(401, 'authError'), null],
    ['500', () => json({}, 500), null],
    ['404', () => erroGoogle(404, 'notFound'), null],
    ['cota', () => erroGoogle(403, 'quotaExceeded'), null],
    ['exceção', () => new Error('rede'), null],
    ['corpo ilegível', () => new Response('<html>', { status: 200 }), null],
    ['forma estranha', () => json({ columnHeaders: CABECALHO3, rows: [[2, 1, 1, 1]] }), null],
    ['banco recusa a escrita', () => json(curva()), 'banco'],
  ]
  for (const [nome, resp, banco] of modos) {
    it(`${nome}: nenhuma tentativa ok ou sem_dado_na_janela e nenhuma linha de retenção`, async () => {
      fetchFalso({}, resp)
      const db = bd(lidosHoje(3))
      if (banco) db.writeErrors.yt_own_video_retention = { code: 'XX000', message: 'x' }
      const r = await passoRetencao(ctxDe(db))
      const dosVideos = tentativas(db).filter(t => t.scope_type === 'video')
      expect(dosVideos).toHaveLength(3)
      expect(dosVideos.filter(t => t.outcome === 'ok' || t.outcome === 'sem_dado_na_janela')).toEqual([])
      expect(retencoes(db)).toEqual([])
      expect(r.gravados).toBe(0)
      expect(r.vazios).toBe(0)
      // todo `error` gravado é um código do catálogo
      for (const t of dosVideos) if (t.error != null) expect(ehMotivo(t.error as string)).toBe(true)
    })
  }

  it('sem tempo: a tentativa é nao_alcancado_orcamento, nunca ok', async () => {
    fetchFalso()
    const db = bd(lidosHoje(2))
    const ctx = ctxDe(db)
    // o relógio vence depois do token e antes das leituras
    await passoRetencao(ctx, { token: async () => { ctx.deadline = Date.now() - 1; return 'tok' } })
    const dosVideos = tentativas(db).filter(t => t.scope_type === 'video')
    expect(dosVideos.map(t => t.outcome)).toEqual(['nao_alcancado_orcamento', 'nao_alcancado_orcamento'])
    expect(retencoes(db)).toEqual([])
  })
})
