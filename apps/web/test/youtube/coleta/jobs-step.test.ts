// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
import { criarReportingClient, PaginacaoExcedidaError } from '@/lib/youtube/reporting/client'
import { REPORT_TYPES_ENABLED, ReportingHttpError } from '@/lib/youtube/reporting/types'
import { avisarEntrada, avisarSaida } from '@/lib/youtube/coleta/alerts'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import { SemTempoError } from '@/lib/youtube/coleta/clock'
import { criteriosRelatorios } from '@/lib/youtube/coleta/criteria'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'ok' as const, video_count: 1 }
const api = { reportTypesList: vi.fn(), jobsList: vi.fn(), jobsCreate: vi.fn(), reportsList: vi.fn(), download: vi.fn() }
const TIPOS = REPORT_TYPES_ENABLED.map(id => ({ id }))
const ctxDe = (db: FakeDb, prazoMs = 20_000): StepCtx => ({
  // Cópia: o passo muda `collection_status` do canal em memória e isso não pode vazar para outro teste.
  supabase: db.client, channels: [{ ...canal }], deadline: Date.now() + prazoMs, falhas: [], tentativas: [],
})
const job = (db: FakeDb, tipo: string) => db.tables.yt_reporting_jobs?.find(r => r.channel_id === 'ch-1' && r.report_type_id === tipo)
const estados = (db: FakeDb) => Object.fromEntries((db.tables.yt_reporting_jobs ?? []).map(r => [r.report_type_id as string, r.status]))
const tentativaCanal = (db: FakeDb) => db.tables.yt_own_collection_attempts?.find(r => r.scope_type === 'canal' && r.kind === 'sondagem')
const linhaAtiva = (tipo: string): Row => ({ site_id: 'site-1', channel_id: 'ch-1', report_type_id: tipo, status: 'ativo', job_id: `job-${tipo}`, job_create_time: '2026-10-01T00:00:00.000Z' })

