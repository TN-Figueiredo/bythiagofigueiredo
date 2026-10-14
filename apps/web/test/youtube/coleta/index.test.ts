// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/coleta/meta-step', () => ({ passoMetadados: vi.fn() }))
vi.mock('@/lib/youtube/coleta/jobs-step', () => ({ passoJobs: vi.fn() }))
vi.mock('@/lib/youtube/coleta/reports-step', () => ({ passoRelatorios: vi.fn() }))
vi.mock('@/lib/youtube/coleta/alcance-step', () => ({ passoAlcance: vi.fn() }))
vi.mock('@/lib/youtube/coleta/diario-step', () => ({ passoDiario: vi.fn() }))
vi.mock('@/lib/youtube/coleta/criteria-l2', () => ({ criteriosL2: vi.fn() }))
vi.mock('@/lib/youtube/coleta/dimensoes-step', () => ({ passoDimensoes: vi.fn() }))
vi.mock('@/lib/youtube/coleta/normalizadores-step', () => ({ passoNormalizadores: vi.fn() }))
vi.mock('@/lib/youtube/coleta/criteria-e11', () => ({ criteriosE11: vi.fn() }))
vi.mock('@/lib/youtube/coleta/criteria-desligados', () => ({ criterioDesligados: vi.fn() }))
vi.mock('@/lib/youtube/coleta/retencao-step', () => ({ passoRetencao: vi.fn() }))
vi.mock('@/lib/youtube/coleta/criteria-retencao', () => ({ criteriosRetencao: vi.fn() }))
vi.mock('@/lib/youtube/coleta/criteria-cobertura', () => ({ criterioCobertura: vi.fn() }))
// Item 246: a lista publicada de conferências é trocada por uma lista de teste (mutável, esvaziada a cada teste).
const conferenciasDeTeste = vi.hoisted(() => [] as Array<{ id: string; etapa: string; data: string; responsavel: 'agente' | 'dono'; onde: string; feitaEm: string | null }>)
vi.mock('@/lib/conferencias', async (orig) => ({ ...(await orig<typeof import('@/lib/conferencias')>()), CONFERENCIAS: conferenciasDeTeste }))
vi.mock('@/lib/youtube/coleta/criteria', () => ({
  criteriosRelatorios: vi.fn(),
  criterioJobsEmErro: vi.fn(),
  criterioOrcamento: vi.fn(),
  criterioMetadados: vi.fn(),
}))

import { rodarColeta, PASSOS_LIGADOS } from '@/lib/youtube/coleta'
import { passoMetadados } from '@/lib/youtube/coleta/meta-step'
import { passoJobs } from '@/lib/youtube/coleta/jobs-step'
import { passoRelatorios } from '@/lib/youtube/coleta/reports-step'
import { passoAlcance } from '@/lib/youtube/coleta/alcance-step'
import { passoDiario } from '@/lib/youtube/coleta/diario-step'
import { criteriosL2 } from '@/lib/youtube/coleta/criteria-l2'
import { passoDimensoes, type DimensoesResumo } from '@/lib/youtube/coleta/dimensoes-step'
import { passoNormalizadores, type NormalizadoresResumo } from '@/lib/youtube/coleta/normalizadores-step'
import { criteriosE11 } from '@/lib/youtube/coleta/criteria-e11'
import { criterioDesligados } from '@/lib/youtube/coleta/criteria-desligados'
import { passoRetencao, type RetencaoResumo } from '@/lib/youtube/coleta/retencao-step'
import { criteriosRetencao } from '@/lib/youtube/coleta/criteria-retencao'
import { criterioCobertura } from '@/lib/youtube/coleta/criteria-cobertura'
import { notaNomesDesconhecidos } from '@/lib/youtube/coleta/passos-desligados'
import { pushUnico } from '@/lib/youtube/coleta/schema'
import { DIMENSOES_DESDE, DIMENSOES_LIGADO_EM } from '@/lib/youtube/coleta/e11-config'
import { criteriosRelatorios, criterioJobsEmErro, criterioOrcamento, criterioMetadados } from '@/lib/youtube/coleta/criteria'
import { criarRelogio } from '@/lib/youtube/coleta/clock'
import { GUARDA_PRAZO_MS } from '@/lib/youtube/coleta/guarda'
import * as Sentry from '@sentry/nextjs'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakeSupabase, type FakeDb } from './fake-supabase'

const AGORA = new Date('2026-10-07T12:00:00.000Z')
const canais = [
  { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, slug: 'um' },
  { id: 'ch-2', channel_id: 'UC2', site_id: 'site-1', name: 'Canal Dois', sync_enabled: false, slug: 'dois' },
]
const resumoVazio = { gravados: 0, tentativas: {}, pendentes: 0 }
const dimResumo = (o: Partial<DimensoesResumo> = {}): DimensoesResumo => ({
  ...resumoVazio, ate: '2026-10-07', desde: DIMENSOES_DESDE, consultas: 0, consultas_cortadas: 0, videos_com_view: 0,
  conjuntos_cobertos_sem_api: 0, dias_mantidos: 0, dias_em_revisao: 0, fora_do_teto: 0, valores_invalidos: 0,
  estendidas_recusadas: 0, base_ate: null, ...o,
})
const zeradoDoTipo = { normalizados: 0, vazios: 0, superados: 0, erros: 0, sem_par: 0, descartadas_zeradas: 0, codigos_fora_do_catalogo: 0 }
const normResumo = (o: Partial<NormalizadoresResumo> = {}): NormalizadoresResumo => ({
  ...resumoVazio, por_tipo: { detalhe: { ...zeradoDoTipo }, alcance_dim: { ...zeradoDoTipo } }, ...o,
})

const retResumo = (o: Partial<RetencaoResumo> = {}): RetencaoResumo => ({
  ...resumoVazio, ate: '2026-10-07', vazios: 0, chamadas: 0, adiados_pela_leva: 0, sem_diario_em_dia: 0,
  sem_resposta_do_youtube: [], novos: 0, ...o,
})

beforeEach(() => {
  vi.clearAllMocks()
  conferenciasDeTeste.length = 0
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  vi.mocked(passoMetadados).mockResolvedValue({ ...resumoVazio, gravados: 35, day_pt: '2026-10-06', dias_sem_meta: { 'ch-1': 0 } })
  vi.mocked(passoJobs).mockResolvedValue({ ...resumoVazio, acao_do_dono: ['Canal Um: sem_acesso'], tipo_indisponivel: [], estados: {} })
  vi.mocked(passoRelatorios).mockResolvedValue({
    ...resumoVazio, vistos: 0, baixados: 3, vazios: 0, expirados: 0, erros_download: 0, bruto_apagado: 0,
    maior_bytes: 0, maior_lido_por_tipo: {}, corpos_gz: 0, expirados_por_tipo: {}, expirados_sem_cobertura_por_tipo: {}, vence_primeiro_em_dias: null, ms_listar: 0, ms_baixar: 0,
  })
  vi.mocked(passoAlcance).mockResolvedValue({ ...resumoVazio, normalizados: 2, vazios: 1, erros: 0, sem_par: 0 })
  vi.mocked(passoDiario).mockResolvedValue({ ...resumoVazio, gravados: 9, ate: '2026-10-07', estendidas_recusadas: 0 })
  vi.mocked(criteriosRelatorios).mockResolvedValue({ perdidos: 2, atrasados: 0, acao_do_dono: ['Canal Um: x em sem_acesso'] })
  vi.mocked(criterioMetadados).mockResolvedValue({ desconhecido: [] })
  vi.mocked(criteriosL2).mockResolvedValue(undefined)
  vi.mocked(passoDimensoes).mockResolvedValue(dimResumo({ gravados: 4 }))
  vi.mocked(passoNormalizadores).mockResolvedValue(normResumo({ gravados: 2 }))
  vi.mocked(criteriosE11).mockResolvedValue({ provas: {}, avaliados: ['dimensoes', 'normalizadores'], desligados: [] })
  vi.mocked(criterioDesligados).mockResolvedValue([])
  vi.mocked(passoRetencao).mockResolvedValue(retResumo({ gravados: 3 }))
  vi.mocked(criteriosRetencao).mockResolvedValue(undefined)
  vi.mocked(criterioCobertura).mockResolvedValue({ acaoDoDono: [] })
  delete process.env.YT_OWN_STEPS_OFF
})
afterEach(() => {
  vi.useRealTimers()
  delete process.env.YT_OWN_STEPS_OFF
})

