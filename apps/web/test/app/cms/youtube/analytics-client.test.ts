import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// server-only is already stubbed via vitest.config.ts alias → test/__stubs__/server-only.ts

// Mock Supabase service client
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// Mock token refresh
vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: vi.fn(),
}))

import { YouTubeAnalyticsError, fetchYtSearchTerms, fetchYtDemographics, fetchYtChannelMetrics } from '@/lib/youtube/analytics-client'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import * as Sentry from '@sentry/nextjs'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchMock(responses: Array<{ status: number; ok: boolean; body?: unknown; text?: string }>) {
  let callIndex = 0
  return vi.fn().mockImplementation(() => {
    const config = responses[callIndex % responses.length]!
    callIndex++
    return Promise.resolve({
      ok: config.ok,
      status: config.status,
      json: () => Promise.resolve(config.body ?? {}),
      text: () => Promise.resolve(config.text ?? ''),
    })
  })
}

function makeSupabaseMock(accountId: string | null) {
  const single = vi.fn().mockResolvedValue({
    data: accountId ? { account_id: accountId } : null,
  })
  const limit = vi.fn().mockReturnValue({ single })
  const order = vi.fn().mockReturnValue({ limit })
  const is = vi.fn().mockReturnValue({ order })
  // eq3 is for optional .eq('account_id', targetChannelId) after .is()
  const eq3 = vi.fn().mockReturnValue({ order })
  // eq2 returns both .eq (for optional targetChannelId) and .is (for revoked_at null)
  const eq2 = vi.fn().mockReturnValue({ eq: eq3, is })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
  const inFn = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ eq: eq1, in: inFn })
  const from = vi.fn().mockReturnValue({ select })
  return { from } as unknown as ReturnType<typeof getSupabaseServiceClient>
}

// ---------------------------------------------------------------------------
// YouTubeAnalyticsError
// ---------------------------------------------------------------------------

