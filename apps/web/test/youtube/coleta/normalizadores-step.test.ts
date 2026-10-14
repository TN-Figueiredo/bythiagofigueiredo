// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { MAX_NORMALIZAR_E11, passoNormalizadores } from '@/lib/youtube/coleta/normalizadores-step'
import { TETOS_DE_FIM_MS } from '@/lib/youtube/coleta/clock'
import { paraBytea } from '@/lib/youtube/reporting/client'
import { CABECALHO_ALCANCE_COMBINADO } from '@/lib/youtube/reporting/reach-combined-csv'
import { CABECALHO_TRAFEGO } from '@/lib/youtube/reporting/traffic-source-csv'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase, type FakeDb, type FakeErr, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-13T12:00:00.000Z')
const SENTINELA = 'zz-sentinela-e11'
const fixture = (nome: string) => readFileSync(join(__dirname, 'fixtures', nome), 'utf8')
const TRAFEGO_REAL = fixture('traffic-source-a3-real.csv')
const ALCANCE_SINT = fixture('reach-combined-a1-sintetico.csv')

const UC = 'UCRHtzTwaEpcjspAS2hbqmrA'
const UC_FAKE = 'UCfake00000000000000000A'
const UC_OUTRO = 'UCOutroCanal00000000000A'
const TIPO_T = 'channel_traffic_source_a3'
const TIPO_A = 'channel_reach_combined_a1'
// Pacífico começa 07:00 UTC: o dia do relatório é a data UTC do start_time.
const START_TRAFEGO = '2026-09-25T07:00:00.000Z'
const START_ALCANCE = '2026-09-30T07:00:00.000Z'
const CREATE = '2026-10-01T10:00:00.000Z'
const S1 = 'S1iMQVIOFL4'

const gz = (csv: string) => paraBytea(gzipSync(Buffer.from(csv)))
const canal = { id: 'ch-1', channel_id: UC, site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'ok' as const, video_count: 35 }
const canalFake = { ...canal, id: 'ch-2', channel_id: UC_FAKE, name: 'Canal Dois' }

const linhasDoDia = (csv: string, dia: string): string =>
  csv.split('\n').filter((l, i) => i === 0 || l.startsWith(dia)).join('\n') + '\n'
const T_25 = linhasDoDia(TRAFEGO_REAL, '20260925')
const CAB_T = CABECALHO_TRAFEGO.join(',')
const CAB_A = CABECALHO_ALCANCE_COMBINADO.join(',')

const csvTrafego = (linhas: Array<{ dia?: string; canalId?: string; video: string; origem: string; detalhe?: string; views: number; min?: number }>): string =>
  [CAB_T, ...linhas.map(l => [
    l.dia ?? '20260925', l.canalId ?? UC, l.video, 'on_demand', 'not_subscribed', 'BR', l.origem, l.detalhe ?? '', l.views, l.views, l.min ?? 1.5, 0, 0, 0, 0,
  ].join(','))].join('\n') + '\n'

const csvAlcance = (linhas: Array<{ dia?: string; video: string; aparelho?: string; so?: string; origem?: string; imp: number; ctr?: string }>): string =>
  [CAB_A, ...linhas.map(l => [
    l.dia ?? '20260930', UC_FAKE, l.video, l.aparelho ?? '102', l.so ?? '2', l.origem ?? '5', 'XXXX', l.imp, l.ctr ?? '0.25',
  ].join(','))].join('\n') + '\n'

const videos = (ids: string[], canalId = 'ch-1'): Row[] => ids.map(id => ({ id: `v-${id}`, youtube_video_id: id, channel_id: canalId }))
const rel = (id: string, extra: Row = {}): Row => ({
  site_id: 'site-1', report_id: id, job_id: 'job-1', channel_id: 'ch-1', report_type_id: TIPO_T, status: 'baixado',
  create_time: CREATE, start_time: START_TRAFEGO, end_time: '2026-09-26T07:00:00.000Z', normalized_at: null, unmatched_video_ids: null, error: null, ...extra,
})
const relA = (id: string, extra: Row = {}): Row => rel(id, {
  report_type_id: TIPO_A, channel_id: 'ch-2', start_time: START_ALCANCE, end_time: '2026-10-01T07:00:00.000Z', ...extra,
})
const blob = (id: string, csv: string): Row => ({ report_id: id, site_id: 'site-1', csv_gz: gz(csv) })

type Handler = FakeDb['rpcHandlers'][string]

/** Espelho da regra de yt_own_traffic_detail_apply / yt_own_reach_dim_apply: superado só por relatório JÁ normalizado, marca normalized_at. */
function comApplyE11(db: FakeDb): FakeDb {
  const fazer = (tipo: string, tabela: string): Handler => (a) => {
    const reports = db.tables.yt_reporting_reports ?? []
    const r = reports.find(x => x.report_id === a.p_report_id)
    if (!r) return { data: null, error: { code: 'P0001', message: 'relatório não encontrado' } }
    if (r.report_type_id !== tipo) return { data: null, error: { code: 'P0001', message: 'tipo inesperado' } }
    const dia = String(r.start_time).slice(0, 10)
    const novoDemais = reports.some(n =>
      n.channel_id === r.channel_id && n.report_type_id === r.report_type_id && n.start_time === r.start_time
      && n.normalized_at != null && ['baixado', 'vazio'].includes(String(n.status))
      && `${n.create_time}|${n.report_id}` > `${r.create_time}|${r.report_id}`)
    if (novoDemais) {
      r.normalized_at = new Date().toISOString()
      return { data: { status: 'superado', dia, gravadas: 0, apagadas: 0, videos_cobertos: 0 }, error: null }
    }
    const t = (db.tables[tabela] ??= [])
    const antes = t.length
    db.tables[tabela] = t.filter(l => !(l.channel_id === r.channel_id && l.day_pt === dia))
    const apagadas = antes - db.tables[tabela]!.length
    const linhas = (a.p_rows ?? []) as Row[]
    for (const l of linhas) db.tables[tabela]!.push({ ...l, channel_id: r.channel_id, source_report_id: r.report_id })
    r.normalized_at = new Date().toISOString()
    r.unmatched_video_ids = a.p_unmatched ?? null
    return { data: { status: 'gravado', dia, gravadas: linhas.length, apagadas, videos_cobertos: 0 }, error: null }
  }
  db.rpcHandlers.yt_own_traffic_detail_apply = fazer(TIPO_T, 'yt_own_video_traffic_detail_daily')
  db.rpcHandlers.yt_own_reach_dim_apply = fazer(TIPO_A, 'yt_own_video_reach_dim_daily')
  return db
}