describe('rodarColeta', () => {
  it('os cinco passos nascem ligados', () => {
    expect(PASSOS_LIGADOS).toEqual({ metadados: true, jobs: true, relatorios: true, alcance: true, diario: true })
  })

  it('fase antes: lê todos os canais sem filtro e roda metadados e depois jobs, cada um com o seu teto', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    const ctxMeta = vi.mocked(passoMetadados).mock.calls[0]![0] as StepCtx
    const ctxJobs = vi.mocked(passoJobs).mock.calls[0]![0] as StepCtx
    expect(ctxMeta.channels.map(c => c.id)).toEqual(['ch-1', 'ch-2'])
    expect(ctxMeta.deadline - Date.now()).toBe(30_000)
    expect(ctxJobs.deadline - Date.now()).toBe(20_000)
    expect(vi.mocked(passoMetadados).mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(passoJobs).mock.invocationCallOrder[0]!)
    expect(criterioJobsEmErro).toHaveBeenCalledTimes(1)
    expect(passoRelatorios).not.toHaveBeenCalled()
    expect(r.falhas).toEqual([])
    expect(r.resumo).toMatchObject({ metadados: { gravados: 35 }, jobs: { acao_do_dono: ['Canal Um: sem_acesso'] }, acao_do_dono: ['Canal Um: sem_acesso'] })
  })

  it('fase depois: roda relatórios com 120 s, junta perdidos e atrasados, e confere o orçamento', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    const ctxRel = vi.mocked(passoRelatorios).mock.calls[0]![0] as StepCtx
    expect(ctxRel.deadline - Date.now()).toBe(120_000)
    expect(passoMetadados).not.toHaveBeenCalled()
    expect(passoJobs).not.toHaveBeenCalled()
    expect(r.resumo).toMatchObject({
      relatorios: { baixados: 3, perdidos: 2, atrasados: 0 },
      perdidos: 2,
      acao_do_dono: ['Canal Um: x em sem_acesso'],
      desconhecido: [],
    })
    expect(criterioOrcamento).toHaveBeenCalledWith(expect.anything(), ['meta', 'thumbnail', 'sondagem', 'relatorio', 'diario', 'dimensoes', 'normalizador_trafego', 'normalizador_alcance_dim', 'retencao_vida', 'retencao_7d', 'retencao_30d'])
  })

  it('fase depois: vazios_sem_publicacao do critério chega ao resumo; ausente vira lista vazia, e nunca entra em falhas', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const sem = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    expect(sem.resumo.vazios_sem_publicacao).toEqual([])

    vi.mocked(criteriosRelatorios).mockResolvedValue({ perdidos: 0, atrasados: 0, acao_do_dono: [], vazios_sem_publicacao: ['Canal Um'] })
    const com = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    expect(com.resumo.vazios_sem_publicacao).toEqual(['Canal Um'])
    expect(com.falhas).toEqual([])
  })

  it('fase depois com o resultado de metadados do antes: criterioMetadados recebe dia e dias_sem_meta', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    vi.mocked(criterioMetadados).mockResolvedValue({ desconhecido: ['Canal Dois'] })
    const r = await rodarColeta({
      supabase: db.client, relogio: criarRelogio(), fase: 'depois',
      metadadosAntes: { day_pt: '2026-10-06', dias_sem_meta: { 'ch-1': 0 } },
    })
    expect(vi.mocked(criterioMetadados).mock.calls[0]![1]).toEqual({ day_pt: '2026-10-06', dias_sem_meta: { 'ch-1': 0 } })
    expect(r.resumo.desconhecido).toEqual(['Canal Dois'])
  })

  it('fase depois sem o resultado do antes: dias_sem_meta vai vazio (tudo desconhecido), nunca zero', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    const meta = vi.mocked(criterioMetadados).mock.calls[0]![1]
    expect(meta.dias_sem_meta).toEqual({})
    expect(meta.day_pt).toBe('2026-10-06')
  })

  it('exceção num passo vira item de falhas e o passo seguinte roda', async () => {
    vi.mocked(passoMetadados).mockRejectedValue(new Error('statement timeout'))
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.falhas).toEqual(['metadados: database error'])
    expect(passoJobs).toHaveBeenCalledTimes(1)
  })

  it('exceção em relatórios: falha nomeada e os critérios ainda rodam', async () => {
    vi.mocked(passoRelatorios).mockRejectedValue(new Error('boom'))
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    expect(r.falhas).toEqual(['relatorios: unexpected error (Error)'])
    expect(criterioOrcamento).toHaveBeenCalledTimes(1)
    expect(criterioMetadados).toHaveBeenCalledTimes(1)
  })

  it('exceção num critério não impede os outros nem lança', async () => {
    vi.mocked(criterioOrcamento).mockRejectedValue(new Error('statement timeout'))
    vi.mocked(criteriosRelatorios).mockRejectedValue(new Error('statement timeout'))
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    expect(r.falhas).toEqual(['relatorios: database error', 'orçamento: database error'])
    expect(criterioMetadados).toHaveBeenCalledTimes(1)
  })

  it('exceção no critério de jobs em erro não derruba a fase antes', async () => {
    vi.mocked(criterioJobsEmErro).mockRejectedValue(new Error('statement timeout'))
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.falhas).toEqual(['jobs: database error'])
    expect(r.resumo.jobs).toBeDefined()
  })

  it('o que os passos põem em ctx.falhas sai no resultado, sem duplicar', async () => {
    vi.mocked(passoJobs).mockImplementation(async (c: StepCtx) => {
      c.falhas.push('schema_ausente: yt_reporting_jobs')
      return { ...resumoVazio, acao_do_dono: [], tipo_indisponivel: [], estados: {} }
    })
    vi.mocked(criterioJobsEmErro).mockImplementation(async (c) => { c.falhas.push('schema_ausente: yt_reporting_jobs') })
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.falhas).toEqual(['schema_ausente: yt_reporting_jobs'])
  })

  it('erro ao ler os canais: uma falha e nenhum passo novo nem critério roda', async () => {
    const db = fakeSupabase()
    db.errors.youtube_channels = { code: '57014', message: 'statement timeout' }
    for (const fase of ['antes', 'depois'] as const) {
      const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase })
      expect(r.falhas).toEqual(['erro de banco ao ler youtube_channels'])
    }
    expect(passoMetadados).not.toHaveBeenCalled()
    expect(passoJobs).not.toHaveBeenCalled()
    expect(passoRelatorios).not.toHaveBeenCalled()
    expect(criterioOrcamento).not.toHaveBeenCalled()
  })

  it('tabela de canais ausente: schema_ausente, sem lançar', async () => {
    const db = fakeSupabase()
    db.errors.youtube_channels = { code: '42P01', message: 'relation does not exist' }
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.falhas).toEqual(['schema_ausente: youtube_channels'])
  })

  it('relógio global estourado: relatórios não rodam, cada canal ativo vira nao_alcancado_orcamento, critérios rodam', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
    expect(passoRelatorios).not.toHaveBeenCalled()
    expect(r.resumo.relatorios).toMatchObject({ tentativas: { nao_alcancado_orcamento: 1 }, pendentes: 1, perdidos: 2 })
    // O passo `diario` (kind próprio) também fica sem tempo e grava a sua tentativa: aqui só interessa a do kind `relatorio`.
    const doRelatorio = db.tables.yt_own_collection_attempts!.filter(t => t.kind === 'relatorio')
    expect(doRelatorio).toHaveLength(1)
    expect(doRelatorio[0]).toMatchObject({ scope_type: 'canal', scope_id: 'ch-1', kind: 'relatorio', outcome: 'nao_alcancado_orcamento' })
    expect(criterioOrcamento).toHaveBeenCalledTimes(1)
  })

  it('relógio estourado na fase antes: metadados (todos os canais) e jobs (só ativos) não rodam', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 300_000), fase: 'antes' })
    expect(passoMetadados).not.toHaveBeenCalled()
    expect(passoJobs).not.toHaveBeenCalled()
    expect(r.resumo.metadados).toMatchObject({ tentativas: { nao_alcancado_orcamento: 2 }, pendentes: 2 })
    expect(r.resumo.jobs).toMatchObject({ tentativas: { nao_alcancado_orcamento: 1 }, pendentes: 1 })
    expect(db.tables.yt_own_collection_attempts!.map(t => t.kind).sort()).toEqual(['meta', 'meta', 'sondagem'])
  })

  it('restando 10 s de relógio, o passo de 60 s recebe 10 s', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 260_000), fase: 'depois' })
    const ctxRel = vi.mocked(passoRelatorios).mock.calls[0]![0] as StepCtx
    expect(ctxRel.deadline - Date.now()).toBe(10_000)
  })
})

describe('rodarColeta: L2 (alcance e diário)', () => {
  // vi.clearAllMocks não desfaz implementações: o critério de orçamento que um teste acima fez falhar voltaria a falhar aqui.
  beforeEach(() => {
    vi.mocked(criterioJobsEmErro).mockReset()
    vi.mocked(criterioOrcamento).mockReset()
  })

  const ordem = (f: unknown) => (f as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0]!

  it('fase depois: relatórios → alcance → critérios de relatórios → diário → critérios do L2, cada passo com o seu teto', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    const ctxAlcance = vi.mocked(passoAlcance).mock.calls[0]![0] as StepCtx
    const ctxDiario = vi.mocked(passoDiario).mock.calls[0]![0] as StepCtx
    expect(ctxAlcance.deadline - Date.now()).toBe(20_000)
    expect(ctxDiario.deadline - Date.now()).toBe(50_000)
    const seq = [passoRelatorios, passoAlcance, criteriosRelatorios, passoDiario, criteriosL2].map(ordem)
    expect(seq).toEqual([...seq].sort((a, b) => a - b))
    expect(new Set(seq).size).toBe(5)
    expect(r.resumo).toMatchObject({ alcance: { normalizados: 2 }, diario: { gravados: 9 } })
    expect(Object.keys(r.resumo.ms as object).sort()).toEqual(['alcance', 'cauda', 'diario', 'dimensoes', 'guarda', 'normalizadores', 'relatorios', 'retencao'])
    expect(r.falhas).toEqual([])
  })

  it('fase antes: alcance, diário e critérios do L2 não rodam', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(passoAlcance).not.toHaveBeenCalled()
    expect(passoDiario).not.toHaveBeenCalled()
    expect(criteriosL2).not.toHaveBeenCalled()
  })

  it('exceção em alcance: falha nomeada; diário, critérios de relatórios e critérios do L2 ainda rodam', async () => {
    vi.mocked(passoAlcance).mockRejectedValue(new Error('boom'))
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    expect(r.falhas).toEqual(['alcance: unexpected error (Error)'])
    expect(passoDiario).toHaveBeenCalledTimes(1)
    expect(criteriosRelatorios).toHaveBeenCalledTimes(1)
    expect(criteriosL2).toHaveBeenCalledTimes(1)
  })

  it('exceção em diário: falha nomeada; critérios do L2, de metadados e de orçamento ainda rodam', async () => {
    vi.mocked(passoDiario).mockRejectedValue(new Error('boom'))
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    expect(r.falhas).toEqual(['diario: unexpected error (Error)'])
    expect(criteriosL2).toHaveBeenCalledTimes(1)
    expect(criterioMetadados).toHaveBeenCalledTimes(1)
    expect(criterioOrcamento).toHaveBeenCalledTimes(1)
  })

  it('exceção nos critérios do L2: falha nomeada e o critério de orçamento ainda roda', async () => {
    vi.mocked(criteriosL2).mockRejectedValue(new Error('statement timeout'))
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    expect(r.falhas).toEqual(['critérios do L2: database error'])
    expect(criterioOrcamento).toHaveBeenCalledTimes(1)
  })

  it('relógio global vencido: diário não roda e vira nao_alcancado_orcamento só para o canal com sync; alcance não cria tentativa de relatório', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
    expect(passoAlcance).not.toHaveBeenCalled()
    expect(passoDiario).not.toHaveBeenCalled()
    const tentativas = db.tables.yt_own_collection_attempts ?? []
    const diario = tentativas.filter(t => t.kind === 'diario')
    expect(diario).toHaveLength(1)
    expect(diario[0]).toMatchObject({ scope_type: 'canal', scope_id: 'ch-1', outcome: 'nao_alcancado_orcamento' })
    // Só as do passo de relatórios (uma por canal ativo): o alcance, sem tempo, não grava nada.
    expect(tentativas.filter(t => t.kind === 'relatorio' && t.scope_type === 'canal')).toHaveLength(1)
    expect(r.resumo.alcance).toMatchObject({ sem_tempo: true, pendentes: 0 })
    expect(r.resumo.diario).toMatchObject({ tentativas: { nao_alcancado_orcamento: 1 }, pendentes: 1 })
  })

  it('o passo diário recebe todos os canais lidos (o filtro de sync_enabled é dele); o alcance também', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    const ctxDiario = vi.mocked(passoDiario).mock.calls[0]![0] as StepCtx
    expect(ctxDiario.channels.map(c => c.id)).toEqual(['ch-1', 'ch-2'])
    const ctxAlcance = vi.mocked(passoAlcance).mock.calls[0]![0] as StepCtx
    expect(ctxAlcance.channels.map(c => c.id)).toEqual(['ch-1', 'ch-2'])
  })
})

