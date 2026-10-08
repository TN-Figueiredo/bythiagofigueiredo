// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import { passoJobs } from '@/lib/youtube/coleta/jobs-step'
import { ensureFreshToken, TokenRevokedError, NoActiveConnectionError } from '@/lib/social/token-refresh'
import { criarReportingClient } from '@/lib/youtube/reporting/client'
import { REPORT_TYPES_ENABLED, ReportingHttpError } from '@/lib/youtube/reporting/types'
import { avisarEntrada, avisarSaida } from '@/lib/youtube/coleta/alerts'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import { SemTempoError } from '@/lib/youtube/coleta/clock'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'ok' as const, video_count: 1 }
const api = { reportTypesList: vi.fn(), jobsList: vi.fn(), jobsCreate: vi.fn(), reportsList: vi.fn(), download: vi.fn() }
const TIPOS = REPORT_TYPES_ENABLED.map(id => ({ id }))
const ctxDe = (db: FakeDb, prazoMs = 20_000): StepCtx => ({
  supabase: db.client, channels: [canal], deadline: Date.now() + prazoMs, falhas: [], tentativas: [],
})
const job = (db: FakeDb, tipo: string) => db.tables.yt_reporting_jobs?.find(r => r.channel_id === 'ch-1' && r.report_type_id === tipo)
const estados = (db: FakeDb) => Object.fromEntries((db.tables.yt_reporting_jobs ?? []).map(r => [r.report_type_id as string, r.status]))
const tentativaCanal = (db: FakeDb) => db.tables.yt_own_collection_attempts?.find(r => r.scope_type === 'canal' && r.kind === 'sondagem')
const linhaAtiva = (tipo: string): Row => ({ site_id: 'site-1', channel_id: 'ch-1', report_type_id: tipo, status: 'ativo', job_id: `job-${tipo}`, job_create_time: '2026-10-01T00:00:00.000Z' })

beforeEach(() => {
  vi.clearAllMocks()
  for (const m of Object.values(api)) m.mockReset()
  vi.mocked(criarReportingClient).mockReturnValue(api)
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' } as never)
  api.reportTypesList.mockResolvedValue(TIPOS)
  api.jobsList.mockResolvedValue([])
  api.jobsCreate.mockImplementation(async ({ reportTypeId }: { reportTypeId: string }) => ({ id: `job-${reportTypeId}`, reportTypeId, createTime: '2026-10-07T12:00:01Z' }))
})

describe('passoJobs: caminho feliz', () => {
  it('canal sem job: cria os quatro, grava ativo com job_id e job_create_time, e registra a sondagem', async () => {
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(api.jobsCreate).toHaveBeenCalledTimes(4)
    expect(estados(db)).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'ativo'])))
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ site_id: 'site-1', job_id: 'job-channel_reach_basic_a1', job_create_time: '2026-10-07T12:00:01Z', error: null })
    expect(resumo.gravados).toBe(4)
    expect(resumo.estados['ch-1']).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'ativo'])))
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'ok', scope_id: 'ch-1' })
    expect(db.tables.yt_own_collection_attempts!.filter(r => r.scope_type === 'job')).toHaveLength(4)
    expect(avisarSaida).toHaveBeenCalledTimes(1)
    expect(ctx.falhas).toEqual([])
    expect(resumo.acao_do_dono).toEqual([])
  })

  it('o cliente recebe o token do canal dono', async () => {
    await passoJobs(ctxDe(fakeSupabase()))
    expect(ensureFreshToken).toHaveBeenCalledWith('site-1', 'youtube', 'UC1')
    expect(vi.mocked(criarReportingClient).mock.calls[0]![0]).toBe('tok')
  })

  it('job que já existe do lado do Google é adotado, sem jobs.create', async () => {
    api.jobsList.mockResolvedValue(REPORT_TYPES_ENABLED.map(t => ({ id: `ja-${t}`, reportTypeId: t, createTime: '2026-09-01T00:00:00Z' })))
    const db = fakeSupabase()
    await passoJobs(ctxDe(db))
    expect(api.jobsCreate).not.toHaveBeenCalled()
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo', job_id: 'ja-channel_basic_a3', job_create_time: '2026-09-01T00:00:00Z' })
  })

  it('canal com os quatro jobs ativos: nenhuma chamada, nem de token', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: REPORT_TYPES_ENABLED.map(linhaAtiva) })
    const resumo = await passoJobs(ctxDe(db))
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(api.reportTypesList).not.toHaveBeenCalled()
    expect(resumo.estados['ch-1']).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'ativo'])))
  })

  it('canal com sync desligado é ignorado', async () => {
    const db = fakeSupabase()
    await passoJobs({ ...ctxDe(db), channels: [{ ...canal, sync_enabled: false }] })
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(db.tables.yt_reporting_jobs ?? []).toEqual([])
  })

  it('jobs.create com 409: lista de novo e adota o job existente', async () => {
    api.jobsCreate.mockImplementation(async ({ reportTypeId }: { reportTypeId: string }) => {
      if (reportTypeId === 'channel_basic_a3') throw new ReportingHttpError(409, 'alreadyExists')
      return { id: `job-${reportTypeId}`, reportTypeId, createTime: '2026-10-07T12:00:01Z' }
    })
    api.jobsList.mockResolvedValueOnce([]).mockResolvedValue([{ id: 'ja-existia', reportTypeId: 'channel_basic_a3', createTime: '2026-08-01T00:00:00Z' }])
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo', job_id: 'ja-existia' })
    expect(ctx.falhas).toEqual([])
  })
})

