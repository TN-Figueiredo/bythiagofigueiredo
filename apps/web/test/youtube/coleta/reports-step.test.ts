// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { gunzipSync } from 'node:zlib'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@/lib/youtube/reporting/client', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/reporting/client')>()),
  criarReportingClient: vi.fn(),
}))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))

import { passoRelatorios, MAX_DOWNLOADS, MAX_GZ_BYTES } from '@/lib/youtube/coleta/reports-step'
import { ensureFreshToken, NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import { criarReportingClient, empacotarCsv, deBytea } from '@/lib/youtube/reporting/client'
import { ArquivoGrandeDemaisError, ReportingHttpError, SEM_NORMALIZADOR } from '@/lib/youtube/reporting/types'
import { SemTempoError, TETOS_MS } from '@/lib/youtube/coleta/clock'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import { criteriosRelatorios } from '@/lib/youtube/coleta/criteria'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-07T12:05:00.000Z')
const DIA_MS = 86_400_000
const ha = (dias: number) => new Date(AGORA.getTime() - dias * DIA_MS).toISOString()
const CSV = Buffer.from('date,video_id,video_thumbnail_impressions\n20261005,abc,100\n20261005,def,50\n')

// O banco em memória é estrito: rpc de função desconhecida dá PGRST202. A limpeza do bruto precisa de handler.
const bancoComPurge = (seed: Record<string, Row[]> = {}): FakeDb => {
  const db = fakeSupabase(seed)
  db.rpcHandlers.yt_reporting_blobs_purge = () => ({ data: 0, error: null })
  return db
}

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'ok' as const, video_count: 1 }
const api = { reportTypesList: vi.fn(), jobsList: vi.fn(), jobsCreate: vi.fn(), reportsList: vi.fn(), download: vi.fn() }
const jobRow = (tipo: string, extra: Row = {}): Row => ({
  site_id: 'site-1', channel_id: 'ch-1', report_type_id: tipo, job_id: `job-${tipo}`, status: 'ativo',
  job_create_time: ha(6), last_create_time: null, ...extra,
})
const doGoogle = (id: string, extra: Record<string, string> = {}) => ({
  id, jobId: 'job-channel_reach_basic_a1', startTime: ha(2), endTime: ha(1), createTime: ha(1),
  jobExpireTime: ha(-60), downloadUrl: `https://dl.test/${id}`, ...extra,
})
const listado = (id: string, extra: Row = {}): Row => ({
  site_id: 'site-1', report_id: id, job_id: 'job-channel_reach_basic_a1', channel_id: 'ch-1',
  report_type_id: 'channel_reach_basic_a1', start_time: ha(2), end_time: ha(1), create_time: ha(1),
  download_url: `https://dl.test/${id}`, is_backfill: false, status: 'listado', ...extra,
})
const ctxDe = (db: FakeDb, prazoMs = 60_000): StepCtx => ({
  // Cópia: o passo muda `collection_status` do canal em memória e isso não pode vazar para outro teste.
  supabase: db.client, channels: [{ ...canal }], deadline: Date.now() + prazoMs, falhas: [], tentativas: [],
})
const rel = (db: FakeDb, id: string) => db.tables.yt_reporting_reports?.find(r => r.report_id === id)
const comStatus = (db: FakeDb, status: string) => (db.tables.yt_reporting_reports ?? []).filter(r => r.status === status)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  for (const m of Object.values(api)) m.mockReset()
  vi.mocked(criarReportingClient).mockReturnValue(api)
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' } as never)
  api.reportsList.mockResolvedValue({ reports: [], nextPageToken: null })
  api.download.mockImplementation(async () => empacotarCsv(CSV))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('passoRelatorios: listar', () => {
  it('primeira vez: sem createdAfter; entra listado com download_url, job_expire_time e is_backfill; o job guarda o maior createTime', async () => {
    api.reportsList.mockResolvedValue({
      reports: [
        // Como texto, '…01.5Z' < '…01Z'; como instante é o maior. O job tem de guardar o maior instante.
        doGoogle('r-antigo', { startTime: ha(20), endTime: ha(19), createTime: '2026-10-06T10:00:01.5Z' }),
        doGoogle('r-novo', { startTime: ha(2), endTime: ha(1), createTime: '2026-10-06T10:00:01Z' }),
      ],
      nextPageToken: null,
    })
    api.download.mockRejectedValue(new ReportingHttpError(500, null))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(api.reportsList).toHaveBeenCalledWith('job-channel_reach_basic_a1', { createdAfter: undefined, pageToken: undefined })
    expect(rel(db, 'r-antigo')).toMatchObject({
      site_id: 'site-1', channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', job_id: 'job-channel_reach_basic_a1',
      status: 'listado', download_url: 'https://dl.test/r-antigo', job_expire_time: ha(-60), is_backfill: true,
    })
    expect(rel(db, 'r-novo')).toMatchObject({ is_backfill: false })
    const job = db.tables.yt_reporting_jobs![0]!
    expect(job.last_create_time).toBe('2026-10-06T10:00:01.5Z')
    expect(job.last_listed_at).toBe(AGORA.toISOString())
    expect(resumo.vistos).toBe(2)
    expect(ctx.falhas).toEqual([])
  })


  it('startTime ilegível num job com job_create_time: também prazo curto, nunca o longo', async () => {
    api.reportsList.mockResolvedValue({ reports: [doGoogle('r-lixo', { startTime: 'isto não é data', endTime: ha(1), createTime: ha(1) })], nextPageToken: null })
    api.download.mockRejectedValue(new ReportingHttpError(500, null))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r-lixo')).toMatchObject({ is_backfill: true })
  })

  it('job sem job_create_time: não dá para dizer o que é histórico, então vale o prazo curto (is_backfill true) e vence aos 30 dias', async () => {
    for (const apagar of ['nulo', 'chave ausente'] as const) {
      api.reportsList.mockReset()
      api.reportsList.mockResolvedValue({
        reports: [
          doGoogle('r-sem-marca', { startTime: ha(33), endTime: ha(32), createTime: ha(31) }),
          doGoogle('r-recente', { startTime: ha(2), endTime: ha(1), createTime: ha(1) }),
        ],
        nextPageToken: null,
      })
      api.download.mockRejectedValue(new ReportingHttpError(500, null))
      const job = jobRow('channel_reach_basic_a1', { job_create_time: null })
      if (apagar === 'chave ausente') delete job.job_create_time
      const db = bancoComPurge({ yt_reporting_jobs: [job] })
      const ctx = ctxDe(db)
      await passoRelatorios(ctx)
      expect(rel(db, 'r-sem-marca'), apagar).toMatchObject({ is_backfill: true, status: 'expirado_sem_baixar' })
      expect(rel(db, 'r-recente'), apagar).toMatchObject({ is_backfill: true, status: 'listado' })
    }
  })
  it('depois: createdAfter = last_create_time − 1 dia, e percorre nextPageToken', async () => {
    api.reportsList
      .mockResolvedValueOnce({ reports: [doGoogle('p1')], nextPageToken: 'tok2' })
      .mockResolvedValueOnce({ reports: [doGoogle('p2')], nextPageToken: null })
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1', { last_create_time: '2026-10-06T10:00:00.000Z' })] })
    await passoRelatorios(ctxDe(db))
    expect(api.reportsList).toHaveBeenNthCalledWith(1, 'job-channel_reach_basic_a1', { createdAfter: '2026-10-05T10:00:00.000Z', pageToken: undefined })
    expect(api.reportsList).toHaveBeenNthCalledWith(2, 'job-channel_reach_basic_a1', { createdAfter: '2026-10-05T10:00:00.000Z', pageToken: 'tok2' })
    expect(db.tables.yt_reporting_reports).toHaveLength(2)
  })

  it('relistar um relatório já baixado não muda a linha nem baixa de novo', async () => {
    api.reportsList.mockResolvedValue({ reports: [doGoogle('r1', { downloadUrl: 'https://dl.test/outra' })], nextPageToken: null })
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('r1', { status: 'baixado', row_count: 5, sha256: 'abc' })],
    })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'baixado', row_count: 5, sha256: 'abc', download_url: 'https://dl.test/r1' })
    expect(api.download).not.toHaveBeenCalled()
  })

  it('reports.list com 404: o job vira erro (o 1A recria), sem falha crítica na hora', async () => {
    api.reportsList.mockRejectedValue(new ReportingHttpError(404, 'notFound'))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(db.tables.yt_reporting_jobs![0]).toMatchObject({ status: 'erro', error: 'job_removido' })
    expect(db.tables.yt_own_collection_attempts!.find(r => r.scope_type === 'job')).toMatchObject({
      scope_id: 'ch-1:channel_reach_basic_a1', kind: 'relatorio', outcome: 'erro_http', http_status: 404,
    })
    expect(ctx.falhas).toEqual([])
  })

  it('reports.list com 403 accessNotConfigured: o job vira api_nao_ativada para o 1A voltar a sondar', async () => {
    api.reportsList.mockRejectedValue(new ReportingHttpError(403, 'accessNotConfigured'))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    await passoRelatorios(ctxDe(db))
    expect(db.tables.yt_reporting_jobs![0]).toMatchObject({ status: 'api_nao_ativada', job_id: 'job-channel_reach_basic_a1' })
  })

  it('canal sem job ativo: nenhuma chamada, nem de token', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1', { status: 'sem_acesso' })] })
    await passoRelatorios(ctxDe(db))
    expect(ensureFreshToken).not.toHaveBeenCalled()
  })

  it('token revogado: pula o canal com tentativa sem_autorizacao, sem falha', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube', 'conn-1'))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(db.tables.yt_own_collection_attempts).toEqual([expect.objectContaining({ scope_type: 'canal', kind: 'relatorio', outcome: 'sem_autorizacao' })])
    expect(api.reportsList).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual([])
  })
})