describe('rodarColeta: L1b', () => {
  const canalL1b = (extra: Record<string, unknown>) => ({ channel_id: 'UC1', site_id: 'site-1', sync_enabled: true, collection_status: 'ok', video_count: 0, ...extra })

  // vi.clearAllMocks não desfaz implementações: os critérios que testes acima fizeram falhar voltam a passar aqui.
  beforeEach(() => {
    vi.mocked(criterioJobsEmErro).mockReset()
    vi.mocked(criterioOrcamento).mockReset()
  })

  it('lê collection_status e video_count; resumo traz ms por passo e os canais em reautorizar', async () => {
    const db = fakeSupabase({
      youtube_channels: [
        canalL1b({ id: 'ch-1', name: 'Canal Um', collection_status: 'reautorizar' }),
        canalL1b({ id: 'ch-2', channel_id: 'UC2', name: 'Canal Dois' }),
      ],
    })
    vi.mocked(passoJobs).mockResolvedValue({ ...resumoVazio, acao_do_dono: [], tipo_indisponivel: [], estados: {} })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.resumo.reautorizar).toEqual(['ch-1'])
    expect(r.resumo.acao_do_dono).toContain('Canal Um: reautorizar')
    expect(Object.keys(r.resumo.ms as object).sort()).toEqual(['jobs', 'metadados'])
    for (const v of Object.values(r.resumo.ms as Record<string, number>)) expect(v).toBeGreaterThanOrEqual(0)
    const ctxMeta = vi.mocked(passoMetadados).mock.calls[0]![0] as StepCtx
    expect(ctxMeta.channels.map(c => [c.collection_status, c.video_count])).toEqual([['reautorizar', 0], ['ok', 0]])
  })

  it('canal que o YouTube diz ter vídeos e não tem nenhum cadastrado vai para acao_do_dono; canal vazio de verdade não', async () => {
    const db = fakeSupabase({
      youtube_channels: [
        canalL1b({ id: 'ch-1', name: 'Com Vídeos', video_count: 12 }),
        canalL1b({ id: 'ch-2', channel_id: 'UC2', name: 'Vazio', video_count: 0 }),
        canalL1b({ id: 'ch-3', channel_id: 'UC3', name: 'Desconhecido', video_count: null }),
      ],
      youtube_videos: [],
    })
    vi.mocked(passoJobs).mockResolvedValue({ ...resumoVazio, acao_do_dono: [], tipo_indisponivel: [], estados: {} })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.resumo.acao_do_dono).toEqual(['Com Vídeos: o YouTube informa 12 vídeo(s) e nenhum está cadastrado'])
  })

  it('canal com vídeos cadastrados não vira nota', async () => {
    const db = fakeSupabase({
      youtube_channels: [canalL1b({ id: 'ch-1', name: 'Com Vídeos', video_count: 12 })],
      youtube_videos: [{ id: 'v1', channel_id: 'ch-1' }],
    })
    vi.mocked(passoJobs).mockResolvedValue({ ...resumoVazio, acao_do_dono: [], tipo_indisponivel: [], estados: {} })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.resumo.acao_do_dono).toEqual([])
  })

  it('leitura de youtube_videos falhando: nota de falha de leitura e NENHUMA nota "o YouTube informa…" (não sei não é zero)', async () => {
    const db = fakeSupabase({ youtube_channels: [canalL1b({ id: 'ch-1', name: 'Com Vídeos', video_count: 12 })] })
    db.errors.youtube_videos = { code: '57014', message: 'statement timeout' }
    vi.mocked(passoJobs).mockResolvedValue({ ...resumoVazio, acao_do_dono: [], tipo_indisponivel: [], estados: {} })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.falhas).toEqual(['erro de banco ao ler youtube_videos'])
    expect(r.resumo.acao_do_dono).toEqual([])
  })

  it('contagem de youtube_videos que volta nula sem erro: ausente não é zero — nenhuma nota "o YouTube informa…", e a falha de contagem ausente', async () => {
    const db = fakeSupabase({ youtube_channels: [canalL1b({ id: 'ch-1', name: 'Com Vídeos', video_count: 12 })], youtube_videos: [] })
    const cliente = {
      ...db.client,
      from: (tabela: string) => {
        if (tabela !== 'youtube_videos') return db.client.from(tabela)
        return { select: () => ({ eq: async () => ({ data: null, error: null, count: null }) }) }
      },
    } as unknown as SupabaseClient
    vi.mocked(passoJobs).mockResolvedValue({ ...resumoVazio, acao_do_dono: [], tipo_indisponivel: [], estados: {} })
    const r = await rodarColeta({ supabase: cliente, relogio: criarRelogio(), fase: 'antes' })
    expect(r.resumo.acao_do_dono).toEqual([])
    expect(r.falhas).toEqual(['critérios: não foi possível avaliar canais sem vídeos cadastrados (youtube_videos): contagem ausente'])
  })

  /** Cliente fino em volta do banco em memória: a leitura de canais que pede `collection_status` devolve 42703, como o Postgres sem a migration. */
  const semColunaNova = (db: FakeDb, selects: string[] = []): SupabaseClient => ({
    ...db.client,
    from: (tabela: string) => {
      const q = db.client.from(tabela)
      if (tabela !== 'youtube_channels') return q
      const select = q.select.bind(q)
      q.select = ((cols?: string, o?: never) => {
        selects.push(cols ?? '*')
        if (!(cols ?? '').includes('collection_status')) return select(cols, o)
        return Promise.resolve({ data: null, error: { code: '42703', message: 'column youtube_channels.collection_status does not exist' }, count: null }) as never
      }) as typeof q.select
      return q
    },
  }) as unknown as SupabaseClient

  it('migration não aplicada (coluna collection_status ausente): schema_ausente, relê sem as colunas novas e os passos rodam com os canais em ok', async () => {
    // Linhas como o banco de antes da migration: sem collection_status e sem video_count.
    const db = fakeSupabase({ youtube_channels: canais })
    const selects: string[] = []
    vi.mocked(passoJobs).mockResolvedValue({ ...resumoVazio, acao_do_dono: [], tipo_indisponivel: [], estados: {} })
    const r = await rodarColeta({ supabase: semColunaNova(db, selects), relogio: criarRelogio(), fase: 'antes' })
    expect(r.falhas).toEqual(['schema_ausente: youtube_channels'])
    expect(selects).toEqual([
      'id, channel_id, site_id, name, sync_enabled, collection_status, video_count',
      'id, channel_id, site_id, name, sync_enabled',
    ])
    const ctxMeta = vi.mocked(passoMetadados).mock.calls[0]![0] as StepCtx
    expect(ctxMeta.channels.map(c => [c.id, c.collection_status, c.video_count])).toEqual([['ch-1', 'ok', null], ['ch-2', 'ok', null]])
    expect(passoJobs).toHaveBeenCalledTimes(1)
    expect(r.resumo.reautorizar).toEqual([])
    expect(r.resumo.acao_do_dono).toEqual([])
  })

  it('coluna ausente na fase depois: a mesma falha, e relatórios e critérios rodam', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: semColunaNova(db), relogio: criarRelogio(), fase: 'depois' })
    expect(r.falhas).toEqual(['schema_ausente: youtube_channels'])
    expect(passoRelatorios).toHaveBeenCalledTimes(1)
    expect(criterioOrcamento).toHaveBeenCalledTimes(1)
  })

  it('as duas leituras de canais falham: schema_ausente e nenhum passo novo roda', async () => {
    const db = fakeSupabase({ youtube_channels: [] })
    db.errors.youtube_channels = { code: '42703', message: 'column youtube_channels.collection_status does not exist' }
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.falhas).toEqual(['schema_ausente: youtube_channels'])
    expect(r.resumo).toEqual({})
    expect(passoMetadados).not.toHaveBeenCalled()
    expect(passoJobs).not.toHaveBeenCalled()
  })

  it('coluna ausente e a segunda leitura falha por outro motivo: as duas falhas ficam visíveis e nenhum passo roda', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const cliente = semColunaNova(db)
    db.errors.youtube_channels = { code: '57014', message: 'statement timeout' }
    const r = await rodarColeta({ supabase: cliente, relogio: criarRelogio(), fase: 'antes' })
    expect(r.falhas).toEqual(['schema_ausente: youtube_channels', 'erro de banco ao ler youtube_channels'])
    expect(passoMetadados).not.toHaveBeenCalled()
  })

  it('fase depois: ms dos passos relatorios, alcance e diario; reautorizar e a nota somam ao acao_do_dono do critério', async () => {
    const db = fakeSupabase({ youtube_channels: [canalL1b({ id: 'ch-1', name: 'Canal Um', collection_status: 'reautorizar' })] })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    expect(Object.keys(r.resumo.ms as object).sort()).toEqual(['alcance', 'cauda', 'diario', 'dimensoes', 'guarda', 'normalizadores', 'relatorios', 'retencao'])
    expect(r.resumo.reautorizar).toEqual(['ch-1'])
    expect(r.resumo.acao_do_dono).toEqual(['Canal Um: x em sem_acesso', 'Canal Um: reautorizar'])
  })
  describe('volta a ok, uma vez, no fim da fase depois', () => {
    const emReautorizar = () => fakeSupabase({ youtube_channels: [canalL1b({ id: 'ch-1', name: 'Canal Um', collection_status: 'reautorizar' })] })
    const estado = (db: FakeDb) => db.tables.youtube_channels![0]!.collection_status
    beforeEach(() => {
      vi.mocked(criteriosRelatorios).mockResolvedValue({ perdidos: 0, atrasados: 0, acao_do_dono: [] })
    })

    it('canal em reautorizar com uma chamada autenticada que passou e nenhuma negada: vira ok e some de reautorizar e de acao_do_dono', async () => {
      const db = emReautorizar()
      const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois', autorizadosAntes: ['ch-1'] })
      expect(estado(db)).toBe('ok')
      expect(r.resumo.reautorizar).toEqual([])
      expect(r.resumo.acao_do_dono).toEqual([])
      expect(r.resumo.autorizados).toEqual(['ch-1'])
      expect(r.resumo.negados).toEqual([])
      expect(r.falhas).toEqual([])
    })

    it('o mesmo canal, mas negado em algum ponto da execução: CONTINUA reautorizar e a nota fica em acao_do_dono', async () => {
      const db = emReautorizar()
      const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois', autorizadosAntes: ['ch-1'], negadosAntes: ['ch-1'] })
      expect(estado(db)).toBe('reautorizar')
      expect(db.writes.filter(w => w.table === 'youtube_channels')).toEqual([])
      expect(r.resumo.reautorizar).toEqual(['ch-1'])
      expect(r.resumo.acao_do_dono).toEqual(['Canal Um: reautorizar'])
      expect(r.resumo.negados).toEqual(['ch-1'])
    })

    it('canal em reautorizar sem nenhum sucesso na execução: continua', async () => {
      const db = emReautorizar()
      const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
      expect(estado(db)).toBe('reautorizar')
      expect(r.resumo.reautorizar).toEqual(['ch-1'])
      expect(r.resumo.acao_do_dono).toEqual(['Canal Um: reautorizar'])
    })

    it('negação registrada pelo passo de relatórios da própria fase depois também segura o canal', async () => {
      const db = emReautorizar()
      vi.mocked(passoRelatorios).mockImplementation(async (c: StepCtx) => {
        c.negados!.add('ch-1')
        return { ...resumoVazio, vistos: 0, baixados: 0, vazios: 0, expirados: 0, erros_download: 0, bruto_apagado: 0 }
      })
      const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois', autorizadosAntes: ['ch-1'] })
      expect(estado(db)).toBe('reautorizar')
      expect(r.resumo.reautorizar).toEqual(['ch-1'])
    })

    it('a fase antes nunca devolve o canal a ok, mesmo com sucesso: só registra e devolve os dois conjuntos', async () => {
      const db = emReautorizar()
      vi.mocked(passoMetadados).mockImplementation(async (c: StepCtx) => {
        c.autorizados!.add('ch-1')
        return { ...resumoVazio, gravados: 1, day_pt: '2026-10-06', dias_sem_meta: {}, sem_privacidade: 0, sem_is_short: 0 }
      })
      vi.mocked(passoJobs).mockImplementation(async (c: StepCtx) => {
        c.negados!.add('ch-9')
        return { ...resumoVazio, acao_do_dono: [], tipo_indisponivel: [], estados: {} }
      })
      const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
      expect(estado(db)).toBe('reautorizar')
      expect(r.resumo.autorizados).toEqual(['ch-1'])
      expect(r.resumo.negados).toEqual(['ch-9'])
      expect(r.resumo.reautorizar).toEqual(['ch-1'])
    })

    it('canal em ok com sucesso registrado: nenhuma gravação de estado', async () => {
      const db = fakeSupabase({ youtube_channels: [canalL1b({ id: 'ch-1', name: 'Canal Um' })] })
      await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois', autorizadosAntes: ['ch-1'] })
      expect(db.writes.filter(w => w.table === 'youtube_channels')).toEqual([])
    })
  })
  describe('conferências com data (item 246)', () => {
    /** Dia de São Paulo `n` dias antes do AGORA do arquivo (2026-10-07). */
    const haDias = (n: number): string => new Date(AGORA.getTime() - n * 86_400_000).toISOString().slice(0, 10)
    const conf = (id: string, data: string, feitaEm: string | null = null) => ({ id, etapa: 'ET', data, responsavel: 'agente' as const, onde: 'plano', feitaEm })
    const rodar = (fase: 'antes' | 'depois' = 'depois') =>
      rodarColeta({ supabase: fakeSupabase({ youtube_channels: canais }).client, relogio: criarRelogio(), fase })

    it('lista vazia: o campo existe e é lista vazia', async () => {
      const r = await rodar()
      expect(r.resumo.conferencias_vencidas).toEqual([])
      expect(r.falhas).toEqual([])
    })

    it('vencida há até 7 dias: aparece no resumo, com o nome, e o cron não fica vermelho; a feita e a de amanhã ficam fora', async () => {
      conferenciasDeTeste.push(conf('vencida-1d', haDias(1)), conf('vencida-7d', haDias(7)), conf('feita', haDias(30), haDias(2)), conf('hoje', haDias(0)), conf('futura', haDias(-3)))
      const r = await rodar()
      expect(r.resumo.conferencias_vencidas).toEqual([`vencida-1d (ET, ${haDias(1)}, agente)`, `vencida-7d (ET, ${haDias(7)}, agente)`])
      expect(r.falhas).toEqual([])
    })

    it('vencida há 8 dias ou mais: entra no resumo E em falhas, com o nome e o que fazer; a de 7 dias continua só no resumo', async () => {
      conferenciasDeTeste.push(conf('de-7-dias', haDias(7)), conf('de-8-dias', haDias(8)), conf('de-40-dias', haDias(40)))
      const r = await rodar()
      expect(r.resumo.conferencias_vencidas).toEqual([`de-7-dias (ET, ${haDias(7)}, agente)`, `de-8-dias (ET, ${haDias(8)}, agente)`, `de-40-dias (ET, ${haDias(40)}, agente)`])
      expect(r.falhas).toEqual([
        `conferências vencidas há mais de 7 dias: 2 (de-8-dias, devida em ${haDias(8)}; de-40-dias, devida em ${haDias(40)}): faça a conferência, anote no ledger e preencha feitaEm em apps/web/src/lib/conferencias.ts (runbook da coleta, seção 6, "Conferências com data")`,
      ])
    })

    it('a nota de conferência é SEMPRE a última de falhas: as falhas reais vêm na frente (ela mascara o aviso do vigia, que deduplica por estado)', async () => {
      conferenciasDeTeste.push(conf('de-9-dias', haDias(9)))
      vi.mocked(passoRelatorios).mockRejectedValue(new Error('boom'))
      vi.mocked(criterioOrcamento).mockImplementation(async ({ falhas }) => { falhas.push('orçamento: o passo diario ficou sem tempo') })
      const db = fakeSupabase({ youtube_channels: canais, yt_reporting_reports: [{ report_id: 'r1', status: 'baixado', downloaded_at: '2026-10-01T12:00:00.000Z' }] })
      const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
      expect(r.falhas.length).toBe(4)
      expect(r.falhas.slice(0, 3).some(f => f.startsWith('conferências vencidas'))).toBe(false)
      expect(r.falhas.at(-1)).toMatch(/^conferências vencidas há mais de 7 dias: 1 \(de-9-dias,/)
      expect(r.falhas.indexOf('orçamento: o passo diario ficou sem tempo')).toBeLessThan(r.falhas.length - 1)
    })

    it('marcada como feita, a conferência de 40 dias some do resumo e do vermelho', async () => {
      conferenciasDeTeste.push(conf('de-40-dias', haDias(40), haDias(0)))
      const r = await rodar()
      expect(r.resumo.conferencias_vencidas).toEqual([])
      expect(r.falhas).toEqual([])
    })

    it('o dia é o de São Paulo: às 02:00 UTC do dia seguinte ainda é o dia anterior (a conferência de ontem em SP ainda não venceu)', async () => {
      vi.setSystemTime(new Date('2026-10-08T02:00:00.000Z'))   // 23:00 de 07/10 em São Paulo
      conferenciasDeTeste.push(conf('de-07-10', '2026-10-07'))
      expect((await rodar()).resumo.conferencias_vencidas).toEqual([])
      vi.setSystemTime(new Date('2026-10-08T03:00:00.000Z'))   // 00:00 de 08/10
      expect((await rodar()).resumo.conferencias_vencidas).toEqual(['de-07-10 (ET, 2026-10-07, agente)'])
    })

    it('a fase antes não traz o campo (ele é da fase depois, que fecha a execução)', async () => {
      conferenciasDeTeste.push(conf('vencida-9d', haDias(9)))
      const r = await rodar('antes')
      expect(r.resumo).not.toHaveProperty('conferencias_vencidas')
      expect(r.falhas).toEqual([])
    })
  })
  describe('guarda do bruto conferida em toda execução (E20, MG13)', () => {
    const baixado = { report_id: 'r1', status: 'baixado', downloaded_at: '2026-10-01T12:00:00.000Z' }
    const comBruto = (extra: Record<string, Array<Record<string, unknown>>> = {}) => fakeSupabase({
      youtube_channels: canais, yt_reporting_reports: [baixado], yt_reporting_report_blobs: [{ report_id: 'r1', site_id: 'site-1', csv_gz: '\\x00' }], ...extra,
    })

    it('fase depois: resumo.guarda traz números; sem execução anterior a base é nula; nenhuma falha', async () => {
      const r = await rodarColeta({ supabase: comBruto().client, relogio: criarRelogio(), fase: 'depois' })
      expect(r.resumo.guarda).toEqual({
        blobs_guardados: 1, blobs_guardados_ao_abrir: 1, blobs_guardados_antes: null, baixados_sem_bruto: 0, brutos_sem_baixado: 0, perdas_reconhecidas: 0, expirados_sem_registro: 0,
      })
      expect(r.falhas).toEqual([])
    })

    it('com o passo de relatórios SEM TEMPO a conferência roda do mesmo jeito (não está dentro do passo)', async () => {
      const r = await rodarColeta({ supabase: comBruto().client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
      expect(passoRelatorios).not.toHaveBeenCalled()
      expect(r.resumo.guarda).toMatchObject({ blobs_guardados: 1, baixados_sem_bruto: 0 })
    })

    it('com o passo de relatórios LANÇANDO a conferência roda do mesmo jeito', async () => {
      vi.mocked(passoRelatorios).mockRejectedValue(new Error('boom'))
      const r = await rodarColeta({ supabase: comBruto().client, relogio: criarRelogio(), fase: 'depois' })
      expect(r.falhas).toEqual(['relatorios: unexpected error (Error)'])
      expect(r.resumo.guarda).toMatchObject({ blobs_guardados: 1 })
    })

    it('baixado sem bruto: falha na execução, com o resumo preenchido', async () => {
      const db = fakeSupabase({ youtube_channels: canais, yt_reporting_reports: [baixado] })
      const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
      expect(r.resumo.guarda).toMatchObject({ blobs_guardados: 0, baixados_sem_bruto: 1 })
      expect(r.falhas).toEqual(['relatórios: 1 relatório(s) baixado(s) estão sem o bruto guardado (1 baixados, 0 brutos): liste e resolva pela seção 13 do runbook da coleta (devolver à fila ou reconhecer a perda)'])
    })

    it('queda contra a última execução gravada: falha de um dia, com os dois números', async () => {
      const db = comBruto({ yt_own_collection_runs: [{ ran_at: '2026-10-06T12:02:00.000Z', resumo: { guarda: { blobs_guardados: 4 } } }] })
      const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
      expect(r.resumo.guarda).toMatchObject({ blobs_guardados: 1, blobs_guardados_antes: 4 })
      expect(r.falhas).toEqual(['relatórios: os brutos guardados caíram de 4 para 1 desde a última execução conferida: canal próprio removido ou perda (confira qual)'])
    })

    it('a conferência LANÇA: nota em falhas, Sentry avisado, rodarColeta não lança e o resto da execução segue', async () => {
      const db = comBruto()
      db.rpcHandlers.yt_reporting_guarda_conferir = () => { throw new Error('x') }
      const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
      expect(r.falhas).toEqual(['guarda do bruto: unexpected error (Error)', 'relatórios: guarda do bruto não conferida (a conferência lançou)'])
      expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), { tags: { cron: 'sync-analytics-metrics', passo: 'guarda do bruto' } })
      expect(r.resumo).not.toHaveProperty('guarda')
      expect(criterioOrcamento).toHaveBeenCalledTimes(1)
    })

    it('a função do banco NÃO RESPONDE: o prazo próprio corta em GUARDA_PRAZO_MS, vira nota e a execução termina', async () => {
      vi.useRealTimers()
      vi.useFakeTimers({ now: AGORA, toFake: ['Date', 'setTimeout', 'clearTimeout'] })   // este teste precisa do setTimeout falso: o do arquivo só falsifica Date
      const db = comBruto()
      db.rpcHandlers.yt_reporting_guarda_conferir = () => new Promise<never>(() => {})
      const andamento = rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
      for (let i = 0; i < 5000 && vi.getTimerCount() === 0; i++) await Promise.resolve()   // até a conferência armar o prazo (só microtarefas)
      expect(vi.getTimerCount()).toBe(1)
      await vi.advanceTimersByTimeAsync(GUARDA_PRAZO_MS - 1)
      expect(criterioOrcamento).not.toHaveBeenCalled()   // ainda esperando a conferência, que é a única coisa pendente
      await vi.advanceTimersByTimeAsync(1)
      const r = await andamento
      expect(r.falhas).toEqual([`relatórios: guarda do bruto não conferida (passou do prazo de ${GUARDA_PRAZO_MS} ms)`])
      expect(r.resumo.guarda).toMatchObject({ blobs_guardados: null, baixados_sem_bruto: null })
      expect(criterioOrcamento).toHaveBeenCalledTimes(1)
    })

    describe('queda contada ANTES dos downloads do dia (I2 da revisão final) e o tempo da guarda (M-8)', () => {
      const relatorio = (i: number) => ({ report_id: `r${i}`, status: 'baixado', downloaded_at: '2026-10-01T12:00:00.000Z' })
      const blob = (i: number) => ({ report_id: `r${i}`, site_id: 'site-1', csv_gz: '\\x00' })
      const faixa = (de: number, ate: number) => Array.from({ length: ate - de }, (_, k) => de + k)

      it('cenário do revisor de ponta a ponta: ontem 160, entre as execuções somem 10 (relatório e bruto juntos), o passo baixa 26: acusa a queda de 160 para 150', async () => {
        const db = fakeSupabase({
          youtube_channels: canais,
          yt_reporting_reports: faixa(10, 160).map(relatorio),   // a cascata levou 0..9 antes desta execução abrir
          yt_reporting_report_blobs: faixa(10, 160).map(blob),
          yt_own_collection_runs: [{ ran_at: '2026-10-06T12:02:00.000Z', resumo: { guarda: { blobs_guardados: 160 } } }],
        })
        vi.mocked(passoRelatorios).mockImplementation(async () => {
          db.tables.yt_reporting_reports!.push(...faixa(200, 226).map(relatorio))   // o passo baixa 26
          db.tables.yt_reporting_report_blobs!.push(...faixa(200, 226).map(blob))
          return { ...resumoVazio, baixados: 26 }
        })
        const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
        expect(r.resumo.guarda).toMatchObject({ blobs_guardados: 176, blobs_guardados_ao_abrir: 150, blobs_guardados_antes: 160, baixados_sem_bruto: 0 })
        expect(r.falhas).toEqual(['relatórios: os brutos guardados caíram de 160 para 150 desde a última execução conferida: canal próprio removido ou perda (confira qual)'])
      })

      it('sem perda, com a entrada do dia: verde (a abertura é igual à base)', async () => {
        const db = fakeSupabase({
          youtube_channels: canais,
          yt_reporting_reports: faixa(0, 160).map(relatorio),
          yt_reporting_report_blobs: faixa(0, 160).map(blob),
          yt_own_collection_runs: [{ ran_at: '2026-10-06T12:02:00.000Z', resumo: { guarda: { blobs_guardados: 160 } } }],
        })
        vi.mocked(passoRelatorios).mockImplementation(async () => {
          db.tables.yt_reporting_reports!.push(...faixa(200, 226).map(relatorio))
          db.tables.yt_reporting_report_blobs!.push(...faixa(200, 226).map(blob))
          return { ...resumoVazio, baixados: 26 }
        })
        const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
        expect(r.resumo.guarda).toMatchObject({ blobs_guardados: 186, blobs_guardados_ao_abrir: 160, blobs_guardados_antes: 160 })
        expect(r.falhas).toEqual([])
      })

      it('a contagem de abertura roda ANTES do passo de relatórios (uma leitura dos brutos quando o passo começa)', async () => {
        const db = comBruto()
        let leiturasNoPasso = -1
        vi.mocked(passoRelatorios).mockImplementation(async () => {
          leiturasNoPasso = db.leituras.yt_reporting_report_blobs ?? 0
          return { ...resumoVazio }
        })
        await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
        expect(leiturasNoPasso).toBe(1)
      })

      it('a contagem de abertura falha: nota, a guarda segue e a queda é comparada com o total do fim', async () => {
        const db = comBruto({ yt_own_collection_runs: [{ ran_at: '2026-10-06T12:02:00.000Z', resumo: { guarda: { blobs_guardados: 4 } } }] })
        db.erroNaLeitura = (tabela) => (tabela === 'yt_reporting_report_blobs' ? { code: '57014', message: 'statement timeout' } : undefined)
        const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
        expect(r.resumo.guarda).toMatchObject({ blobs_guardados: 1, blobs_guardados_ao_abrir: null, blobs_guardados_antes: 4 })
        expect(r.falhas).toEqual([
          'erro de banco ao ler yt_reporting_report_blobs',
          'relatórios: brutos não contados antes do passo de relatórios; a queda de hoje foi comparada só depois dos downloads',
          'relatórios: os brutos guardados caíram de 4 para 1 desde a última execução conferida: canal próprio removido ou perda (confira qual)',
        ])
      })

      it('a contagem de abertura LANÇA: Sentry avisado, nota, e a execução segue até o fim', async () => {
        const db = comBruto()
        const original = db.client.from.bind(db.client)
        db.client.from = ((tabela: string) => {
          if (tabela === 'yt_reporting_report_blobs') throw new Error('x')
          return original(tabela)
        }) as typeof db.client.from
        const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
        expect(r.falhas).toContain('guarda do bruto (abertura): unexpected error (Error)')
        expect(r.falhas).toContain('relatórios: brutos não contados antes do passo de relatórios; a queda de hoje foi comparada só depois dos downloads')
        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), { tags: { cron: 'sync-analytics-metrics', passo: 'guarda do bruto (abertura)' } })
        expect(criterioOrcamento).toHaveBeenCalledTimes(1)
        expect(passoRelatorios).toHaveBeenCalledTimes(1)
      })

      it('o tempo da guarda (abertura + fim) é gravado em ms.guarda; a fase antes não o grava', async () => {
        const depois = await rodarColeta({ supabase: comBruto().client, relogio: criarRelogio(), fase: 'depois' })
        expect(typeof (depois.resumo.ms as Record<string, unknown>).guarda).toBe('number')
        const antes = await rodarColeta({ supabase: comBruto().client, relogio: criarRelogio(), fase: 'antes' })
        expect(antes.resumo.ms).not.toHaveProperty('guarda')
      })
    })

    it('a fase antes não confere a guarda', async () => {
      const db = comBruto()
      const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
      expect(r.resumo).not.toHaveProperty('guarda')
      expect(db.rpcCalls.map(c => c.name)).not.toContain('yt_reporting_guarda_conferir')
    })

    it('as duas saídas sem a guarda (G2), ambas já vermelhas: a leitura de youtube_channels falha; o executar lança', async () => {
      const lerFalha = fakeSupabase()
      lerFalha.errors.youtube_channels = { code: '57014', message: 'statement timeout' }
      const a = await rodarColeta({ supabase: lerFalha.client, relogio: criarRelogio(), fase: 'depois' })
      expect(a.falhas).toEqual(['erro de banco ao ler youtube_channels'])
      expect(a.resumo).not.toHaveProperty('guarda')
      expect(lerFalha.rpcCalls.map(c => c.name)).not.toContain('yt_reporting_guarda_conferir')

      // O que escapa dos try internos cai na rede de segurança de rodarColeta: um getter que lança, depois da leitura dos canais.
      const lanca = fakeSupabase({ youtube_channels: canais })
      const b = await rodarColeta({
        supabase: lanca.client, relogio: criarRelogio(), fase: 'depois',
        get autorizadosAntes(): string[] { throw new Error('fora dos try') },
      })
      expect(b.falhas).toEqual(['coleta: unexpected error (Error)'])
      expect(b.resumo).not.toHaveProperty('guarda')
    })
  })
})

