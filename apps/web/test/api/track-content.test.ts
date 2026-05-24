// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockCaptureException, mockResolveGeo, mockClassifyDevice } = vi.hoisted(() => ({
  mockCaptureException: vi.fn(),
  mockResolveGeo: vi.fn(),
  mockClassifyDevice: vi.fn(),
}))

const mockInsert = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: vi.fn(() => ({ insert: mockInsert })),
  }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}))

vi.mock('@/lib/tracking/config', () => ({
  CONTENT_TRACKING_ENABLED: true,
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX: 30,
  MAX_USER_AGENT_LENGTH: 512,
}))

vi.mock('@/lib/request/geo', () => ({
  resolveGeo: mockResolveGeo,
}))

vi.mock('@/lib/request/device', () => ({
  classifyDevice: mockClassifyDevice,
}))

import { POST } from '../../src/app/api/track/content/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SITE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const RESOURCE_ID = '11111111-2222-3333-4444-555555555555'

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'sess-001',
    siteId: SITE_ID,
    resourceType: 'blog',
    resourceId: RESOURCE_ID,
    eventType: 'view',
    anonymousId: 'anon-1',
    hasConsent: true,
    ...overrides,
  }
}

function trackRequest(body: unknown, ip = '10.0.0.1'): Request {
  return new Request('http://localhost/api/track/content', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      'user-agent': 'Mozilla/5.0',
    },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/track/content', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ data: null, error: null })
    mockResolveGeo.mockReturnValue({ country: 'BR', city: 'Sao Paulo', region: 'SP' })
    mockClassifyDevice.mockReturnValue('desktop')
  })

  it('returns 400 for invalid body', async () => {
    const res = await POST(trackRequest({ wrong: true }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_body')
  })

  it('inserts event rows and returns 204 on success', async () => {
    const res = await POST(trackRequest({ events: [validEvent()] }))
    expect(res.status).toBe(204)
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        session_id: 'sess-001',
        site_id: SITE_ID,
        resource_type: 'blog',
        resource_id: RESOURCE_ID,
        event_type: 'view',
        anonymous_id: 'anon-1',
        has_consent: true,
        country: 'BR',
        city: 'Sao Paulo',
        region: 'SP',
        device_type: 'desktop',
        user_agent: 'Mozilla/5.0',
      }),
    ])
  })

  it('nullifies user_agent when hasConsent is false', async () => {
    const res = await POST(
      trackRequest({ events: [validEvent({ hasConsent: false })] }),
    )
    expect(res.status).toBe(204)
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        has_consent: false,
        user_agent: null,
      }),
    ])
  })

  it('reports DB errors to Sentry but still returns 204', async () => {
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'db error' },
    })
    const res = await POST(trackRequest({ events: [validEvent()] }))
    expect(res.status).toBe(204)
    expect(mockCaptureException).toHaveBeenCalled()
  })

  it('returns 429 when rate limit exceeded', async () => {
    const ip = '172.16.0.99'
    // Exceed RATE_LIMIT_MAX (30) requests
    for (let i = 0; i < 30; i++) {
      await POST(trackRequest({ events: [validEvent()] }, ip))
    }
    const res = await POST(trackRequest({ events: [validEvent()] }, ip))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('rate_limited')
  })
})