describe('passoRelatorios: autorização (L1b)', () => {
  it('token revogado: reautorizar, tentativa sem_autorizacao de escopo canal, nada listado', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube', 'c1'))
    const db = bancoComPurge({
      youtube_channels: [{ id: 'ch-1', collection_status: 'ok' }],
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(db.tables.yt_own_collection_attempts!.find(t => t.scope_type === 'canal')).toMatchObject({ outcome: 'sem_autorizacao', kind: 'relatorio' })
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'reautorizar' })
    expect(ctx.channels[0]!.collection_status).toBe('reautorizar')
    expect(resumo.vistos).toBe(0)
    expect(ctx.falhas).toEqual([])
  })

  it('sem conexão e sem conexão revogada: sem_conexao e o estado continua ok', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
    const db = bancoComPurge({
      youtube_channels: [{ id: 'ch-1', collection_status: 'ok' }],
      social_connections: [],
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
    })
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(db.tables.yt_own_collection_attempts!.find(t => t.scope_type === 'canal')).toMatchObject({ outcome: 'sem_conexao', kind: 'relatorio' })
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'ok' })
    expect(ctx.falhas).toEqual([])
  })
})

describe('passoRelatorios: baixar', () => {
  it('grava o bruto como \\x + hex de um gzip, e bytes, sha256, row_count e downloaded_at no relatório', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const resumo = await passoRelatorios(ctxDe(db))
    const pacote = empacotarCsv(CSV)
    expect(api.download).toHaveBeenCalledWith('https://dl.test/r1')
    const blob = db.tables.yt_reporting_report_blobs![0]!
    expect(blob).toMatchObject({ report_id: 'r1', site_id: 'site-1' })
    expect((blob.csv_gz as string).startsWith('\\x1f8b')).toBe(true)
    expect(gunzipSync(deBytea(blob.csv_gz as string)).equals(CSV)).toBe(true)
    expect(rel(db, 'r1')).toMatchObject({ status: 'baixado', row_count: 2, sha256: pacote.sha256, downloaded_at: AGORA.toISOString(), error: null })
    expect(rel(db, 'r1')!.bytes).toBe((deBytea(blob.csv_gz as string)).length)
    expect(resumo).toMatchObject({ baixados: 1, gravados: 1, pendentes: 0 })
  })

  it('fila de 250: baixa o teto (100) e deixa 150; no dia seguinte baixa mais 100 pelo download_url gravado', async () => {
    const todos = Array.from({ length: 250 }, (_, i) => listado(`r-${String(i).padStart(3, '0')}`, { create_time: new Date(AGORA.getTime() - (400 - i) * 60_000).toISOString() }))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: todos })
    const ctx = ctxDe(db)
    const um = await passoRelatorios(ctx)
    expect(MAX_DOWNLOADS).toBe(100)
    expect(um).toMatchObject({ baixados: 100, pendentes: 150 })
    expect(comStatus(db, 'baixado')).toHaveLength(100)
    expect(rel(db, 'r-000')!.status).toBe('baixado')
    expect(rel(db, 'r-100')!.status).toBe('listado')
    // O teto de downloads não é falta de orçamento: só o relógio é.
    expect(ctx.tentativas.some(t => t.outcome === 'nao_alcancado_orcamento')).toBe(false)
    const dois = await passoRelatorios(ctxDe(db))
    expect(dois).toMatchObject({ baixados: 100, pendentes: 50 })
    expect(api.download).toHaveBeenLastCalledWith('https://dl.test/r-199')
  })

  it('o teto de downloads cabe no teto de tempo do passo, pela medida de produção: mexer num exige refazer a conta', () => {
    const MS_POR_DOWNLOAD = 900   // pior medida: 36,0 s para listar 8 jobs e baixar 40 (execução de 11/10/2026)
    const MS_LISTAGEM = 20_000    // reserva para listar 26 jobs, 4 em paralelo
    expect(MAX_DOWNLOADS * MS_POR_DOWNLOAD + MS_LISTAGEM).toBeLessThanOrEqual(TETOS_MS.relatorios)
  })

  it('o teto de tamanho é 10 MB comprimido', () => {
    expect(MAX_GZ_BYTES).toBe(10 * 1024 * 1024)
  })

  it('ordem de drenagem: o que vence em até 7 dias, depois o alcance, depois o resto pelo vencimento; o tipo só desempata', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('trafego-corrente', { report_type_id: 'channel_traffic_source_a3', create_time: ha(20) }),               // vence em 40 dias
        listado('basic-historico', { report_type_id: 'channel_basic_a3', create_time: ha(10), is_backfill: true }),      // vence em 20 dias
        listado('alcance-novo', { create_time: ha(1) }),                                                                  // vence em 59 dias
        listado('basic-quase-vencendo', { report_type_id: 'channel_basic_a3', create_time: ha(24), is_backfill: true }), // vence em 6 dias
      ],
    })
    await passoRelatorios(ctxDe(db))
    expect(api.download.mock.calls.map(c => c[0])).toEqual([
      'https://dl.test/basic-quase-vencendo', 'https://dl.test/alcance-novo', 'https://dl.test/basic-historico', 'https://dl.test/trafego-corrente',
    ])
  })

  it('fila maior que o teto: o que vence primeiro entra, mesmo criado por último e de tipo de menor prioridade; fica para trás o que vence por último', async () => {
    const correntes = Array.from({ length: MAX_DOWNLOADS }, (_, i) =>
      listado(`corrente-${i}`, { report_type_id: 'channel_traffic_source_a3', create_time: new Date(AGORA.getTime() - 5 * DIA_MS + i * 1000).toISOString() }))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [...correntes, listado('historico', { report_type_id: 'channel_basic_a3', create_time: ha(2), is_backfill: true })],
    })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(api.download.mock.calls[0]![0]).toBe('https://dl.test/historico')
    expect(rel(db, 'historico')!.status).toBe('baixado')
    expect(comStatus(db, 'listado')).toHaveLength(1)
    expect(rel(db, `corrente-${MAX_DOWNLOADS - 1}`)!.status).toBe('listado')
    expect(resumo.pendentes).toBe(1)
  })

  it('URL que devolve 403 é renovada: reportsList sem createdAfter uma vez, update do download_url e novo download', async () => {
    api.reportsList.mockImplementation(async (_job: string, o?: { createdAfter?: string }) =>
      o?.createdAfter
        ? { reports: [], nextPageToken: null }
        : { reports: [doGoogle('r1', { downloadUrl: 'https://dl.test/r1-nova' })], nextPageToken: null })
    api.download.mockImplementation(async (url: string) => {
      if (url.endsWith('-nova')) return empacotarCsv(CSV)
      throw new ReportingHttpError(403, null)
    })
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1', { last_create_time: ha(1) })],
      yt_reporting_reports: [listado('r1', { create_time: ha(3) }), listado('r2', { create_time: ha(2) })],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(api.reportsList).toHaveBeenCalledTimes(2)
    expect(api.reportsList).toHaveBeenLastCalledWith('job-channel_reach_basic_a1', { createdAfter: undefined, pageToken: undefined })
    expect(api.download.mock.calls.map(c => c[0])).toEqual(['https://dl.test/r1', 'https://dl.test/r1-nova', 'https://dl.test/r2'])
    expect(rel(db, 'r1')).toMatchObject({ status: 'baixado', download_url: 'https://dl.test/r1-nova' })
    expect(rel(db, 'r2')).toMatchObject({ status: 'listado' })
    expect(resumo).toMatchObject({ baixados: 1, erros_download: 1, pendentes: 1 })
    expect(ctx.falhas).toEqual([])
  })

  it.each([404, 410])('download com %i: expirado_sem_baixar', async (status) => {
    api.download.mockRejectedValue(new ReportingHttpError(status, null))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'expirado_sem_baixar', error: `HTTP ${status}` })
    expect(resumo.expirados).toBe(1)
  })

  it('download com 500: continua listado para amanhã, com tentativa erro_http no job', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(500, null))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'r1')!.status).toBe('listado')
    expect(resumo).toMatchObject({ erros_download: 1, pendentes: 1 })
    expect(db.tables.yt_own_collection_attempts!.find(r => r.scope_type === 'job')).toMatchObject({ outcome: 'erro_http', http_status: 500 })
    expect(ctx.falhas).toEqual([])
  })

  it('relatório só com cabeçalho: vazio, com o bruto guardado', async () => {
    api.download.mockResolvedValue(empacotarCsv(Buffer.from('date,video_id\n')))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'vazio', row_count: 0 })
    expect(db.tables.yt_reporting_report_blobs).toHaveLength(1)
    expect(resumo).toMatchObject({ vazios: 1, baixados: 0 })
  })

  it('expira por idade: 60 dias, ou 30 se for backfill; o que ainda está no prazo é baixado', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('velho', { create_time: ha(61) }),
        listado('backfill-velho', { create_time: ha(31), is_backfill: true }),
        listado('backfill-ok', { create_time: ha(29), is_backfill: true }),
        listado('ok', { create_time: ha(59) }),
      ],
    })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(rel(db, 'velho')!.status).toBe('expirado_sem_baixar')
    expect(rel(db, 'backfill-velho')!.status).toBe('expirado_sem_baixar')
    expect(rel(db, 'backfill-ok')!.status).toBe('baixado')
    expect(rel(db, 'ok')!.status).toBe('baixado')
    expect(resumo.expirados).toBe(2)
  })
})