describe('rodarColeta: E11 (dimensões e normalizadores)', () => {
  // vi.clearAllMocks não desfaz implementações: o que um teste de cima fez falhar voltaria a falhar aqui.
  beforeEach(() => {
    vi.mocked(criterioJobsEmErro).mockReset()
    vi.mocked(criterioOrcamento).mockReset()
  })

  const ordem = (f: unknown) => (f as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0]!
  const rodar = (extra: Partial<Parameters<typeof rodarColeta>[0]> = {}, canaisDb: unknown[] = canais) =>
    rodarColeta({ supabase: fakeSupabase({ youtube_channels: canaisDb as never }).client, relogio: criarRelogio(), fase: 'depois', ...extra })

  it('ordem: diário → dimensões → normalizadores → critérios do L2 → critérios da E11 → desligados → metadados → orçamento', async () => {
    const r = await rodar()
    const seq = [passoDiario, passoDimensoes, passoNormalizadores, criteriosL2, criteriosE11, criterioDesligados, criterioMetadados, criterioOrcamento].map(ordem)
    expect(seq).toEqual([...seq].sort((a, b) => a - b))
    expect(new Set(seq).size).toBe(8)
    expect(r.falhas).toEqual([])
  })

  it('cada passo recebe o seu teto de fim; dimensões recebe a configuração padrão e o dia do Pacífico', async () => {
    await rodar()
    const d = vi.mocked(passoDimensoes).mock.calls[0]![0]
    const n = vi.mocked(passoNormalizadores).mock.calls[0]![0]
    expect(d.deadline - Date.now()).toBe(30_000)
    expect(n.deadline - Date.now()).toBe(20_000)
    expect(d.e11).toEqual({ desde: DIMENSOES_DESDE, ligadoEm: DIMENSOES_LIGADO_EM })
    expect(d.hoje).toBe('2026-10-07')
    expect(d.channels.map(c => c.id)).toEqual(['ch-1', 'ch-2'])
  })

  it('o resumo leva dimensoes, normalizadores e e11 (provas, avaliados, desligados) e os tempos dos dois passos', async () => {
    vi.mocked(criteriosE11).mockResolvedValue({ provas: { 'site-1': null }, avaliados: [], desligados: [] })
    const r = await rodar()
    expect(r.resumo).toMatchObject({
      dimensoes: { gravados: 4 }, normalizadores: { gravados: 2 },
      e11: { provas: { 'site-1': null }, avaliados: [], desligados: [] },
    })
    expect(Object.keys(r.resumo.ms as object)).toEqual(expect.arrayContaining(['dimensoes', 'normalizadores']))
  })

  it('ctx.e11 sobrescreve o padrão, nos passos e nos critérios', async () => {
    const e11 = { desde: '2026-10-01', ligadoEm: '2026-10-03' }
    await rodar({ e11 })
    expect(vi.mocked(passoDimensoes).mock.calls[0]![0].e11).toEqual(e11)
    expect(vi.mocked(criteriosE11).mock.calls[0]![0].e11).toEqual(e11)
  })

  it('o dia dos critérios e do passo é o do PACÍFICO, não o de São Paulo: na virada de São Paulo ainda é o dia anterior', async () => {
    // 05:00 UTC de 08/10: em São Paulo já é 02:00 de 08/10; no Pacífico (UTC-7) ainda são 22:00 de 07/10.
    vi.setSystemTime(new Date('2026-10-08T05:00:00.000Z'))
    await rodar()
    expect(vi.mocked(passoDimensoes).mock.calls[0]![0].hoje).toBe('2026-10-07')
    expect(vi.mocked(criteriosE11).mock.calls[0]![0].hoje).toBe('2026-10-07')
    // 07:30 UTC: virou no Pacífico também.
    vi.setSystemTime(new Date('2026-10-08T07:30:00.000Z'))
    await rodar()
    expect(vi.mocked(criteriosE11).mock.calls[1]![0].hoje).toBe('2026-10-08')
    expect(vi.mocked(passoDimensoes).mock.calls[1]![0].hoje).toBe('2026-10-08')
  })

  it('os critérios da E11 recebem o site dos canais ligados (sem repetir) e os dois passos ligados', async () => {
    const tres = [
      { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Um', sync_enabled: true },
      { id: 'ch-2', channel_id: 'UC2', site_id: 'site-1', name: 'Dois', sync_enabled: true },
      { id: 'ch-3', channel_id: 'UC3', site_id: 'site-2', name: 'Três', sync_enabled: true },
      { id: 'ch-4', channel_id: 'UC4', site_id: 'site-9', name: 'Quatro', sync_enabled: false },
    ]
    await rodar({}, tres)
    const c = vi.mocked(criteriosE11).mock.calls[0]![0]
    expect(c.sites).toEqual(['site-1', 'site-2'])
    expect(c.desligados).toEqual({ dimensoes: false, normalizadores: false })
    expect(c.falhas).toBeDefined()
  })

  it('sem nenhum canal ligado (ou nenhum canal): os critérios da E11 NÃO rodam, para não acusar "nenhum site" para sempre', async () => {
    const r1 = await rodar({}, [{ ...canais[0]!, sync_enabled: false }])
    const r2 = await rodar({}, [])
    expect(criteriosE11).not.toHaveBeenCalled()
    expect(r1.falhas).toEqual([])
    expect(r2.falhas).toEqual([])
    expect(r1.resumo.e11).toBeUndefined()
    // Os outros critérios continuam.
    expect(criterioOrcamento).toHaveBeenCalledTimes(2)
    expect(criterioMetadados).toHaveBeenCalledTimes(2)
  })

  it('YT_OWN_STEPS_OFF=dimensoes: o passo não é chamado, o resumo diz desligado, e o nome vai a criterioDesligados e aos critérios', async () => {
    process.env.YT_OWN_STEPS_OFF = 'dimensoes'
    const r = await rodar()
    expect(passoDimensoes).not.toHaveBeenCalled()
    expect(passoNormalizadores).toHaveBeenCalledTimes(1)
    expect(r.resumo.dimensoes).toEqual({ desligado: true })
    expect(vi.mocked(criterioDesligados).mock.calls[0]![1]).toEqual(['dimensoes'])
    expect(vi.mocked(criteriosE11).mock.calls[0]![0].desligados).toEqual({ dimensoes: true, normalizadores: false })
    // Nenhuma tentativa foi gravada para um passo desligado.
    expect(vi.mocked(passoDimensoes).mock.calls).toHaveLength(0)
  })

  it('os dois desligados (com espaço e maiúscula): nenhum passo roda, os dois nomes vão a criterioDesligados', async () => {
    process.env.YT_OWN_STEPS_OFF = ' Dimensoes , NORMALIZADORES '
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    expect(passoDimensoes).not.toHaveBeenCalled()
    expect(passoNormalizadores).not.toHaveBeenCalled()
    expect(r.resumo.dimensoes).toEqual({ desligado: true })
    expect(r.resumo.normalizadores).toEqual({ desligado: true })
    expect(vi.mocked(criterioDesligados).mock.calls[0]![1]).toEqual(['dimensoes', 'normalizadores'])
    expect((db.tables.yt_own_collection_attempts ?? []).filter(t => ['dimensoes', 'normalizador_trafego', 'normalizador_alcance_dim'].includes(t.kind as string))).toEqual([])
    expect(r.falhas).toEqual([])
  })

  it('sem a variável (apagada): os dois passos rodam e criterioDesligados recebe lista vazia', async () => {
    delete process.env.YT_OWN_STEPS_OFF
    const r = await rodar()
    expect(passoDimensoes).toHaveBeenCalledTimes(1)
    expect(passoNormalizadores).toHaveBeenCalledTimes(1)
    expect(vi.mocked(criterioDesligados).mock.calls[0]![1]).toEqual([])
    expect(r.resumo.dimensoes).not.toHaveProperty('desligado')
  })

  it('o interruptor vale mesmo sem canal ligado (o resumo registra o desligado)', async () => {
    process.env.YT_OWN_STEPS_OFF = 'normalizadores'
    const r = await rodar({}, [])
    expect(r.resumo.normalizadores).toEqual({ desligado: true })
    expect(vi.mocked(criterioDesligados).mock.calls[0]![1]).toEqual(['normalizadores'])
  })

  it('as notas de passo desligado (não vermelhas) de criterioDesligados vão para acao_do_dono, sem duplicar', async () => {
    process.env.YT_OWN_STEPS_OFF = 'dimensoes'
    vi.mocked(criterioDesligados).mockResolvedValue(['dimensoes: passo desligado por YT_OWN_STEPS_OFF (há 2 execuções)'])
    vi.mocked(criteriosRelatorios).mockResolvedValue({ perdidos: 0, atrasados: 0, acao_do_dono: ['Canal Um: x'] })
    const r = await rodar()
    expect(r.resumo.acao_do_dono).toEqual(['Canal Um: x', 'dimensoes: passo desligado por YT_OWN_STEPS_OFF (há 2 execuções)'])
    expect(r.falhas).toEqual([])
  })

  it('criterioDesligados recebe supabase, falhas e o relógio da execução', async () => {
    process.env.YT_OWN_STEPS_OFF = 'dimensoes'
    const relogio = criarRelogio()
    await rodar({ relogio })
    const c = vi.mocked(criterioDesligados).mock.calls[0]![0]
    expect(c.relogio).toBe(relogio)
    expect(Array.isArray(c.falhas)).toBe(true)
  })

  it('nome desconhecido na variável: UMA nota em falhas (a de notaNomesDesconhecidos), e o passo conhecido segue desligado', async () => {
    process.env.YT_OWN_STEPS_OFF = 'dimensoes,retencoa'
    const r = await rodar()
    expect(r.falhas).toEqual(['YT_OWN_STEPS_OFF tem nome desconhecido: retencoa'])
    expect(passoDimensoes).not.toHaveBeenCalled()
  })

  it('a fase antes não roda nenhum dos dois passos, nem os critérios da E11, nem lê a variável como nota', async () => {
    process.env.YT_OWN_STEPS_OFF = 'dimensoes,xx'
    const r = await rodar({ fase: 'antes' })
    expect(passoDimensoes).not.toHaveBeenCalled()
    expect(passoNormalizadores).not.toHaveBeenCalled()
    expect(criteriosE11).not.toHaveBeenCalled()
    expect(criterioDesligados).not.toHaveBeenCalled()
    expect(r.falhas).toEqual([])
    expect(r.resumo).not.toHaveProperty('dimensoes')
  })

  it('sem tempo: os dois não rodam; dimensões grava nao_alcancado_orcamento por canal ligado e o resumo diz sem_tempo; normalizadores não grava (o passo grava as próprias)', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
    expect(passoDimensoes).not.toHaveBeenCalled()
    expect(passoNormalizadores).not.toHaveBeenCalled()
    expect(r.resumo.dimensoes).toMatchObject({ sem_tempo: true, pendentes: 1, tentativas: { nao_alcancado_orcamento: 1 } })
    expect(r.resumo.normalizadores).toMatchObject({ sem_tempo: true })
    const t = db.tables.yt_own_collection_attempts ?? []
    expect(t.filter(x => x.kind === 'dimensoes')).toEqual([expect.objectContaining({ scope_id: 'ch-1', outcome: 'nao_alcancado_orcamento' })])
    expect(t.filter(x => String(x.kind).startsWith('normalizador'))).toEqual([])
  })

  it('um passo novo que lança não derruba o outro, os critérios nem a nota de conferências, que continua a última', async () => {
    const hoje = new Date('2026-10-07T12:00:00.000Z')
    const antes = (d: number) => new Date(hoje.getTime() - d * 86_400_000).toISOString().slice(0, 10)
    conferenciasDeTeste.push({ id: 'de-9-dias', etapa: 'ET', data: antes(9), responsavel: 'agente', onde: 'x', feitaEm: null })
    vi.mocked(passoDimensoes).mockRejectedValue(new Error('boom'))
    vi.mocked(passoNormalizadores).mockRejectedValue(new Error('boom'))
    const r = await rodar()
    expect(r.falhas.slice(0, 2)).toEqual(['dimensoes: unexpected error (Error)', 'normalizadores: unexpected error (Error)'])
    expect(r.falhas.at(-1)).toMatch(/^conferências vencidas/)
    expect(r.falhas).toHaveLength(3)
    expect(criteriosL2).toHaveBeenCalledTimes(1)
    expect(criteriosE11).toHaveBeenCalledTimes(1)
    expect(criterioDesligados).toHaveBeenCalledTimes(1)
    expect(criterioMetadados).toHaveBeenCalledTimes(1)
    expect(criterioOrcamento).toHaveBeenCalledTimes(1)
  })

  it('criteriosE11 que lança (por exemplo, a lista de desligados indefinida): nota VERMELHA em falhas, nunca engolida, e o resto segue', async () => {
    vi.mocked(criteriosE11).mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'dimensoes')"))
    const r = await rodar()
    expect(r.falhas).toHaveLength(1)
    expect(r.falhas[0]).toMatch(/^critérios da E11: /)
    expect(r.resumo.e11).toBeUndefined()
    expect(criterioDesligados).toHaveBeenCalledTimes(1)
    expect(criterioMetadados).toHaveBeenCalledTimes(1)
    expect(criterioOrcamento).toHaveBeenCalledTimes(1)
  })

  it('criterioDesligados que lança: nota em falhas e metadados e orçamento ainda rodam', async () => {
    vi.mocked(criterioDesligados).mockRejectedValue(new Error('statement timeout'))
    const r = await rodar()
    expect(r.falhas).toEqual(['critérios de passos desligados: database error'])
    expect(criterioMetadados).toHaveBeenCalledTimes(1)
    expect(criterioOrcamento).toHaveBeenCalledTimes(1)
  })
})

