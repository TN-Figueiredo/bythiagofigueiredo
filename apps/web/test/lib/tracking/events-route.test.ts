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

  it('returns 429 when rate limit exceeded', async () => {
    vi.resetModules()
    const { POST } = await import('../../../src/app/api/track/content/route')
    for (let i = 0; i < 30; i++) {
      await POST(makeRequest({ events: [validEvent] }, { 'x-forwarded-for': '10.0.0.99' }))
    }
    const res = await POST(makeRequest({ events: [validEvent] }, { 'x-forwarded-for': '10.0.0.99' }))
    expect(res.status).toBe(429)
  })
})