describe('passoRelatorios: limpeza, orçamento e schema', () => {
  it('chama a limpeza do bruto com os tipos sem normalizador', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    db.rpcHandlers.yt_reporting_blobs_purge = () => ({ data: 3, error: null })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(db.rpcCalls.find(c => c.name === 'yt_reporting_blobs_purge')!.args).toEqual({ p_sem_normalizador: SEM_NORMALIZADOR })
    expect(resumo.bruto_apagado).toBe(3)
  })

  it('passo que recebe 0 s: nao_alcancado_orcamento por canal, pendentes > 0, nenhuma chamada', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const resumo = await passoRelatorios(ctxDe(db, -1))
    expect(resumo.pendentes).toBeGreaterThan(0)
    expect(resumo.tentativas).toEqual({ nao_alcancado_orcamento: 1 })
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(api.download).not.toHaveBeenCalled()
  })

  it('o relógio acaba no meio dos downloads: para, registra nao_alcancado_orcamento e o resto fica listado', async () => {
    api.download.mockImplementation(async () => {
      vi.setSystemTime(new Date(Date.now() + 61_000))
      return empacotarCsv(CSV)
    })
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('r1', { create_time: ha(3) }), listado('r2', { create_time: ha(2) }), listado('r3', { create_time: ha(1) })],
    })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(api.download).toHaveBeenCalledTimes(1)
    expect(resumo).toMatchObject({ baixados: 1, pendentes: 2 })
    expect(db.tables.yt_own_collection_attempts!.find(r => r.scope_type === 'canal')).toMatchObject({ kind: 'relatorio', outcome: 'nao_alcancado_orcamento' })
  })

  it('tabela de relatórios ausente em produção: schema_ausente em falhas, sem lançar e sem baixar', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    db.errors.yt_reporting_reports = { code: '42P01', message: 'relation "yt_reporting_reports" does not exist' }
    api.reportsList.mockResolvedValue({ reports: [doGoogle('r1')], nextPageToken: null })
    const ctx = ctxDe(db)
    await expect(passoRelatorios(ctx)).resolves.toBeDefined()
    expect(ctx.falhas).toEqual(['schema_ausente: yt_reporting_reports'])
    expect(api.download).not.toHaveBeenCalled()
  })

  it('tabela de jobs ausente: schema_ausente e o passo para', async () => {
    const db = bancoComPurge()
    db.errors.yt_reporting_jobs = { code: 'PGRST205', message: 'Could not find the table' }
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(ctx.falhas).toEqual(['schema_ausente: yt_reporting_jobs'])
    expect(db.rpcCalls.some(c => c.name === 'yt_reporting_blobs_purge')).toBe(false)
  })
})