describe('rodarColeta: E8 (retenção)', () => {
  beforeEach(() => {
    vi.mocked(criterioJobsEmErro).mockReset()
    vi.mocked(criterioOrcamento).mockReset()
  })

  const ordem = (f: unknown) => (f as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0]!
  const rodar = (extra: Partial<Parameters<typeof rodarColeta>[0]> = {}, db: FakeDb = fakeSupabase({ youtube_channels: canais })) =>
    rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois', ...extra })

  it('variável apagada: o passo roda com o teto de fim e resumo.retencao é o resumo do passo (item 245)', async () => {
    delete process.env.YT_OWN_STEPS_OFF
    const r = await rodar()
    expect(passoRetencao).toHaveBeenCalledTimes(1)
    const c = vi.mocked(passoRetencao).mock.calls[0]![0]
    expect(c.deadline - Date.now()).toBe(20_000)
    expect(c.channels.map(x => x.id)).toEqual(['ch-1', 'ch-2'])
    expect(r.resumo.retencao).toEqual(retResumo({ gravados: 3 }))
    expect(r.resumo.retencao).not.toHaveProperty('desligado')
    expect(vi.mocked(criterioDesligados).mock.calls[0]![1]).toEqual([])
    expect(criteriosRetencao).toHaveBeenCalledTimes(1)
  })

  it('YT_OWN_STEPS_OFF=retencao: não roda, { desligado: true }, a nota vai a acao_do_dono, nenhuma rpc de fatos, o critério da retenção não é avaliado (item 245)', async () => {
    process.env.YT_OWN_STEPS_OFF = 'retencao'
    vi.mocked(criterioDesligados).mockResolvedValue(['retencao: passo desligado por YT_OWN_STEPS_OFF (há 1 execuções)'])
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodar({}, db)
    expect(passoRetencao).not.toHaveBeenCalled()
    expect(criteriosRetencao).not.toHaveBeenCalled()
    expect(r.resumo.retencao).toEqual({ desligado: true })
    expect(vi.mocked(criterioDesligados).mock.calls[0]![1]).toEqual(['retencao'])
    expect(r.resumo.acao_do_dono).toEqual(expect.arrayContaining(['retencao: passo desligado por YT_OWN_STEPS_OFF (há 1 execuções)']))
    expect(db.rpcCalls.filter(x => x.name === 'yt_own_retention_facts')).toEqual([])
    expect((db.tables.yt_own_collection_attempts ?? []).filter(x => String(x.kind).startsWith('retencao'))).toEqual([])
    expect(r.falhas).toEqual([])
  })

  it('retenção e E11 desligadas juntas: os dois nomes vão a criterioDesligados, em lista única', async () => {
    process.env.YT_OWN_STEPS_OFF = 'dimensoes,retencao'
    await rodar()
    expect(criterioDesligados).toHaveBeenCalledTimes(1)
    expect(vi.mocked(criterioDesligados).mock.calls[0]![1]).toEqual(['dimensoes', 'retencao'])
  })

  it('nome desconhecido na variável: a nota fica em falhas UMA vez só, mesmo que outro chamador a empurre também', async () => {
    process.env.YT_OWN_STEPS_OFF = 'retencoa'
    vi.mocked(passoRetencao).mockImplementation(async (c) => {
      const n = notaNomesDesconhecidos()
      if (n) pushUnico(c.falhas, n)
      return retResumo()
    })
    const r = await rodar()
    expect(r.falhas).toEqual(['YT_OWN_STEPS_OFF tem nome desconhecido: retencoa'])
    expect(passoRetencao).toHaveBeenCalledTimes(1)
  })

  it('a retenção roda depois do diário, de criteriosL2 e dos critérios da E11; o critério vem depois dela e antes de desligados, metadados e orçamento', async () => {
    const r = await rodar()
    const seq = [passoDiario, criteriosL2, criteriosE11, passoRetencao, criteriosRetencao, criterioDesligados, criterioMetadados, criterioOrcamento].map(ordem)
    expect(seq).toEqual([...seq].sort((a, b) => a - b))
    expect(new Set(seq).size).toBe(8)
    expect(r.falhas).toEqual([])
  })

  it('o critério da retenção recebe supabase, os canais, as falhas e o relógio da execução', async () => {
    const relogio = criarRelogio()
    await rodar({ relogio })
    const c = vi.mocked(criteriosRetencao).mock.calls[0]![0]
    expect(c.relogio).toBe(relogio)
    expect(c.channels.map(x => x.id)).toEqual(['ch-1', 'ch-2'])
    expect(Array.isArray(c.falhas)).toBe(true)
    expect(c.supabase).toBeDefined()
  })

  it('a nota de vídeo que o YouTube não devolve chega a acao_do_dono e NÃO a falhas', async () => {
    vi.mocked(passoRetencao).mockResolvedValue(retResumo({ sem_resposta_do_youtube: ['Canal Um: 2 vídeo(s) sem resposta do YouTube (a, b)'] }))
    const r = await rodar()
    expect(r.resumo.acao_do_dono).toEqual(expect.arrayContaining(['Canal Um: x em sem_acesso', 'Canal Um: 2 vídeo(s) sem resposta do YouTube (a, b)']))
    expect(r.falhas).toEqual([])
    // A lista continua no resumo da retenção.
    expect((r.resumo.retencao as RetencaoResumo).sem_resposta_do_youtube).toHaveLength(1)
  })

  it('a nota de acao_do_dono da retenção não duplica a de criterioDesligados nem as de antes', async () => {
    vi.mocked(passoRetencao).mockResolvedValue(retResumo({ sem_resposta_do_youtube: ['n1'] }))
    vi.mocked(criterioDesligados).mockResolvedValue(['n1', 'n2'])
    const r = await rodar()
    expect((r.resumo.acao_do_dono as string[]).filter(x => x === 'n1')).toHaveLength(1)
    expect(r.resumo.acao_do_dono).toContain('n2')
  })

  it('o passo lança: nota nomeada, os outros critérios rodam (inclusive o da retenção) e a nota das conferências continua a última', async () => {
    const hoje = new Date('2026-10-07T12:00:00.000Z')
    const antes = (d: number) => new Date(hoje.getTime() - d * 86_400_000).toISOString().slice(0, 10)
    conferenciasDeTeste.push({ id: 'de-9-dias', etapa: 'ET', data: antes(9), responsavel: 'agente', onde: 'x', feitaEm: null })
    vi.mocked(passoRetencao).mockRejectedValue(new Error('boom'))
    const r = await rodar()
    expect(r.falhas[0]).toBe('retencao: unexpected error (Error)')
    expect(r.falhas.at(-1)).toMatch(/^conferências vencidas/)
    expect(r.falhas).toHaveLength(2)
    expect(criteriosRetencao).toHaveBeenCalledTimes(1)
    expect(criterioDesligados).toHaveBeenCalledTimes(1)
    expect(criterioMetadados).toHaveBeenCalledTimes(1)
    expect(criterioOrcamento).toHaveBeenCalledTimes(1)
  })

  it('criteriosRetencao que lança: nota VERMELHA em falhas e o resto segue', async () => {
    vi.mocked(criteriosRetencao).mockRejectedValue(new Error('boom'))
    const r = await rodar()
    expect(r.falhas).toEqual(['critérios da retenção: unexpected error (Error)'])
    expect(criterioDesligados).toHaveBeenCalledTimes(1)
    expect(criterioMetadados).toHaveBeenCalledTimes(1)
    expect(criterioOrcamento).toHaveBeenCalledTimes(1)
  })

  it('sem tempo antes do passo: não roda, grava nao_alcancado_orcamento de kind retencao_vida por canal ligado e o resumo diz sem_tempo', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
    expect(passoRetencao).not.toHaveBeenCalled()
    expect(r.resumo.retencao).toMatchObject({ sem_tempo: true, pendentes: 1, tentativas: { nao_alcancado_orcamento: 1 } })
    const t = (db.tables.yt_own_collection_attempts ?? []).filter(x => x.kind === 'retencao_vida')
    expect(t).toEqual([expect.objectContaining({ scope_type: 'canal', scope_id: 'ch-1', outcome: 'nao_alcancado_orcamento' })])
    // O critério roda mesmo assim: é ele que dá a nota de sem tempo (o real, nos testes de orcamento).
    expect(criteriosRetencao).toHaveBeenCalledTimes(1)
  })

  it('ms.retencao aparece (e só quando o passo roda)', async () => {
    const r = await rodar()
    expect(typeof (r.resumo.ms as Record<string, unknown>).retencao).toBe('number')
    process.env.YT_OWN_STEPS_OFF = 'retencao'
    const r2 = await rodar()
    expect(r2.resumo.ms).not.toHaveProperty('retencao')
  })

  it('ms.cauda mede o que passou dos 270 s: 4.000 ms depois de relogio.fim; 0 se a fase termina antes', async () => {
    const tarde = { ...criarRelogio(), fim: Date.now() - 4_000 }
    const r1 = await rodar({ relogio: tarde })
    expect((r1.resumo.ms as Record<string, number>).cauda).toBe(4_000)
    const cedo = { ...criarRelogio(), fim: Date.now() + 60_000 }
    const r2 = await rodar({ relogio: cedo })
    expect((r2.resumo.ms as Record<string, number>).cauda).toBe(0)
  })

  it('ms.cauda é da fase depois: a fase antes não a traz', async () => {
    const r = await rodar({ fase: 'antes' })
    expect(r.resumo.ms).not.toHaveProperty('cauda')
    expect(passoRetencao).not.toHaveBeenCalled()
    expect(criteriosRetencao).not.toHaveBeenCalled()
  })
})

