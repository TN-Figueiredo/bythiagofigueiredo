import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockChannelAccountId } = vi.hoisted(() => ({ mockChannelAccountId: vi.fn() }))
vi.mock('@/lib/youtube/teste-youtube/nativo/guarda', async (orig) => (await import('../../helpers/guarda-nativa-vazia')).guardaVazia(await orig<typeof import('@/lib/youtube/teste-youtube/nativo/guarda')>()))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: mockChannelAccountId,
}))
import type { NextRequest } from 'next/server'
import { cadeiaUpdate } from '../../helpers/cadeia-update'
import { settleOnAirFalso } from '../../helpers/montar-saida-automatica'
import { YouTubeApiError } from '@/lib/youtube/youtube-api-error'

// T8: a 3ª falha PEDE settleOnAir(original, falha_api); o contrato dele está em ab-settle.test.ts.
vi.mock('@/lib/youtube/ab-settle', async (orig) => {
  const { settleOnAirFalso: falso } = await import('../../helpers/montar-saida-automatica')
  return { ...(await orig<typeof import('@/lib/youtube/ab-settle')>()), settleOnAir: falso }
})

const CRON_SECRET = 'test-cron-secret'
process.env.CRON_SECRET = CRON_SECRET

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))

// ── Token refresh mock ───────────────────────────────────────────────────────
const mockEnsureFreshToken = vi.fn()
vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
}))

// ── YouTube mocks ────────────────────────────────────────────────────────────
vi.mock('@/lib/youtube/ab-rotation', () => ({
  getNextVariantIndex: vi.fn().mockReturnValue(1),
}))

const mockSetThumbnail = vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/x/hqdefault.jpg' })
const mockFetchVariantImageBuffer = vi.fn().mockResolvedValue({
  buffer: Buffer.from('img'),
  contentType: 'image/png',
})

vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: (...args: unknown[]) => mockSetThumbnail(...args),
  fetchVariantImageBuffer: (...args: unknown[]) =>
    mockFetchVariantImageBuffer(...args),
}))

vi.mock('@/lib/youtube/ab-metadata', () => ({
  updateVideoMetadata: vi.fn().mockResolvedValue(undefined),
}))


const mockPreflightTokenCheck = vi.fn().mockResolvedValue({ ok: true, accessToken: 'tok-mock' })
vi.mock('@/lib/youtube/ab-preflight', () => ({
  preflightTokenCheck: (...args: unknown[]) => mockPreflightTokenCheck(...args),
}))

vi.mock('@/lib/notifications/create', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn().mockResolvedValue(undefined),
  recordCronFailure: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '@/app/api/cron/ab-rotate/route'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(authHeader?: string): NextRequest {
  return {
    headers: new Headers(authHeader ? { authorization: authHeader } : {}),
  } as unknown as NextRequest
}

function makeTest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-1',
    name: 'Teste do Lab',
    restore_seq: 0,
    site_id: 'site-1',
    youtube_video_id: 'vid-1',
    status: 'active',
    test_type: 'thumbnail',
    original_title: null,
    config: { rotation_pattern: 'abba' },
    variants: [
      { id: 'var-a', sort_order: 0, label: 'A', blob_url: 'https://abc.public.blob.vercel-storage.com/a.png', title_text: null, metadata: {}, is_original: true },
      { id: 'var-b', sort_order: 1, label: 'B', blob_url: 'https://abc.public.blob.vercel-storage.com/b.png', title_text: null, metadata: {}, is_original: false },
    ],
    ...overrides,
  }
}

function queuedTestsQuery(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  }
}

function activeTestsQuery(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      // `{ data }` = leitura dos ativos; `.single()` = releitura de restore_seq antes de cada escrita
      eq: vi.fn().mockReturnValue(Object.assign(Promise.resolve({ data, error: null }), {
        single: vi.fn().mockResolvedValue({ data: { restore_seq: 1, config: (data[0] as { config?: unknown } | undefined)?.config }, error: null }),
      })),
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

function idempotencyQuery(alreadyRotated = false) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: alreadyRotated ? { id: 'existing-cycle' } : null,
              error: null,
            }),
          }),
        }),
      }),
    }),
  }
}

