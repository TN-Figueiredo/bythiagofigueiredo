import { describe, it, expect, vi, beforeEach } from 'vitest'

const CRON_SECRET = 'test-cron-secret'
process.env.CRON_SECRET = CRON_SECRET

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))

vi.mock('../../../lib/logger', () => ({
  withCronLock: vi.fn(
    (_sb: unknown, _key: string, _runId: string, _tag: string, fn: () => Promise<unknown>) =>
      fn().then((r: unknown) => Response.json(r)),
  ),
  newRunId: vi.fn(() => 'test-run-id'),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '../../../src/app/api/cron/linktree-aggregate-metrics/route'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(auth?: string): Request {
  const headers = new Headers()
  if (auth !== undefined) {
    headers.set('authorization', auth)
  } else {
    headers.set('authorization', `Bearer ${CRON_SECRET}`)
  }
  return new Request('http://localhost/api/cron/linktree-aggregate-metrics', { headers })
}

function watermarkQuery(lastProcessedAt: string | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: lastProcessedAt ? { last_processed_at: lastProcessedAt } : null,
          error: null,
        }),
      }),
    }),
  }
}

function eventsQuery(events: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      gt: vi.fn().mockReturnValue({
        lte: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: events, error: null }),
          }),
        }),
      }),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [{ visitor_id: 'v1' }], error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  }
}

function watermarkUpsert(error: null | object = null) {
  return {
    upsert: vi.fn().mockResolvedValue({ error }),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/linktree-aggregate-metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(new Request('http://localhost/api/cron/linktree-aggregate-metrics'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest('Bearer wrong'))
    expect(res.status).toBe(401)
  })

  it('returns ok with 0 aggregated when no events exist', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'link_aggregation_watermark') return watermarkQuery(null)
      if (table === 'linktree_events') return eventsQuery([])
      return {}
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.aggregated).toBe(0)
    expect(body.eventsProcessed).toBe(0)
  })

  it('happy path: aggregates events and upserts metrics', async () => {
    const now = new Date().toISOString()
    const fakeEvents = [
      {
        site_id: 'site-1',
        event_type: 'pageview',
        link_key: null,
        visitor_id: 'v1',
        is_bot: false,
        device_type: 'mobile',
        referrer_source: 'direct',
        country: 'BR',
        created_at: now,
      },
      {
        site_id: 'site-1',
        event_type: 'link_click',
        link_key: 'github',
        visitor_id: 'v1',
        is_bot: false,
        device_type: 'mobile',
        referrer_source: 'direct',
        country: 'BR',
        created_at: now,
      },
    ]

    mockRpc.mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'link_aggregation_watermark') {
        return {
          ...watermarkQuery(null),
          ...watermarkUpsert(),
        }
      }
      if (table === 'linktree_events') return eventsQuery(fakeEvents)
      return {}
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.aggregated).toBe(1) // 1 site+date bucket
    expect(body.eventsProcessed).toBe(2)
  })

  it('returns error when linktree_events query fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'link_aggregation_watermark') return watermarkQuery(null)
      if (table === 'linktree_events') {
        return {
          select: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
                }),
              }),
            }),
          }),
        }
      }
      return {}
    })

    const Sentry = await import('@sentry/nextjs')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200) // withCronLock wraps result as 200
    const body = await res.json()
    expect(body.status).toBe('error')
    expect(body.error).toBe('db error')
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