describe('passoRelatorios: limpeza ausente', () => {
  it('função de limpeza não aplicada no banco: schema_ausente em falhas, sem lançar', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    const ctx = ctxDe(db)
    await expect(passoRelatorios(ctx)).resolves.toBeDefined()
    expect(ctx.falhas).toEqual(['schema_ausente: yt_reporting_blobs_purge'])
  })
})

describe('passoRelatorios: rodadas de revisão (decisões do controlador)', () => {
  it('URL recusada pelo cliente (url_inesperada): o relatório vira erro, sem nova tentativa e sem renovar', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(0, 'url_inesperada'))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1', { download_url: 'http://evil.test/x' })] })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'erro', error: 'url_inesperada' })
    expect(api.download).toHaveBeenCalledTimes(1)
    expect(api.reportsList).toHaveBeenCalledTimes(1) // só a listagem normal, nenhuma renovação
    expect(resumo).toMatchObject({ erros_download: 1, pendentes: 0 })
    expect(db.tables.yt_reporting_report_blobs ?? []).toEqual([])
  })

  it('bytes que não abrem como gzip (um download cortado chega assim): continua listado para amanhã, com tentativa erro_http "gzip_invalido"; o passo segue', async () => {
    api.download.mockImplementation(async (url: string) =>
      url.endsWith('/r1') ? empacotarCsv(Buffer.from([0x1f, 0x8b, 1, 2, 3, 4])) : empacotarCsv(CSV))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('r1', { create_time: ha(3) }), listado('r2', { create_time: ha(2) })],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'r1')!.status).toBe('listado')
    expect(rel(db, 'r1')!.error ?? null).toBeNull()
    expect(rel(db, 'r2')!.status).toBe('baixado')
    expect(resumo).toMatchObject({ baixados: 1, erros_download: 1, pendentes: 1 })
    expect(db.tables.yt_own_collection_attempts!.find(r => r.scope_type === 'job')).toMatchObject({ outcome: 'erro_http', error: 'gzip_invalido' })
    expect(ctx.falhas).toEqual([])
  })

  it('o prazo acaba DENTRO do download (SemTempoError): o relatório continua listado, sem erro_http, com nao_alcancado_orcamento', async () => {
    api.download.mockRejectedValue(new SemTempoError())
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1'), listado('r2', { create_time: ha(0.5) })] })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(api.download).toHaveBeenCalledTimes(1)
    expect(comStatus(db, 'listado')).toHaveLength(2)
    expect(rel(db, 'r1')!.error ?? null).toBeNull()
    expect(ctx.tentativas.some(t => t.outcome === 'erro_http')).toBe(false)
    expect(db.tables.yt_own_collection_attempts!.find(r => r.scope_type === 'canal')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(resumo).toMatchObject({ erros_download: 0, pendentes: 2 })
    expect(ctx.falhas).toEqual([])
  })

  it('o prazo acaba DENTRO da listagem (SemTempoError): job intacto, nao_alcancado_orcamento, nada de erro', async () => {
    api.reportsList.mockRejectedValue(new SemTempoError())
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(db.tables.yt_reporting_jobs![0]).toMatchObject({ status: 'ativo' })
    expect(db.tables.yt_reporting_jobs![0]!.error ?? null).toBeNull()
    expect(ctx.tentativas.map(t => t.outcome)).toEqual(['nao_alcancado_orcamento'])
    expect(resumo.pendentes).toBeGreaterThan(0)
    expect(ctx.falhas).toEqual([])
  })

  it('o prazo acaba na renovação da URL: relatório continua listado, sem erro', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(403, null))
    api.reportsList.mockImplementation(async (_j: string, o?: { createdAfter?: string }) => {
      if (o?.createdAfter) return { reports: [], nextPageToken: null }
      throw new SemTempoError()
    })
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1', { last_create_time: ha(1) })], yt_reporting_reports: [listado('r1')] })
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(rel(db, 'r1')!.status).toBe('listado')
    expect(ctx.tentativas.some(t => t.outcome === 'erro_http')).toBe(false)
    expect(ctx.tentativas.some(t => t.outcome === 'nao_alcancado_orcamento')).toBe(true)
  })
})