describe('passoJobs: tipos', () => {
  it('tipo habilitado ausente da lista: tipo_indisponivel, avisa e fica na resposta; tipo não habilitado: desativado, sem chamada', async () => {
    api.reportTypesList.mockResolvedValue([{ id: 'channel_basic_a3' }, { id: 'channel_reach_combined_a1' }, { id: 'channel_traffic_source_a3' }, { id: 'channel_demographics_a1' }])
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ status: 'tipo_indisponivel' })
    expect(job(db, 'channel_reach_basic_a1')!.job_id).toBeUndefined()
    expect(job(db, 'channel_demographics_a1')).toMatchObject({ status: 'desativado' })
    expect(api.jobsCreate).toHaveBeenCalledTimes(3)
    expect(api.jobsCreate.mock.calls.map(c => (c[0] as { reportTypeId: string }).reportTypeId)).not.toContain('channel_demographics_a1')
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel')
    expect(resumo.tipo_indisponivel).toEqual(['Canal Um: channel_reach_basic_a1'])
    expect(resumo.acao_do_dono).toEqual([])
    expect(ctx.falhas).toEqual([])
  })

  it('linha desativado que já existe não é regravada', async () => {
    api.reportTypesList.mockResolvedValue([...TIPOS, { id: 'channel_demographics_a1' }])
    const db = fakeSupabase({ yt_reporting_jobs: [{ site_id: 'site-1', channel_id: 'ch-1', report_type_id: 'channel_demographics_a1', status: 'desativado' }] })
    await passoJobs(ctxDe(db))
    expect(db.writes.filter(w => (w.payload as Row).report_type_id === 'channel_demographics_a1')).toEqual([])
  })
})

describe('passoJobs: ação do dono', () => {
  it('reportTypes.list com 403 accessNotConfigured: uma linha api_nao_ativada por tipo, aviso, sem falha crítica', async () => {
    api.reportTypesList.mockRejectedValue(new ReportingHttpError(403, 'accessNotConfigured'))
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(estados(db)).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'api_nao_ativada'])))
    expect(avisarEntrada).toHaveBeenCalledTimes(1)
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'api_nao_ativada')
    expect(avisarSaida).not.toHaveBeenCalled()
    expect(resumo.acao_do_dono).toEqual(['Canal Um: api_nao_ativada'])
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'erro_http', http_status: 403 })
    expect(ctx.falhas).toEqual([])
    expect(api.jobsCreate).not.toHaveBeenCalled()
  })

  it('com 401: sem_acesso, e um job que estava ativo guarda o job_id', async () => {
    api.jobsList.mockRejectedValue(new ReportingHttpError(401, null))
    const db = fakeSupabase({ yt_reporting_jobs: [linhaAtiva('channel_basic_a3')] })
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(estados(db)).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'sem_acesso'])))
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'sem_acesso', job_id: 'job-channel_basic_a3' })
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'sem_acesso')
    expect(resumo.acao_do_dono).toEqual(['Canal Um: sem_acesso'])
    expect(ctx.falhas).toEqual([])
  })

  it('duas execuções com a API desativada: o aviso é pedido nas duas (quem deduplica é avisarEntrada) e a chamada é refeita', async () => {
    api.reportTypesList.mockRejectedValue(new ReportingHttpError(403, 'accessNotConfigured'))
    const db = fakeSupabase()
    await passoJobs(ctxDe(db))
    await passoJobs(ctxDe(db))
    expect(api.reportTypesList).toHaveBeenCalledTimes(2)
    expect(avisarEntrada).toHaveBeenCalledTimes(2)
    expect(db.tables.yt_reporting_jobs).toHaveLength(4)
  })

  it('a chamada volta a passar: os estados saem sozinhos e avisarSaida é chamado', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: REPORT_TYPES_ENABLED.map(t => ({ site_id: 'site-1', channel_id: 'ch-1', report_type_id: t, status: 'api_nao_ativada', error: 'HTTP 403 accessNotConfigured' })) })
    await passoJobs(ctxDe(db))
    expect(estados(db)).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'ativo'])))
    expect(job(db, 'channel_basic_a3')).toMatchObject({ error: null })
    expect(avisarSaida).toHaveBeenCalledWith(expect.anything(), canal)
  })
})

