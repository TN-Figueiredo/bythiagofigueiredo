import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'
const VALID_UUID_2 = '00000000-0000-0000-0000-000000000002'
const MOCK_SITE_ID = 'site-1'

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn(),
  authenticateWrite: vi.fn(),
  pipelineError: vi.fn(
    (code: string, msg: string, status: number) =>
      new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
  ),
  pipelineSuccess: vi.fn(
    (data: unknown, status: number) =>
      new Response(JSON.stringify({ data }), { status }),
  ),
  parseBody: vi.fn(),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(() => true),
  buildRateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn().mockReturnValue({
    siteId: 'site-1',
    permissions: ['read', 'write'],
    keyHash: 'test',
    supabase: {},
  }),
  serviceErrorToResponse: vi.fn((_err: unknown, _auth: unknown) =>
    new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }), { status: 500 }),
  ),
}))

vi.mock('@/lib/pipeline/services/utilities', () => ({
  getUpNext: vi.fn(),
  assignUpNextSlot: vi.fn(),
}))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getUpNext, assignUpNextSlot } from '@/lib/pipeline/services/utilities'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

// ─── Helpers ───────────────────────────────────────────────────────────────

function mockAuthRead() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'session' as const },
  } as any)
}
function mockAuthWrite() {
  vi.mocked(authenticateWrite).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'session' as const },
  } as any)
}
function mockAuthReadFail() {
  vi.mocked(authenticateRead).mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'No token' } }), { status: 401 }),
  )
}
function mockAuthWriteFail() {
  vi.mocked(authenticateWrite).mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'No token' } }), { status: 401 }),
  )
}
function mockAuthWriteForbidden() {
  vi.mocked(authenticateWrite).mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }), { status: 403 }),
  )
}

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

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/pipeline/up-next', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../src/app/api/pipeline/up-next/route')
    GET = mod.GET
  })

  it('returns 200 with data on valid request', async () => {
    mockAuthRead()
    vi.mocked(getUpNext).mockResolvedValue({ today: { actions: [] }, weekSlots: [] } as any)
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthReadFail()
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid maxCards param', async () => {
    mockAuthRead()
    const error = new PipelineServiceError('VALIDATION_ERROR', 'Invalid maxCards', 400)
    vi.mocked(getUpNext).mockRejectedValue(error)
    vi.mocked(serviceErrorToResponse).mockReturnValue(
      new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid maxCards' } }), { status: 400 }),
    )
    const res = await GET(makeRequest('GET', undefined, { maxCards: '0' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid timezone', async () => {
    mockAuthRead()
    const error = new PipelineServiceError('VALIDATION_ERROR', 'Invalid timezone', 400)
    vi.mocked(getUpNext).mockRejectedValue(error)
    vi.mocked(serviceErrorToResponse).mockReturnValue(
      new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid timezone' } }), { status: 400 }),
    )
    const res = await GET(makeRequest('GET', undefined, { tz: 'Invalid/Zone' }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/pipeline/up-next', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../src/app/api/pipeline/up-next/route')
    POST = mod.POST
  })

  it('assigns item to slot and returns 200', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '10:00',
    })
    const returnData = { id: VALID_UUID, scheduled_at: '2026-05-26T10:00:00' }
    vi.mocked(assignUpNextSlot).mockResolvedValue(returnData as any)

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
    mockAuthWriteFail()
    const res = await POST(makeRequest('POST', { itemId: VALID_UUID, slotDay: '2026-05-26' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when write permission denied', async () => {
    mockAuthWriteForbidden()
    const res = await POST(makeRequest('POST', { itemId: VALID_UUID, slotDay: '2026-05-26' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid itemId (not UUID)', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({
      itemId: 'not-a-uuid',
      slotDay: '2026-05-26',
    })
    const error = new PipelineServiceError('VALIDATION_ERROR', 'Invalid UUID', 400)
    vi.mocked(assignUpNextSlot).mockRejectedValue(error)
    vi.mocked(serviceErrorToResponse).mockReturnValue(
      new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid UUID' } }), { status: 400 }),
    )

    const res = await POST(makeRequest('POST', {
      itemId: 'not-a-uuid',
      slotDay: '2026-05-26',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid slotDay format', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({
      itemId: VALID_UUID,
      slotDay: '26-05-2026',
    })
    const error = new PipelineServiceError('VALIDATION_ERROR', 'Invalid slotDay', 400)
    vi.mocked(assignUpNextSlot).mockRejectedValue(error)
    vi.mocked(serviceErrorToResponse).mockReturnValue(
      new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid slotDay' } }), { status: 400 }),
    )

    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '26-05-2026',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid slotHour (out of range)', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '25:00',
    })
    const error = new PipelineServiceError('VALIDATION_ERROR', 'Invalid slotHour', 400)
    vi.mocked(assignUpNextSlot).mockRejectedValue(error)
    vi.mocked(serviceErrorToResponse).mockReturnValue(
      new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid slotHour' } }), { status: 400 }),
    )

    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '25:00',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }), { status: 400 }),
    )

    const req = new NextRequest('http://localhost/api/pipeline/up-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found in DB', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '10:00',
    })
    const error = new PipelineServiceError('NOT_FOUND', 'Item not found or not accessible', 404)
    vi.mocked(assignUpNextSlot).mockRejectedValue(error)
    vi.mocked(serviceErrorToResponse).mockReturnValue(
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Item not found or not accessible' } }), { status: 404 }),
    )

    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '10:00',
    }))

    expect(res.status).toBe(404)
  })

  it('clears previous item scheduled_at on swap', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '10:00',
      previousItemId: VALID_UUID_2,
    })
    const returnData = { id: VALID_UUID, scheduled_at: '2026-05-26T10:00:00' }
    vi.mocked(assignUpNextSlot).mockResolvedValue(returnData as any)

    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '10:00',
      previousItemId: VALID_UUID_2,
    }))

    expect(res.status).toBe(200)
    // The service handles the swap internally; we verify the call was made with previousItemId
    expect(vi.mocked(assignUpNextSlot)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ previousItemId: VALID_UUID_2 }),
    )
  })

  it('does not clear previous if previousItemId equals itemId', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '10:00',
      previousItemId: VALID_UUID,
    })
    const returnData = { id: VALID_UUID, scheduled_at: '2026-05-26T10:00:00' }
    vi.mocked(assignUpNextSlot).mockResolvedValue(returnData as any)

    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: '10:00',
      previousItemId: VALID_UUID,
    }))

    expect(res.status).toBe(200)
    expect(vi.mocked(assignUpNextSlot)).toHaveBeenCalledTimes(1)
  })

  it('accepts null slotHour (defaults to 00:00)', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: null,
    })
    const returnData = { id: VALID_UUID, scheduled_at: '2026-05-26T00:00:00' }
    vi.mocked(assignUpNextSlot).mockResolvedValue(returnData as any)

    const res = await POST(makeRequest('POST', {
      itemId: VALID_UUID,
      slotDay: '2026-05-26',
      slotHour: null,
    }))

    expect(res.status).toBe(200)
  })
})