describe('passoRelatorios: fix round 1', () => {
  const GURL = (id: string) => `https://youtubereporting.googleapis.com/dl/${id}`

  const usarClienteReal = async () => {
    const real = await vi.importActual<typeof import('@/lib/youtube/reporting/client')>('@/lib/youtube/reporting/client')
    vi.mocked(criarReportingClient).mockImplementation(real.criarReportingClient)
  }
  const fetchQueEstouraOPrazo = () => {
    const f = vi.fn(async () => {
      vi.setSystemTime(new Date(Date.now() + 61_000))
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
    vi.stubGlobal('fetch', f)
    return f
  }
  afterEach(() => { vi.unstubAllGlobals() })

  it('fetchComPrazo real: o prazo acaba com o download no ar; o relatório continua listado, sem erro_http', async () => {
    await usarClienteReal()
    const f = fetchQueEstouraOPrazo()
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('r1', { download_url: GURL('r1') }), listado('r2', { download_url: GURL('r2'), create_time: ha(0.5) })],
    })
    const ctx = ctxDe(db)
    // a listagem real também passa pelo fetch: devolve vazio na primeira chamada (listagem), estoura na seguinte
    f.mockImplementationOnce(async () => new Response(JSON.stringify({ reports: [] }), { status: 200 }))
    const resumo = await passoRelatorios(ctx)
    expect(f).toHaveBeenCalledTimes(2)
    expect(comStatus(db, 'listado')).toHaveLength(2)
    expect(ctx.tentativas.some(t => t.outcome === 'erro_http')).toBe(false)
    expect(db.tables.yt_own_collection_attempts!.find(r => r.scope_type === 'canal')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(resumo).toMatchObject({ erros_download: 0, pendentes: 2 })
    expect(ctx.falhas).toEqual([])
  })

  it('fetchComPrazo real: o prazo acaba com a listagem no ar; job intacto e nao_alcancado_orcamento', async () => {
    await usarClienteReal()
    fetchQueEstouraOPrazo()
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(db.tables.yt_reporting_jobs![0]).toMatchObject({ status: 'ativo' })
    expect(ctx.tentativas.map(t => t.outcome)).toEqual(['nao_alcancado_orcamento'])
    expect(ctx.falhas).toEqual([])
  })

  it('renovação de URL: só os listado do job recebem URL nova; baixado de outro relatório nunca é tocado', async () => {
    api.reportsList.mockImplementation(async (_j: string, o?: { createdAfter?: string }) =>
      o?.createdAfter
        ? { reports: [], nextPageToken: null }
        : { reports: [doGoogle('r1', { downloadUrl: 'https://dl.test/r1-nova' }), doGoogle('velho', { downloadUrl: 'https://dl.test/mudou' })], nextPageToken: null })
    api.download.mockImplementation(async (url: string) => {
      if (url.endsWith('-nova')) return empacotarCsv(CSV)
      throw new ReportingHttpError(403, null)
    })
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1', { last_create_time: ha(1) })],
      yt_reporting_reports: [listado('r1'), listado('velho', { status: 'baixado' })],
    })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'baixado', download_url: 'https://dl.test/r1-nova' })
    expect(rel(db, 'velho')).toMatchObject({ status: 'baixado', download_url: 'https://dl.test/velho' })
  })

  it('paginação no teto: falha nomeando o job, relatórios vistos entram, last_create_time não avança', async () => {
    let n = 0
    api.reportsList.mockImplementation(async () => ({ reports: [doGoogle(`p-${n++}`, { createTime: ha(0.1) })], nextPageToken: 'mais' }))
    const marca = '2026-10-05T10:00:00.000Z'
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1', { last_create_time: marca })] })
    api.download.mockRejectedValue(new ReportingHttpError(500, null))
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(api.reportsList).toHaveBeenCalledTimes(50)
    expect(ctx.falhas.some(f => f.includes('listagem truncada') && f.includes('channel_reach_basic_a1'))).toBe(true)
    expect(db.tables.yt_reporting_jobs![0]!.last_create_time).toBe(marca)
    expect(db.tables.yt_reporting_reports).toHaveLength(50)
  })

  it('ordem bruto -> baixado (a): a escrita do bruto falha; o relatório fica listado, com falha, nada baixado', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    db.writeErrors.yt_reporting_report_blobs = { code: '08006', message: 'conexão caiu' }
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'r1')!.status).toBe('listado')
    expect(comStatus(db, 'baixado')).toHaveLength(0)
    expect(ctx.falhas).toContain('erro de banco ao gravar yt_reporting_report_blobs')
    expect(resumo).toMatchObject({ baixados: 0, pendentes: 1 })
  })

  it('ordem bruto -> baixado (b): o bruto grava e o update do relatório falha; listado hoje, baixado amanhã com um só bruto', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    db.writeErrors.yt_reporting_reports = { code: '08006', message: 'conexão caiu' }
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(rel(db, 'r1')!.status).toBe('listado')
    expect(db.tables.yt_reporting_report_blobs).toHaveLength(1)
    expect(ctx.falhas).toContain('erro de banco ao gravar yt_reporting_reports')
    db.writeErrors.yt_reporting_reports = undefined
    const dois = await passoRelatorios(ctxDe(db))
    expect(dois).toMatchObject({ baixados: 1, pendentes: 0 })
    expect(rel(db, 'r1')!.status).toBe('baixado')
    expect(db.tables.yt_reporting_report_blobs).toHaveLength(1)
  })
})

