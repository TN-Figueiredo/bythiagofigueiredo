import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

vi.mock('@/lib/youtube/ab-schemas', async () => {
  const { z } = await import('zod')
  const VariantMetadataSchema = z.object({
    thumbnail_tags: z.array(z.string().max(50)).max(10).optional(),
    title_pattern: z.string().max(200).optional(),
    emotional_triggers: z.array(z.string().max(50)).max(10).optional(),
    visual_description: z.string().max(2000).optional(),
    ai_image_prompt: z.string().max(1000).optional(),
    creative_direction: z.string().max(2000).optional(),
    rationale: z.string().max(1000).optional(),
  })
  const VariantPayloadSchema = z.object({
    label: z.enum(['B', 'C', 'D']),
    title_text: z.string().max(200).nullable().optional(),
    description_text: z.string().max(5000).nullable().optional(),
    metadata: VariantMetadataSchema.nullable().optional(),
  })
  return {
    VariantMetadataSchema,
    VariantPayloadSchema,
    BatchVariantUpsertSchema: z.object({
      variants: z.array(VariantPayloadSchema).min(1).max(3),
    }),
    TestTypeSchema: z.enum(['thumbnail', 'title', 'description', 'combo']),
  }
})

vi.mock('@/lib/youtube/ab-types', () => ({ VARIANT_LABELS: ['B', 'C', 'D'] as const }))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'

const AUTH_OK = {
  ok: true,
  auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
} as any

function createMockChain(finalResult: { data?: unknown; error?: unknown; count?: number | null }) {
  const chain: Record<string, any> = {}
  for (const m of [
    'from', 'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'is', 'in', 'or', 'order', 'limit', 'not', 'neq',
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockResolvedValue({ data: finalResult.data, error: finalResult.error })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: finalResult.data, error: finalResult.error })
  chain.then = (resolve: (v: any) => any) =>
    resolve({ data: finalResult.data, error: finalResult.error, count: finalResult.count ?? null })
  return chain
}

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

    const req = makeRequest('POST', '/api/pipeline/youtube/ab-tests/not-a-uuid/variants')
    const result = await POST(req, makeParams('not-a-uuid'))
    expect(result.status).toBe(400)
  })

  it('returns 400 for invalid body (empty variants)', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({ variants: [] })

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(400)
  })

  it('returns 404 when test not found', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({ variants: [{ label: 'B', title_text: 'Test' }] })

    const chain = createMockChain({ data: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: () => chain } as any)

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(404)
  })

  it('returns 409 when test is not draft', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({ variants: [{ label: 'B', title_text: 'Test' }] })

    const chain = createMockChain({ data: { id: MOCK_TEST_ID, status: 'active', site_id: MOCK_SITE_ID, test_type: 'title' } })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: () => chain } as any)

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(409)
  })

  it('returns 200 with results on successful upsert', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({
      variants: [{ label: 'B', title_text: 'Title B', metadata: { rationale: 'test' } }],
    })

    const testChain = createMockChain({
      data: { id: MOCK_TEST_ID, status: 'draft', site_id: MOCK_SITE_ID, test_type: 'title' },
    })
    const upsertChain = createMockChain({
      data: [{ id: MOCK_VARIANT_ID, label: 'B' }],
    })
    upsertChain.select = vi.fn().mockReturnValue(upsertChain)
    upsertChain.then = (resolve: (v: any) => any) =>
      resolve({ data: [{ id: MOCK_VARIANT_ID, label: 'B' }], error: null })

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => {
        callCount++
        return callCount === 1 ? testChain : upsertChain
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

    const testChain = createMockChain({
      data: { id: MOCK_TEST_ID, status: 'draft', site_id: MOCK_SITE_ID, test_type: 'title' },
    })
    const rawDbError = { message: 'duplicate key value violates unique constraint "ab_test_variants_pkey"' }
    const upsertChain = createMockChain({ data: null, error: rawDbError })
    upsertChain.select = vi.fn().mockReturnValue(upsertChain)
    upsertChain.then = (resolve: (v: any) => any) =>
      resolve({ data: null, error: rawDbError })

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => {
        callCount++
        return callCount === 1 ? testChain : upsertChain
      },
    } as any)

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(500)
    const body = await result.json() as { error: { code: string; message: string } }
    expect(body.error.message).not.toContain('duplicate key value')
    expect(body.error.message).toBe('Failed to save variants')
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(rawDbError, { tags: { component: 'ab-variants' } })
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
    const testChain = createMockChain({
      data: { id: MOCK_TEST_ID, site_id: MOCK_SITE_ID },
    })
    const variantChain = createMockChain({ data: variants })

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => {
        callCount++
        return callCount === 1 ? testChain : variantChain
      },
    } as any)

    const req = makeRequest('GET', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await GET(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(200)
  })

  it('returns 500 with generic message and does not leak DB error on fetch failure', async () => {
    vi.mocked(authenticateRead).mockResolvedValue(AUTH_OK)

    const rawDbError = { message: 'ERROR: column "foo" does not exist at character 12' }
    const testChain = createMockChain({
      data: { id: MOCK_TEST_ID, site_id: MOCK_SITE_ID },
    })
    const variantChain = createMockChain({ data: null, error: rawDbError })

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => {
        callCount++
        return callCount === 1 ? testChain : variantChain
      },
    } as any)

    const req = makeRequest('GET', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await GET(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(500)
    const body = await result.json() as { error: { code: string; message: string } }
    expect(body.error.message).not.toContain('column "foo"')
    expect(body.error.message).toBe('Failed to load variants')
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(rawDbError, { tags: { component: 'ab-variants' } })
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

    const req = makeRequest('DELETE', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await DELETE(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(400)
  })

  it('returns 400 for invalid label', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)

    const req = makeRequest('DELETE', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants?label=A`)
    const result = await DELETE(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(400)
  })
})
