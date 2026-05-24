import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

vi.mock('@/lib/pipeline/broll-import', () => ({
  mapBRollJsonToDbRow: vi.fn((item: Record<string, unknown>) => ({
    asset_id: item.asset_id,
    original_filename: item.original_filename,
    type: item.type ?? 'footage',
    source: item.source ?? 'local',
    source_type: item.source_type ?? 'pessoal',
    resolution: item.resolution ?? '1080p',
    has_audio: item.has_audio ?? false,
    reusable: item.reusable ?? true,
    status: item.status ?? 'available',
    sha256: item.sha256,
    tags: item.tags,
  })),
  classifyBRollImportItem: vi.fn((_row: Record<string, unknown>, existing: unknown) =>
    existing ? 'update' : 'create',
  ),
  buildBRollDiffLog: vi.fn(() => []),
}))

import { authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { classifyBRollImportItem } from '@/lib/pipeline/broll-import'

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

function createMockChain(finalResult: { data?: unknown; error?: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'in',
    'order', 'limit', 'single', 'filter', 'maybeSingle', 'not', 'neq', 'upsert', 'contains']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: { data?: unknown; error?: unknown }) => unknown) => resolve(finalResult)
  return chain
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

    const res = await POST(createRequest({ items: [] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when items contain invalid data', async () => {
    mockAuthSuccess()
    vi.mocked(parseBody).mockResolvedValue({
      schema_version: '1.0.0',
      items: [{ asset_id: '' }], // asset_id min length is 1, but empty string
    })

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
    vi.mocked(classifyBRollImportItem).mockReturnValue('create')

    const chain = createMockChain({ data: [], error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never)

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

    const existingAssets = [
      { asset_id: 'clip-002', sha256: 'abc123', tags: ['old'], version: 1 },
      { asset_id: 'clip-003', sha256: 'def456', tags: ['old'], version: 2 },
    ]
    const chain = createMockChain({ data: existingAssets, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as never)

    // First call: clip-001 has no existing -> create
    // Second call: clip-002 exists -> update
    // Third call: clip-003 exists -> skip
    vi.mocked(classifyBRollImportItem)
      .mockReturnValueOnce('create')
      .mockReturnValueOnce('update')
      .mockReturnValueOnce('skip')

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
    vi.mocked(classifyBRollImportItem).mockReturnValue('create')

    // Chain for the select (existing check)
    const selectChain = createMockChain({ data: [], error: null })
    // Chain for the upsert
    const upsertChain = createMockChain({ data: null as unknown as undefined, error: null })
    // Chain for the import log insert
    const logChain = createMockChain({ data: { id: 'log-1' }, error: null })

    let fromCallCount = 0
    const mockClient = {
      from: vi.fn(() => {
        fromCallCount++
        if (fromCallCount === 1) return selectChain // broll_library select
        if (fromCallCount === 2) return upsertChain // broll_library upsert
        return logChain // broll_import_log insert
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient as never)

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

    const selectChain = createMockChain({ data: [], error: null })
    const logChain = createMockChain({ data: { id: 'log-empty' }, error: null })

    let fromCallCount = 0
    const mockClient = {
      from: vi.fn(() => {
        fromCallCount++
        if (fromCallCount === 1) return selectChain
        return logChain
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient as never)

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
    vi.mocked(classifyBRollImportItem).mockReturnValue('create')

    // Select chain returns no existing items
    const selectChain = createMockChain({ data: [], error: null })
    // Upsert chain returns an error
    const upsertChain = createMockChain({ data: null as unknown as undefined, error: { message: 'DB error' } })
    // Import log chain
    const logChain = createMockChain({ data: { id: 'log-err' }, error: null })

    let fromCallCount = 0
    const mockClient = {
      from: vi.fn(() => {
        fromCallCount++
        if (fromCallCount === 1) return selectChain
        if (fromCallCount === 2) return upsertChain
        return logChain
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient as never)

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
    vi.mocked(classifyBRollImportItem).mockReturnValue('skip')

    const selectChain = createMockChain({ data: [{ asset_id: 'clip-skip', sha256: 'same', tags: [], version: 1 }], error: null })
    const logChain = createMockChain({ data: { id: 'log-skip' }, error: null })

    let fromCallCount = 0
    const mockClient = {
      from: vi.fn(() => {
        fromCallCount++
        if (fromCallCount === 1) return selectChain
        return logChain
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockClient as never)

    const res = await POST(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.skipped).toBe(1)
    expect(body.data.created).toBe(0)
    expect(body.data.updated).toBe(0)
  })
})