describe('passoRelatorios: tipo fora da lista habilitada (REPORT_TYPES_ENABLED)', () => {
  const FORA = 'channel_demographics_a1'

  it('job ativo de tipo fora da lista não é listado nem baixado; os listado dele ficam como estão e não contam em pendentes', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow(FORA), jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('fora-1', { report_type_id: FORA, job_id: `job-${FORA}` }),
        listado('fora-2', { report_type_id: FORA, job_id: `job-${FORA}` }),
        listado('dentro-1'),
      ],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(api.reportsList.mock.calls.map(c => c[0])).toEqual(['job-channel_reach_basic_a1'])
    expect(api.download.mock.calls.map(c => c[0])).toEqual(['https://dl.test/dentro-1'])
    expect(rel(db, 'dentro-1')).toMatchObject({ status: 'baixado' })
    expect(rel(db, 'fora-1')).toMatchObject({ status: 'listado', download_url: 'https://dl.test/fora-1' })
    expect(rel(db, 'fora-2')).toMatchObject({ status: 'listado' })
    expect(db.tables.yt_reporting_report_blobs).toHaveLength(1)
    expect(resumo).toMatchObject({ baixados: 1, pendentes: 0 })
    expect(db.tables.yt_own_collection_attempts!.some(r => String(r.scope_id).includes(FORA))).toBe(false)
    expect(ctx.falhas).toEqual([])
  })

  it('canal que só tem job ativo de tipo fora da lista: nenhuma chamada, nem de token', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow(FORA)], yt_reporting_reports: [listado('fora-1', { report_type_id: FORA, job_id: `job-${FORA}` })] })
    await passoRelatorios(ctxDe(db))
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(api.reportsList).not.toHaveBeenCalled()
    expect(api.download).not.toHaveBeenCalled()
    expect(rel(db, 'fora-1')).toMatchObject({ status: 'listado' })
  })
})

