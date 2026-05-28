import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_TEST_ID = '22222222-2222-2222-2222-222222222222'
const MOCK_VARIANT_ID = '33333333-3333-3333-3333-333333333333'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

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
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/pipeline/logger', () => ({
  pipelineLog: vi.fn(),
}))

vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn().mockReturnValue({
    siteId: MOCK_SITE_ID,
    permissions: ['read', 'write'],
    supabase: {},
  }),
  serviceErrorToResponse: vi.fn().mockImplementation((err: unknown) => {
    if (err instanceof PipelineServiceError) {
      return new Response(
        JSON.stringify({ error: { code: err.code, message: err.message } }),
        { status: err.status },
      )
    }
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }),
      { status: 500 },
    )
  }),
}))

vi.mock('@/lib/pipeline/services/youtube', () => ({
  listVariants: vi.fn(),
  upsertVariants: vi.fn(),
  deleteVariant: vi.fn(),
}))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import {
  listVariants,
  upsertVariants,
  deleteVariant,
} from '@/lib/pipeline/services/youtube'
import * as Sentry from '@sentry/nextjs'

const AUTH_OK = {
  ok: true,
  auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
} as any

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeRequest(method: string, path: string, body?: unknown) {
  const url = `http://localhost:3000${path}`
  const init: RequestInit = { method, headers: { 'content-type': 'application/json' } }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(url, init)
}

describe('POST /api/pipeline/youtube/ab-tests/:id/variants', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/ab-tests/[id]/variants/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    const resp = new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 })
    vi.mocked(authenticateWrite).mockResolvedValue(resp as any)

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(401)
  })

  it('returns 400 for invalid UUID', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({ variants: [{ label: 'B', title_text: 'Test' }] })

    vi.mocked(upsertVariants).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Invalid test ID format', 400),
    )

    const req = makeRequest('POST', '/api/pipeline/youtube/ab-tests/not-a-uuid/variants')
    const result = await POST(req, makeParams('not-a-uuid'))
    expect(result.status).toBe(400)
  })

  it('returns 400 for invalid body (empty variants)', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({ variants: [] })

    vi.mocked(upsertVariants).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Array must contain at least 1 element(s)', 400),
    )

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(400)
  })

  it('returns 404 when test not found', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({ variants: [{ label: 'B', title_text: 'Test' }] })

    vi.mocked(upsertVariants).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Test not found', 404),
    )

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(404)
  })

  it('returns 409 when test is not draft', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({ variants: [{ label: 'B', title_text: 'Test' }] })

    vi.mocked(upsertVariants).mockRejectedValue(
      new PipelineServiceError('INVALID_STATUS', 'Variants can only be added to draft tests', 409),
    )

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(409)
  })

  it('returns 200 with results on successful upsert', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({
      variants: [{ label: 'B', title_text: 'Title B', metadata: { rationale: 'test' } }],
    })

    vi.mocked(upsertVariants).mockResolvedValue({
      data: {
        results: [{ label: 'B', ok: true, id: MOCK_VARIANT_ID }],
        summary: { total: 1, succeeded: 1, failed: 0 },
      },
    } as any)

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(200)
  })

  it('returns 400 for duplicate variant labels in batch', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({
      variants: [
        { label: 'B', title_text: 'Title B1' },
        { label: 'B', title_text: 'Title B2' },
      ],
    })

    vi.mocked(upsertVariants).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Duplicate variant labels in batch', 400),
    )

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(400)
    const body = await result.json() as { error: { code: string; message: string } }
    expect(body.error.message).toContain('Duplicate variant labels')
  })

  it('returns 500 with generic message and does not leak DB error on upsert failure', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({
      variants: [{ label: 'B', title_text: 'Title B' }],
    })

    vi.mocked(upsertVariants).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to save variants', 500),
    )

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(500)
    const body = await result.json() as { error: { code: string; message: string } }
    expect(body.error.message).not.toContain('duplicate key value')
    expect(body.error.message).toBe('Failed to save variants')
  })
})

describe('GET /api/pipeline/youtube/ab-tests/:id/variants', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/ab-tests/[id]/variants/route')
    GET = mod.GET
  })

  it('returns variants ordered by sort_order', async () => {
    vi.mocked(authenticateRead).mockResolvedValue(AUTH_OK)

    const variants = [
      { id: '1', label: 'original', sort_order: 0 },
      { id: '2', label: 'B', sort_order: 1 },
    ]
    vi.mocked(listVariants).mockResolvedValue({ data: variants } as any)

    const req = makeRequest('GET', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await GET(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(200)
  })

  it('returns 500 with generic message and does not leak DB error on fetch failure', async () => {
    vi.mocked(authenticateRead).mockResolvedValue(AUTH_OK)

    vi.mocked(listVariants).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to load variants', 500),
    )

    const req = makeRequest('GET', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await GET(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(500)
    const body = await result.json() as { error: { code: string; message: string } }
    expect(body.error.message).not.toContain('column "foo"')
    expect(body.error.message).toBe('Failed to load variants')
  })
})

describe('DELETE /api/pipeline/youtube/ab-tests/:id/variants', () => {
  let DELETE: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/ab-tests/[id]/variants/route')
    DELETE = mod.DELETE
  })

  it('returns 400 when label query param is missing', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)

    vi.mocked(deleteVariant).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Query param "label" must be B, C, or D', 400),
    )

    const req = makeRequest('DELETE', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await DELETE(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(400)
  })

  it('returns 400 for invalid label', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)

    vi.mocked(deleteVariant).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'Query param "label" must be B, C, or D', 400),
    )

    const req = makeRequest('DELETE', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants?label=A`)
    const result = await DELETE(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(400)
  })
})
