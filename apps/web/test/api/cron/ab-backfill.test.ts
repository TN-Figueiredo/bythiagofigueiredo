import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const CRON_SECRET = 'test-cron-secret'
process.env.CRON_SECRET = CRON_SECRET

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

// ── Token refresh mock ───────────────────────────────────────────────────────
const mockEnsureFreshToken = vi.fn()
vi.mock('@/lib/social/token-refresh', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
}))

// ── YouTube analytics mock ───────────────────────────────────────────────────
const mockFetchAnalyticsForDateRange = vi.fn()
vi.mock('@/lib/youtube/ab-youtube', () => ({
  fetchAnalyticsForDateRange: (...args: unknown[]) =>
    mockFetchAnalyticsForDateRange(...args),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setTag: vi.fn(),
}))

vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn().mockResolvedValue(undefined),
  recordCronFailure: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  fanOutToSiteAdmins: vi.fn().mockResolvedValue(1),
}))

// ── Import after mocks ─���─────────��──────────────────────────────────────────
import { GET } from '@/app/api/cron/ab-backfill/route'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { NoActiveConnectionError } from '@/lib/social/token-refresh'
import * as Sentry from '@sentry/nextjs'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(authHeader?: string): NextRequest {
  return {
    headers: new Headers(authHeader ? { authorization: authHeader } : {}),
  } as unknown as NextRequest
}

const cyclesLimit = vi.fn()
const cyclesOrder = vi.fn()
function cyclesQuery(data: unknown[], error: null | object = null) {
  cyclesLimit.mockResolvedValue({ data, error })
  cyclesOrder.mockReturnValue({ limit: cyclesLimit })
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({ order: cyclesOrder }),
        }),
      }),
    }),
  }
}

function singleQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

const cycleUpdates: Record<string, unknown>[] = []
function updateQuery() {
  return {
    update: vi.fn((data: Record<string, unknown>) => {
      cycleUpdates.push(data)
      return { eq: vi.fn().mockResolvedValue({ error: null }) }
    }),
  }
}

/**
 * `youtube_videos` responde às duas leituras da rota: o id do vídeo no YouTube
 * e o canal dono do vídeo (`youtube_channels!inner(channel_id)`).
 */