describe('passoRelatorios: E12, perda nunca fica em verde', () => {
  it('perda que NENHUM critério persistente cobre (404 em corrente criado há 20 dias) vira a nota da execução; o resumo conta todas as vencidas', async () => {
    api.download.mockImplementation(async (url: string) => {
      if (url.endsWith('/sumiu')) throw new ReportingHttpError(404, null)
      return empacotarCsv(CSV)
    })
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('velho', { report_type_id: 'channel_traffic_source_a3', create_time: ha(31), is_backfill: true }), // por idade: o critério persistente é o dono
        listado('sumiu', { report_type_id: 'channel_traffic_source_a3', create_time: ha(20) }),                      // 404: nem por relatório (>14 d) nem agregado (vence daqui a 40)
        listado('alcance-velho', { create_time: ha(61) }),                                                            // por idade: critério persistente
      ],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(resumo.expirados).toBe(3)
    expect(resumo.expirados_por_tipo).toEqual({ channel_traffic_source_a3: 2, channel_reach_basic_a1: 1 })
    expect(ctx.falhas).toEqual(['relatórios: 1 relatório(s) venceram sem baixar nesta execução (channel_traffic_source_a3: 1)'])
  })

  it('o passo não anota o que os critérios persistentes já cobrem: vencido por idade, ou 404 em relatório criado há menos de 14 dias', async () => {
    api.download.mockImplementation(async (url: string) => {
      if (url.endsWith('/sumiu')) throw new ReportingHttpError(404, null)
      return empacotarCsv(CSV)
    })
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('velho', { report_type_id: 'channel_traffic_source_a3', create_time: ha(31), is_backfill: true }),
        listado('sumiu', { report_type_id: 'channel_traffic_source_a3', create_time: ha(3) }),
      ],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(resumo.expirados_por_tipo).toEqual({ channel_traffic_source_a3: 2 })
    expect(ctx.falhas).toEqual([])
  })

  it('vencido de tipo fora da lista habilitada não vira nota (ninguém ia baixá-lo); nada vencido = nenhuma nota', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('fora', { report_type_id: 'channel_annotations_a1', create_time: ha(61) }), listado('ok', { create_time: ha(1) })],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'fora')!.status).toBe('expirado_sem_baixar')
    expect(resumo.expirados_por_tipo).toEqual({})
    expect(ctx.falhas).toEqual([])
  })

  it('acima do teto: erro grande_demais, sem bruto, e a execução diz que o bruto não foi guardado', async () => {
    api.download.mockResolvedValue({ gz: Buffer.alloc(MAX_GZ_BYTES + 1), sha256: 'x', rowCount: 10 })
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'r1')).toMatchObject({ status: 'erro', error: 'grande_demais' })
    expect(db.tables.yt_reporting_report_blobs ?? []).toEqual([])
    expect(resumo.maior_bytes).toBe(MAX_GZ_BYTES + 1)
    expect(ctx.falhas).toEqual([
      `relatórios: channel_reach_basic_a1 recusado por tamanho (${MAX_GZ_BYTES + 1} bytes comprimidos; teto ${MAX_GZ_BYTES}): o bruto NÃO foi guardado`,
    ])
  })

  it('o cliente recusa por Content-Length/leitura (comprimido): vira grande_demais terminal com o tamanho na nota, não erro de rede', async () => {
    api.download.mockRejectedValue(new ArquivoGrandeDemaisError('comprimido', MAX_GZ_BYTES + 5, `${MAX_GZ_BYTES + 5} bytes comprimidos (Content-Length); teto ${MAX_GZ_BYTES}`))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'r1')).toMatchObject({ status: 'erro', error: 'grande_demais', bytes: MAX_GZ_BYTES + 5 })
    expect(rel(db, 'r1')!.sha256 ?? null).toBeNull() // o corpo não foi lido: sem hash nem contagem inventados
    expect(rel(db, 'r1')!.row_count ?? null).toBeNull()
    expect(db.tables.yt_reporting_report_blobs ?? []).toEqual([])
    expect(resumo).toMatchObject({ erros_download: 1, maior_bytes: MAX_GZ_BYTES + 5, pendentes: 0 })
    expect(ctx.falhas).toEqual([
      `relatórios: channel_reach_basic_a1 recusado por tamanho (${MAX_GZ_BYTES + 5} bytes comprimidos (Content-Length); teto ${MAX_GZ_BYTES}): o bruto NÃO foi guardado`,
    ])
    // Nunca é "erro de rede": nenhuma tentativa erro_http (que contaria para o aviso de 3 dias e tentaria de novo).
    expect((db.tables.yt_own_collection_attempts ?? []).filter(t => t.scope_type === 'job' && t.outcome === 'erro_http')).toEqual([])
  })

  it('gzip pequeno que descomprime acima do teto (bomba): grande_demais terminal com o tamanho comprimido; no dia seguinte não é baixado de novo', async () => {
    api.download.mockRejectedValue(new ArquivoGrandeDemaisError('descomprimido', 812, '812 bytes comprimidos descomprimem a mais de 67108864 bytes; teto 67108864 descomprimido'))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(rel(db, 'r1')).toMatchObject({ status: 'erro', error: 'grande_demais', bytes: 812 })
    expect(ctx.falhas).toEqual([
      'relatórios: channel_reach_basic_a1 recusado por tamanho (812 bytes comprimidos descomprimem a mais de 67108864 bytes; teto 67108864 descomprimido): o bruto NÃO foi guardado',
    ])
    expect(api.download).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date(AGORA.getTime() + DIA_MS))
    await passoRelatorios(ctxDe(db))
    expect(api.download).toHaveBeenCalledTimes(1) // `erro` não volta para a fila
  })

  it('corpo vazio da API (corpo_vazio) NÃO vira relatório "vazio": continua listado, com tentativa erro_http', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(200, 'corpo_vazio'))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')!.status).toBe('listado')
    expect(resumo).toMatchObject({ erros_download: 1, vazios: 0, baixados: 0, pendentes: 1 })
    expect(db.tables.yt_own_collection_attempts!.find(t => t.scope_type === 'job')).toMatchObject({ outcome: 'erro_http' })
  })

  it('abort DURANTE a leitura do corpo, com o prazo do passo esgotado: sem_tempo (listado, nao_alcancado_orcamento), nunca erro de download', async () => {
    api.download.mockImplementation(async () => {
      vi.setSystemTime(new Date(Date.now() + 120_000)) // o prazo acaba com o corpo a meio caminho
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1'), listado('r2', { create_time: ha(0.5) })] })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(comStatus(db, 'listado').map(r => r.report_id).sort()).toEqual(['r1', 'r2'])
    expect(resumo.erros_download).toBe(0)
    expect(api.download).toHaveBeenCalledTimes(1) // o passo para
    const t = db.tables.yt_own_collection_attempts ?? []
    expect(t.find(x => x.scope_type === 'canal' && x.outcome === 'nao_alcancado_orcamento')).toBeTruthy()
    expect(t.filter(x => x.outcome === 'erro_http')).toEqual([])
  })

  it('abort por tempo da CHAMADA (15 s) com prazo do passo sobrando continua sendo erro de download passageiro', async () => {
    api.download.mockRejectedValue(new DOMException('timeout', 'TimeoutError'))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')!.status).toBe('listado')
    expect(resumo.erros_download).toBe(1)
  })

  it('mais da metade do teto: o bruto é guardado e a execução avisa antes de perder; exatamente a metade não avisa', async () => {
    const metade = MAX_GZ_BYTES / 2
    api.download
      .mockResolvedValueOnce({ gz: Buffer.alloc(metade + 1), sha256: 'x', rowCount: 10 })
      .mockResolvedValueOnce({ gz: Buffer.alloc(metade), sha256: 'y', rowCount: 10 })
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('grande', { create_time: ha(3) }), listado('no-limite', { create_time: ha(2) })],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'grande')!.status).toBe('baixado')
    expect(rel(db, 'no-limite')!.status).toBe('baixado')
    expect(db.tables.yt_reporting_report_blobs).toHaveLength(2)
    expect(resumo.maior_bytes).toBe(metade + 1)
    expect(ctx.falhas).toEqual([`relatórios: channel_reach_basic_a1 chegou a ${metade + 1} bytes comprimidos, mais da metade do teto de ${MAX_GZ_BYTES}`])
  })

  it('nenhum download: maior_bytes é 0 e nada ficou para trás (vence_primeiro_em_dias nulo)', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(resumo).toMatchObject({ maior_bytes: 0, pendentes: 0, vence_primeiro_em_dias: null, expirados_por_tipo: {} })
  })

  it('o que ficou para trás aparece com prazo: pendentes e os dias até o primeiro vencer', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(500, null))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('corrente', { create_time: ha(1) }),                                                              // vence em 59 dias
        listado('historico', { report_type_id: 'channel_basic_a3', create_time: ha(10), is_backfill: true }),      // vence em 20 dias
      ],
    })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(resumo).toMatchObject({ pendentes: 2, vence_primeiro_em_dias: 20 })
  })

  describe('fila longa: lida inteira, em páginas de 1000 (o PostgREST nunca devolve mais que isso por resposta)', () => {
    const NOTA_CORTE = /^relatórios: fila de download cortada em \d+ relatórios/
    const pendentesDe = (n: number, extra: (i: number) => Row = () => ({})): Row[] =>
      Array.from({ length: n }, (_, i) => listado(`r-${String(i).padStart(5, '0')}`, {
        report_type_id: 'channel_traffic_source_a3', create_time: new Date(AGORA.getTime() - 40 * DIA_MS + i * 1000).toISOString(), ...extra(i),
      }))
    const banco = (linhas: Row[]) => bancoComPurge({ yt_reporting_jobs: [jobRow('channel_traffic_source_a3')], yt_reporting_reports: linhas })

    it('mais de 1000 pendentes: um histórico (30 dias) criado DEPOIS de 1200 correntes (60 dias) que vence antes é baixado primeiro, não cortado', async () => {
      // 1200 correntes criados há 40 dias vencem em ~20 dias; o histórico criado há 20 dias vence em 10. Por create_time ele é o 1201º.
      const historico = listado('historico-recente', { report_type_id: 'channel_basic_a3', is_backfill: true, create_time: ha(20) })
      const db = banco([...pendentesDe(1200), historico])
      const ctx = ctxDe(db)
      const resumo = await passoRelatorios(ctx)
      expect(rel(db, 'historico-recente')!.status).toBe('baixado')
      expect(api.download.mock.calls[0]![0]).toBe('https://dl.test/historico-recente')
      expect(ctx.falhas.filter(f => NOTA_CORTE.test(f))).toEqual([])
      expect(resumo).toMatchObject({ baixados: 100, pendentes: 1101 })
      // O primeiro a vencer entre os que sobraram é o dos correntes (20 dias).
      expect(resumo.vence_primeiro_em_dias).toBe(20)
    })

    it.each([999, 1000, 1001])('%i pendentes: lidos inteiros, sem nota de corte; a conta de pendentes bate', async (n) => {
      const db = banco(pendentesDe(n))
      const ctx = ctxDe(db)
      const resumo = await passoRelatorios(ctx)
      expect(ctx.falhas.filter(f => NOTA_CORTE.test(f))).toEqual([])
      expect(resumo).toMatchObject({ baixados: 100, pendentes: n - 100 })
      expect(comStatus(db, 'listado')).toHaveLength(n - 100)
    })

    it('5000 pendentes (o limite de leitura) ainda não é corte; 5001 é, e a nota diz quantos ficaram de fora', async () => {
      const cheia = banco(pendentesDe(5000))
      const c1 = ctxDe(cheia)
      await passoRelatorios(c1)
      expect(c1.falhas.filter(f => NOTA_CORTE.test(f))).toEqual([])

      const db = banco(pendentesDe(5100))
      const c2 = ctxDe(db)
      const resumo = await passoRelatorios(c2)
      expect(c2.falhas).toContain('relatórios: fila de download cortada em 5000 relatórios (ficaram de fora 100); a ordem por vencimento não cobre o que ficou de fora')
      // O corte é só da leitura: os 100 baixados são os que vencem primeiro entre os 5000 lidos, e a contagem é a real.
      expect(resumo).toMatchObject({ baixados: 100, pendentes: 5000 })
    })

    it('contagem (count) ausente não vira zero: vale o número de linhas lidas', async () => {
      api.download.mockRejectedValue(new ReportingHttpError(500, null))
      const db = banco(pendentesDe(3))
      db.semContagem.yt_reporting_reports = true
      const ctx = ctxDe(db)
      const resumo = await passoRelatorios(ctx)
      expect(resumo).toMatchObject({ erros_download: 3, pendentes: 3 })
      expect(resumo.vence_primeiro_em_dias).toBe(20)
      expect(ctx.falhas).toEqual([])
    })

    it('contagem ausente com a leitura no limite: nota de corte sem inventar número, nunca "tudo lido"', async () => {
      const db = banco(pendentesDe(5000))
      db.semContagem.yt_reporting_reports = true
      const ctx = ctxDe(db)
      await passoRelatorios(ctx)
      expect(ctx.falhas).toContain('relatórios: fila de download cortada em 5000 relatórios (contagem indisponível: pode haver mais); a ordem por vencimento não cobre o que ficou de fora')
    })

    it('a leitura que conta os pendentes (passo 5) falha: nota vermelha e vence_primeiro_em_dias null, nunca "fila vazia"', async () => {
      // Calibra: quantos selects a tabela recebe numa execução normal; o último é o do passo 5.
      const calibra = banco(pendentesDe(2))
      await passoRelatorios(ctxDe(calibra))
      const ultima = calibra.leituras.yt_reporting_reports!
      expect(ultima).toBeGreaterThanOrEqual(2)

      const db = banco(pendentesDe(2))
      db.erroNaLeitura = (tabela, n) => (tabela === 'yt_reporting_reports' && n === ultima ? { code: '57014', message: 'timeout' } : undefined)
      const ctx = ctxDe(db)
      const resumo = await passoRelatorios(ctx)
      expect(comStatus(db, 'baixado')).toHaveLength(2) // o passo 3 leu e baixou
      expect(ctx.falhas).toContain('erro de banco ao ler yt_reporting_reports')
      expect(resumo.vence_primeiro_em_dias).toBeNull()
    })

    it('a leitura da fila (passo 3) falha: nota vermelha, nenhum download', async () => {
      const db = banco(pendentesDe(2))
      db.erroNaLeitura = (tabela) => (tabela === 'yt_reporting_reports' ? { code: '57014', message: 'timeout' } : undefined)
      const ctx = ctxDe(db)
      await passoRelatorios(ctx)
      expect(api.download).not.toHaveBeenCalled()
      expect(ctx.falhas).toContain('erro de banco ao ler yt_reporting_reports')
    })
  })

  it('mede a listagem e os downloads em separado (item de aceite 97)', async () => {
    api.reportsList.mockImplementation(async () => {
      vi.setSystemTime(new Date(Date.now() + 700))
      return { reports: [], nextPageToken: null }
    })
    api.download.mockImplementation(async () => {
      vi.setSystemTime(new Date(Date.now() + 1500))
      return empacotarCsv(CSV)
    })
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('r1', { create_time: ha(3) }), listado('r2', { create_time: ha(2) })],
    })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(resumo.ms_listar).toBe(700)
    expect(resumo.ms_baixar).toBe(3000)
  })
})