describe('rodarColeta: a dieta do diário entra no cron (A5 E6, Tarefa 11b)', () => {
  const ordem = (f: unknown) => (f as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0]!
  const rodar = (extra: Partial<Parameters<typeof rodarColeta>[0]> = {}, canaisDb: unknown[] = canais) =>
    rodarColeta({ supabase: fakeSupabase({ youtube_channels: canaisDb as never }).client, relogio: criarRelogio(), fase: 'depois', ...extra })

  it('o critério de cobertura roda logo depois de criteriosL2, antes dos critérios da E11 e antes da retenção', async () => {
    const r = await rodar()
    const seq = [passoDiario, criteriosL2, criterioCobertura, criteriosE11, passoRetencao, criteriosRetencao].map(ordem)
    expect(seq).toEqual([...seq].sort((a, b) => a - b))
    expect(new Set(seq).size).toBe(6)
    expect(r.falhas).toEqual([])
  })

  it('recebe supabase, os canais, as falhas e o relógio da execução', async () => {
    const relogio = criarRelogio()
    await rodar({ relogio })
    expect(criterioCobertura).toHaveBeenCalledTimes(1)
    const c = vi.mocked(criterioCobertura).mock.calls[0]![0]
    expect(c.relogio).toBe(relogio)
    expect(c.channels.map(x => x.id)).toEqual(['ch-1', 'ch-2'])
    expect(Array.isArray(c.falhas)).toBe(true)
    expect(c.supabase).toBeDefined()
  })

  it('roda mesmo quando o passo do diário lançou', async () => {
    vi.mocked(passoDiario).mockRejectedValue(new Error('boom'))
    const r = await rodar()
    expect(r.falhas).toEqual(['diario: unexpected error (Error)'])
    expect(criterioCobertura).toHaveBeenCalledTimes(1)
  })

  it('roda mesmo quando o diário ficou sem tempo (relógio global vencido)', async () => {
    await rodarColeta({ supabase: fakeSupabase({ youtube_channels: canais }).client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
    expect(passoDiario).not.toHaveBeenCalled()
    expect(criterioCobertura).toHaveBeenCalledTimes(1)
  })

  it('fase antes: não roda', async () => {
    await rodar({ fase: 'antes' })
    expect(criterioCobertura).not.toHaveBeenCalled()
  })

  it('a ação do dono do critério chega a resumo.acao_do_dono e NÃO a falhas, sem duplicar as de antes', async () => {
    vi.mocked(criterioCobertura).mockResolvedValue({ acaoDoDono: ['diário: Canal Um: o YouTube não devolve mais o vídeo v1', 'Canal Um: x em sem_acesso'] })
    const r = await rodar()
    expect(r.resumo.acao_do_dono).toEqual(expect.arrayContaining(['diário: Canal Um: o YouTube não devolve mais o vídeo v1', 'Canal Um: x em sem_acesso']))
    expect((r.resumo.acao_do_dono as string[]).filter(x => x === 'Canal Um: x em sem_acesso')).toHaveLength(1)
    expect(r.falhas).toEqual([])
  })

  it('sem nada a avisar o dono, a lista que já havia fica como estava', async () => {
    const r = await rodar()
    expect(r.resumo.acao_do_dono).toEqual(['Canal Um: x em sem_acesso'])
  })

  it('a nota de vermelho que o critério empurra em falhas chega ao veredito', async () => {
    vi.mocked(criterioCobertura).mockImplementation(async (ctx) => {
      ctx.falhas.push('diário: Canal Um: 1 de 3 vídeos sem cobertura até 02/10 (v1 (nunca coberto))')
      return { acaoDoDono: [] }
    })
    const r = await rodar()
    expect(r.falhas).toEqual(['diário: Canal Um: 1 de 3 vídeos sem cobertura até 02/10 (v1 (nunca coberto))'])
  })

  it('criterioCobertura que lança: nota VERMELHA em falhas e o resto segue (inclusive a retenção)', async () => {
    vi.mocked(criterioCobertura).mockRejectedValue(new Error('boom'))
    const r = await rodar()
    expect(r.falhas).toEqual(['critérios de cobertura: unexpected error (Error)'])
    expect(criteriosE11).toHaveBeenCalledTimes(1)
    expect(passoRetencao).toHaveBeenCalledTimes(1)
    expect(criterioMetadados).toHaveBeenCalledTimes(1)
    expect(criterioOrcamento).toHaveBeenCalledTimes(1)
  })

  it('canal em `reautorizar` não gera nota de cobertura (o critério de verdade, sobre um vídeo antigo sem cobertura)', async () => {
    const { criterioCobertura: real } = await vi.importActual<typeof import('@/lib/youtube/coleta/criteria-cobertura')>('@/lib/youtube/coleta/criteria-cobertura')
    vi.mocked(criterioCobertura).mockImplementation(real)
    const videos = [{ id: 'vid-1', channel_id: 'ch-1', site_id: 'site-1', youtube_video_id: 'yt-antigo', published_at: '2026-08-01T12:00:00.000Z' }]
    const db = (status: string) => fakeSupabase({
      youtube_channels: [{ ...canais[0]!, collection_status: status, video_count: null }], youtube_videos: videos,
    })
    const ok = await rodarColeta({ supabase: db('ok').client, relogio: criarRelogio(), fase: 'depois' })
    expect(ok.falhas.some(f => f.includes('yt-antigo'))).toBe(true) // o mesmo cenário em `ok` DÁ a nota: a prova de que a ausência abaixo é do estado
    const re = await rodarColeta({ supabase: db('reautorizar').client, relogio: criarRelogio(), fase: 'depois' })
    expect(re.falhas.some(f => f.includes('yt-antigo') || f.includes('cobertura'))).toBe(false)
  })
})
