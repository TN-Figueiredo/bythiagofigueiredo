// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/thumb-fingerprint', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/thumb-fingerprint')>()),
  probeThumb: vi.fn(async () => ({ etag: null, lastModified: null, dhash: 'ffffffffffffffff', bytes: Buffer.from('img'), url: 'u' })),
  archiveThumb: vi.fn(async () => 'https://blob.test/a.jpg'),
}))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(async () => ({ accessToken: 'tok', connectionId: 'c1' })),
}))
vi.mock('@/lib/youtube/coleta/videos-list', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/coleta/videos-list')>()),
  // O passo de metadados chama videos.list com o token do canal: a rede é simulada (nunca a do Google de verdade); todos públicos.
  videosList: vi.fn(async (_token: string, ids: readonly string[]) => new Map(ids.map(id => [id, {
    id, title: null, description: null, tags: [], durationSeconds: null, privacyStatus: 'public',
  }]))),
}))
vi.mock('@/lib/youtube/reporting/client', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/reporting/client')>()),
  criarReportingClient: vi.fn(() => ({
    reportTypesList: vi.fn(async () => []),
    jobsList: vi.fn(async () => []),
    jobsCreate: vi.fn(),
    reportsList: vi.fn(async () => ({ reports: [], nextPageToken: null })),
    download: vi.fn(),
  })),
}))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))