describe('YouTubeAnalyticsError', () => {
  it('is an instance of Error', () => {
    const err = new YouTubeAnalyticsError('msg', 403, 'impressions', 'UC123', 'body')
    expect(err).toBeInstanceOf(Error)
  })

  it('has name YouTubeAnalyticsError', () => {
    const err = new YouTubeAnalyticsError('msg', 403, 'impressions', 'UC123')
    expect(err.name).toBe('YouTubeAnalyticsError')
  })

  it('stores all fields correctly', () => {
    const err = new YouTubeAnalyticsError('fail', 429, 'views', 'UC456', 'rate limited')
    expect(err.message).toBe('fail')
    expect(err.statusCode).toBe(429)
    expect(err.endpoint).toBe('views')
    expect(err.channelId).toBe('UC456')
    expect(err.errorBody).toBe('rate limited')
  })

  it('errorBody is undefined when omitted', () => {
    const err = new YouTubeAnalyticsError('oops', 500, 'ep', 'UC1')
    expect(err.errorBody).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// fetchWithRetry (tested indirectly through the public API)
// ---------------------------------------------------------------------------

describe('fetchWithRetry — retry behaviour (via fetchYtSearchTerms)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      makeSupabaseMock('UC_TEST'),
    )
    vi.mocked(ensureFreshToken).mockResolvedValue({
      accessToken: 'token-abc',
      provider: 'youtube',
    } as Awaited<ReturnType<typeof ensureFreshToken>>)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns on first success (no retry needed)', async () => {
    const successBody = { rows: [['term', 100, 50]] }
    global.fetch = makeFetchMock([{ status: 200, ok: true, body: successBody }])

    const promise = fetchYtSearchTerms('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toHaveLength(1)
    expect(result[0]!.term).toBe('term')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 and succeeds on second attempt', async () => {
    const successBody = { rows: [['retry term', 200, 80]] }
    global.fetch = makeFetchMock([
      { status: 429, ok: false, text: 'rate limited' },
      { status: 200, ok: true, body: successBody },
    ])

    const promise = fetchYtSearchTerms('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toHaveLength(1)
    expect(result[0]!.term).toBe('retry term')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('retries on 500 and succeeds on third attempt', async () => {
    const successBody = { rows: [['third', 50, 25]] }
    global.fetch = makeFetchMock([
      { status: 500, ok: false, text: 'server error' },
      { status: 500, ok: false, text: 'still broken' },
      { status: 200, ok: true, body: successBody },
    ])

    const promise = fetchYtSearchTerms('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result[0]!.term).toBe('third')
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('throws after max retries are exceeded', async () => {
    global.fetch = makeFetchMock([
      { status: 500, ok: false },
      { status: 500, ok: false },
      { status: 500, ok: false },
    ])

    // Attach rejection handler BEFORE running timers to avoid unhandled rejection warnings
    const promise = fetchYtSearchTerms('site-1', 30)
    const rejection = expect(promise).rejects.toThrow('HTTP 500')
    await vi.runAllTimersAsync()
    await rejection
  })

  it('bails immediately on 4xx (not 429) without retrying', async () => {
    // 404 is a non-retryable 4xx — fetchWithRetry returns the response as-is (no retry),
    // then queryYtAnalytics throws YouTubeAnalyticsError because !res.ok
    global.fetch = makeFetchMock([
      { status: 404, ok: false, text: 'not found' },
    ])

    // Attach rejection handler before timers to prevent unhandled rejection
    const promise = fetchYtSearchTerms('site-1', 30)
    const rejection = expect(promise).rejects.toBeInstanceOf(YouTubeAnalyticsError)
    await vi.runAllTimersAsync()
    await rejection
    // Only 1 call — no retry on 4xx
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// fetchYtChannelMetrics — dual API call + impression 403 fallback
// ---------------------------------------------------------------------------

describe('fetchYtChannelMetrics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      makeSupabaseMock('UC_CHAN'),
    )
    vi.mocked(ensureFreshToken).mockResolvedValue({
      accessToken: 'token-xyz',
      provider: 'youtube',
    } as Awaited<ReturnType<typeof ensureFreshToken>>)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns null when no token/connection found', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeSupabaseMock(null))
    global.fetch = vi.fn()

    const result = await fetchYtChannelMetrics('site-x', 30)
    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns null when coreReport has no rows', async () => {
    global.fetch = makeFetchMock([
      { status: 200, ok: true, body: { rows: [] } },
      { status: 200, ok: true, body: { rows: [] } },
    ])

    const promise = fetchYtChannelMetrics('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBeNull()
  })

  it('combines core + impression reports correctly', async () => {
    const coreRow = [1000, 500, 180, 45.5, 20, 5, 150, 30, 25]
    const impRow = [3000, 8.2]

    global.fetch = makeFetchMock([
      { status: 200, ok: true, body: { rows: [coreRow] } },
      { status: 200, ok: true, body: { rows: [impRow] } },
    ])

    const promise = fetchYtChannelMetrics('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).not.toBeNull()
    expect(result!.views).toBe(1000)
    expect(result!.estimatedMinutesWatched).toBe(500)
    expect(result!.averageViewDuration).toBe(180)
    expect(result!.averageViewPercentage).toBe(45.5)
    expect(result!.subscribersGained).toBe(20)
    expect(result!.subscribersLost).toBe(5)
    expect(result!.likes).toBe(150)
    expect(result!.comments).toBe(30)
    expect(result!.shares).toBe(25)
    expect(result!.impressions).toBe(3000)
    expect(result!.impressionClickThroughRate).toBe(8.2)
  })

  it('falls back to 0 impressions on 403 (scope not granted)', async () => {
    const coreRow = [500, 250, 120, 40.0, 10, 2, 80, 15, 8]

    // First call succeeds (core), second call 403 (impressions)
    global.fetch = makeFetchMock([
      { status: 200, ok: true, body: { rows: [coreRow] } },
      { status: 403, ok: false, text: 'forbidden' },
    ])

    const promise = fetchYtChannelMetrics('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).not.toBeNull()
    expect(result!.views).toBe(500)
    // Impression fallback to 0
    expect(result!.impressions).toBe(0)
    expect(result!.impressionClickThroughRate).toBe(0)
    // Non-impression fields still correct
    expect(result!.likes).toBe(80)
  })

  it('captures to Sentry and falls back on non-403 impression error', async () => {
    const coreRow = [500, 250, 120, 40.0, 10, 2, 80, 15, 8]

    global.fetch = makeFetchMock([
      { status: 200, ok: true, body: { rows: [coreRow] } },
      // 503 on impression call — non-403, should go to Sentry
      { status: 503, ok: false },
      { status: 503, ok: false },
      { status: 503, ok: false },
    ])

    const promise = fetchYtChannelMetrics('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).not.toBeNull()
    expect(result!.impressions).toBe(0)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// fetchYtSearchTerms — row mapping
// ---------------------------------------------------------------------------

describe('fetchYtSearchTerms', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      makeSupabaseMock('UC_SEARCH'),
    )
    vi.mocked(ensureFreshToken).mockResolvedValue({
      accessToken: 'token-s',
      provider: 'youtube',
    } as Awaited<ReturnType<typeof ensureFreshToken>>)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns empty array when no connection found', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeSupabaseMock(null))
    const result = await fetchYtSearchTerms('site-x', 30)
    expect(result).toEqual([])
  })

  it('maps rows to { term, views, estimatedMinutesWatched }', async () => {
    const rows = [
      ['como aprender programação', 320, 160],
      ['javascript tutorial', 250, 120],
    ]
    global.fetch = makeFetchMock([{ status: 200, ok: true, body: { rows } }])

    const promise = fetchYtSearchTerms('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ term: 'como aprender programação', views: 320, estimatedMinutesWatched: 160 })
    expect(result[1]).toEqual({ term: 'javascript tutorial', views: 250, estimatedMinutesWatched: 120 })
  })

  it('returns empty array when API returns no rows', async () => {
    global.fetch = makeFetchMock([{ status: 200, ok: true, body: {} }])

    const promise = fetchYtSearchTerms('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual([])
  })

  it('coerces string numbers in rows to Number', async () => {
    const rows = [['query', '150', '75']]
    global.fetch = makeFetchMock([{ status: 200, ok: true, body: { rows } }])

    const promise = fetchYtSearchTerms('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(typeof result[0]!.views).toBe('number')
    expect(result[0]!.views).toBe(150)
  })
})

// ---------------------------------------------------------------------------
// fetchYtDemographics — 3-call aggregation
// ---------------------------------------------------------------------------

describe('fetchYtDemographics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      makeSupabaseMock('UC_DEMO'),
    )
    vi.mocked(ensureFreshToken).mockResolvedValue({
      accessToken: 'token-d',
      provider: 'youtube',
    } as Awaited<ReturnType<typeof ensureFreshToken>>)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns empty arrays when no connection found', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeSupabaseMock(null))
    const result = await fetchYtDemographics('site-x', 30)
    expect(result).toEqual({ ageGender: [], countries: [], devices: [] })
  })

  it('aggregates age/gender rows into ageGender array', async () => {
    const ageRows = [
      ['age18-24', 'male', 25.0],
      ['age18-24', 'female', 18.0],
      ['age25-34', 'male', 30.0],
      ['age25-34', 'female', 22.0],
    ]
    const countryRows = [['BR', 700, 350]]
    const deviceRows = [['MOBILE', 600, 300]]

    global.fetch = makeFetchMock([
      { status: 200, ok: true, body: { rows: ageRows } },
      { status: 200, ok: true, body: { rows: countryRows } },
      { status: 200, ok: true, body: { rows: deviceRows } },
    ])

    const promise = fetchYtDemographics('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.ageGender).toHaveLength(2)
    expect(result.ageGender.find(a => a.ageGroup === 'age18-24')).toEqual({ ageGroup: 'age18-24', male: 25.0, female: 18.0 })
    expect(result.ageGender.find(a => a.ageGroup === 'age25-34')).toEqual({ ageGroup: 'age25-34', male: 30.0, female: 22.0 })
  })

  it('aggregates country rows with percentage calculation', async () => {
    const ageRows: unknown[][] = []
    const countryRows = [
      ['BR', 700, 350],
      ['US', 200, 100],
      ['PT', 100, 50],
    ]
    const deviceRows: unknown[][] = []

    global.fetch = makeFetchMock([
      { status: 200, ok: true, body: { rows: ageRows } },
      { status: 200, ok: true, body: { rows: countryRows } },
      { status: 200, ok: true, body: { rows: deviceRows } },
    ])

    const promise = fetchYtDemographics('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.countries).toHaveLength(3)
    expect(result.countries[0]).toEqual({ country: 'BR', views: 700, percentage: 70 })
    expect(result.countries[1]).toEqual({ country: 'US', views: 200, percentage: 20 })
    expect(result.countries[2]).toEqual({ country: 'PT', views: 100, percentage: 10 })
  })

  it('handles zero total country views (no divide-by-zero)', async () => {
    const countryRows = [['BR', 0, 0]]

    global.fetch = makeFetchMock([
      { status: 200, ok: true, body: { rows: [] } },
      { status: 200, ok: true, body: { rows: countryRows } },
      { status: 200, ok: true, body: { rows: [] } },
    ])

    const promise = fetchYtDemographics('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.countries[0]!.percentage).toBe(0)
  })

  it('aggregates device rows with percentage', async () => {
    const deviceRows = [
      ['MOBILE', 600, 300],
      ['DESKTOP', 300, 150],
      ['TABLET', 100, 50],
    ]

    global.fetch = makeFetchMock([
      { status: 200, ok: true, body: { rows: [] } },
      { status: 200, ok: true, body: { rows: [] } },
      { status: 200, ok: true, body: { rows: deviceRows } },
    ])

    const promise = fetchYtDemographics('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.devices).toHaveLength(3)
    expect(result.devices[0]).toEqual({ deviceType: 'MOBILE', views: 600, percentage: 60 })
    expect(result.devices[1]).toEqual({ deviceType: 'DESKTOP', views: 300, percentage: 30 })
    expect(result.devices[2]).toEqual({ deviceType: 'TABLET', views: 100, percentage: 10 })
  })

  it('handles empty rows for all 3 calls', async () => {
    global.fetch = makeFetchMock([
      { status: 200, ok: true, body: { rows: [] } },
      { status: 200, ok: true, body: { rows: [] } },
      { status: 200, ok: true, body: { rows: [] } },
    ])

    const promise = fetchYtDemographics('site-1', 30)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.ageGender).toEqual([])
    expect(result.countries).toEqual([])
    expect(result.devices).toEqual([])
  })

  it('issues exactly 3 parallel fetch calls to YouTube Analytics API', async () => {
    global.fetch = makeFetchMock([
      { status: 200, ok: true, body: { rows: [] } },
      { status: 200, ok: true, body: { rows: [] } },
      { status: 200, ok: true, body: { rows: [] } },
    ])

    const promise = fetchYtDemographics('site-1', 30)
    await vi.runAllTimersAsync()
    await promise

    // 3 analytics calls (age/gender, country, device)
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })
})
