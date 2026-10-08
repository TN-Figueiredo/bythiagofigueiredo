// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/coleta/meta-step', () => ({ passoMetadados: vi.fn() }))
vi.mock('@/lib/youtube/coleta/jobs-step', () => ({ passoJobs: vi.fn() }))
vi.mock('@/lib/youtube/coleta/reports-step', () => ({ passoRelatorios: vi.fn() }))
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
  vi.mocked(criteriosRelatorios).mockResolvedValue({ perdidos: 2, atrasados: 0, acao_do_dono: ['Canal Um: x em sem_acesso'] })
  vi.mocked(criterioMetadados).mockResolvedValue({ desconhecido: [] })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('rodarColeta', () => {
  it('os três passos nascem ligados', () => {
    expect(PASSOS_LIGADOS).toEqual({ metadados: true, jobs: true, relatorios: true })
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
    expect(criterioOrcamento).toHaveBeenCalledWith(expect.anything(), ['meta', 'thumbnail', 'sondagem', 'relatorio'])
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
    expect(db.tables.yt_own_collection_attempts).toHaveLength(1)
    expect(db.tables.yt_own_collection_attempts![0]).toMatchObject({ scope_type: 'canal', scope_id: 'ch-1', kind: 'relatorio', outcome: 'nao_alcancado_orcamento' })
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

  it('fase depois: ms só de relatorios; reautorizar e a nota somam ao acao_do_dono do critério', async () => {
    const db = fakeSupabase({ youtube_channels: [canalL1b({ id: 'ch-1', name: 'Canal Um', collection_status: 'reautorizar' })] })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    expect(Object.keys(r.resumo.ms as object)).toEqual(['relatorios'])
    expect(r.resumo.reautorizar).toEqual(['ch-1'])
    expect(r.resumo.acao_do_dono).toEqual(['Canal Um: x em sem_acesso', 'Canal Um: reautorizar'])
  })
})