describe('uma perda, uma nota por execução (passo + critérios juntos, como no cron)', () => {
  const NOTAS_DE_PERDA = /venceram sem baixar|expirado sem baixar/
  const rodar = async (db: FakeDb): Promise<string[]> => {
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    await criteriosRelatorios(ctx)
    return ctx.falhas.filter(f => NOTAS_DE_PERDA.test(f))
  }

  it('vence por idade: no dia do vencimento sai exatamente UMA nota (a persistente, com a contagem) e no dia seguinte também', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('h', { report_type_id: 'channel_traffic_source_a3', create_time: ha(31), is_backfill: true }),
        listado('c', { report_type_id: 'channel_basic_a3', create_time: ha(61) }),
      ],
    })
    const dia0 = await rodar(db)
    expect(comStatus(db, 'expirado_sem_baixar')).toHaveLength(2)
    expect(dia0).toEqual(['relatórios: 2 relatório(s) venceram sem baixar nos últimos 14 dias (channel_basic_a3: 1; channel_traffic_source_a3: 1)'])
    vi.setSystemTime(new Date(AGORA.getTime() + DIA_MS))
    expect(await rodar(db)).toEqual(dia0)
  })

  it('404 em relatório criado há 3 dias: UMA nota no dia (a por relatório), nenhuma a mais da execução', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(404, null))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('sumiu', { create_time: ha(3) })],
    })
    expect(await rodar(db)).toEqual(['relatórios: Canal Um tem relatório channel_reach_basic_a1 expirado sem baixar'])
  })

  it('404 em corrente criado há 20 dias (nenhum critério persistente enxerga): UMA nota no dia, a da execução', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(404, null))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('sumiu', { create_time: ha(20) })],
    })
    expect(await rodar(db)).toEqual(['relatórios: 1 relatório(s) venceram sem baixar nesta execução (channel_reach_basic_a1: 1)'])
  })

  it('na fronteira dos 14 dias (relatório criado há 14 dias e uns segundos) ninguém fica sem nota: no mínimo uma, nunca zero', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(404, null))
    for (const segundos of [-5, 5, 600, 3600]) {
      const db = bancoComPurge({
        yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
        yt_reporting_reports: [listado('sumiu', { create_time: new Date(AGORA.getTime() - 14 * DIA_MS + segundos * 1000).toISOString() })],
      })
      const ctx = ctxDe(db)
      await passoRelatorios(ctx)
      vi.setSystemTime(new Date(AGORA.getTime() + 120_000)) // os critérios rodam minutos depois do passo
      await criteriosRelatorios(ctx)
      vi.setSystemTime(AGORA)
      expect(ctx.falhas.filter(f => NOTAS_DE_PERDA.test(f)).length, `segundos=${segundos}`).toBeGreaterThanOrEqual(1)
    }
  })
})