const banco = (reports: Row[], blobs: Row[], extra: Record<string, Row[]> = {}): FakeDb =>
  comApplyE11(fakeSupabase({
    yt_reporting_reports: reports, yt_reporting_report_blobs: blobs,
    youtube_videos: [...videos(['S1iMQVIOFL4', 'r_3QZBKHqU8', 'yJl_YzInZ3U', 'VIDEO000001', 'VIDEO000002']), ...videos(['VIDEOFAKE01', 'VIDEOFAKE02', 'VIDEOFAKE03', 'VIDEOFAKE04', 'VIDEOFAKE05'], 'ch-2')],
    ...extra,
  }))
const ctxDe = (db: FakeDb, prazoMs = 60_000, canais = [{ ...canal }, { ...canalFake }]): StepCtx => ({
  supabase: db.client, channels: canais, deadline: Date.now() + prazoMs, falhas: [], tentativas: [],
})
const relatorio = (db: FakeDb, id: string) => db.tables.yt_reporting_reports!.find(r => r.report_id === id)!
const aplicacoes = (db: FakeDb, nome?: string) =>
  db.rpcCalls.filter(c => c.name === (nome ?? c.name) && /^yt_own_(traffic_detail|reach_dim)_apply$/.test(c.name))
const tentativasGravadas = (db: FakeDb) => db.tables.yt_own_collection_attempts ?? []
const rpcErro = (code: string, extra: Partial<FakeErr> = {}): FakeErr => ({ code, message: `falhou ${code}`, ...extra })
const instalar = (db: FakeDb, nome: string, h: Handler) => { db.rpcHandlers[nome] = h }

/** Tudo o que o passo mostrou para fora: notas, erro gravado, tentativas, argumentos do Sentry. */
const saida = (db: FakeDb, ctx: StepCtx): string => JSON.stringify([
  ctx.falhas, ctx.tentativas, tentativasGravadas(db),
  (db.tables.yt_reporting_reports ?? []).map(r => [r.status, r.error]),
  vi.mocked(Sentry.captureMessage).mock.calls, vi.mocked(Sentry.captureException).mock.calls,
])

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  delete process.env.YT_OWN_STEPS_OFF
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  delete process.env.YT_OWN_STEPS_OFF
})