function videoQuery(video: unknown, owner: { channel_id: string } | null) {
  return {
    select: vi.fn((cols: string) => ({
      eq: vi.fn().mockReturnValue((() => {
        const single = vi.fn().mockResolvedValue(
          cols.includes('youtube_channels')
            ? { data: { youtube_channels: owner }, error: null }
            : { data: video, error: null },
        )
        return { single, eq: vi.fn().mockReturnValue({ single }) }
      })()),
    })),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/ab-backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cycleUpdates.length = 0
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns backfilled: 0 when no cycles need backfilling', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_test_cycles') return cyclesQuery([])
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.backfilled).toBe(0)
    // Regressão: "nada a processar" é sucesso e precisa gravar cron_health —
    // sem isso /api/health acusa "down" todo dia mesmo com o cron saudável.
    expect(recordCronSuccess).toHaveBeenCalledWith('ab-backfill', 'critical')
    expect(recordCronFailure).not.toHaveBeenCalled()
  })

  it('reports error and records a critical failure when the cycles query itself errors', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_test_cycles') return cyclesQuery([], { message: 'connection reset' })
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    // Um erro de query dropado aqui caia em `cycles === null` -> "nada a
    // processar" -> sucesso implicito. Precisa surgir como falha explicita,
    // sem que recordCronSuccess seja chamado.
    expect(res.status).toBe(500)
    expect(body.status).toBe('error')
    expect(body.error).toBe('connection reset')
    expect(recordCronFailure).toHaveBeenCalledWith('ab-backfill', 'connection reset', 'critical')
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('happy path: backfills cycle with analytics data', async () => {
    const cycle = {
      id: 'cycle-1',
      test_id: 'test-1',
      started_at: '2026-05-01T00:00:00Z',
      ended_at: '2026-05-10T00:00:00Z',
      backfill_attempts: 0,
    }
    const test = { id: 'test-1', site_id: 'site-1', youtube_video_id: 'vid-1' }
    const video = { youtube_video_id: 'yt-video-abc' }

    mockEnsureFreshToken.mockResolvedValue({ accessToken: 'tok-123' })
    mockFetchAnalyticsForDateRange.mockResolvedValue([
      { impressions: 1000, ctr: 0.05 },
      { impressions: 2000, ctr: 0.04 },
    ])

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_test_cycles') {
        // First call: select cycles; subsequent: update
        return {
          ...cyclesQuery([cycle]),
          ...updateQuery(),
        }
      }
      if (table === 'ab_tests') return singleQuery(test)
      if (table === 'youtube_videos') return videoQuery(video, { channel_id: 'UCpt' })
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.backfilled).toBe(1)
    expect(body.errors).toBe(0)
    // Site com dois canais: o token é o do canal DONO do vídeo. A Analytics API
    // é consultada com `channel==MINE` — o token de outro canal devolve zero linhas.
    expect(mockEnsureFreshToken).toHaveBeenCalledTimes(1)
    expect(mockEnsureFreshToken).toHaveBeenCalledWith('site-1', 'youtube', 'UCpt')
    expect(mockFetchAnalyticsForDateRange).toHaveBeenCalledWith(
      'yt-video-abc', '2026-05-01', '2026-05-10', 'tok-123',
    )
  })

  describe('o dado não existe', () => {
    const cycle = {
      id: 'cycle-3',
      test_id: 'test-3',
      started_at: '2026-05-01T00:00:00Z',
      ended_at: '2026-05-10T00:00:00Z',
      backfill_attempts: 2,
    }
    const test = { id: 'test-3', site_id: 'site-1', youtube_video_id: 'vid-3' }
    const video = { youtube_video_id: 'yt-video-ghi' }

    function mockTables(owner: { channel_id: string } | null) {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'ab_test_cycles') return { ...cyclesQuery([cycle]), ...updateQuery() }
        if (table === 'ab_tests') return singleQuery(test)
        if (table === 'youtube_videos') return videoQuery(video, owner)
        return {}
      })
    }

    it('canal sem conexão OAuth: pula o ciclo SEM gastar tentativa (nada é gravado no ciclo), reporta o pulo e avisa o dono', async () => {
      mockTables({ channel_id: 'UCpt' })
      mockEnsureFreshToken.mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(mockEnsureFreshToken).toHaveBeenCalledWith('site-1', 'youtube', 'UCpt')
      expect(mockFetchAnalyticsForDateRange).not.toHaveBeenCalled()
      // O YouTube nem foi consultado: nem tentativa (backfill_attempts) nem status mudam.
      expect(cycleUpdates).toEqual([])
      expect(body).toMatchObject({ status: 'ok', backfilled: 0, errors: 0, skipped: 1 })
      // Pulado não é silencioso: aviso no Sentry e UMA notificação ao dono por site/dia.
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
      expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
      const n = vi.mocked(fanOutToSiteAdmins).mock.calls[0]![0]
      expect(n.siteId).toBe('site-1')
      expect(n.type).toBe('youtube.backfill_skipped_no_connection')
      expect(n.dedupKey).toBe(`backfill-skipped-no-connection-site-1-${new Date().toISOString().slice(0, 10)}`)
      expect(n.message).toContain('UCpt')
      // Estado legítimo (canal recém-cadastrado sem OAuth): não é falha de cron.
      expect(recordCronFailure).not.toHaveBeenCalled()
      expect(recordCronSuccess).toHaveBeenCalled()
    })

    it('vídeo sem canal: não pede token (nunca "a conexão mais recente"); o ciclo não gasta tentativa', async () => {
      mockTables(null)

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
      const body = await res.json()

      expect(mockEnsureFreshToken).not.toHaveBeenCalled()
      expect(mockFetchAnalyticsForDateRange).not.toHaveBeenCalled()
      expect(cycleUpdates).toEqual([])
      expect(body).toMatchObject({ backfilled: 0, errors: 0, skipped: 1 })
      expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
    })

    it('erro de BANCO ao ler a conexão: erro da execução, ciclo não é marcado error, nada de "conecte o canal"', async () => {
      mockTables({ channel_id: 'UCpt' })
      mockEnsureFreshToken.mockRejectedValue(new Error('Could not read the youtube connection for site site-1: statement timeout'))

      const body = await (await GET(makeRequest(`Bearer ${CRON_SECRET}`))).json()

      expect(body.errors).toBe(1)
      expect(body.skipped).toBe(0)
      expect(cycleUpdates).toEqual([])
      expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
      expect(recordCronFailure).toHaveBeenCalled()
    })

    it('o select de pendentes é limitado a 200, mais recentes primeiro', async () => {
      mockTables({ channel_id: 'UCpt' })
      mockEnsureFreshToken.mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
      await GET(makeRequest(`Bearer ${CRON_SECRET}`))
      expect(cyclesOrder).toHaveBeenCalledWith('ended_at', { ascending: false })
      expect(cyclesLimit).toHaveBeenCalledWith(200)
    })

    it('vários ciclos pulados: UM aviso agregado do Sentry, com contagem e canais', async () => {
      const cycles = [1, 2, 3].map((n) => ({ ...cycle, id: `cycle-${n}` }))
      mockFrom.mockImplementation((table: string) => {
        if (table === 'ab_test_cycles') return { ...cyclesQuery(cycles), ...updateQuery() }
        if (table === 'ab_tests') return singleQuery(test)
        if (table === 'youtube_videos') return videoQuery(video, { channel_id: 'UCpt' })
        return {}
      })
      mockEnsureFreshToken.mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))

      const body = await (await GET(makeRequest(`Bearer ${CRON_SECRET}`))).json()

      expect(body.skipped).toBe(3)
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
      const [msg, ctx] = vi.mocked(Sentry.captureMessage).mock.calls[0]!
      expect(msg).toMatch(/3 cycle\(s\) skipped/)
      expect((ctx as { extra: { channels: string[] } }).extra.channels).toEqual(['UCpt'])
      expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
    })

    it('outro erro de token (ex.: falha no refresh) continua sendo erro, sem condenar o ciclo', async () => {
      mockTables({ channel_id: 'UCpt' })
      mockEnsureFreshToken.mockRejectedValue(new Error('Google token refresh failed (500): boom'))

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
      const body = await res.json()

      expect(body.errors).toBe(1)
      // Falha de token não condena o ciclo: continua pendente para a próxima rodada.
      expect(cycleUpdates).toEqual([])
      expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
      expect(recordCronFailure).toHaveBeenCalled()
    })
  })

  it('marks partial when analytics returns empty rows', async () => {
    const cycle = {
      id: 'cycle-2',
      test_id: 'test-2',
      started_at: '2026-05-01T00:00:00Z',
      ended_at: '2026-05-10T00:00:00Z',
      backfill_attempts: 1,
    }
    const test = { id: 'test-2', site_id: 'site-2', youtube_video_id: 'vid-2' }
    const video = { youtube_video_id: 'yt-video-def' }

    mockEnsureFreshToken.mockResolvedValue({ accessToken: 'tok-456' })
    mockFetchAnalyticsForDateRange.mockResolvedValue([])

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_test_cycles') {
        return {
          ...cyclesQuery([cycle]),
          ...updateQuery(),
        }
      }
      if (table === 'ab_tests') return singleQuery(test)
      if (table === 'youtube_videos') return videoQuery(video, { channel_id: 'UCpt' })
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.backfilled).toBe(0)
  })

  it('continues processing when a cycle throws and reports errors', async () => {
    const cycle = {
      id: 'cycle-err',
      test_id: 'test-err',
      started_at: '2026-05-01T00:00:00Z',
      ended_at: '2026-05-10T00:00:00Z',
      backfill_attempts: 0,
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_test_cycles') {
        return {
          ...cyclesQuery([cycle]),
          ...updateQuery(),
        }
      }
      if (table === 'ab_tests') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockRejectedValue(new Error('db error')),
            }),
          }),
        }
      }
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.errors).toBe(1)
  })
})