/** A Reporting API recusa o token com 401 (a listagem de jobs falha); o passo roda sobre o ctx dado. */
const rodarComReporting401 = (ctx: StepCtx) => {
  api.jobsList.mockRejectedValue(new ReportingHttpError(401, null))
  return passoJobs(ctx)
}

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
  it('canal sem job: cria todos os habilitados, grava ativo com job_id e job_create_time, e registra a sondagem', async () => {
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(api.jobsCreate).toHaveBeenCalledTimes(REPORT_TYPES_ENABLED.length)
    expect(estados(db)).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'ativo'])))
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ site_id: 'site-1', job_id: 'job-channel_reach_basic_a1', job_create_time: '2026-10-07T12:00:01Z', error: null })
    expect(resumo.gravados).toBe(REPORT_TYPES_ENABLED.length)
    expect(resumo.estados['ch-1']).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'ativo'])))
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'ok', scope_id: 'ch-1' })
    expect(db.tables.yt_own_collection_attempts!.filter(r => r.scope_type === 'job')).toHaveLength(REPORT_TYPES_ENABLED.length)
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

  it('canal com todos os jobs habilitados ativos: nenhuma chamada, nem de token', async () => {
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
    api.reportTypesList.mockResolvedValue([
      ...REPORT_TYPES_ENABLED.filter(t => t !== 'channel_reach_basic_a1').map(id => ({ id })),
      { id: 'channel_annotations_a1' },
    ])
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ status: 'tipo_indisponivel' })
    expect(job(db, 'channel_reach_basic_a1')!.job_id).toBeUndefined()
    expect(job(db, 'channel_annotations_a1')).toMatchObject({ status: 'desativado' })
    expect(api.jobsCreate).toHaveBeenCalledTimes(REPORT_TYPES_ENABLED.length - 1)
    expect(api.jobsCreate.mock.calls.map(c => (c[0] as { reportTypeId: string }).reportTypeId)).not.toContain('channel_annotations_a1')
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel', 'channel_reach_basic_a1')
    expect(resumo.tipo_indisponivel).toEqual(['Canal Um: channel_reach_basic_a1'])
    expect(resumo.acao_do_dono).toEqual([])
    expect(ctx.falhas).toEqual([])
  })

  it('cada tipo indisponível avisa com o seu nome', async () => {
    api.reportTypesList.mockResolvedValue(REPORT_TYPES_ENABLED.filter(t => t !== 'channel_basic_a3' && t !== 'channel_traffic_source_a3').map(id => ({ id })))
    const db = fakeSupabase()
    const resumo = await passoJobs(ctxDe(db))
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel', 'channel_basic_a3')
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel', 'channel_traffic_source_a3')
    expect([...resumo.tipo_indisponivel].sort()).toEqual(['Canal Um: channel_basic_a3', 'Canal Um: channel_traffic_source_a3'])
  })

  it('tipo habilitado com data de descontinuação: o job é criado mesmo assim e a data aparece em acao_do_dono', async () => {
    const quando = new Date(Date.now() + 90 * 86_400_000).toISOString()
    api.reportTypesList.mockResolvedValue(REPORT_TYPES_ENABLED.map(id => (id === 'channel_basic_a3' ? { id, deprecateTime: quando } : { id })))
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo' })
    expect(resumo.acao_do_dono).toEqual([`Canal Um: channel_basic_a3 tem data de descontinuação no YouTube (${quando})`])
    expect(ctx.falhas).toEqual([])
  })

  it('data de descontinuação NO PASSADO: o job é criado mesmo assim e a nota diz que a data já passou', async () => {
    api.reportTypesList.mockResolvedValue(REPORT_TYPES_ENABLED.map(id => (id === 'channel_basic_a3' ? { id, deprecateTime: '2019-01-15T00:00:00Z' } : { id })))
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo' })
    expect(resumo.acao_do_dono).toEqual(['Canal Um: channel_basic_a3 tem data de descontinuação no YouTube (2019-01-15T00:00:00Z), que já passou'])
    expect(ctx.falhas).toEqual([])
  })

  it('data de descontinuação ilegível: o passo não quebra e a nota sai com o texto cru', async () => {
    api.reportTypesList.mockResolvedValue(REPORT_TYPES_ENABLED.map(id => (id === 'channel_basic_a3' ? { id, deprecateTime: 'em breve' } : { id })))
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo' })
    expect(resumo.acao_do_dono).toEqual(['Canal Um: channel_basic_a3 tem data de descontinuação no YouTube (em breve)'])
    expect(ctx.falhas).toEqual([])
  })

  it('tipo fora da lista com data de descontinuação: nenhuma nota', async () => {
    api.reportTypesList.mockResolvedValue([...REPORT_TYPES_ENABLED.map(id => ({ id })), { id: 'channel_annotations_a1', deprecateTime: '2019-01-15T00:00:00Z' }])
    const resumo = await passoJobs(ctxDe(fakeSupabase()))
    expect(resumo.acao_do_dono).toEqual([])
  })

  it('linha desativado que já existe não é regravada', async () => {
    api.reportTypesList.mockResolvedValue([...TIPOS, { id: 'channel_annotations_a1' }])
    const db = fakeSupabase({ yt_reporting_jobs: [{ site_id: 'site-1', channel_id: 'ch-1', report_type_id: 'channel_annotations_a1', status: 'desativado' }] })
    await passoJobs(ctxDe(db))
    expect(db.writes.filter(w => (w.payload as Row).report_type_id === 'channel_annotations_a1')).toEqual([])
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
    const db = fakeSupabase({ yt_reporting_jobs: [linhaAtiva('channel_basic_a3')] })
    const ctx = ctxDe(db)
    const resumo = await rodarComReporting401(ctx)
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
    expect(db.tables.yt_reporting_jobs).toHaveLength(REPORT_TYPES_ENABLED.length)
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

  it('sem conexão: pula o canal com tentativa sem_conexao, sem aviso e sem falha', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
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
    expect(db.tables.yt_reporting_jobs!.filter(r => r.channel_id === 'ch-2')).toHaveLength(REPORT_TYPES_ENABLED.length)
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

  it('lista vazia de tipos da API: é "o dado não existe", não "todos indisponíveis": nenhuma linha, nenhum aviso, UMA falha do passo', async () => {
    api.reportTypesList.mockResolvedValue([])
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(db.tables.yt_reporting_jobs ?? []).toEqual([])
    expect(api.jobsCreate).not.toHaveBeenCalled()
    expect(avisarEntrada).not.toHaveBeenCalled()
    expect(resumo.tipo_indisponivel).toEqual([])
    expect(ctx.falhas).toEqual(['jobs: Canal Um: o YouTube não devolveu a lista de tipos de relatório'])
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'erro_http', scope_id: 'ch-1' })
  })

  it('lista não vazia mas sem NENHUM tipo habilitado: mesma coisa (nada marcado indisponível, uma falha)', async () => {
    api.reportTypesList.mockResolvedValue([{ id: 'playlist_basic_a2' }, { id: 'channel_annotations_a1' }])
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(estados(db)).toEqual({})
    expect(avisarEntrada).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual(['jobs: Canal Um: o YouTube não devolveu a lista de tipos de relatório'])
  })

  it('lista vazia num dia e boa no seguinte: a segunda execução cria os jobs e a falha não volta', async () => {
    const db = fakeSupabase()
    api.reportTypesList.mockResolvedValueOnce([]).mockResolvedValue(TIPOS)
    const dia1 = ctxDe(db)
    await passoJobs(dia1)
    expect(dia1.falhas).toHaveLength(1)
    const dia2 = ctxDe(db)
    await passoJobs(dia2)
    expect(dia2.falhas).toEqual([])
    expect(estados(db)).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'ativo'])))
  })

  it('um tipo isolado ausente de uma lista não vazia continua sendo tipo_indisponivel (os outros seguem)', async () => {
    api.reportTypesList.mockResolvedValue(TIPOS.filter(t => t.id !== 'channel_basic_a3'))
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'tipo_indisponivel' })
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ status: 'ativo' })
    expect(ctx.falhas).toEqual([])
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

  it('canal pulado por já ter todos os jobs ativos registra sondagem ok', async () => {
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

describe('passoJobs: autorização (L1b)', () => {
  it('token revogado: canal vira reautorizar, tentativa sem_autorizacao, nenhuma falha crítica e nenhuma chamada à Reporting API', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube', 'c1'))
    const db = fakeSupabase({ youtube_channels: [{ id: 'ch-1', collection_status: 'ok' }] })
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(resumo.tentativas).toEqual({ sem_autorizacao: 1 })
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'reautorizar' })
    expect(ctx.channels[0]!.collection_status).toBe('reautorizar')
    expect(ctx.falhas).toEqual([])
    expect(db.tables.yt_reporting_jobs ?? []).toEqual([])
    expect(api.reportTypesList).not.toHaveBeenCalled()
  })

  it('sem conexão e sem conexão revogada: sem_conexao, estado ok', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
    const db = fakeSupabase({ youtube_channels: [{ id: 'ch-1', collection_status: 'ok' }], social_connections: [] })
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(resumo.tentativas).toEqual({ sem_conexao: 1 })
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'ok' })
  })

  it('401 da Reporting API não muda collection_status (é sem_acesso do job, e só isso)', async () => {
    vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' })
    const db = fakeSupabase({ youtube_channels: [{ id: 'ch-1', collection_status: 'ok' }] })
    const ctx = ctxDe(db)
    await rodarComReporting401(ctx)
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'ok' })
    expect(ctx.channels[0]!.collection_status).toBe('ok')
  })
})