describe('passoJobs: erros', () => {
  it('500 na listagem: erro só nos tipos que não estavam ativos; não é falha crítica na hora', async () => {
    api.reportTypesList.mockRejectedValue(new ReportingHttpError(500, null))
    const db = fakeSupabase({ yt_reporting_jobs: [linhaAtiva('channel_basic_a3')] })
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo' })
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ status: 'erro', error: 'HTTP 500' })
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'erro_http', http_status: 500 })
    expect(avisarEntrada).not.toHaveBeenCalled()
    expect(resumo.acao_do_dono).toEqual([])
    expect(ctx.falhas).toEqual([])
  })

  it('fetch que nunca responde (timeout de 15 s): tentativa erro_http com http_status nulo', async () => {
    api.reportTypesList.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    const db = fakeSupabase()
    await passoJobs(ctxDe(db))
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'erro_http', http_status: null, error: 'request timed out' })
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ status: 'erro', error: 'request timed out' })
  })

  it.each([
    ['TokenRevokedError', () => new TokenRevokedError('youtube', 'conn-1')],
    ['NoActiveConnectionError', () => new NoActiveConnectionError('youtube', 'site-1')],
  ])('simplificação de L1a: %s pula o canal com tentativa sem_conexao, sem aviso e sem falha', async (_nome, erro) => {
    vi.mocked(ensureFreshToken).mockRejectedValue(erro())
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'sem_conexao' })
    expect(api.reportTypesList).not.toHaveBeenCalled()
    expect(avisarEntrada).not.toHaveBeenCalled()
    expect(db.tables.yt_reporting_jobs ?? []).toEqual([])
    expect(ctx.falhas).toEqual([])
  })

  it('outro erro ao obter o token é falha crítica, com o nome do canal e sem o texto do banco', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new Error('Could not read the youtube connection for site site-1: relation "segredo" does not exist'))
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(ctx.falhas).toEqual(['jobs: Canal Um: database error reading the connection'])
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'erro_http' })
  })

  it('um canal que falha não impede o seguinte', async () => {
    const outro = { ...canal, id: 'ch-2', channel_id: 'UC2', name: 'Canal Dois' }
    vi.mocked(ensureFreshToken).mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ accessToken: 'tok', connectionId: 'c2' } as never)
    const db = fakeSupabase()
    const ctx = { ...ctxDe(db), channels: [canal, outro] }
    await passoJobs(ctx)
    expect(db.tables.yt_reporting_jobs!.filter(r => r.channel_id === 'ch-2')).toHaveLength(4)
    expect(ctx.falhas).toHaveLength(1)
  })

  it('tabela ausente em produção: schema_ausente, tentativa registrada e o passo para', async () => {
    const db = fakeSupabase()
    db.errors.yt_reporting_jobs = { code: 'PGRST205', message: 'Could not find the table' }
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(ctx.falhas).toEqual(['schema_ausente: yt_reporting_jobs'])
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'schema_ausente' })
    expect(ensureFreshToken).not.toHaveBeenCalled()
  })

  it('passo que recebe 0 s: nao_alcancado_orcamento e pendentes', async () => {
    const db = fakeSupabase()
    const resumo = await passoJobs(ctxDe(db, -1))
    expect(resumo.pendentes).toBe(1)
    expect(resumo.tentativas).toEqual({ nao_alcancado_orcamento: 1 })
    expect(ensureFreshToken).not.toHaveBeenCalled()
  })
})

