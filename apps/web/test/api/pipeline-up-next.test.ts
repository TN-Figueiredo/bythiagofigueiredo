import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(() => true),
  buildRateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock('@/lib/pipeline/up-next-fetcher', () => ({
  fetchUpNextData: vi.fn().mockResolvedValue({ today: { actions: [] }, weekSlots: [] }),
}))

import { GET, POST } from '../../src/app/api/pipeline/up-next/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'
const VALID_UUID_2 = '00000000-0000-0000-0000-000000000002'
const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }

function makeRequest(method: string, body?: unknown, searchParams?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/pipeline/up-next')
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v)
  }
  const init: RequestInit = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }
  return new NextRequest(url, init)
}

function mockSupabaseUpdate(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error })
  const select = vi.fn().mockReturnValue({ single })
  const eq2 = vi.fn().mockReturnValue({ select })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
  const update = vi.fn().mockReturnValue({ eq: eq1 })
  const from = vi.fn().mockReturnValue({ update })
  vi.mocked(getSupabaseServiceClient).mockReturnValue({ from } as any)
  return { from, update, eq1, eq2, select, single }
}

describe('GET /api/pipeline/up-next', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
  })

  it('returns 200 with data on valid request', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as any)
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, error: 'No token', status: 401 })
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid maxCards param', async () => {
    const res = await GET(makeRequest('GET', undefined, { maxCards: '0' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid timezone', async () => {
    const res = await GET(makeRequest('GET', undefined, { tz: 'Invalid/Zone' }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/pipeline/up-next', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    vi.mocked(requirePermission).mockReturnValue(true)
  })

  it('assigns item to slot and returns 200', async () => {
    const returnData = { id: VALID_UUID, scheduled_at: '2026-05-26T10:00:00' }
    mockSupabaseUpdate(returnData)

    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '10:00',
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.id).toBe(VALID_UUID)
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, error: 'No token', status: 401 })
    const res = await POST(makeRequest('POST', { itemId: VALID_UUID, slotDay: '2026-05-26' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when write permission denied', async () => {
    vi.mocked(requirePermission).mockReturnValue(false)
    const res = await POST(makeRequest('POST', { itemId: VALID_UUID, slotDay: '2026-05-26' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid itemId (not UUID)', async () => {
    const res = await POST(makeRequest('POST', {
      itemId: 'not-a-uuid',
      slotDay: '2026-05-26',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid slotDay format', async () => {
    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '26-05-2026',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid slotHour (out of range)', async () => {
    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '25:00',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/pipeline/up-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found in DB', async () => {
    mockSupabaseUpdate(null, { code: 'PGRST116', message: 'not found' })

    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '10:00',
    }))

    expect(res.status).toBe(404)
  })

  it('clears previous item scheduled_at on swap', async () => {
    const returnData = { id: VALID_UUID, scheduled_at: '2026-05-26T10:00:00' }
    const single = vi.fn().mockResolvedValue({ data: returnData, error: null })
    const select = vi.fn().mockReturnValue({ single })

    const updateEq2 = vi.fn().mockReturnValue({ select })
    const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 })
    const update = vi.fn().mockReturnValue({ eq: updateEq1 })

    const clearEq2 = vi.fn().mockResolvedValue({ data: null, error: null })
    const clearEq1 = vi.fn().mockReturnValue({ eq: clearEq2 })
    const clearUpdate = vi.fn().mockReturnValue({ eq: clearEq1 })

    let callCount = 0
    const from = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return { update }
      return { update: clearUpdate }
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from } as any)

    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '10:00',
      previousItemId: VALID_UUID_2,
    }))

    expect(res.status).toBe(200)
    expect(from).toHaveBeenCalledTimes(2)
    expect(clearUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ scheduled_at: null }),
    )
  })

  it('does not clear previous if previousItemId equals itemId', async () => {
    const returnData = { id: VALID_UUID, scheduled_at: '2026-05-26T10:00:00' }
    const mocks = mockSupabaseUpdate(returnData)

    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '10:00',
      previousItemId: VALID_UUID,
    }))

    expect(res.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('accepts null slotHour (defaults to 00:00)', async () => {
    const returnData = { id: VALID_UUID, scheduled_at: '2026-05-26T00:00:00' }
    mockSupabaseUpdate(returnData)

    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: null,
    }))

    expect(res.status).toBe(200)
  })
})
