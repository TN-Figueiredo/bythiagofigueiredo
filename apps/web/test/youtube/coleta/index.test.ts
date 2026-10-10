// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/coleta/meta-step', () => ({ passoMetadados: vi.fn() }))
vi.mock('@/lib/youtube/coleta/jobs-step', () => ({ passoJobs: vi.fn() }))
vi.mock('@/lib/youtube/coleta/reports-step', () => ({ passoRelatorios: vi.fn() }))
vi.mock('@/lib/youtube/coleta/alcance-step', () => ({ passoAlcance: vi.fn() }))
vi.mock('@/lib/youtube/coleta/diario-step', () => ({ passoDiario: vi.fn() }))
vi.mock('@/lib/youtube/coleta/criteria-l2', () => ({ criteriosL2: vi.fn() }))
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
import { criteriosRelatorios, criterioJobsEmErro, criterioOrcamento, criterioMetadados } from '@/lib/youtube/coleta/criteria'
import { criarRelogio } from '@/lib/youtube/coleta/clock'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakeSupabase, type FakeDb } from './fake-supabase'

const AGORA = new Date('2026-10-07T12:00:00.000Z')
const canais = [
  { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, slug: 'um' },
  { id: 'ch-2', channel_id: 'UC2', site_id: 'site-1', name: 'Canal Dois', sync_enabled: false, slug: 'dois' },
]
const resumoVazio = { gravados: 0, tentativas: {}, pendentes: 0 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  vi.mocked(passoMetadados).mockResolvedValue({ ...resumoVazio, gravados: 35, day_pt: '2026-10-06', dias_sem_meta: { 'ch-1': 0 } })
  vi.mocked(passoJobs).mockResolvedValue({ ...resumoVazio, acao_do_dono: ['Canal Um: sem_acesso'], tipo_indisponivel: [], estados: {} })
  vi.mocked(passoRelatorios).mockResolvedValue({ ...resumoVazio, vistos: 0, baixados: 3, vazios: 0, expirados: 0, erros_download: 0, bruto_apagado: 0 })
  vi.mocked(passoAlcance).mockResolvedValue({ ...resumoVazio, normalizados: 2, vazios: 1, erros: 0, sem_par: 0 })
  vi.mocked(passoDiario).mockResolvedValue({ ...resumoVazio, gravados: 9, ate: '2026-10-07', estendidas_recusadas: 0 })
  vi.mocked(criteriosRelatorios).mockResolvedValue({ perdidos: 2, atrasados: 0, acao_do_dono: ['Canal Um: x em sem_acesso'] })
  vi.mocked(criterioMetadados).mockResolvedValue({ desconhecido: [] })
  vi.mocked(criteriosL2).mockResolvedValue(undefined)
})
afterEach(() => {
  vi.useRealTimers()
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

  it('fase depois: roda relatórios com 60 s, junta perdidos e atrasados, e confere o orçamento', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    const ctxRel = vi.mocked(passoRelatorios).mock.calls[0]![0] as StepCtx
    expect(ctxRel.deadline - Date.now()).toBe(60_000)
    expect(passoMetadados).not.toHaveBeenCalled()
    expect(passoJobs).not.toHaveBeenCalled()
    expect(r.resumo).toMatchObject({
      relatorios: { baixados: 3, perdidos: 2, atrasados: 0 },
      perdidos: 2,
      acao_do_dono: ['Canal Um: x em sem_acesso'],
      desconhecido: [],
    })
    expect(criterioOrcamento).toHaveBeenCalledWith(expect.anything(), ['meta', 'thumbnail', 'sondagem', 'relatorio', 'diario'])
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
    expect(Object.keys(r.resumo.ms as object).sort()).toEqual(['alcance', 'diario', 'relatorios'])
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
    expect(Object.keys(r.resumo.ms as object).sort()).toEqual(['alcance', 'diario', 'relatorios'])
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
})