describe('passoJobs: tempo e 409 sem job', () => {
  it('409 e a nova listagem não traz o job: vira erro, nunca ativo', async () => {
    api.jobsCreate.mockImplementation(async ({ reportTypeId }: { reportTypeId: string }) => {
      if (reportTypeId === 'channel_basic_a3') throw new ReportingHttpError(409, 'alreadyExists')
      return { id: `job-${reportTypeId}`, reportTypeId, createTime: '2026-10-07T12:00:01Z' }
    })
    const db = fakeSupabase()
    await passoJobs(ctxDe(db))
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'erro', error: 'HTTP 409 alreadyExists' })
  })

  it('jobs.create devolve job sem id: erro, não ativo', async () => {
    api.jobsCreate.mockImplementation(async ({ reportTypeId }: { reportTypeId: string }) => (reportTypeId === 'channel_basic_a3' ? { reportTypeId } : { id: `job-${reportTypeId}`, reportTypeId }))
    const db = fakeSupabase()
    await passoJobs(ctxDe(db))
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'erro' })
  })

  it('lista vazia de tipos da API: os quatro viram tipo_indisponivel e o dono é avisado', async () => {
    api.reportTypesList.mockResolvedValue([])
    const db = fakeSupabase()
    const resumo = await passoJobs(ctxDe(db))
    expect(estados(db)).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'tipo_indisponivel'])))
    expect(resumo.tipo_indisponivel).toHaveLength(4)
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel')
  })

  it('prazo que acaba no meio da listagem: nao_alcancado_orcamento, jobs intocados, restantes pendentes, sem falha', async () => {
    const outro = { ...canal, id: 'ch-2', channel_id: 'UC2', name: 'Canal Dois' }
    api.reportTypesList.mockRejectedValue(new SemTempoError())
    const db = fakeSupabase()
    const ctx = { ...ctxDe(db), channels: [canal, outro] }
    const resumo = await passoJobs(ctx)
    expect(db.tables.yt_reporting_jobs ?? []).toEqual([])
    expect(resumo.pendentes).toBe(2)
    expect(resumo.tentativas).toEqual({ nao_alcancado_orcamento: 2 })
    expect(ctx.falhas).toEqual([])
    expect(ensureFreshToken).toHaveBeenCalledTimes(1)
    expect(avisarEntrada).not.toHaveBeenCalled()
  })

  it('prazo que acaba no meio da criação de um job: sem erro_http e sem linha de erro para ele', async () => {
    api.jobsCreate.mockImplementation(async ({ reportTypeId }: { reportTypeId: string }) => {
      if (reportTypeId === 'channel_basic_a3') throw new SemTempoError()
      return { id: `job-${reportTypeId}`, reportTypeId, createTime: '2026-10-07T12:00:01Z' }
    })
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, 'channel_basic_a3')).toBeUndefined()
    expect(resumo.pendentes).toBe(1)
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(db.tables.yt_own_collection_attempts!.filter(r => r.outcome === 'erro_http')).toEqual([])
    expect(ctx.falhas).toEqual([])
  })

  it('canal pulado por já ter os quatro jobs ativos registra sondagem ok', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: REPORT_TYPES_ENABLED.map(linhaAtiva) })
    await passoJobs(ctxDe(db))
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'ok', scope_id: 'ch-1' })
  })
})

