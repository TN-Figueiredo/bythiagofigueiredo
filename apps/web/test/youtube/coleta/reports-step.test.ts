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
import { ReportingHttpError, SEM_NORMALIZADOR } from '@/lib/youtube/reporting/types'
import { SemTempoError } from '@/lib/youtube/coleta/clock'
import type { StepCtx } from '@/lib/youtube/coleta/types'
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

  it('100 listados: 40 baixados e 60 pendentes; no dia seguinte baixa mais 40 pelo download_url gravado', async () => {
    const cem = Array.from({ length: 100 }, (_, i) => listado(`r-${String(i).padStart(3, '0')}`, { create_time: new Date(AGORA.getTime() - (200 - i) * 60_000).toISOString() }))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: cem })
    const ctx = ctxDe(db)
    const um = await passoRelatorios(ctx)
    expect(MAX_DOWNLOADS).toBe(40)
    expect(um).toMatchObject({ baixados: 40, pendentes: 60 })
    expect(comStatus(db, 'baixado')).toHaveLength(40)
    expect(rel(db, 'r-000')!.status).toBe('baixado')
    expect(rel(db, 'r-040')!.status).toBe('listado')
    expect(ctx.tentativas.some(t => t.outcome === 'nao_alcancado_orcamento')).toBe(false)
    const dois = await passoRelatorios(ctxDe(db))
    expect(dois).toMatchObject({ baixados: 40, pendentes: 20 })
    expect(api.download).toHaveBeenLastCalledWith('https://dl.test/r-079')
  })

  it('prioridade: alcance básico → combinado → tráfego → channel_basic_a3; dentro do tipo, create_time crescente', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('basic-velho', { report_type_id: 'channel_basic_a3', create_time: ha(9) }),
        listado('trafego', { report_type_id: 'channel_traffic_source_a3', create_time: ha(8) }),
        listado('combinado', { report_type_id: 'channel_reach_combined_a1', create_time: ha(7) }),
        listado('alcance-2', { create_time: ha(1) }),
        listado('alcance-1', { create_time: ha(2) }),
      ],
    })
    await passoRelatorios(ctxDe(db))
    expect(api.download.mock.calls.map(c => c[0])).toEqual([
      'https://dl.test/alcance-1', 'https://dl.test/alcance-2', 'https://dl.test/combinado', 'https://dl.test/trafego', 'https://dl.test/basic-velho',
    ])
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

  it('acima de 2 MB comprimido: erro grande_demais, sem bruto', async () => {
    api.download.mockResolvedValue({ gz: Buffer.alloc(MAX_GZ_BYTES + 1), sha256: 'x', rowCount: 10 })
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    await passoRelatorios(ctxDe(db))
    expect(MAX_GZ_BYTES).toBe(2 * 1024 * 1024)
    expect(rel(db, 'r1')).toMatchObject({ status: 'erro', error: 'grande_demais', bytes: MAX_GZ_BYTES + 1 })
    expect(db.tables.yt_reporting_report_blobs ?? []).toEqual([])
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

  it('bytes que não viram gzip (gzip corrompido): o relatório vira erro com texto curto; o passo segue com o próximo', async () => {
    api.download.mockImplementation(async (url: string) =>
      url.endsWith('/r1') ? empacotarCsv(Buffer.from([0x1f, 0x8b, 1, 2, 3, 4])) : empacotarCsv(CSV))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('r1', { create_time: ha(3) }), listado('r2', { create_time: ha(2) })],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'r1')).toMatchObject({ status: 'erro', error: 'gzip_invalido' })
    expect(rel(db, 'r2')!.status).toBe('baixado')
    expect(resumo).toMatchObject({ baixados: 1, erros_download: 1, pendentes: 0 })
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