import { rodarColeta } from '@/lib/youtube/coleta'
import { criarRelogio } from '@/lib/youtube/coleta/clock'
import { REPORT_TYPES_ENABLED } from '@/lib/youtube/reporting/types'
import { comE11Padrao, fakeSupabase, semearCobertura, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-07T12:00:00.000Z')
const canal: Row = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true }
const video: Row = { id: 'v-1', youtube_video_id: 'yt-1', channel_id: 'ch-1', site_id: 'site-1', title: 'T', description: 'D', tags: [], duration_seconds: 300, published_at: '2026-09-01T00:00:00.000Z' }
const jobAtivo: Row = { site_id: 'site-1', channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', job_id: 'job-1', status: 'ativo', job_create_time: '2026-10-05T00:00:00.000Z', last_create_time: null }
// O que a fase 'antes' devolveria: sem ele o critério de metadados acusa "0 de 1 vídeos", ruído que não é da E11.
const META_ANTES = { day_pt: '2026-10-06', dias_sem_meta: { 'ch-1': 0 } }
// Sem a linha de metadados do dia o critério de metadados acusa o canal; essa nota não é da E11 e é tirada dos testes dela.
const deE11 = (falhas: string[]): string[] => falhas.filter(n => !n.startsWith('metadados:'))
const semAlcancar = (dia: string): Row => ({ scope_type: 'canal', scope_id: 'ch-1', kind: 'relatorio', outcome: 'nao_alcancado_orcamento', attempt_day: dia, channel_id: 'ch-1', site_id: 'site-1', attempts: 1 })

beforeEach(() => {
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('orçamento, com os passos de verdade', () => {
  it('relógio global estourado depois da parte antiga: metadados rodou, relatórios ficam nao_alcancado_orcamento com pendentes > 0', async () => {
    // Os quatro jobs já ativos: o 1A não tem o que sondar e o teste fica só no orçamento.
    const quatroAtivos = REPORT_TYPES_ENABLED.map(t => ({ ...jobAtivo, report_type_id: t, job_id: `job-${t}` }))
    const db = comE11Padrao(fakeSupabase({ youtube_channels: [canal], youtube_videos: [video], yt_reporting_jobs: quatroAtivos }))

    const antes = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(antes.resumo.metadados).toMatchObject({ gravados: 1 })
    expect(db.tables.yt_own_video_meta_daily).toHaveLength(1)

    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 280_000), fase: 'depois' })
    const relatorios = depois.resumo.relatorios as { pendentes: number; tentativas: Record<string, number> }
    expect(relatorios.tentativas).toEqual({ nao_alcancado_orcamento: 1 })
    expect(relatorios.pendentes).toBeGreaterThan(0)
    expect(depois.falhas).toEqual([])
  })

  it('terceira execução seguida sem alcançar os relatórios: falha crítica', async () => {
    const db = comE11Padrao(fakeSupabase({
      youtube_channels: [canal], yt_reporting_jobs: [jobAtivo],
      yt_own_collection_attempts: [semAlcancar('2026-10-05'), semAlcancar('2026-10-06')],
    }))
    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 280_000), fase: 'depois' })
    expect(depois.falhas).toEqual(['orçamento: 1 escopo(s) de relatorio sem alcançar nas 3 últimas tentativas'])
  })

  // ── A5 E8 (Tarefa 11a): a retenção e o critério dela, com o relógio de verdade ───────────────────────────────────────
  const canalOk: Row = { ...canal, collection_status: 'ok' }
  it('E8, com 300 s decorridos: criteriosRetencao não chama yt_own_retention_facts e deixa a nota de sem tempo em falhas', async () => {
    const db = comE11Padrao(fakeSupabase({ youtube_channels: [canalOk], yt_reporting_jobs: [jobAtivo] }))
    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
    expect(db.rpcCalls.filter(c => c.name === 'yt_own_retention_facts')).toEqual([])
    expect(depois.resumo.retencao).toMatchObject({ sem_tempo: true, pendentes: 1 })
    expect(depois.falhas).toContain('critérios: não foi possível avaliar retenção de Canal Um (sem tempo)')
    // A5 E6 (11b): o critério de cobertura, o primeiro a perder o prazo, deixa a sua nota de sem tempo (e nenhuma nota de atraso)
    expect(depois.falhas).toContain('critérios: não foi possível avaliar cobertura de Canal Um (sem tempo)')
    expect(depois.falhas.filter(n => n.startsWith('diário:'))).toEqual([])
    expect((db.tables.yt_own_collection_attempts ?? []).filter(x => x.kind === 'retencao_vida')).toEqual([expect.objectContaining({ scope_id: 'ch-1', outcome: 'nao_alcancado_orcamento' })])
  })

  it('E8, com 280 s decorridos: os passos não rodam (270 s vencidos), mas o critério da retenção ainda tem prazo e lê os fatos (lista vazia, sem vídeo: verde)', async () => {
    const db = comE11Padrao(fakeSupabase({ youtube_channels: [canalOk], yt_reporting_jobs: [jobAtivo] }))
    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 280_000), fase: 'depois' })
    expect(db.rpcCalls.filter(c => c.name === 'yt_own_retention_facts')).toHaveLength(1)
    expect(depois.falhas).toEqual([])
  })

  it('E8, com 295 s decorridos e uma leitura que não volta: a nota de sem tempo do critério (prazoDoCriterio, 296 s) sai em cerca de 1 s', async () => {
    const db = comE11Padrao(fakeSupabase({ youtube_channels: [canalOk], yt_reporting_jobs: [jobAtivo] }))
    db.rpcHandlers.yt_own_retention_facts = () => new Promise(() => { /* nunca volta */ })
    const t0 = performance.now()
    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 295_000), fase: 'depois' })
    expect(performance.now() - t0).toBeLessThan(3_000)
    expect(db.rpcCalls.filter(c => c.name === 'yt_own_retention_facts')).toHaveLength(1)
    expect(depois.falhas).toContain('critérios: não foi possível avaliar retenção de Canal Um (sem tempo)')
  })

  // ── A5 E6 (Tarefa 11b): o critério de cobertura, com o relógio de verdade ───────────────────────────────────────────
  it('E6, com 280 s decorridos: vídeo antigo e cobertura vazia = vermelho com o id; com a cobertura em dia = verde', async () => {
    const vermelho = comE11Padrao(fakeSupabase({ youtube_channels: [canalOk], youtube_videos: [video], yt_reporting_jobs: [jobAtivo] }))
    const a = await rodarColeta({ supabase: vermelho.client, relogio: criarRelogio(Date.now() - 280_000), fase: 'depois' })
    expect(a.falhas.filter(n => n.startsWith('diário:'))).toEqual([expect.stringContaining('1 de 1 vídeos sem cobertura')])
    expect(a.falhas.filter(n => n.startsWith('diário:'))[0]).toContain('yt-1 (nunca coberto)')

    const verde = comE11Padrao(fakeSupabase({ youtube_channels: [canalOk], youtube_videos: [video], yt_reporting_jobs: [jobAtivo] }))
    semearCobertura(verde, [video], '2026-10-07')
    const b = await rodarColeta({ supabase: verde.client, relogio: criarRelogio(Date.now() - 280_000), fase: 'depois' })
    expect(deE11(b.falhas)).toEqual([]) // o critério de metadados não é desta tarefa: sem a linha do dia ele acusa o canal
  })

  // ── A5 E11 (Tarefa 10): os dois passos novos só gastam o que SOBRA do relógio ──────────────────────────────────────
  it('E11, pior dia (relógio estourado): dimensões e normalizadores não rodam, dimensões grava nao_alcancado_orcamento por canal ligado, e a prova dos critérios ainda é chamada', async () => {
    const db = comE11Padrao(fakeSupabase({ youtube_channels: [canal, { ...canal, id: 'ch-2', channel_id: 'UC2', sync_enabled: false }], yt_reporting_jobs: [jobAtivo] }))
    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
    expect(depois.resumo.dimensoes).toMatchObject({ sem_tempo: true, pendentes: 1, tentativas: { nao_alcancado_orcamento: 1 } })
    expect(depois.resumo.normalizadores).toMatchObject({ sem_tempo: true })
    const t = db.tables.yt_own_collection_attempts ?? []
    expect(t.filter(x => x.kind === 'dimensoes')).toEqual([expect.objectContaining({ scope_id: 'ch-1', outcome: 'nao_alcancado_orcamento' })])
    expect(t.filter(x => String(x.kind).startsWith('normalizador'))).toEqual([])
    // Nada foi chamado no banco pelos passos (nem a guarda de schema); só a prova dos critérios.
    expect(db.rpcCalls.filter(c => ['yt_own_dim_cover_idle', 'yt_own_dim_apply', 'yt_own_traffic_detail_apply', 'yt_own_reach_dim_apply'].includes(c.name))).toEqual([])
    expect(db.rpcCalls.filter(c => c.name === 'yt_own_dim_prova')).toHaveLength(1)
    expect(depois.falhas).toEqual([])
  })

  it('E11, relógio inteiro: os dois passos rodam e os passos de antes continuam rodando no mesmo teto (a soma de TETOS_MS não mudou)', async () => {
    const db = comE11Padrao(fakeSupabase({ youtube_channels: [canal], youtube_videos: [video], yt_reporting_jobs: REPORT_TYPES_ENABLED.map(t => ({ ...jobAtivo, report_type_id: t, job_id: `job-${t}` })) }))
    db.rpcHandlers.yt_reporting_blobs_purge = () => ({ data: 0, error: null })
    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois', metadadosAntes: META_ANTES })
    expect(depois.resumo.dimensoes).not.toHaveProperty('sem_tempo')
    expect(depois.resumo.normalizadores).not.toHaveProperty('sem_tempo')
    expect(depois.resumo.relatorios).toBeDefined()
    expect(deE11(depois.falhas)).toEqual([])
  })

  it('E11, ctx.e11 inválido: nota da data de partida e dos critérios, e os passos antigos seguem', async () => {
    const db = comE11Padrao(fakeSupabase({ youtube_channels: [canal], youtube_videos: [video], yt_reporting_jobs: [jobAtivo] }))
    db.rpcHandlers.yt_reporting_blobs_purge = () => ({ data: 0, error: null })
    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois', metadadosAntes: META_ANTES, e11: { desde: '2026-13-45', ligadoEm: '2026-10-01' } })
    expect(deE11(depois.falhas)).toEqual([
      'dimensões: data de partida inválida (e11-config.ts)',
      'dimensões: prova não avaliada (configuração das dimensões: desde não é uma data AAAA-MM-DD que existe)',
    ])
    expect(depois.resumo.relatorios).toBeDefined()
    expect(depois.resumo.alcance).toBeDefined()
    expect(depois.resumo.diario).toBeDefined()
  })

  it('E11, nenhum canal com coleta ligada: os critérios da E11 não chamam a prova (senão "nenhum site" seria vermelho para sempre)', async () => {
    const db = comE11Padrao(fakeSupabase({ youtube_channels: [{ ...canal, sync_enabled: false }] }))
    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    expect(db.rpcCalls.filter(c => c.name === 'yt_own_dim_prova')).toEqual([])
    expect(depois.resumo.e11).toBeUndefined()
    expect(depois.falhas).toEqual([])
  })
})
