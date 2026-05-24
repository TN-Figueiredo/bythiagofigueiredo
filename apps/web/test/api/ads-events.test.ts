// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn()
const { mockCaptureException } = vi.hoisted(() => ({
  mockCaptureException: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: vi.fn(() => ({ insert: mockInsert })),
  }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}))

// Import after mocks
import { POST } from '../../src/app/api/ads/events/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function adEventsRequest(
  body: unknown,
  ip = '10.0.0.1',
): Request {
  return new Request('http://localhost/api/ads/events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'impression' as const,
    slotKey: 'sidebar-1',
    campaignId: null,
    userHash: 'abc123hash',
    timestamp: Date.now(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/ads/events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ data: null, error: null })
  })

  it('returns 400 for invalid body (missing events array)', async () => {
    const res = await POST(adEventsRequest({ wrong: true }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_body')
  })

  it('returns 204 for empty events array', async () => {
    const res = await POST(adEventsRequest({ events: [] }))
    expect(res.status).toBe(204)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('inserts events and returns 204 on success', async () => {
    const res = await POST(adEventsRequest({ events: [validEvent()] }))
    expect(res.status).toBe(204)
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'impression',
        slot_key: 'sidebar-1',
        user_hash: 'abc123hash',
        ip: '10.0.0.1',
      }),
    ])
  })

  it('reports DB errors to Sentry but still returns 204', async () => {
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'insert failed' },
    })
    const res = await POST(adEventsRequest({ events: [validEvent()] }))
    expect(res.status).toBe(204)
    expect(mockCaptureException).toHaveBeenCalled()
  })

  it('returns 429 when rate limit exceeded', async () => {
    const ip = '192.168.99.99'
    // Fire 51 requests from same IP to exceed the 50-request limit
    for (let i = 0; i < 50; i++) {
      await POST(adEventsRequest({ events: [validEvent()] }, ip))
    }
    const res = await POST(adEventsRequest({ events: [validEvent()] }, ip))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('rate_limited')
    expect(res.headers.get('Retry-After')).toBe('60')
  })
})
