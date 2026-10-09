// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { passoAlcance, MAX_NORMALIZAR } from '@/lib/youtube/coleta/alcance-step'
import { paraBytea } from '@/lib/youtube/reporting/client'
import { lerAlcanceBasico } from '@/lib/youtube/reporting/reach-csv'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import { comReachApply, fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-09T12:05:00.000Z')
const fixture = (nome: string) => readFileSync(join(__dirname, '../../fixtures/yt-reporting', nome), 'utf8')
const REAL = fixture('channel_reach_basic_a1.csv')
const VAZIO = fixture('channel_reach_basic_a1-vazio.csv')
const CABECALHO = 'date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr'
const IDS = lerAlcanceBasico(REAL).map(l => l.videoId)
const UC = 'UCRHtzTwaEpcjspAS2hbqmrA'
const CREATE = '2026-10-09T11:02:00.000Z'
const S1 = 'S1iMQVIOFL4'

const gz = (csv: string) => paraBytea(gzipSync(Buffer.from(csv)))
const canal = { id: 'ch-1', channel_id: UC, site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'ok' as const, video_count: 35 }
const videos = (ids: string[] = IDS): Row[] => ids.map(id => ({ id: `v-${id}`, youtube_video_id: id, channel_id: 'ch-1' }))
const rel = (id: string, extra: Row = {}): Row => ({
  site_id: 'site-1', report_id: id, job_id: 'job-1', channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', status: 'baixado',
  create_time: CREATE, normalized_at: null, unmatched_video_ids: null, error: null, ...extra,
})
const blob = (id: string, csv: string): Row => ({ report_id: id, site_id: 'site-1', csv_gz: gz(csv) })
const banco = (reports: Row[], blobs: Row[], extra: Record<string, Row[]> = {}): FakeDb =>
  comReachApply(fakeSupabase({ yt_reporting_reports: reports, yt_reporting_report_blobs: blobs, youtube_videos: videos(), ...extra }))
const ctxDe = (db: FakeDb, prazoMs = 60_000): StepCtx => ({
  supabase: db.client, channels: [{ ...canal }], deadline: Date.now() + prazoMs, falhas: [], tentativas: [],
})
const relatorio = (db: FakeDb, id: string) => db.tables.yt_reporting_reports!.find(r => r.report_id === id)!
const alcance = (db: FakeDb) => db.tables.yt_own_video_reach_daily ?? []
const aplicacoes = (db: FakeDb) => db.rpcCalls.filter(c => c.name === 'yt_own_reach_apply')
const csvDe = (linhas: Array<[string, number, number | null]>, canalId = UC) =>
  [CABECALHO, ...linhas.map(([v, imp, ctr]) => `20260925,${canalId},${v},${imp},${ctr ?? ''}`)].join('\n') + '\n'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('passoAlcance', () => {
  it('1. CSV real de 25/09: 11 linhas; o relatório vira normalizado e continua baixado', async () => {
    const db = banco([rel('r1')], [blob('r1', REAL)])
    const ctx = ctxDe(db)
    const resumo = await passoAlcance(ctx)
    expect(alcance(db)).toHaveLength(11)
    expect(alcance(db).find(r => r.youtube_video_id === S1)).toMatchObject({
      day_pt: '2026-09-25', thumbnail_impressions: 3, thumbnail_ctr: 0.3333333333333333, video_id: `v-${S1}`, channel_id: 'ch-1',
      site_id: 'site-1', source_report_id: 'r1', report_create_time: CREATE, metric_version: 'views_desde_2026-08-27',
    })
    expect(relatorio(db, 'r1')).toMatchObject({ normalized_at: AGORA.toISOString(), status: 'baixado', unmatched_video_ids: null })
    expect(resumo).toMatchObject({ gravados: 11, normalizados: 1, vazios: 0, erros: 0, sem_par: 0, pendentes: 0, tentativas: {} })
    expect(ctx.falhas).toEqual([])
  })

  it('2. relatório vazio: só o cabeçalho; marca normalizado sem chamar a função e continua vazio', async () => {
    const db = banco([rel('r1', { status: 'vazio' })], [blob('r1', VAZIO)])
    const resumo = await passoAlcance(ctxDe(db))
    expect(alcance(db)).toHaveLength(0)
    expect(aplicacoes(db)).toHaveLength(0)
    expect(relatorio(db, 'r1')).toMatchObject({ normalized_at: AGORA.toISOString(), status: 'vazio' })
    expect(resumo).toMatchObject({ vazios: 1, normalizados: 0, gravados: 0, erros: 0 })
  })

  it.each([
    ['baixado com cabeçalho inesperado', 'baixado', 'date,video_id,video_thumbnail_impressions\n20260925,abc,1\n', 'cabecalho_inesperado'],
    ['vazio com outro cabeçalho', 'vazio', 'date,video_id,outra_coisa\n', 'cabecalho_inesperado'],
    ['linha inválida', 'baixado', `${CABECALHO}\n2026-09-25,${UC},abc,1,0\n`, 'linha_invalida'],
  ])('3. %s: vira erro, sem normalized_at e sem linhas', async (_nome, status, csv, motivo) => {
    const db = banco([rel('r1', { status })], [blob('r1', csv)])
    const ctx = ctxDe(db)
    const resumo = await passoAlcance(ctx)
    expect(relatorio(db, 'r1')).toMatchObject({ status: 'erro', error: motivo, normalized_at: null })
    expect(alcance(db)).toHaveLength(0)
    expect(resumo).toMatchObject({ erros: 1, normalizados: 0, vazios: 0, pendentes: 0 })
    expect(ctx.falhas).toEqual([]) // quem avisa é o critério de relatório em erro
  })

  it('4. relatório mais antigo não sobrescreve o mais novo (aceite 9), mas é marcado normalizado', async () => {
    const db = banco([rel('r1')], [blob('r1', REAL)], {
      yt_own_video_reach_daily: [{
        youtube_video_id: S1, day_pt: '2026-09-25', site_id: 'site-1', video_id: `v-${S1}`, channel_id: 'ch-1',
        thumbnail_impressions: 99, thumbnail_ctr: 0.5, source_report_id: 'r-novo', report_create_time: '2026-10-09T12:00:00.000Z',
        metric_version: 'views_desde_2026-08-27', source: 'reporting_api',
      }],
    })
    const resumo = await passoAlcance(ctxDe(db))
    expect(alcance(db)).toHaveLength(11)
    expect(alcance(db).find(r => r.youtube_video_id === S1)).toMatchObject({ thumbnail_impressions: 99, source_report_id: 'r-novo' })
    expect(resumo.gravados).toBe(10)
    expect(relatorio(db, 'r1').normalized_at).toBe(AGORA.toISOString())
  })

  it('5. dois relatórios do mesmo dia, o mais novo por último: a linha fica com o mais novo', async () => {
    const db = banco(
      [rel('r-velho', { create_time: '2026-10-09T10:00:00.000Z' }), rel('r-novo', { create_time: '2026-10-09T11:00:00.000Z' })],
      [blob('r-velho', csvDe([[S1, 3, 0.5]])), blob('r-novo', csvDe([[S1, 8, 0.25]]))],
    )
    const resumo = await passoAlcance(ctxDe(db))
    expect(alcance(db)).toHaveLength(1)
    expect(alcance(db)[0]).toMatchObject({ thumbnail_impressions: 8, thumbnail_ctr: 0.25, source_report_id: 'r-novo' })
    expect(resumo).toMatchObject({ normalizados: 2, gravados: 2 })
  })

  it('6. vídeo sem par: grava com video_id nulo e lista no relatório', async () => {
    const db = banco([rel('r1')], [blob('r1', REAL)], { youtube_videos: videos(IDS.filter(i => i !== S1)) })
    const resumo = await passoAlcance(ctxDe(db))
    expect(alcance(db)).toHaveLength(11)
    expect(alcance(db).find(r => r.youtube_video_id === S1)).toMatchObject({ video_id: null })
    expect(relatorio(db, 'r1').unmatched_video_ids).toEqual({ count: 1, ids: [S1] })
    expect(resumo).toMatchObject({ sem_par: 1, normalizados: 1 })
  })

  it('7. channel_id do CSV diferente do canal do relatório: erro canal_inesperado, nada gravado', async () => {
    const db = banco([rel('r1')], [blob('r1', csvDe([[S1, 3, 0.5]], 'UCoutroCanal'))])
    const resumo = await passoAlcance(ctxDe(db))
    expect(relatorio(db, 'r1')).toMatchObject({ status: 'erro', error: 'canal_inesperado', normalized_at: null })
    expect(alcance(db)).toHaveLength(0)
    expect(resumo.erros).toBe(1)
  })

  it('8. bruto ausente e gzip corrompido viram erro', async () => {
    const db = banco([rel('r-sem'), rel('r-ruim')], [{ report_id: 'r-ruim', site_id: 'site-1', csv_gz: '\\x00ff' }])
    const resumo = await passoAlcance(ctxDe(db))
    expect(relatorio(db, 'r-sem')).toMatchObject({ status: 'erro', error: 'bruto_ausente', normalized_at: null })
    expect(relatorio(db, 'r-ruim')).toMatchObject({ status: 'erro', error: 'gzip_invalido', normalized_at: null })
    expect(resumo.erros).toBe(2)
  })

  it('9. prazo vencido: nada além da fila é lido ou gravado; pendentes = tamanho da fila', async () => {
    const db = banco([rel('r1'), rel('r2', { create_time: '2026-10-09T11:03:00.000Z' })], [blob('r1', REAL), blob('r2', REAL)])
    const resumo = await passoAlcance({ ...ctxDe(db), deadline: Date.now() })
    expect(resumo).toMatchObject({ pendentes: 2, gravados: 0, normalizados: 0 })
    expect(db.writes).toEqual([])
    expect(db.rpcCalls).toEqual([])
    expect(relatorio(db, 'r1').normalized_at).toBeNull()
    expect(relatorio(db, 'r2').normalized_at).toBeNull()
  })

  describe('10. sem a migration', () => {
    it('função ausente: anota schema_ausente, não marca o relatório e para o passo', async () => {
      const db = banco([rel('r1'), rel('r2', { create_time: '2026-10-09T11:03:00.000Z' })], [blob('r1', REAL), blob('r2', REAL)])
      db.errors['rpc:yt_own_reach_apply'] = { code: 'PGRST202', message: 'x' }
      const ctx = ctxDe(db)
      const resumo = await passoAlcance(ctx)
      expect(ctx.falhas).toContain('schema_ausente: yt_own_reach_apply')
      expect(relatorio(db, 'r1')).toMatchObject({ status: 'baixado', normalized_at: null, error: null })
      expect(relatorio(db, 'r2')).toMatchObject({ status: 'baixado', normalized_at: null })
      expect(aplicacoes(db)).toHaveLength(1)
      expect(resumo).toMatchObject({ normalizados: 0, erros: 0, gravados: 0, pendentes: 2 })
    })

    it('coluna ou tabela ausente na fila: resumo zerado', async () => {
      const db = banco([rel('r1')], [blob('r1', REAL)])
      db.errors.yt_reporting_reports = { code: '42703', message: 'x' }
      const ctx = ctxDe(db)
      const resumo = await passoAlcance(ctx)
      expect(ctx.falhas).toContain('schema_ausente: yt_reporting_reports')
      expect(resumo).toMatchObject({ gravados: 0, normalizados: 0, vazios: 0, erros: 0, sem_par: 0, pendentes: 0 })
    })
  })

  it('11. leitura de youtube_videos que falha: o relatório fica pendente, intacto', async () => {
    const db = banco([rel('r1')], [blob('r1', REAL)])
    db.errors.youtube_videos = { code: '57014', message: 'x' }
    const ctx = ctxDe(db)
    const resumo = await passoAlcance(ctx)
    expect(ctx.falhas).toContain('erro de banco ao ler youtube_videos')
    expect(relatorio(db, 'r1')).toMatchObject({ status: 'baixado', normalized_at: null })
    expect(resumo).toMatchObject({ pendentes: 1, normalizados: 0 })
    expect(alcance(db)).toHaveLength(0)
  })

  it('11b. 1000 vídeos lidos: leitura possivelmente truncada, relatório pendente', async () => {
    const muitos = Array.from({ length: 1000 }, (_, i) => `vid${String(i).padStart(8, '0')}`)
    const db = banco([rel('r1')], [blob('r1', REAL)], { youtube_videos: videos(muitos) })
    const ctx = ctxDe(db)
    const resumo = await passoAlcance(ctx)
    expect(ctx.falhas).toContain('alcance: vídeos do canal Canal Um lidos até o limite de 1000 — a leitura pode estar truncada')
    expect(resumo.pendentes).toBe(1)
    expect(relatorio(db, 'r1').normalized_at).toBeNull()
  })

  it('12. erro ao marcar o relatório: não conta como normalizado e a falha é anotada', async () => {
    const db = banco([rel('r1')], [blob('r1', REAL)])
    db.writeErrors.yt_reporting_reports = { code: '57014', message: 'x' }
    const ctx = ctxDe(db)
    const resumo = await passoAlcance(ctx)
    expect(ctx.falhas).toContain('erro de banco ao gravar yt_reporting_reports')
    expect(resumo).toMatchObject({ normalizados: 0, pendentes: 1 })
    expect(relatorio(db, 'r1').normalized_at).toBeNull()
  })

  it('13. re-normalização: normalized_at nulo de novo reaplica as mesmas 11 linhas', async () => {
    const db = banco([rel('r1')], [blob('r1', REAL)])
    const a = await passoAlcance(ctxDe(db))
    const antes = structuredClone(alcance(db).map(r => ({ ...r, collected_at: null })))
    relatorio(db, 'r1').normalized_at = null
    const b = await passoAlcance(ctxDe(db))
    expect(a.gravados).toBe(11)
    expect(b.gravados).toBe(11)
    expect(alcance(db)).toHaveLength(11)
    expect(alcance(db).map(r => ({ ...r, collected_at: null }))).toEqual(antes)
  })

  it('14. só normaliza o tipo básico, os não baixados e os já normalizados', async () => {
    const db = banco(
      [
        rel('r-comb', { report_type_id: 'channel_reach_combined_a1' }),
        rel('r-listado', { status: 'listado' }),
        rel('r-feito', { normalized_at: '2026-10-08T00:00:00.000Z' }),
      ],
      [blob('r-comb', REAL), blob('r-listado', REAL), blob('r-feito', REAL)],
    )
    const resumo = await passoAlcance(ctxDe(db))
    expect(resumo).toMatchObject({ gravados: 0, normalizados: 0, pendentes: 0 })
    expect(db.writes).toEqual([])
    expect(relatorio(db, 'r-comb').normalized_at).toBeNull()
  })

  it('15. a função do banco lançar não derruba os outros relatórios', async () => {
    const db = banco([rel('r1'), rel('r2', { create_time: '2026-10-09T11:03:00.000Z' })], [blob('r1', REAL), blob('r2', REAL)])
    vi.spyOn(db.client, 'rpc').mockImplementationOnce(() => { throw new Error('boom') })
    const ctx = ctxDe(db)
    const resumo = await passoAlcance(ctx)
    expect(relatorio(db, 'r1').normalized_at).toBeNull()
    expect(relatorio(db, 'r2').normalized_at).toBe(AGORA.toISOString())
    expect(ctx.falhas).toContain('erro de banco ao gravar yt_own_reach_apply')
    expect(resumo).toMatchObject({ normalizados: 1, pendentes: 1, gravados: 11 })
  })

  it('16. exceção fora da função do banco: vai ao Sentry, vira nota e o próximo relatório segue', async () => {
    const db = banco([rel('r1'), rel('r2', { create_time: '2026-10-09T11:03:00.000Z' })], [blob('r1', REAL), blob('r2', REAL)])
    const from = db.client.from.bind(db.client)
    let lancou = false
    vi.spyOn(db.client, 'from').mockImplementation((t: string) => {
      if (t === 'yt_reporting_report_blobs' && !lancou) { lancou = true; throw new Error('quebrou') }
      return from(t)
    })
    const ctx = ctxDe(db)
    const resumo = await passoAlcance(ctx)
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ tags: { cron: 'sync-analytics-metrics', passo: 'alcance' }, extra: { report: 'r1' } }))
    expect(ctx.falhas.some(n => n.startsWith('alcance: '))).toBe(true)
    expect(relatorio(db, 'r1').normalized_at).toBeNull()
    expect(relatorio(db, 'r2').normalized_at).toBe(AGORA.toISOString())
    expect(resumo).toMatchObject({ normalizados: 1, pendentes: 1 })
  })

  it('17. sem canais: resumo zerado e nenhuma leitura', async () => {
    const db = banco([rel('r1')], [blob('r1', REAL)])
    const resumo = await passoAlcance({ ...ctxDe(db), channels: [] })
    expect(resumo).toEqual({ gravados: 0, tentativas: {}, pendentes: 0, normalizados: 0, vazios: 0, erros: 0, sem_par: 0 })
    expect(db.writes).toEqual([])
  })

  it('18. mais de 200 na fila: processa 200 e soma 1 em pendentes', async () => {
    const reports = Array.from({ length: MAX_NORMALIZAR + 1 }, (_, i) => rel(`r${String(i).padStart(3, '0')}`, { status: 'vazio', create_time: new Date(Date.parse(CREATE) + i * 1000).toISOString() }))
    const db = banco(reports, reports.map(r => blob(r.report_id as string, VAZIO)))
    const resumo = await passoAlcance(ctxDe(db))
    expect(resumo).toMatchObject({ vazios: MAX_NORMALIZAR, pendentes: 1 })
    expect(relatorio(db, 'r200').normalized_at).toBeNull()
    expect(relatorio(db, 'r199').normalized_at).toBe(AGORA.toISOString())
  })

  it('19. CTR nulo no CSV não vira zero: a coluna fica nula', async () => {
    const db = banco([rel('r1')], [blob('r1', csvDe([[S1, 3, null]]))])
    await passoAlcance(ctxDe(db))
    expect(alcance(db)[0]).toMatchObject({ thumbnail_impressions: 3, thumbnail_ctr: null })
    expect(alcance(db)[0]!.thumbnail_ctr).not.toBe(0)
  })
})