describe('passoJobs: rodada de correção 1', () => {
  const create403 = () => api.jobsCreate.mockRejectedValue(new ReportingHttpError(403, 'insufficientPermissions'))

  it('listagem ok e create 403: sem avisarSaida (nada de pisca-pisca), entrada pelo motivo certo', async () => {
    create403()
    const db = fakeSupabase()
    await passoJobs(ctxDe(db))
    expect(avisarSaida).not.toHaveBeenCalled()
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'sem_acesso')
  })

  it('create 403: a sondagem do canal é erro_http com o status do primeiro erro', async () => {
    create403()
    const db = fakeSupabase()
    await passoJobs(ctxDe(db))
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'erro_http', http_status: 403 })
  })

  it('create 500: sondagem do canal erro_http 500 e job em erro', async () => {
    api.jobsCreate.mockRejectedValue(new ReportingHttpError(500, null))
    const db = fakeSupabase()
    await passoJobs(ctxDe(db))
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'erro_http', http_status: 500 })
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'erro' })
  })

  it('create sem id: sondagem do canal erro_http com status nulo', async () => {
    api.jobsCreate.mockImplementation(async ({ reportTypeId }: { reportTypeId: string }) => ({ reportTypeId }))
    const db = fakeSupabase()
    await passoJobs(ctxDe(db))
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'erro_http', http_status: null })
  })

  it('listagem com erro transitório: os tipos já ativos continuam no resumo', async () => {
    api.reportTypesList.mockRejectedValue(new ReportingHttpError(500, null))
    const db = fakeSupabase({ yt_reporting_jobs: [linhaAtiva('channel_basic_a3')] })
    const resumo = await passoJobs(ctxDe(db))
    expect(resumo.estados['ch-1']!.channel_basic_a3).toBe('ativo')
    expect(resumo.estados['ch-1']!.channel_reach_basic_a1).toBe('erro')
  })

  it('token que nunca responde com o prazo esgotado: nao_alcancado_orcamento, sem falha', async () => {
    vi.mocked(ensureFreshToken).mockImplementation(() => new Promise(() => {}))
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    try {
      const db = fakeSupabase()
      const ctx = ctxDe(db, 1000)
      const p = passoJobs(ctx)
      await vi.advanceTimersByTimeAsync(1500)
      const resumo = await p
      expect(resumo.pendentes).toBe(1)
      expect(tentativaCanal(db)).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
      expect(ctx.falhas).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('passoJobs: tipo tirado de REPORT_TYPES_ENABLED', () => {
  const FORA = 'channel_demographics_a1'

  it('os quatro habilitados ativos e uma linha ativa de tipo fora da lista: ela vira desativado, sem token e sem chamada ao Google', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [...REPORT_TYPES_ENABLED.map(linhaAtiva), linhaAtiva(FORA)] })
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, FORA)).toMatchObject({ status: 'desativado', job_id: `job-${FORA}`, error: null })
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(criarReportingClient).not.toHaveBeenCalled()
    expect(resumo.estados['ch-1']).toEqual({ ...Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'ativo'])), [FORA]: 'desativado' })
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'ok' })
    expect(ctx.falhas).toEqual([])
  })

  it('linha de tipo fora da lista em estado do dono (api_nao_ativada) também vira desativado e para de pedir ação', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [...REPORT_TYPES_ENABLED.map(linhaAtiva), { ...linhaAtiva(FORA), status: 'api_nao_ativada', error: 'HTTP 403' }] })
    const resumo = await passoJobs(ctxDe(db))
    expect(job(db, FORA)).toMatchObject({ status: 'desativado' })
    expect(resumo.acao_do_dono).toEqual([])
    expect(avisarEntrada).not.toHaveBeenCalled()
  })

  it('a escrita do desativado é recusada: o canal NÃO conta como completo, a sondagem roda e a falha aparece', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [...REPORT_TYPES_ENABLED.map(linhaAtiva), linhaAtiva(FORA)] })
    db.writeErrors.yt_reporting_jobs = { code: '57014', message: 'timeout' }
    api.jobsList.mockResolvedValue(REPORT_TYPES_ENABLED.map(t => ({ id: `job-${t}`, reportTypeId: t })))
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(api.reportTypesList).toHaveBeenCalledTimes(1)
    expect(ctx.falhas).toContain('erro de banco ao gravar yt_reporting_jobs')
    expect(job(db, FORA)).toMatchObject({ status: 'ativo' })
  })

  it('linha desativado de tipo fora da lista não é regravada nem tira o canal do atalho', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [...REPORT_TYPES_ENABLED.map(linhaAtiva), { ...linhaAtiva(FORA), status: 'desativado' }] })
    await passoJobs(ctxDe(db))
    expect(db.writes.filter(w => w.table === 'yt_reporting_jobs')).toEqual([])
    expect(ensureFreshToken).not.toHaveBeenCalled()
  })
})
