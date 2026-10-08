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
import { fakeSupabase, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-07T12:00:00.000Z')
const canal: Row = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true }
const video: Row = { id: 'v-1', youtube_video_id: 'yt-1', channel_id: 'ch-1', site_id: 'site-1', title: 'T', description: 'D', tags: [], duration_seconds: 300, published_at: '2026-09-01T00:00:00.000Z' }
const jobAtivo: Row = { site_id: 'site-1', channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', job_id: 'job-1', status: 'ativo', job_create_time: '2026-10-05T00:00:00.000Z', last_create_time: null }
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
    const db = fakeSupabase({ youtube_channels: [canal], youtube_videos: [video], yt_reporting_jobs: quatroAtivos })

    const antes = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(antes.resumo.metadados).toMatchObject({ gravados: 1 })
    expect(db.tables.yt_own_video_meta_daily).toHaveLength(1)

    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
    const relatorios = depois.resumo.relatorios as { pendentes: number; tentativas: Record<string, number> }
    expect(relatorios.tentativas).toEqual({ nao_alcancado_orcamento: 1 })
    expect(relatorios.pendentes).toBeGreaterThan(0)
    expect(depois.falhas).toEqual([])
  })

  it('terceira execução seguida sem alcançar os relatórios: falha crítica', async () => {
    const db = fakeSupabase({
      youtube_channels: [canal], yt_reporting_jobs: [jobAtivo],
      yt_own_collection_attempts: [semAlcancar('2026-10-05'), semAlcancar('2026-10-06')],
    })
    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
    expect(depois.falhas).toEqual(['orçamento: 1 escopo(s) de relatorio sem alcançar nas 3 últimas tentativas'])
  })
})
