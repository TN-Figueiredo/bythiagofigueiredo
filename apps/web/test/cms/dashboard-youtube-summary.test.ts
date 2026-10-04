// @vitest-environment node
/**
 * Card "YouTube" do painel: números do PRIMEIRO canal com OAuth (ordem de
 * cadastro), com o nome dele. Antes: `fetchYtChannelMetrics(siteId, 30)` sem
 * canal — com 2+ conexões a guarda do token devolve vazio (e avisa o Sentry a
 * cada carga), e com 1 o número saía sem dizer de qual canal era.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'

const SITE = 'site-1'
const { metricsMock } = vi.hoisted(() => ({ metricsMock: vi.fn() }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/cache', () => ({ unstable_cache: <T,>(fn: T) => fn }))
vi.mock('@/lib/youtube/analytics-client', () => ({ fetchYtChannelMetrics: metricsMock }))

const tables: Record<string, unknown[]> = {}
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => stub() }))

/** Aplica eq/is de verdade, para que `revoked_at is null` e o site contem. */
function stub() {
  const make = (table: string) => {
    let rows = [...((tables[table] ?? []) as Array<Record<string, unknown>>)]
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), b)
    b.is = (c: string, v: unknown) => ((rows = rows.filter((r) => (r[c] ?? null) === v)), b)
    b.order = () => b
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(res, rej)
    return b
  }
  return { from: make }
}

const metrics = (views: number) => ({
  views, estimatedMinutesWatched: 1, averageViewDuration: 1, averageViewPercentage: 40,
  subscribersGained: 5, subscribersLost: 1, impressions: 0, impressionClickThroughRate: 2,
  likes: 1, comments: 1, shares: 0,
})

const ch = (id: string, uc: string, name: string, created_at: string) => ({
  id, channel_id: uc, name, created_at, site_id: SITE,
})
const conn = (uc: string, revoked_at: string | null = null) => ({
  site_id: SITE, provider: 'youtube', account_id: uc, revoked_at,
})

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(tables)) delete tables[k]
  metricsMock.mockImplementation(async (_s: string, days: number) => metrics(days === 30 ? 300 : 500))
})

describe('fetchYtDashboardSummary', () => {
  it('3 canais, 2 com OAuth: usa o primeiro com OAuth na ordem de cadastro e diz o nome', async () => {
    tables.youtube_channels = [
      ch('c', 'UC_C', 'Canal C', '2026-03-01T00:00:00Z'),
      ch('a', 'UC_A', 'Canal A (sem OAuth)', '2026-01-01T00:00:00Z'),
      ch('b', 'UC_B', 'Canal B', '2026-02-01T00:00:00Z'),
    ]
    tables.social_connections = [conn('UC_C'), conn('UC_B')]
    const { fetchYtDashboardSummary } = await import('@/app/cms/(authed)/_components/dashboard-queries')
    const s = await fetchYtDashboardSummary(SITE)
    expect(s?.channelName).toBe('Canal B')
    expect(s?.channelId).toBe('UC_B')
    expect(metricsMock).toHaveBeenCalledWith(SITE, 30, 'UC_B')
    expect(metricsMock).toHaveBeenCalledWith(SITE, 60, 'UC_B')
    expect(s?.views30d).toBe(300)
  })

  it('1 canal com OAuth: números dele, com o nome', async () => {
    tables.youtube_channels = [ch('a', 'UC_A', 'Único', '2026-01-01T00:00:00Z')]
    tables.social_connections = [conn('UC_A')]
    const { fetchYtDashboardSummary } = await import('@/app/cms/(authed)/_components/dashboard-queries')
    const s = await fetchYtDashboardSummary(SITE)
    expect(s?.channelName).toBe('Único')
    expect(metricsMock).toHaveBeenCalledWith(SITE, 30, 'UC_A')
  })

  it('conexão revogada não conta; empate de created_at desempata por id', async () => {
    tables.youtube_channels = [
      ch('z', 'UC_Z', 'Z', '2026-01-01T00:00:00Z'),
      ch('y', 'UC_Y', 'Y', '2026-01-01T00:00:00Z'),
      ch('r', 'UC_R', 'Revogado', '2025-01-01T00:00:00Z'),
    ]
    tables.social_connections = [conn('UC_R', '2026-09-01T00:00:00Z'), conn('UC_Z'), conn('UC_Y')]
    const { fetchYtDashboardSummary } = await import('@/app/cms/(authed)/_components/dashboard-queries')
    const s = await fetchYtDashboardSummary(SITE)
    expect(s?.channelName).toBe('Y')
    expect(metricsMock).toHaveBeenCalledWith(SITE, 30, 'UC_Y')
  })

  it('o dado não existe: nenhum canal com conexão ativa → null, sem chamar o analytics', async () => {
    tables.youtube_channels = [ch('a', 'UC_A', 'A', '2026-01-01T00:00:00Z')]
    tables.social_connections = [conn('UC_A', '2026-09-01T00:00:00Z')]
    const { fetchYtDashboardSummary } = await import('@/app/cms/(authed)/_components/dashboard-queries')
    expect(await fetchYtDashboardSummary(SITE)).toBeNull()
    expect(metricsMock).not.toHaveBeenCalled()
  })

  it('o dado não existe: zero canais e zero conexões → null', async () => {
    const { fetchYtDashboardSummary } = await import('@/app/cms/(authed)/_components/dashboard-queries')
    expect(await fetchYtDashboardSummary(SITE)).toBeNull()
    expect(metricsMock).not.toHaveBeenCalled()
  })
  it('erro de banco: o card some, mas com Sentry (não em silêncio)', async () => {
    tables.youtube_channels = [ch('a', 'UC_A', 'A', '2026-01-01T00:00:00Z')]
    tables.social_connections = [conn('UC_A')]
    // a leitura de conexões estoura
    const real = tables.social_connections
    Object.defineProperty(tables, 'social_connections', { get: () => { throw new Error('statement timeout') }, configurable: true })
    const { fetchYtDashboardSummary } = await import('@/app/cms/(authed)/_components/dashboard-queries')
    expect(await fetchYtDashboardSummary(SITE)).toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    Object.defineProperty(tables, 'social_connections', { value: real, writable: true, configurable: true, enumerable: true })
  })

  it('EN antigo sem OAuth + PT com OAuth → o card é do PT', async () => {
    tables.youtube_channels = [
      { ...ch('en', 'UC_EN', 'EN vazio', '2025-01-01T00:00:00Z'), locale: 'en' },
      { ...ch('pt', 'UC_PT', 'PT', '2025-06-01T00:00:00Z'), locale: 'pt' },
    ]
    tables.social_connections = [conn('UC_PT')]
    const { fetchYtDashboardSummary } = await import('@/app/cms/(authed)/_components/dashboard-queries')
    expect((await fetchYtDashboardSummary(SITE))?.channelName).toBe('PT')
  })
})
