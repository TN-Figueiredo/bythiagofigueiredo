import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/pipeline/services/broll', () => ({
  importBRollAssets: vi.fn(),
}))

vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn().mockReturnValue({
    siteId: MOCK_SITE_ID,
    permissions: ['read', 'write'],
    supabase: {},
    source: 'api_key',
  }),
  serviceErrorToResponse: vi.fn().mockImplementation((err: unknown) => {
    if (err instanceof PipelineServiceError) {
      return new Response(JSON.stringify({ error: { code: err.code, message: err.message } }), { status: err.status })
    }
    return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'unexpected' } }), { status: 500 })
  }),
}))

vi.mock('@/lib/pipeline/helpers', () => ({
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
  buildRateLimitHeaders: vi.fn(() => ({})),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/pipeline/logger', () => ({
  pipelineLog: vi.fn(),
}))

import { authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { importBRollAssets } from '@/lib/pipeline/services/broll'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockAuthSuccess() {
  vi.mocked(authenticateWrite).mockResolvedValue({
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as never)
}

function mockAuthFailure() {
  vi.mocked(authenticateWrite).mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }), { status: 401 }),
  )
}

function createRequest(body?: unknown) {
  return new NextRequest(
    new URL('http://localhost:3000/api/pipeline/broll-library/import'),
    { method: 'POST', body: body ? JSON.stringify(body) : undefined },
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/pipeline/broll-library/import', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/pipeline/broll-library/import/route')
    POST = mod.POST
  })

  it('returns 401 when authentication fails', async () => {
    mockAuthFailure()
    const res = await POST(createRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 when body is invalid JSON', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }), { status: 400 }),
    )

    const res = await POST(createRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when schema validation fails (missing schema_version)', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({ items: [] })
    vi.mocked(importBRollAssets).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'schema_version is required', 400),
    )

    const res = await POST(createRequest({ items: [] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when items contain invalid data', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({
      schema_version: '1.0.0',
      items: [{ asset_id: '' }],
    })
    vi.mocked(importBRollAssets).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'asset_id must not be empty', 400),
    )

    const res = await POST(createRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('handles dry run with no existing items (all creates)', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({
      dry_run: true,
      schema_version: '1.0.0',
      items: [
        { asset_id: 'clip-001', original_filename: 'clip1.mp4' },
        { asset_id: 'clip-002', original_filename: 'clip2.mp4' },
      ],
    })
    vi.mocked(importBRollAssets).mockResolvedValue({
      data: {
        dry_run: true,
        preview: { to_create: 2, to_update: 0, to_skip: 0, errors: [] as never[] },
      },
    } as never)

    const res = await POST(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.dry_run).toBe(true)
    expect(body.data.preview.to_create).toBe(2)
    expect(body.data.preview.to_update).toBe(0)
    expect(body.data.preview.to_skip).toBe(0)
  })

  it('handles dry run with existing items (mix of create/update/skip)', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({
      dry_run: true,
      schema_version: '1.0.0',
      items: [
        { asset_id: 'clip-001', original_filename: 'clip1.mp4' },
        { asset_id: 'clip-002', original_filename: 'clip2.mp4' },
        { asset_id: 'clip-003', original_filename: 'clip3.mp4' },
      ],
    })
    vi.mocked(importBRollAssets).mockResolvedValue({
      data: {
        dry_run: true,
        preview: { to_create: 1, to_update: 1, to_skip: 1, errors: [] as never[] },
      },
    } as never)

    const res = await POST(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.dry_run).toBe(true)
    expect(body.data.preview.to_create).toBe(1)
    expect(body.data.preview.to_update).toBe(1)
    expect(body.data.preview.to_skip).toBe(1)
  })

  it('performs actual import with upsert on non-dry-run', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({
      dry_run: false,
      schema_version: '1.0.0',
      items: [
        { asset_id: 'clip-001', original_filename: 'clip1.mp4' },
      ],
    })
    vi.mocked(importBRollAssets).mockResolvedValue({
      data: {
        dry_run: false,
        import_log_id: 'log-1',
        created: 1,
        updated: 0,
        skipped: 0,
        errors: [],
      },
    } as never)

    const res = await POST(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.dry_run).toBe(false)
    expect(body.data.created).toBe(1)
    expect(body.data.updated).toBe(0)
    expect(body.data.skipped).toBe(0)
    expect(body.data.import_log_id).toBe('log-1')
  })

  it('returns empty items list when no items provided', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({
      dry_run: false,
      schema_version: '1.0.0',
      items: [],
    })
    vi.mocked(importBRollAssets).mockResolvedValue({
      data: {
        dry_run: false,
        import_log_id: 'log-empty',
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
      },
    } as never)

    const res = await POST(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.created).toBe(0)
    expect(body.data.updated).toBe(0)
    expect(body.data.skipped).toBe(0)
  })

  it('handles upsert error and reports in errors array', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({
      dry_run: false,
      schema_version: '1.0.0',
      items: [
        { asset_id: 'clip-fail', original_filename: 'fail.mp4' },
      ],
    })
    vi.mocked(importBRollAssets).mockResolvedValue({
      data: {
        dry_run: false,
        import_log_id: 'log-err',
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [{ asset_id: 'clip-fail', error: 'Batch upsert failed' }],
      },
    } as never)

    const res = await POST(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.errors.length).toBeGreaterThan(0)
    expect(body.data.errors[0].error).toBe('Batch upsert failed')
  })

  it('skips items classified as skip during real import', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({
      dry_run: false,
      schema_version: '1.0.0',
      items: [
        { asset_id: 'clip-skip', original_filename: 'skip.mp4' },
      ],
    })
    vi.mocked(importBRollAssets).mockResolvedValue({
      data: {
        dry_run: false,
        import_log_id: 'log-skip',
        created: 0,
        updated: 0,
        skipped: 1,
        errors: [],
      },
    } as never)

    const res = await POST(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.skipped).toBe(1)
    expect(body.data.created).toBe(0)
    expect(body.data.updated).toBe(0)
  })
})
