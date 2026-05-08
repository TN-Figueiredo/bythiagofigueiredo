import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn(() => Promise.resolve({ error: null }))
const mockFrom = vi.fn(() => ({ insert: mockInsert }))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/track/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

const validEvent = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  siteId: '22222222-2222-4222-8222-222222222222',
  resourceType: 'blog' as const,
  resourceId: '33333333-3333-4333-8333-333333333333',
  eventType: 'view' as const,
  anonymousId: '44444444-4444-4444-8444-444444444444',
  hasConsent: false,
}

describe('POST /api/track/content', () => {
  beforeEach(() => vi.clearAllMocks())

  async function callRoute(body: unknown, headers: Record<string, string> = {}) {
    vi.resetModules()
    const { POST } = await import('../../../src/app/api/track/content/route')
    return POST(makeRequest(body, headers))
  }

  it('returns 204 for valid view event', async () => {
    const res = await callRoute({ events: [validEvent] })
    expect(res.status).toBe(204)
    expect(mockFrom).toHaveBeenCalledWith('content_events')
  })

  it('strips user_agent when hasConsent is false', async () => {
    await callRoute({ events: [validEvent] })
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].user_agent).toBeNull()
  })

  it('includes user_agent when hasConsent is true', async () => {
    await callRoute(
      { events: [{ ...validEvent, hasConsent: true }] },
      { 'user-agent': 'Mozilla/5.0 Chrome/125' },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].user_agent).toBe('Mozilla/5.0 Chrome/125')
  })

  it('returns 400 for missing events array', async () => {
    const res = await callRoute({})
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid event_type', async () => {
    const res = await callRoute({ events: [{ ...validEvent, eventType: 'hover' }] })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid resourceType', async () => {
    const res = await callRoute({ events: [{ ...validEvent, resourceType: 'page' }] })
    expect(res.status).toBe(400)
  })

  it('returns 400 for events exceeding max 5', async () => {
    const events = Array.from({ length: 6 }, () => validEvent)
    const res = await callRoute({ events })
    expect(res.status).toBe(400)
  })

  it('returns 204 when CONTENT_TRACKING_ENABLED is false', async () => {
    process.env.CONTENT_TRACKING_ENABLED = 'false'
    const res = await callRoute({ events: [validEvent] })
    expect(res.status).toBe(204)
    expect(mockFrom).not.toHaveBeenCalled()
    delete process.env.CONTENT_TRACKING_ENABLED
  })

  it('truncates user_agent exceeding MAX_USER_AGENT_LENGTH', async () => {
    const longUa = 'X'.repeat(1000)
    await callRoute(
      { events: [{ ...validEvent, hasConsent: true }] },
      { 'user-agent': longUa },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect((rows[0].user_agent as string).length).toBe(512)
  })

  it('returns 429 when rate limit exceeded', async () => {
    vi.resetModules()
    const { POST } = await import('../../../src/app/api/track/content/route')
    for (let i = 0; i < 30; i++) {
      await POST(makeRequest({ events: [validEvent] }, { 'x-forwarded-for': '10.0.0.99' }))
    }
    const res = await POST(makeRequest({ events: [validEvent] }, { 'x-forwarded-for': '10.0.0.99' }))
    expect(res.status).toBe(429)
  })

  it('includes geo data from Vercel headers in inserted rows', async () => {
    await callRoute(
      { events: [validEvent] },
      {
        'x-vercel-ip-country': 'BR',
        'x-vercel-ip-city': 'Sao Paulo',
        'x-vercel-ip-country-region': 'SP',
      },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].country).toBe('BR')
    expect(rows[0].city).toBe('Sao Paulo')
    expect(rows[0].region).toBe('SP')
  })

  it('includes geo from Cloudflare headers as fallback', async () => {
    await callRoute(
      { events: [validEvent] },
      {
        'cf-ipcountry': 'US',
        'cf-ipcity': 'New York',
        'cf-ipregion': 'NY',
      },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].country).toBe('US')
    expect(rows[0].city).toBe('New York')
    expect(rows[0].region).toBe('NY')
  })

  it('sets null geo when no geo headers present', async () => {
    await callRoute({ events: [validEvent] })
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].country).toBeNull()
    expect(rows[0].city).toBeNull()
    expect(rows[0].region).toBeNull()
  })

  it('classifies device_type from user-agent', async () => {
    await callRoute(
      { events: [validEvent] },
      { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile' },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].device_type).toBe('mobile')
  })

  it('classifies desktop user-agent', async () => {
    await callRoute(
      { events: [validEvent] },
      { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0' },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].device_type).toBe('desktop')
  })

  it('classifies bot user-agent', async () => {
    await callRoute(
      { events: [validEvent] },
      { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].device_type).toBe('bot')
  })

  it('sets null device_type when no user-agent header', async () => {
    await callRoute({ events: [validEvent] })
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].device_type).toBeNull()
  })

  it('saves geo regardless of hasConsent (legitimate interest)', async () => {
    await callRoute(
      { events: [{ ...validEvent, hasConsent: false }] },
      { 'x-vercel-ip-country': 'DE' },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].country).toBe('DE')
    expect(rows[0].user_agent).toBeNull()
  })
})