describe('passoJobs: tipo tirado de REPORT_TYPES_ENABLED', () => {
  const FORA = 'channel_annotations_a1'

  it('os habilitados ativos e uma linha ativa de tipo fora da lista: ela vira desativado, sem token e sem chamada ao Google', async () => {
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

describe('E12 onda 2, D3: linha desativada que é religada conta os 6 dias a partir da religação', () => {
  const AGORA = new Date('2026-10-20T12:00:00.000Z')
  const DIA_MS = 86_400_000
  const ha = (dias: number) => new Date(AGORA.getTime() - dias * DIA_MS).toISOString()
  const MSG = 'relatórios: Canal Um está sem relatório novo de channel_basic_a3 há mais de 6 dias'
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })

  /** A API cria o job SEM devolver createTime (o campo é opcional no tipo `Job`). */
  const semCreateTime = () =>
    api.jobsCreate.mockImplementation(async ({ reportTypeId }: { reportTypeId: string }) => ({ id: `job-${reportTypeId}`, reportTypeId }))
  const linhaVelha = (tipo: string, extra: Row = {}): Row => ({
    site_id: 'site-1', channel_id: 'ch-1', report_type_id: tipo, status: 'desativado', created_at: ha(10), job_create_time: null, last_create_time: null, ...extra,
  })

  it('linha desativado criada há 10 dias, job recriado agora sem createTime: job_create_time vira agora e o critério dos 6 dias não alarma no primeiro dia', async () => {
    semCreateTime()
    const db = fakeSupabase({ yt_reporting_jobs: [linhaVelha('channel_basic_a3', { last_create_time: ha(20) })] })
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo', job_create_time: AGORA.toISOString() })

    const criterios = { supabase: db.client, falhas: [] as string[], channels: ctx.channels }
    await criteriosRelatorios(criterios)
    expect(criterios.falhas).toEqual([])

    // dia 5 depois da religação ainda é cedo; passados os 6 dias, sem relatório novo, alarma
    vi.setSystemTime(new Date(AGORA.getTime() + 5 * DIA_MS))
    const dia5 = { supabase: db.client, falhas: [] as string[], channels: ctx.channels }
    await criteriosRelatorios(dia5)
    expect(dia5.falhas).toEqual([])
    vi.setSystemTime(new Date(AGORA.getTime() + 6.5 * DIA_MS))
    const dia7 = { supabase: db.client, falhas: [] as string[], channels: ctx.channels }
    await criteriosRelatorios(dia7)
    expect(dia7.falhas).toContain(MSG)
  })

  it('o mesmo vale para linha em erro ou tipo_indisponivel que volta a ativo', async () => {
    semCreateTime()
    const db = fakeSupabase({ yt_reporting_jobs: [linhaVelha('channel_basic_a3', { status: 'erro' }), linhaVelha('channel_traffic_source_a3', { status: 'tipo_indisponivel' })] })
    await passoJobs(ctxDe(db))
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo', job_create_time: AGORA.toISOString() })
    expect(job(db, 'channel_traffic_source_a3')).toMatchObject({ status: 'ativo', job_create_time: AGORA.toISOString() })
  })

  it('com createTime na resposta, vale o da API', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [linhaVelha('channel_basic_a3')] })
    await passoJobs(ctxDe(db))
    expect(job(db, 'channel_basic_a3')).toMatchObject({ job_create_time: '2026-10-07T12:00:01Z' })
  })

  it('job que já estava ativo e continua sem createTime na API NÃO ganha data nova (o relógio do alarme não reinicia)', async () => {
    semCreateTime()
    api.jobsList.mockResolvedValue([{ id: 'job-channel_basic_a3', reportTypeId: 'channel_basic_a3' }])
    const db = fakeSupabase({ yt_reporting_jobs: [linhaVelha('channel_basic_a3', { status: 'ativo', job_id: 'job-channel_basic_a3' })] })
    await passoJobs(ctxDe(db))
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo', job_create_time: null, created_at: ha(10) })
  })
})