describe('passoNormalizadores', () => {
  it('o teto de fim do passo é o do relógio e o limite da fila é 200', () => {
    expect(TETOS_DE_FIM_MS.normalizadores).toBe(20_000)
    expect(MAX_NORMALIZAR_E11).toBe(200)
  })

  it('nenhum relatório na fila: resumo zerado, nenhuma função chamada, nenhuma tentativa', async () => {
    const db = banco([], [])
    const ctx = ctxDe(db)
    const resumo = await passoNormalizadores(ctx)
    expect(resumo.pendentes).toBe(0)
    expect(resumo.gravados).toBe(0)
    expect(resumo.por_tipo.detalhe).toEqual({ normalizados: 0, vazios: 0, superados: 0, erros: 0, sem_par: 0, descartadas_zeradas: 0, codigos_fora_do_catalogo: 0 })
    expect(resumo.por_tipo.alcance_dim).toEqual(resumo.por_tipo.detalhe)
    expect(aplicacoes(db)).toHaveLength(0)
    expect(ctx.tentativas).toHaveLength(0)
    expect(ctx.falhas).toEqual([])
    // Só a leitura da fila; nenhuma outra tabela foi tocada.
    expect(db.leituras.yt_reporting_reports).toBe(1)
    expect(db.leituras.yt_reporting_report_blobs ?? 0).toBe(0)
  })

  it('só lê relatório baixado ou vazio, ainda não normalizado, dos canais do contexto', async () => {
    const db = banco(
      [rel('ok'), rel('feito', { normalized_at: '2026-10-02T00:00:00.000Z' }), rel('erro', { status: 'erro' }),
        rel('listado', { status: 'listado' }), rel('de-fora', { channel_id: 'ch-9' }), rel('outro-tipo', { report_type_id: 'channel_reach_basic_a1' })],
      [blob('ok', T_25), blob('feito', T_25), blob('erro', T_25), blob('listado', T_25), blob('de-fora', T_25), blob('outro-tipo', T_25)],
    )
    await passoNormalizadores(ctxDe(db))
    expect(aplicacoes(db).map(c => c.args.p_report_id)).toEqual(['ok'])
  })

  it('normaliza os dois tipos: uma chamada a cada função, com o p_report_id certo e linhas no formato do contrato', async () => {
    const db = banco([rel('t1'), relA('a1')], [blob('t1', T_25), blob('a1', ALCANCE_SINT)])
    const ctx = ctxDe(db)
    const resumo = await passoNormalizadores(ctx)
    const t = aplicacoes(db, 'yt_own_traffic_detail_apply')
    const a = aplicacoes(db, 'yt_own_reach_dim_apply')
    expect(t).toHaveLength(1)
    expect(a).toHaveLength(1)
    expect(t[0]!.args.p_report_id).toBe('t1')
    expect(a[0]!.args.p_report_id).toBe('a1')
    expect(t[0]!.args.p_unmatched).toBeNull()
    expect(a[0]!.args.p_unmatched).toBeNull()

    const linhasT = t[0]!.args.p_rows as Row[]
    expect(linhasT).toHaveLength(3)
    const s1 = linhasT.find(l => l.youtube_video_id === S1)!
    expect(s1).toMatchObject({
      video_id: 'v-S1iMQVIOFL4', day_pt: '2026-09-25', source_type: '4', detail: 'XXXXXXXXXXXX', views: 1,
      metric_version: 'views_desde_2026-08-27',
    })
    expect(s1.detail_hash).toBe(createHash('sha256').update('XXXXXXXXXXXX').digest('hex'))
    expect(typeof s1.watch_time_minutes).toBe('number')

    const linhasA = a[0]!.args.p_rows as Row[]
    expect(linhasA.length).toBeGreaterThan(0)
    expect(linhasA[0]).toMatchObject({ day_pt: '2026-09-30', thumbnail_impressions: expect.any(Number), metric_version: 'views_desde_2026-08-27' })
    expect(Object.keys(linhasA[0]!).sort()).toEqual(
      ['day_pt', 'device_type', 'metric_version', 'operating_system', 'thumbnail_clicks_est', 'thumbnail_impressions', 'traffic_source_type', 'video_id', 'youtube_video_id'])

    expect(resumo.por_tipo.detalhe.normalizados).toBe(1)
    expect(resumo.por_tipo.alcance_dim.normalizados).toBe(1)
    expect(resumo.gravados).toBe(3 + linhasA.length)
    expect(resumo.pendentes).toBe(0)
    // A função marca normalized_at; o passo não faz `update` de sucesso no relatório.
    expect(db.writes.filter(w => w.table === 'yt_reporting_reports')).toEqual([])
    expect(relatorio(db, 't1').normalized_at).not.toBeNull()
    expect(relatorio(db, 'a1').status).toBe('baixado')
    // Uma tentativa por canal e tipo, ok.
    expect(tentativasGravadas(db).map(x => [x.kind, x.scope_type, x.scope_id, x.outcome, x.error]).sort()).toEqual([
      ['normalizador_alcance_dim', 'canal', 'ch-2', 'ok', null],
      ['normalizador_trafego', 'canal', 'ch-1', 'ok', null],
    ])
    expect(resumo.tentativas).toEqual({ ok: 2 })
    expect(ctx.falhas).toEqual([])
  })

  it('o relatório de tráfego lê as linhas do canal certo e a linha sem tipo de detalhe não perde views na soma', async () => {
    const csv = csvTrafego([
      { video: S1, origem: '5', detalhe: 'termo a', views: 2 },
      { video: S1, origem: '5', detalhe: 'termo a', views: 3 },
      { video: S1, origem: '5', detalhe: '', views: 4 },
    ])
    const db = banco([rel('t1')], [blob('t1', csv)])
    await passoNormalizadores(ctxDe(db))
    const linhas = aplicacoes(db)[0]!.args.p_rows as Row[]
    expect(linhas.map(l => [l.detail, l.views]).sort()).toEqual([['', 4], ['termo a', 5]])
    expect(linhas.find(l => l.detail === '')!.detail_hash).toBe(createHash('sha256').update('').digest('hex'))
  })

  it('vazio chama a função com lista vazia e conta em vazios, diferente de "não li"', async () => {
    const db = banco([relA('a1', { status: 'vazio' }), rel('t1', { status: 'vazio' })], [blob('a1', `${CAB_A}\n`), blob('t1', `${CAB_T}\n`)])
    const ctx = ctxDe(db)
    const resumo = await passoNormalizadores(ctx)
    expect(aplicacoes(db).map(c => [c.name, c.args.p_rows, c.args.p_unmatched]).sort((x, y) => String(x[0]).localeCompare(String(y[0])))).toEqual([
      ['yt_own_reach_dim_apply', [], null],
      ['yt_own_traffic_detail_apply', [], null],
    ])
    expect(resumo.por_tipo.detalhe).toMatchObject({ vazios: 1, normalizados: 0, erros: 0 })
    expect(resumo.por_tipo.alcance_dim).toMatchObject({ vazios: 1, normalizados: 0, erros: 0 })
    expect(relatorio(db, 'a1').normalized_at).not.toBeNull()
    expect(relatorio(db, 'a1').status).toBe('vazio')
    expect(ctx.falhas).toEqual([])
  })

  it('vazio com cabeçalho trocado não passa: o cabeçalho é conferido mesmo sem linha', async () => {
    const db = banco([relA('a1', { status: 'vazio' })], [blob('a1', 'date,channel_id,video_id,outra\n')])
    const ctx = ctxDe(db)
    const resumo = await passoNormalizadores(ctx)
    expect(aplicacoes(db)).toHaveLength(0)
    expect(relatorio(db, 'a1')).toMatchObject({ status: 'erro', error: 'cabecalho_inesperado' })
    expect(resumo.por_tipo.alcance_dim.erros).toBe(1)
  })

  it('cabeçalho inesperado: erro com o código, nenhuma linha, nota com a frase, e a fila ANDA', async () => {
    const ruim = T_25.replace('watch_time_minutes', 'minutos')
    const db = banco(
      [rel('ruim', { create_time: '2026-10-01T10:00:00.000Z' }), rel('bom', { create_time: '2026-10-01T11:00:00.000Z', start_time: '2026-09-26T07:00:00.000Z' })],
      [blob('ruim', ruim), blob('bom', csvTrafego([{ dia: '20260926', video: S1, origem: '4', detalhe: 'XX', views: 1 }]))],
    )
    const ctx = ctxDe(db)
    const resumo = await passoNormalizadores(ctx)
    expect(relatorio(db, 'ruim')).toMatchObject({ status: 'erro', error: 'cabecalho_inesperado' })
    expect(relatorio(db, 'ruim').normalized_at).toBeNull()
    expect(aplicacoes(db).map(c => c.args.p_report_id)).toEqual(['bom'])
    expect(relatorio(db, 'bom').normalized_at).not.toBeNull()
    expect(ctx.falhas).toEqual(['normalizadores: relatório ruim de Canal Um não pôde ser normalizado (o cabeçalho do relatório não é o esperado)'])
    expect(resumo.por_tipo.detalhe).toMatchObject({ erros: 1, normalizados: 1 })
    expect(resumo.pendentes).toBe(0)
    // Vermelho: a tentativa do canal diz erro_http com o motivo fixo do catálogo de motivo.ts.
    expect(tentativasGravadas(db)).toEqual([expect.objectContaining({ kind: 'normalizador_trafego', outcome: 'erro_http', error: 'forma_inesperada' })])
    expect(Sentry.captureMessage).toHaveBeenCalledWith('normalizadores: cabecalho_inesperado', expect.objectContaining({
      tags: { cron: 'sync-analytics-metrics', passo: 'normalizadores' }, extra: { report: 'ruim', pg_code: null },
    }))
  })

  it('bruto ausente: relatório baixado e vazio sem bruto viram erro bruto_ausente', async () => {
    const db = banco([rel('t1'), rel('t2', { status: 'vazio', start_time: '2026-09-26T07:00:00.000Z' })], [])
    const ctx = ctxDe(db)
    await passoNormalizadores(ctx)
    expect(relatorio(db, 't1')).toMatchObject({ status: 'erro', error: 'bruto_ausente' })
    expect(relatorio(db, 't2')).toMatchObject({ status: 'erro', error: 'bruto_ausente' })
    expect(aplicacoes(db)).toHaveLength(0)
    expect(ctx.falhas).toHaveLength(2)
    expect(ctx.falhas[0]).toContain('o arquivo bruto do relatório não está guardado')
  })

  it('gzip corrompido: erro gzip_invalido, e o seguinte é normalizado', async () => {
    const db = banco(
      [rel('t1'), rel('t2', { create_time: '2026-10-01T11:00:00.000Z' })],
      [{ report_id: 't1', site_id: 'site-1', csv_gz: paraBytea(Buffer.from('isto não é gzip')) }, blob('t2', T_25)],
    )
    const ctx = ctxDe(db)
    await passoNormalizadores(ctx)
    expect(relatorio(db, 't1')).toMatchObject({ status: 'erro', error: 'gzip_invalido' })
    expect(aplicacoes(db).map(c => c.args.p_report_id)).toEqual(['t2'])
    expect(ctx.falhas).toEqual(['normalizadores: relatório t1 de Canal Um não pôde ser normalizado (o arquivo do relatório não abriu (compactação inválida))'])
  })

  it('linha inválida (aspas): erro linha_invalida e nenhuma linha do relatório entra', async () => {
    const csv = `${T_25}20260925,${UC},${S1},on_demand,not_subscribed,BR,5,"a,b",1,1,1,0,0,0,0\n`
    const db = banco([rel('t1')], [blob('t1', csv)])
    await passoNormalizadores(ctxDe(db))
    expect(relatorio(db, 't1')).toMatchObject({ status: 'erro', error: 'linha_invalida' })
    expect(aplicacoes(db)).toHaveLength(0)
  })

  it('linha de outro canal e linha de outro dia: erro, função não chamada', async () => {
    const db = banco(
      [rel('outro-canal'), rel('outro-dia', { start_time: '2026-09-26T07:00:00.000Z' }), relA('a-outro-dia')],
      [
        blob('outro-canal', csvTrafego([{ video: S1, origem: '4', views: 1 }, { canalId: UC_OUTRO, video: S1, origem: '4', views: 1 }])),
        blob('outro-dia', T_25),
        blob('a-outro-dia', csvAlcance([{ dia: '20260929', video: 'VIDEOFAKE01', imp: 3 }])),
      ],
    )
    const ctx = ctxDe(db)
    await passoNormalizadores(ctx)
    expect(relatorio(db, 'outro-canal')).toMatchObject({ status: 'erro', error: 'canal_inesperado' })
    expect(relatorio(db, 'outro-dia')).toMatchObject({ status: 'erro', error: 'dia_inesperado' })
    expect(relatorio(db, 'a-outro-dia')).toMatchObject({ status: 'erro', error: 'dia_inesperado' })
    expect(aplicacoes(db)).toHaveLength(0)
    expect(ctx.falhas).toHaveLength(3)
  })

  it('o dia do relatório é a data UTC do start_time, não a do create_time; start_time ausente é dia_inesperado', async () => {
    const db = banco(
      [rel('t1', { create_time: '2026-10-05T23:59:00.000Z' }), rel('t2', { start_time: null, create_time: '2026-10-05T23:59:30.000Z' })],
      [blob('t1', T_25), blob('t2', T_25)],
    )
    await passoNormalizadores(ctxDe(db))
    expect(relatorio(db, 't1').normalized_at).not.toBeNull()
    expect(relatorio(db, 't2')).toMatchObject({ status: 'erro', error: 'dia_inesperado' })
  })

  it('superado é contado e sai da fila: a função devolve superado, o passo não conta como gravado', async () => {
    const db = banco([rel('t1')], [blob('t1', T_25)])
    instalar(db, 'yt_own_traffic_detail_apply', () => ({ data: { status: 'superado', dia: '2026-09-25', gravadas: 0, apagadas: 0, videos_cobertos: 0 }, error: null }))
    const ctx = ctxDe(db)
    const resumo = await passoNormalizadores(ctx)
    expect(resumo.por_tipo.detalhe).toMatchObject({ superados: 1, normalizados: 0, erros: 0, vazios: 0 })
    expect(resumo.gravados).toBe(0)
    expect(resumo.pendentes).toBe(0)
    expect(tentativasGravadas(db)[0]).toMatchObject({ outcome: 'ok' })
    expect(ctx.falhas).toEqual([])
  })

  describe('dois relatórios do mesmo dia', () => {
    const velho = '2026-10-01T10:00:00.000Z'
    const novo = '2026-10-02T10:00:00.000Z'
    const csvVelho = csvTrafego([{ video: S1, origem: '5', detalhe: 'velho', views: 1 }])
    const csvNovo = csvTrafego([{ video: S1, origem: '5', detalhe: 'novo', views: 9 }])

    it('o mais velho é aplicado primeiro, o mais novo depois e vale: ninguém sai superado', async () => {
      // Ordem de semeadura invertida: quem manda é o create_time.
      const db = banco([rel('novo', { create_time: novo }), rel('velho', { create_time: velho })], [blob('novo', csvNovo), blob('velho', csvVelho)])
      const resumo = await passoNormalizadores(ctxDe(db))
      expect(aplicacoes(db).map(c => c.args.p_report_id)).toEqual(['velho', 'novo'])
      const dia = db.tables.yt_own_video_traffic_detail_daily!
      expect(dia).toHaveLength(1)
      expect(dia[0]).toMatchObject({ detail: 'novo', views: 9, source_report_id: 'novo' })
      expect(resumo.por_tipo.detalhe).toMatchObject({ normalizados: 2, superados: 0 })
    })

    it('o mais novo falha por conteúdo: o mais velho grava e o dia fica com o dado dele (nunca superado antes da hora)', async () => {
      const db = banco([rel('velho', { create_time: velho }), rel('novo', { create_time: novo })], [blob('velho', csvVelho), blob('novo', csvNovo.replace('views', 'visualizacoes'))])
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(aplicacoes(db).map(c => c.args.p_report_id)).toEqual(['velho'])
      expect(db.tables.yt_own_video_traffic_detail_daily![0]).toMatchObject({ detail: 'velho', source_report_id: 'velho' })
      expect(relatorio(db, 'velho').normalized_at).not.toBeNull()
      expect(relatorio(db, 'novo')).toMatchObject({ status: 'erro', error: 'cabecalho_inesperado' })
      expect(resumo.por_tipo.detalhe).toMatchObject({ normalizados: 1, erros: 1, superados: 0 })
      expect(ctx.falhas).toHaveLength(1)
    })

    it('um mais novo JÁ normalizado supera o mais velho que ainda estava na fila', async () => {
      const db = banco(
        [rel('velho', { create_time: velho }), rel('novo', { create_time: novo, normalized_at: '2026-10-02T11:00:00.000Z' })],
        [blob('velho', csvVelho), blob('novo', csvNovo)],
      )
      const resumo = await passoNormalizadores(ctxDe(db))
      expect(aplicacoes(db).map(c => c.args.p_report_id)).toEqual(['velho'])
      expect(resumo.por_tipo.detalhe).toMatchObject({ superados: 1, normalizados: 0 })
      expect(db.tables.yt_own_video_traffic_detail_daily ?? []).toHaveLength(0)
    })

    it('relatórios do mesmo dia de canais ou tipos diferentes não se superam', async () => {
      const db = banco(
        [rel('t-velho', { create_time: velho }), relA('a-novo', { create_time: novo, start_time: START_TRAFEGO })],
        [blob('t-velho', csvVelho), blob('a-novo', csvAlcance([{ dia: '20260925', video: 'VIDEOFAKE01', imp: 3 }]))],
      )
      const resumo = await passoNormalizadores(ctxDe(db))
      expect(resumo.por_tipo.detalhe.superados + resumo.por_tipo.alcance_dim.superados).toBe(0)
      expect(aplicacoes(db)).toHaveLength(2)
    })
  })

  it('sem par: linha sem video_id, p_unmatched com contagem e ids ordenados, e conta em sem_par', async () => {
    const csv = csvTrafego([{ video: S1, origem: '4', detalhe: 'XX', views: 1 }, { video: 'zzzzzzzzzzb', origem: '4', detalhe: 'XX', views: 1 }, { video: 'zzzzzzzzzza', origem: '8', detalhe: 'XX', views: 2 }])
    const db = banco([rel('t1')], [blob('t1', csv)])
    const resumo = await passoNormalizadores(ctxDe(db))
    const c = aplicacoes(db)[0]!
    const linhas = c.args.p_rows as Row[]
    expect(linhas.find(l => l.youtube_video_id === 'zzzzzzzzzza')).not.toHaveProperty('video_id')
    expect(linhas.find(l => l.youtube_video_id === S1)!.video_id).toBe('v-S1iMQVIOFL4')
    expect(c.args.p_unmatched).toEqual({ count: 2, ids: ['zzzzzzzzzza', 'zzzzzzzzzzb'] })
    expect(resumo.por_tipo.detalhe.sem_par).toBe(2)
  })

  it('código fora do catálogo é gravado como veio e contado uma vez por código e relatório', async () => {
    const csv = csvAlcance([
      { video: 'VIDEOFAKE01', origem: '99', imp: 5 },
      { video: 'VIDEOFAKE02', origem: '99', imp: 5 },
      { video: 'VIDEOFAKE03', aparelho: '555', imp: 5 },
      { video: 'VIDEOFAKE04', imp: 5 },
    ])
    const csvT = csvTrafego([{ video: S1, origem: '77', detalhe: 'XX', views: 1 }, { video: 'r_3QZBKHqU8', origem: '4', detalhe: 'XX', views: 1 }])
    const db = banco([relA('a1'), rel('t1')], [blob('a1', csv), blob('t1', csvT)])
    const resumo = await passoNormalizadores(ctxDe(db))
    const linhasA = aplicacoes(db, 'yt_own_reach_dim_apply')[0]!.args.p_rows as Row[]
    expect(linhasA.filter(l => l.traffic_source_type === '99')).toHaveLength(2)
    expect(linhasA.some(l => l.device_type === '555')).toBe(true)
    expect(resumo.por_tipo.alcance_dim.codigos_fora_do_catalogo).toBe(2)
    expect((aplicacoes(db, 'yt_own_traffic_detail_apply')[0]!.args.p_rows as Row[]).some(l => l.source_type === '77')).toBe(true)
    expect(resumo.por_tipo.detalhe.codigos_fora_do_catalogo).toBe(1)
  })

  it('descartadas_zeradas: as chaves zeradas saem do envio e são contadas', async () => {
    const csv = csvTrafego([{ video: S1, origem: '4', detalhe: 'A', views: 0, min: 0 }, { video: S1, origem: '4', detalhe: 'B', views: 2 }])
    const csvA = csvAlcance([{ video: 'VIDEOFAKE01', imp: 0, ctr: '' }, { video: 'VIDEOFAKE02', imp: 3 }])
    const db = banco([rel('t1'), relA('a1')], [blob('t1', csv), blob('a1', csvA)])
    const resumo = await passoNormalizadores(ctxDe(db))
    expect(aplicacoes(db, 'yt_own_traffic_detail_apply')[0]!.args.p_rows as Row[]).toHaveLength(1)
    expect(aplicacoes(db, 'yt_own_reach_dim_apply')[0]!.args.p_rows as Row[]).toHaveLength(1)
    expect(resumo.por_tipo.detalhe.descartadas_zeradas).toBe(1)
    expect(resumo.por_tipo.alcance_dim.descartadas_zeradas).toBe(1)
  })

  it('relatório com tudo zerado vira lista vazia, mas não é "vazio" do bruto: normalizado, com linhas descartadas', async () => {
    const db = banco([rel('t1')], [blob('t1', csvTrafego([{ video: S1, origem: '4', detalhe: 'A', views: 0, min: 0 }]))])
    const resumo = await passoNormalizadores(ctxDe(db))
    expect(aplicacoes(db)[0]!.args.p_rows).toEqual([])
    expect(resumo.por_tipo.detalhe).toMatchObject({ vazios: 1, descartadas_zeradas: 1 })
  })

  describe('tempo', () => {
    it('sem tempo: prazo curto, nada é lido nem aplicado; pendentes e tentativa nao_alcancado_orcamento', async () => {
      const db = banco([rel('t1'), relA('a1')], [blob('t1', T_25), blob('a1', ALCANCE_SINT)])
      const ctx = ctxDe(db, 2_000)
      const resumo = await passoNormalizadores(ctx)
      expect(aplicacoes(db)).toHaveLength(0)
      expect(db.leituras.yt_reporting_report_blobs ?? 0).toBe(0)
      expect(resumo.pendentes).toBe(2)
      expect(relatorio(db, 't1').normalized_at).toBeNull()
      expect(relatorio(db, 't1').status).toBe('baixado')
      expect(tentativasGravadas(db).map(x => [x.kind, x.outcome]).sort()).toEqual([
        ['normalizador_alcance_dim', 'nao_alcancado_orcamento'], ['normalizador_trafego', 'nao_alcancado_orcamento'],
      ])
      expect(resumo.tentativas).toEqual({ nao_alcancado_orcamento: 2 })
      expect(ctx.falhas).toEqual([])
    })

    it('o relógio acaba no meio: o que já gravou fica, o resto é contado como pendente', async () => {
      const ids = ['t1', 't2', 't3', 't4']
      const db = banco(
        ids.map((id, i) => rel(id, { create_time: `2026-10-01T10:0${i}:00.000Z`, start_time: `2026-09-2${i}T07:00:00.000Z` })),
        ids.map((id, i) => blob(id, csvTrafego([{ dia: `2026092${i}`, video: S1, origem: '4', detalhe: 'XX', views: 1 }]))),
      )
      const original = db.rpcHandlers.yt_own_traffic_detail_apply!
      let n = 0
      instalar(db, 'yt_own_traffic_detail_apply', (a) => {
        const r = original(a)
        if (++n === 2) vi.setSystemTime(Date.now() + 59_000) // o prazo de 60 s quase acabou: sobra 1 s (< 3 s)
        return r
      })
      const ctx = ctxDe(db, 60_000, [{ ...canal }])
      const resumo = await passoNormalizadores(ctx)
      expect(aplicacoes(db).map(c => c.args.p_report_id)).toEqual(['t1', 't2'])
      expect(relatorio(db, 't1').normalized_at).not.toBeNull()
      expect(relatorio(db, 't2').normalized_at).not.toBeNull()
      expect(relatorio(db, 't3').normalized_at).toBeNull()
      expect(relatorio(db, 't4').status).toBe('baixado')
      expect(resumo.por_tipo.detalhe.normalizados).toBe(2)
      expect(resumo.pendentes).toBe(2)
      expect(tentativasGravadas(db)).toEqual([expect.objectContaining({ kind: 'normalizador_trafego', outcome: 'nao_alcancado_orcamento' })])
    })

    it('fila maior que 200: 201 lidos, 200 processados, pendentes >= 1 e tentativa nao_alcancado_orcamento', async () => {
      const ids = Array.from({ length: 201 }, (_, i) => `t${String(i).padStart(3, '0')}`)
      const db = banco(
        ids.map((id, i) => rel(id, { status: 'vazio', create_time: new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString() })),
        ids.map(id => blob(id, `${CAB_T}\n`)),
      )
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(aplicacoes(db)).toHaveLength(200)
      expect(resumo.por_tipo.detalhe.vazios).toBe(200)
      expect(resumo.pendentes).toBeGreaterThanOrEqual(1)
      expect(relatorio(db, 't200').normalized_at).toBeNull()
      expect(tentativasGravadas(db)).toEqual([expect.objectContaining({ outcome: 'nao_alcancado_orcamento' })])
    })

    it('função que não responde até o prazo: pendentes, nada marcado', async () => {
      vi.useRealTimers()
      vi.useFakeTimers({ now: AGORA })
      const db = banco([rel('t1')], [blob('t1', T_25)])
      instalar(db, 'yt_own_traffic_detail_apply', () => new Promise(() => {}))
      const ctx = ctxDe(db)
      const corrida = passoNormalizadores(ctx)
      await vi.advanceTimersByTimeAsync(16_000)
      const resumo = await corrida
      expect(resumo.pendentes).toBe(1)
      expect(relatorio(db, 't1')).toMatchObject({ status: 'baixado', normalized_at: null, error: null })
      expect(resumo.por_tipo.detalhe.erros).toBe(0)
    })
  })

  describe('erros de banco', () => {
    it('schema ausente na função: o passo para, o resto vira pendente e a nota é schema_ausente', async () => {
      const db = banco([rel('t1'), rel('t2', { create_time: '2026-10-01T11:00:00.000Z' })], [blob('t1', T_25), blob('t2', T_25)])
      delete db.rpcHandlers.yt_own_traffic_detail_apply // o falso responde PGRST202, como a função ausente
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(aplicacoes(db)).toHaveLength(1)
      expect(ctx.falhas).toContain('schema_ausente: yt_own_traffic_detail_apply')
      expect(resumo.pendentes).toBe(2)
      expect(relatorio(db, 't1')).toMatchObject({ status: 'baixado', normalized_at: null })
      expect(tentativasGravadas(db)).toEqual([expect.objectContaining({ kind: 'normalizador_trafego', outcome: 'schema_ausente' })])
    })

    it('erro de banco passageiro (57014) deixa o relatório na fila, sem tocar status nem normalized_at', async () => {
      const db = banco([rel('t1')], [blob('t1', T_25)])
      instalar(db, 'yt_own_traffic_detail_apply', () => ({ data: null, error: rpcErro('57014') }))
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(resumo.pendentes).toBe(1)
      expect(resumo.por_tipo.detalhe.erros).toBe(0)
      expect(relatorio(db, 't1')).toMatchObject({ status: 'baixado', normalized_at: null, error: null })
      expect(db.writes.filter(w => w.table === 'yt_reporting_reports')).toEqual([])
      expect(Sentry.captureMessage).toHaveBeenCalledWith('normalizadores: erro_de_banco', expect.objectContaining({ extra: { report: 't1', pg_code: '57014' } }))
    })

    it('exceção lançada pela chamada também deixa o relatório na fila', async () => {
      const db = banco([rel('t1')], [blob('t1', T_25)])
      instalar(db, 'yt_own_traffic_detail_apply', () => { throw new Error(`boom ${SENTINELA}`) })
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(resumo.pendentes).toBe(1)
      expect(relatorio(db, 't1').normalized_at).toBeNull()
      expect(saida(db, ctx)).not.toContain(SENTINELA)
    })

    it.each(['23514', '23505', '22P02'])('recusa do banco por conteúdo (%s) marca erro recusado_pelo_banco e sai da fila', async (code) => {
      const db = banco([rel('t1')], [blob('t1', T_25)])
      instalar(db, 'yt_own_traffic_detail_apply', () => ({ data: null, error: rpcErro(code) }))
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(relatorio(db, 't1')).toMatchObject({ status: 'erro', error: 'recusado_pelo_banco' })
      expect(resumo.pendentes).toBe(0)
      expect(resumo.por_tipo.detalhe.erros).toBe(1)
      expect(ctx.falhas).toEqual(['normalizadores: relatório t1 de Canal Um não pôde ser normalizado (o banco recusou a gravação das linhas do relatório)'])
      expect(Sentry.captureMessage).toHaveBeenCalledWith('normalizadores: recusado_pelo_banco', expect.objectContaining({ extra: { report: 't1', pg_code: code } }))
      // E na leitura seguinte já não está na fila.
      const de = await passoNormalizadores(ctxDe(db))
      expect(de.por_tipo.detalhe.erros).toBe(0)
      expect(aplicacoes(db)).toHaveLength(1)
    })

    it('falha ao marcar o erro: o relatório fica na fila e a falha entra na nota', async () => {
      const db = banco([rel('t1')], [blob('t1', T_25.replace('views', 'v'))])
      db.writeErrors.yt_reporting_reports = rpcErro('57014')
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(resumo.pendentes).toBe(1)
      expect(resumo.por_tipo.detalhe.erros).toBe(0)
      expect(ctx.falhas).toContain('erro de banco ao gravar yt_reporting_reports')
    })

    it('falha ao ler a fila: nota e resumo zerado', async () => {
      const db = banco([rel('t1')], [blob('t1', T_25)])
      db.errors.yt_reporting_reports = rpcErro('57014')
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(ctx.falhas).toEqual(['erro de banco ao ler yt_reporting_reports'])
      expect(resumo.pendentes).toBe(0)
      expect(aplicacoes(db)).toHaveLength(0)
    })

    it('resposta da função em forma inesperada: nota, relatório conta como pendente', async () => {
      const db = banco([rel('t1')], [blob('t1', T_25)])
      instalar(db, 'yt_own_traffic_detail_apply', () => ({ data: 'ok', error: null }))
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(resumo.pendentes).toBe(1)
      expect(ctx.falhas).toEqual(['normalizadores: a função yt_own_traffic_detail_apply devolveu uma resposta inesperada'])
    })

    it('vídeos do canal que não puderam ser lidos: os relatórios do canal esperam', async () => {
      const db = banco([rel('t1')], [blob('t1', T_25)])
      db.errors.youtube_videos = rpcErro('57014')
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(resumo.pendentes).toBe(1)
      expect(aplicacoes(db)).toHaveLength(0)
      expect(relatorio(db, 't1').status).toBe('baixado')
      expect(ctx.falhas).toEqual(['erro de banco ao ler youtube_videos'])
    })

    it('mais de 1.000 vídeos no canal (leitura além do teto): espera, com nota', async () => {
      const muitos = Array.from({ length: 1001 }, (_, i) => ({ id: `v${i}`, youtube_video_id: `vid${String(i).padStart(8, '0')}`, channel_id: 'ch-1' }))
      const db = banco([rel('t1')], [blob('t1', T_25)])
      db.tables.youtube_videos = muitos
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(resumo.pendentes).toBe(1)
      expect(aplicacoes(db)).toHaveLength(0)
      expect(ctx.falhas).toEqual(['normalizadores: vídeos do canal Canal Um passam do limite de 1000 lidos; a normalização espera'])
    })

    it('a leitura de vídeos acontece uma vez por canal, mesmo com vários relatórios', async () => {
      const db = banco(
        [rel('t1'), rel('t2', { create_time: '2026-10-01T11:00:00.000Z', start_time: '2026-09-26T07:00:00.000Z' })],
        [blob('t1', T_25), blob('t2', csvTrafego([{ dia: '20260926', video: S1, origem: '4', detalhe: 'XX', views: 1 }]))],
      )
      await passoNormalizadores(ctxDe(db))
      expect(db.leituras.youtube_videos).toBe(1)
    })
  })

  describe('privacidade do detalhe da origem', () => {
    it('o termo não vaza por erro de banco: nem em falhas, erro gravado, tentativa nem Sentry', async () => {
      const csv = csvTrafego([{ video: S1, origem: '5', detalhe: SENTINELA, views: 1 }])
      const db = banco([rel('t1'), rel('t2', { create_time: '2026-10-01T11:00:00.000Z', start_time: '2026-09-26T07:00:00.000Z' })], [blob('t1', csv), blob('t2', csv.replace('20260925', '20260926'))])
      instalar(db, 'yt_own_traffic_detail_apply', (a) => (a.p_report_id === 't1'
        ? { data: null, error: { code: '23514', message: `Failing row contains (${SENTINELA})`, details: `Failing row contains (${SENTINELA})`, hint: SENTINELA } as FakeErr }
        : { data: null, error: { code: '57014', message: SENTINELA, details: SENTINELA, hint: SENTINELA } as FakeErr }))
      const ctx = ctxDe(db)
      await passoNormalizadores(ctx)
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(2)
      expect(saida(db, ctx)).not.toContain(SENTINELA)
      expect(relatorio(db, 't1').error).toBe('recusado_pelo_banco')
    })

    it('o detalhe não vaza por erro de leitura: fixture com sentinela e cabeçalho quebrado', async () => {
      const quebrado = csvTrafego([{ video: S1, origem: '5', detalhe: SENTINELA, views: 1 }]).replace('watch_time_minutes', 'minutos')
      const linhaRuim = csvTrafego([{ video: S1, origem: '5', detalhe: SENTINELA, views: 1 }]) + `20260925,${UC},${S1},on_demand,x,BR,5,"${SENTINELA}",1,1,1,0,0,0,0\n`
      const comOutroCanal = csvTrafego([{ canalId: UC_OUTRO, video: S1, origem: '5', detalhe: SENTINELA, views: 1 }])
      const comOutroDia = csvTrafego([{ dia: '20260101', video: S1, origem: '5', detalhe: SENTINELA, views: 1 }])
      const db = banco(
        [rel('t1'), rel('t2'), rel('t3'), rel('t4')],
        [blob('t1', quebrado), blob('t2', linhaRuim), blob('t3', comOutroCanal), blob('t4', comOutroDia)],
      )
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(resumo.por_tipo.detalhe.erros).toBe(4)
      expect(saida(db, ctx)).not.toContain(SENTINELA)
    })

    it('exceção inesperada: nota fixa, sem texto da exceção, o relatório espera', async () => {
      const db = banco([rel('t1')], [blob('t1', T_25)])
      const original = db.client.from.bind(db.client)
      ;(db.client as unknown as { from: (t: string) => unknown }).from = (t: string) => {
        if (t === 'yt_reporting_report_blobs') throw new Error(`falha ${SENTINELA}`)
        return original(t)
      }
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(resumo.pendentes).toBe(1)
      expect(ctx.falhas).toEqual(['normalizadores: erro interno ao normalizar o relatório t1'])
      expect(saida(db, ctx)).not.toContain(SENTINELA)
      expect(Sentry.captureMessage).toHaveBeenCalledWith('normalizadores: excecao', expect.objectContaining({ extra: { report: 't1', pg_code: null } }))
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })
  })

  describe('interruptor', () => {
    it('passo desligado: não lê a fila, não chama função, devolve desligado', async () => {
      process.env.YT_OWN_STEPS_OFF = 'dimensoes, Normalizadores'
      const db = banco([rel('t1')], [blob('t1', T_25)])
      const ctx = ctxDe(db)
      const resumo = await passoNormalizadores(ctx)
      expect(resumo.desligado).toBe(true)
      expect(db.leituras.yt_reporting_reports ?? 0).toBe(0)
      expect(aplicacoes(db)).toHaveLength(0)
      expect(ctx.tentativas).toHaveLength(0)
      expect(ctx.falhas).toEqual([])
      expect(relatorio(db, 't1').normalized_at).toBeNull()
    })

    it('sem a variável (apagada) o passo roda e não diz desligado; só outro passo na lista também não o desliga', async () => {
      delete process.env.YT_OWN_STEPS_OFF
      const db = banco([rel('t1')], [blob('t1', T_25)])
      const resumo = await passoNormalizadores(ctxDe(db))
      expect(resumo.desligado).toBeUndefined()
      expect(aplicacoes(db)).toHaveLength(1)

      process.env.YT_OWN_STEPS_OFF = 'dimensoes'
      const db2 = banco([rel('t1')], [blob('t1', T_25)])
      const r2 = await passoNormalizadores(ctxDe(db2))
      expect(r2.desligado).toBeUndefined()
      expect(aplicacoes(db2)).toHaveLength(1)
    })
  })

  it('contexto sem canais: nada é lido', async () => {
    const db = banco([rel('t1')], [blob('t1', T_25)])
    const resumo = await passoNormalizadores(ctxDe(db, 60_000, []))
    expect(resumo.pendentes).toBe(0)
    expect(db.leituras.yt_reporting_reports ?? 0).toBe(0)
  })
})
