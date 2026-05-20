import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { getSupabaseServiceClient } from '../../../../lib/supabase/service'

// ---------------------------------------------------------------------------
// Bucketing logic tests — extracted from the route's emptyBucket + event loop
// ---------------------------------------------------------------------------

interface Bucket {
  siteId: string
  date: string
  weekday: number
  pageviews: number
  linkClicks: number
  botViews: number
  mobile: number
  desktop: number
  tablet: number
  refDirect: number
  refSearch: number
  refSocial: number
  refEmail: number
  refReferral: number
  refOther: number
  countries: Record<string, number>
  hourlyViews: number[]
  linkClicksByKey: Record<string, number>
}

function emptyBucket(siteId: string, date: string, weekday: number): Bucket {
  return {
    siteId,
    date,
    weekday,
    pageviews: 0,
    linkClicks: 0,
    botViews: 0,
    mobile: 0,
    desktop: 0,
    tablet: 0,
    refDirect: 0,
    refSearch: 0,
    refSocial: 0,
    refEmail: 0,
    refReferral: 0,
    refOther: 0,
    countries: {},
    hourlyViews: Array.from({ length: 24 }, () => 0),
    linkClicksByKey: {},
  }
}

interface MockEvent {
  site_id: string
  event_type: 'pageview' | 'link_click'
  link_key: string | null
  visitor_id: string | null
  is_bot: boolean
  device_type: 'mobile' | 'desktop' | 'tablet' | null
  referrer_source: 'direct' | 'search' | 'social' | 'email' | 'referral' | null
  country: string | null
  created_at: string
}

function bucketEvents(events: MockEvent[]): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>()
  for (const e of events) {
    const d = new Date(e.created_at)
    const dateStr = d.toISOString().slice(0, 10)
    const key = `${e.site_id}:${dateStr}`

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = emptyBucket(e.site_id, dateStr, d.getUTCDay())
      buckets.set(key, bucket)
    }

    if (e.event_type === 'pageview') {
      bucket.pageviews++
      if (e.is_bot) bucket.botViews++

      const hour = d.getUTCHours()
      bucket.hourlyViews[hour]!++

      switch (e.device_type) {
        case 'mobile':
          bucket.mobile++
          break
        case 'desktop':
          bucket.desktop++
          break
        case 'tablet':
          bucket.tablet++
          break
      }

      switch (e.referrer_source) {
        case 'direct':
          bucket.refDirect++
          break
        case 'search':
          bucket.refSearch++
          break
        case 'social':
          bucket.refSocial++
          break
        case 'email':
          bucket.refEmail++
          break
        case 'referral':
          bucket.refReferral++
          break
        default:
          bucket.refOther++
          break
      }

      if (e.country) {
        bucket.countries[e.country] = (bucket.countries[e.country] ?? 0) + 1
      }
    } else if (e.event_type === 'link_click') {
      bucket.linkClicks++
      if (e.link_key) {
        bucket.linkClicksByKey[e.link_key] = (bucket.linkClicksByKey[e.link_key] ?? 0) + 1
      }
    }
  }
  return buckets
}

function makeEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  return {
    site_id: 'site-1',
    event_type: 'pageview',
    link_key: null,
    visitor_id: 'v-1',
    is_bot: false,
    device_type: 'desktop',
    referrer_source: 'direct',
    country: 'BR',
    created_at: '2026-05-20T14:30:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Section 1: Bucketing logic (pure functions)
// ---------------------------------------------------------------------------

describe('linktree-aggregate-metrics — bucketing logic', () => {
  it('groups events by site_id + date into correct buckets', () => {
    const events: MockEvent[] = [
      makeEvent({ site_id: 'site-1', created_at: '2026-05-20T10:00:00.000Z' }),
      makeEvent({ site_id: 'site-2', created_at: '2026-05-20T11:00:00.000Z' }),
      makeEvent({ site_id: 'site-1', created_at: '2026-05-20T12:00:00.000Z' }),
    ]

    const buckets = bucketEvents(events)
    expect(buckets.size).toBe(2)
    expect(buckets.has('site-1:2026-05-20')).toBe(true)
    expect(buckets.has('site-2:2026-05-20')).toBe(true)
    expect(buckets.get('site-1:2026-05-20')!.pageviews).toBe(2)
    expect(buckets.get('site-2:2026-05-20')!.pageviews).toBe(1)
  })

  it('increments pageviews, device, referrer, country, and hourly counters for pageview events', () => {
    const events: MockEvent[] = [
      makeEvent({
        device_type: 'mobile',
        referrer_source: 'social',
        country: 'US',
        created_at: '2026-05-20T08:15:00.000Z',
      }),
      makeEvent({
        device_type: 'desktop',
        referrer_source: 'search',
        country: 'BR',
        created_at: '2026-05-20T14:00:00.000Z',
      }),
      makeEvent({
        device_type: 'tablet',
        referrer_source: 'email',
        country: 'BR',
        created_at: '2026-05-20T14:30:00.000Z',
      }),
    ]

    const buckets = bucketEvents(events)
    const b = buckets.get('site-1:2026-05-20')!

    expect(b.pageviews).toBe(3)
    expect(b.mobile).toBe(1)
    expect(b.desktop).toBe(1)
    expect(b.tablet).toBe(1)
    expect(b.refSocial).toBe(1)
    expect(b.refSearch).toBe(1)
    expect(b.refEmail).toBe(1)
    expect(b.countries).toEqual({ US: 1, BR: 2 })
    expect(b.hourlyViews[8]).toBe(1)
    expect(b.hourlyViews[14]).toBe(2)
  })

  it('increments linkClicks and linkClicksByKey for link_click events', () => {
    const events: MockEvent[] = [
      makeEvent({ event_type: 'link_click', link_key: 'social:instagram' }),
      makeEvent({ event_type: 'link_click', link_key: 'social:instagram' }),
      makeEvent({ event_type: 'link_click', link_key: 'highlight' }),
    ]

    const buckets = bucketEvents(events)
    const b = buckets.get('site-1:2026-05-20')!

    expect(b.linkClicks).toBe(3)
    expect(b.linkClicksByKey).toEqual({
      'social:instagram': 2,
      highlight: 1,
    })
    // link_click events should NOT increment pageviews
    expect(b.pageviews).toBe(0)
  })

  it('increments botViews for bot pageviews', () => {
    const events: MockEvent[] = [
      makeEvent({ is_bot: true }),
      makeEvent({ is_bot: true }),
      makeEvent({ is_bot: false }),
    ]

    const buckets = bucketEvents(events)
    const b = buckets.get('site-1:2026-05-20')!

    expect(b.pageviews).toBe(3)
    expect(b.botViews).toBe(2)
  })

  it('separates events from different dates into distinct buckets', () => {
    const events: MockEvent[] = [
      makeEvent({ created_at: '2026-05-19T23:00:00.000Z' }),
      makeEvent({ created_at: '2026-05-20T01:00:00.000Z' }),
      makeEvent({ created_at: '2026-05-20T12:00:00.000Z' }),
    ]

    const buckets = bucketEvents(events)
    expect(buckets.size).toBe(2)
    expect(buckets.get('site-1:2026-05-19')!.pageviews).toBe(1)
    expect(buckets.get('site-1:2026-05-20')!.pageviews).toBe(2)
  })

  it('derives weekday correctly from date (UTC)', () => {
    // 2026-05-20 is a Wednesday = UTC day 3
    const events: MockEvent[] = [
      makeEvent({ created_at: '2026-05-20T10:00:00.000Z' }),
    ]
    const buckets = bucketEvents(events)
    expect(buckets.get('site-1:2026-05-20')!.weekday).toBe(3)

    // 2026-05-17 is a Sunday = UTC day 0
    const events2: MockEvent[] = [
      makeEvent({ created_at: '2026-05-17T10:00:00.000Z' }),
    ]
    const buckets2 = bucketEvents(events2)
    expect(buckets2.get('site-1:2026-05-17')!.weekday).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Section 2: Route handler tests (mocked Supabase)
// ---------------------------------------------------------------------------

describe('GET /api/cron/linktree-aggregate-metrics — handler', () => {
  let GET: typeof import('@/app/api/cron/linktree-aggregate-metrics/route').GET

  beforeEach(async () => {
    vi.resetModules()
    process.env.CRON_SECRET = CRON_SECRET
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.CRON_SECRET
  })

  function makeRequest(secret?: string) {
    return new Request('http://localhost/api/cron/linktree-aggregate-metrics', {
      method: 'GET',
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    })
  }

  it('returns 401 without authorization header', async () => {
    const mod = await import('@/app/api/cron/linktree-aggregate-metrics/route')
    GET = mod.GET
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 401 with wrong secret', async () => {
    const mod = await import('@/app/api/cron/linktree-aggregate-metrics/route')
    GET = mod.GET
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns early with aggregated:0 when no events since watermark', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'link_aggregation_watermark') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { last_processed_at: '2026-05-20T00:00:00.000Z' },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'linktree_events') {
          return {
            select: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }
        }
        return {}
      }),
      rpc: vi.fn().mockImplementation((name: string) => {
        if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null })
        if (name === 'cron_unlock') return Promise.resolve({ data: null, error: null })
        return Promise.resolve({ data: null, error: null })
      }),
    }

    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase as never)
    const mod = await import('@/app/api/cron/linktree-aggregate-metrics/route')
    GET = mod.GET

    const res = await GET(makeRequest(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.aggregated).toBe(0)
    expect(body.eventsProcessed).toBe(0)
  })

  it('calls upsert RPC with expected row shape when events exist', async () => {
    const rpcMock = vi.fn().mockImplementation((name: string) => {
      if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null })
      if (name === 'cron_unlock') return Promise.resolve({ data: null, error: null })
      if (name === 'upsert_linktree_daily_metrics') return Promise.resolve({ error: null })
      return Promise.resolve({ data: null, error: null })
    })

    const testEvents = [
      {
        site_id: 'site-1',
        event_type: 'pageview',
        link_key: null,
        visitor_id: 'v-1',
        is_bot: false,
        device_type: 'mobile',
        referrer_source: 'direct',
        country: 'BR',
        created_at: '2026-05-20T10:00:00.000Z',
      },
      {
        site_id: 'site-1',
        event_type: 'link_click',
        link_key: 'highlight',
        visitor_id: 'v-1',
        is_bot: false,
        device_type: null,
        referrer_source: null,
        country: null,
        created_at: '2026-05-20T10:01:00.000Z',
      },
    ]

    let eventsCallCount = 0
    const upsertMock = vi.fn().mockResolvedValue({ error: null })

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'link_aggregation_watermark') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { last_processed_at: '2026-05-20T00:00:00.000Z' },
                  error: null,
                }),
              }),
            }),
            upsert: upsertMock,
          }
        }
        if (table === 'linktree_events') {
          // First call returns events, second returns visitor rows for unique count
          const selectImpl = vi.fn().mockImplementation(() => {
            eventsCallCount++
            if (eventsCallCount === 1) {
              // Fetch events page
              return {
                gt: vi.fn().mockReturnValue({
                  lte: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({
                        data: testEvents,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }
            }
            // Unique visitors query (phase 2) or second page (empty)
            return {
              gt: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lt: vi.fn().mockReturnValue({
                      not: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue({
                          data: [{ visitor_id: 'v-1' }],
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }
          })
          return { select: selectImpl }
        }
        return {}
      }),
      rpc: rpcMock,
    }

    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase as never)
    const mod = await import('@/app/api/cron/linktree-aggregate-metrics/route')
    GET = mod.GET

    const res = await GET(makeRequest(CRON_SECRET))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.aggregated).toBe(1)
    expect(body.eventsProcessed).toBe(2)

    // Verify the upsert RPC was called with expected shape
    expect(rpcMock).toHaveBeenCalledWith(
      'upsert_linktree_daily_metrics',
      expect.objectContaining({
        p_rows: expect.arrayContaining([
          expect.objectContaining({
            site_id: 'site-1',
            date: '2026-05-20',
            weekday: 3, // Wednesday
            pageviews: 1,
            link_clicks: 1,
            bot_views: 0,
            mobile_views: 1,
            desktop_views: 0,
            tablet_views: 0,
            ref_direct: 1,
            countries: { BR: 1 },
            link_clicks_by_key: { highlight: 1 },
          }),
        ]),
      }),
    )
  })
})