describe('E12 onda 4, E3: tipo que sumiu da lista do YouTube', () => {
  const SUMIU = 'channel_basic_a3'
  const MSG = `jobs: Canal Um: o tipo ${SUMIU} sumiu da lista do YouTube; se repetir, foi descontinuado`
  /** Todos ativos menos `channel_reach_basic_a1`, que não tem linha: o canal não está completo e a sondagem roda. */
  const bancoIncompleto = () => fakeSupabase({ yt_reporting_jobs: REPORT_TYPES_ENABLED.filter(t => t !== 'channel_reach_basic_a1').map(linhaAtiva) })
  const listaSem = (...ausentes: string[]) => api.reportTypesList.mockResolvedValue(REPORT_TYPES_ENABLED.filter(t => !ausentes.includes(t)).map(id => ({ id })))

  it('job ATIVO cujo tipo sumiu da lista (lista parcial): não é rebaixado nem avisado como indisponível; vira falha visível', async () => {
    listaSem(SUMIU)
    const db = bancoIncompleto()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, SUMIU)).toMatchObject({ status: 'ativo', job_id: `job-${SUMIU}` })
    expect(db.writes.filter(w => (w.payload as Row).report_type_id === SUMIU)).toEqual([])
    expect(avisarEntrada).not.toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel', SUMIU)
    expect(resumo.tipo_indisponivel).toEqual([])
    expect(resumo.estados['ch-1']![SUMIU]).toBe('ativo')
    expect(ctx.falhas).toEqual([MSG])
  })

  it('a falha se repete a cada execução e o job NUNCA é rebaixado sozinho (sem evidência persistente sem migration)', async () => {
    listaSem(SUMIU)
    const db = bancoIncompleto()
    for (let i = 0; i < 5; i++) {
      // A linha do tipo que falta é recriada pela própria sondagem; apaga para o canal seguir incompleto, como no dia anterior.
      db.tables.yt_reporting_jobs = (db.tables.yt_reporting_jobs ?? []).filter(r => r.report_type_id !== 'channel_reach_basic_a1')
      const ctx = ctxDe(db)
      await passoJobs(ctx)
      expect(ctx.falhas).toEqual([MSG])
      expect(job(db, SUMIU)).toMatchObject({ status: 'ativo' })
    }
    expect(avisarEntrada).not.toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel', SUMIU)
  })

  it('o tipo volta na lista seguinte: sem falha', async () => {
    const db = bancoIncompleto()
    listaSem(SUMIU)
    await passoJobs(ctxDe(db))
    db.tables.yt_reporting_jobs = (db.tables.yt_reporting_jobs ?? []).filter(r => r.report_type_id !== 'channel_reach_basic_a1')
    api.reportTypesList.mockResolvedValue(TIPOS)
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('tipo que NUNCA teve job (sem linha) e não está na lista continua tipo_indisponivel, como antes', async () => {
    listaSem('channel_reach_basic_a1')
    const db = bancoIncompleto()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ status: 'tipo_indisponivel' })
    expect(resumo.tipo_indisponivel).toEqual(['Canal Um: channel_reach_basic_a1'])
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel', 'channel_reach_basic_a1')
    expect(ctx.falhas).toEqual([])
  })

  it('job que já NÃO estava ativo (erro) e o tipo sumiu: continua tipo_indisponivel, como antes', async () => {
    listaSem(SUMIU)
    const db = fakeSupabase({ yt_reporting_jobs: [{ site_id: 'site-1', channel_id: 'ch-1', report_type_id: SUMIU, status: 'erro', error: 'HTTP 500' }] })
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(job(db, SUMIU)).toMatchObject({ status: 'tipo_indisponivel' })
    expect(ctx.falhas).toEqual([])
  })

  it('E4: a lista de tipos estoura as 20 páginas: falha visível na hora, nenhum tipo marcado indisponível, jobs ativos intactos', async () => {
    api.reportTypesList.mockRejectedValue(new PaginacaoExcedidaError('reportTypes'))
    const db = bancoIncompleto()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(ctx.falhas).toEqual(['jobs: Canal Um: a lista reportTypes passou de 20 páginas; a resposta do YouTube está incompleta'])
    expect(resumo.tipo_indisponivel).toEqual([])
    expect(avisarEntrada).not.toHaveBeenCalled()
    for (const t of REPORT_TYPES_ENABLED.filter(x => x !== 'channel_reach_basic_a1')) expect(job(db, t)).toMatchObject({ status: 'ativo' })
  })
})
