import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsertChain = {
  eq: vi.fn().mockReturnThis(),
  then: (resolve: (v: { error: null | { message: string } }) => void) =>
    Promise.resolve({ error: null }).then(resolve),
}
const mockInsert = vi.fn(() => mockInsertChain)
const mockFrom = vi.fn(() => ({ insert: mockInsert }))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/ads/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/ads/events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function callRoute(body: unknown, headers: Record<string, string> = {}) {
    vi.resetModules()
    const { POST } = await import(
      '../../src/app/api/ads/events/route'
    )
    return POST(makeRequest(body, headers))
  }

  it('returns 204 for valid impression event', async () => {
    const body = {
      events: [
        {
          type: 'impression',
          slotKey: 'banner_top',
          campaignId: 'c-1',
          userHash: 'abc123',
          timestamp: Date.now(),
        },
      ],
    }
    const res = await callRoute(body)
    expect(res.status).toBe(204)
  })

  it('returns 204 for valid click event with null campaignId', async () => {
    const body = {
      events: [
        {
          type: 'click',
          slotKey: 'rail_left',
          campaignId: null,
          userHash: 'abc123',
          timestamp: Date.now(),
        },
      ],
    }
    const res = await callRoute(body)
    expect(res.status).toBe(204)
  })

  it('returns 204 for valid dismiss event', async () => {
    const body = {
      events: [
        {
          type: 'dismiss',
          slotKey: 'block_bottom',
          campaignId: null,
          userHash: 'def456',
          timestamp: Date.now(),
        },
      ],
    }
    const res = await callRoute(body)
    expect(res.status).toBe(204)
  })

  it('returns 400 for missing events array', async () => {
    const res = await callRoute({})
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid event type', async () => {
    const body = {
      events: [
        {
          type: 'hover',
          slotKey: 'banner_top',
          campaignId: null,
          userHash: 'abc',
          timestamp: Date.now(),
        },
      ],
    }
    const res = await callRoute(body)
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty slotKey', async () => {
    const body = {
      events: [
        {
          type: 'impression',
          slotKey: '',
          campaignId: null,
          userHash: 'abc',
          timestamp: Date.now(),
        },
      ],
    }
    const res = await callRoute(body)
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty userHash', async () => {
    const body = {
      events: [
        {
          type: 'impression',
          slotKey: 'banner_top',
          campaignId: null,
          userHash: '',
          timestamp: Date.now(),
        },
      ],
    }
    const res = await callRoute(body)
    expect(res.status).toBe(400)
  })

  it('returns 400 when events array exceeds 50 items', async () => {
    const body = {
      events: Array.from({ length: 51 }, (_, i) => ({
        type: 'impression',
        slotKey: 'banner_top',
        campaignId: null,
        userHash: `hash${i}`,
        timestamp: Date.now(),
      })),
    }
    const res = await callRoute(body)
    expect(res.status).toBe(400)
  })

  it('calls supabase insert with correct table', async () => {
    const body = {
      events: [
        {
          type: 'click',
          slotKey: 'inline_mid',
          campaignId: 'camp-99',
          userHash: 'user-hash',
          timestamp: 1234567890,
        },
      ],
    }
    await callRoute(body)
    expect(mockFrom).toHaveBeenCalledWith('ad_events')
    expect(mockInsert).toHaveBeenCalled()
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].event_type).toBe('click')
    expect(rows[0].slot_key).toBe('inline_mid')
    expect(rows[0].campaign_id).toBe('camp-99')
  })

  it('returns 429 when rate limit exceeded (>50 events per IP per minute)', async () => {
    const { POST } = await import('../../src/app/api/ads/events/route')
    const singleEvent = {
      events: [
        {
          type: 'impression' as const,
          slotKey: 'banner_top',
          campaignId: null,
          userHash: 'rate-test',
          timestamp: Date.now(),
        },
      ],
    }

    for (let i = 0; i < 50; i++) {
      const req = new Request('http://localhost/api/ads/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
        },
        body: JSON.stringify(singleEvent),
      })
      const res = await POST(req)
      expect(res.status).toBe(204)
    }

    const req = new Request('http://localhost/api/ads/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.100',
      },
      body: JSON.stringify(singleEvent),
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
  })
})