function countQuery(count: number) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockResolvedValue({ count, error: null }),
      }),
    }),
  }
}

function updateQuery() {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }
}

function insertQuery() {
  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/ab-rotate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: 'ciclo-novo', error: null })
  mockChannelAccountId.mockResolvedValue('UCpt')
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

  it('returns processed: 0 when no active tests', async () => {
    let abTestsCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_tests') {
        abTestsCallCount++
        if (abTestsCallCount === 1) return queuedTestsQuery([])
        return activeTestsQuery([])
      }
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.processed).toBe(0)
  })

  it('happy path: rotates variant and opens new cycle', async () => {
    const test = makeTest()
    const video = { youtube_video_id: 'yt-abc', channel_id: 'ch-1' }

    mockEnsureFreshToken.mockResolvedValue({ accessToken: 'tok-123' })

    let abTestsCallCount = 0
    let cyclesSelectCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_tests') {
        abTestsCallCount++
        if (abTestsCallCount === 1) return queuedTestsQuery([])
        return {
          ...activeTestsQuery([test]),
          update: vi.fn((d: unknown) => cadeiaUpdate(d)),
        }
      }
      if (table === 'youtube_videos') return singleQuery(video)
      if (table === 'youtube_channels') return singleQuery({ channel_id: 'UC123' })
      if (table === 'ab_test_cycles') {
        return {
          ...updateQuery(),
          ...insertQuery(),
          select: vi.fn().mockImplementation((cols?: string) => {
            if (cols === 'started_at') return { eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }) }
            cyclesSelectCount++
            if (cyclesSelectCount === 1) {
              return idempotencyQuery(false).select()
            }
            return countQuery(4).select()
          }),
        }
      }
      if (table === 'ab_test_polls') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.processed).toBe(1)
    expect(body.errors).toBe(0)
    expect(mockSetThumbnail).toHaveBeenCalled()
    expect(mockRpc).toHaveBeenCalledWith('ab_rotate_commit', expect.objectContaining({ p_test_id: 'test-1', p_seq: 1, p_variant_id: 'var-b' }))
  })

  it('auto-pauses test on 401 auth error: a 3ª falha pede a saída por settleOnAir', async () => {
    settleOnAirFalso.mockReset()
    settleOnAirFalso.mockResolvedValue({ resultado: 'feito', campos: {} })
    const test = makeTest({ config: { rotation_pattern: 'abba', consecutive_failures: 2 } })
    const mockUpdate = vi.fn((d: unknown) => cadeiaUpdate(d))

    // Simulate YouTube API returning 401 when setThumbnail is called
    mockSetThumbnail.mockRejectedValueOnce(new YouTubeApiError(401, 'authError', 'thumbnails.set'))

    let abTestsCallCount = 0
    let cyclesSelectCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_tests') {
        abTestsCallCount++
        if (abTestsCallCount === 1) return queuedTestsQuery([])
        return {
          ...activeTestsQuery([test]),
          update: mockUpdate,
        }
      }
      if (table === 'youtube_videos') return singleQuery({ youtube_video_id: 'yt-abc', channel_id: 'ch-1' })
      if (table === 'youtube_channels') return singleQuery({ channel_id: 'UC123' })
      if (table === 'ab_test_cycles') {
        return {
          ...updateQuery(),
          ...insertQuery(),
          select: vi.fn().mockImplementation((cols?: string) => {
            if (cols === 'started_at') return { eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }) }
            cyclesSelectCount++
            if (cyclesSelectCount === 1) {
              return idempotencyQuery(false).select()
            }
            return countQuery(4).select()
          }),
        }
      }
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.errors).toBe(1)
    expect(mockUpdate).toHaveBeenCalled()
    expect(settleOnAirFalso).toHaveBeenCalledTimes(1)
    expect(settleOnAirFalso).toHaveBeenCalledWith('test-1', expect.objectContaining({ motivo: 'falha_api', consecutiveFailures: 3 }))
  })
})
