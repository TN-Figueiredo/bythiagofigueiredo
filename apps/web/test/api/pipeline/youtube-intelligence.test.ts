import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_CHANNEL_ID = '22222222-2222-2222-2222-222222222222'
const MOCK_TASK_ID = '33333333-3333-3333-3333-333333333333'
const MOCK_VIDEO_ID = '44444444-4444-4444-4444-444444444444'

// ─── Mocks ──────────────────────────────────────────────────────────────────

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

vi.mock('@/lib/youtube/analytics-sync', () => ({
  getIsoWeek: vi.fn().mockReturnValue('2026-W21'),
}))

vi.mock('@/lib/youtube/intelligence-schemas', () => ({
  PatchPayloadSchema: { safeParse: vi.fn() },
}))

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { PatchPayloadSchema } from '@/lib/youtube/intelligence-schemas'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function mockAuthRead() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}
function mockAuthWrite() {
  vi.mocked(authenticateWrite).mockResolvedValue({
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}
function mockAuthFail(mode: 'read' | 'write' = 'read') {
  const resp = new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }) as any
  if (mode === 'read') vi.mocked(authenticateRead).mockResolvedValue(resp)
  else vi.mocked(authenticateWrite).mockResolvedValue(resp)
}

function createMockChain(finalResult: { data?: unknown; error?: unknown; count?: number | null }) {
  const chain: Record<string, any> = {}
  for (const m of [
    'from', 'select', 'insert', 'update', 'delete', 'eq', 'is', 'in',
    'or', 'order', 'limit', 'not', 'neq', 'contains', 'ilike', 'textSearch',
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockResolvedValue({ data: finalResult.data, error: finalResult.error })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: finalResult.data, error: finalResult.error })
  chain.rpc = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.then = (resolve: (v: any) => any) =>
    resolve({ data: finalResult.data, error: finalResult.error, count: finalResult.count ?? null })
  return chain
}

// ─── GET /api/pipeline/youtube/intelligence ─────────────────────────────────

describe('GET /api/pipeline/youtube/intelligence', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/intelligence/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/intelligence?channel_id=abc'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when channel_id is missing', async () => {
    mockAuthRead()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/intelligence'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when channel not found', async () => {
    mockAuthRead()
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        // First call: youtube_channels lookup
        return createMockChain({ data: null })
      }),
    } as any)

    const res = await GET(new NextRequest(`http://localhost/api/pipeline/youtube/intelligence?channel_id=${MOCK_CHANNEL_ID}`))
    expect(res.status).toBe(404)
  })

  it('returns full intelligence payload', async () => {
    mockAuthRead()
    const channel = {
      id: MOCK_CHANNEL_ID,
      channel_id: 'UC123',
      name: 'Test Channel',
      subscriber_count: 10000,
    }
    const videos = [
      {
        id: MOCK_VIDEO_ID,
        youtube_video_id: 'yt123',
        title: 'Test Video',
        thumbnail_url: 'https://img.youtube.com/vi/yt123/hq.jpg',
        published_at: '2026-05-01',
        view_count: 5000,
        ctr: 0.08,
        impressions: 60000,
        avg_view_percentage: 45,
        avg_view_duration_seconds: 240,
        retention_curve: null,
        traffic_sources: null,
      },
    ]
    const gradeHistory = [
      { youtube_video_id: 'yt123', grade: 'B', score: 72, ctr: 7, retention: 6, reach: 8, engagement: 7, growth: 6, sub_impact: 5, week_iso: '2026-W20' },
    ]
    const cycles = [{ id: 'c1', state: 'flagged', youtube_video_id: 'yt123' }]
    const abTests = [{ id: 'ab1', youtube_video_id: 'yt123', name: 'Title test', status: 'running' }]
    const intelligence = [{ id: 'int1', type: 'video', source: 'cowork' }]

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return createMockChain({ data: channel })
        if (callCount === 2) return createMockChain({ data: videos })
        if (callCount === 3) return createMockChain({ data: gradeHistory })
        if (callCount === 4) return createMockChain({ data: cycles })
        if (callCount === 5) return createMockChain({ data: abTests })
        return createMockChain({ data: intelligence })
      }),
    } as any)

    const res = await GET(new NextRequest(`http://localhost/api/pipeline/youtube/intelligence?channel_id=${MOCK_CHANNEL_ID}`))
    // intelligence route uses NextResponse.json, so status is always 200 on success
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.channel.name).toBe('Test Channel')
    expect(body.videos).toHaveLength(1)
    expect(body.videos[0].video_id).toBe('yt123')
    expect(body.grade_history).toHaveLength(1)
    expect(body.optimization_cycles).toHaveLength(1)
    expect(body.ab_tests).toHaveLength(1)
    expect(body.intelligence).toHaveLength(1)
  })
})

// ─── PATCH /api/pipeline/youtube/intelligence ───────────────────────────────

describe('PATCH /api/pipeline/youtube/intelligence', () => {
  let PATCH: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/intelligence/route')
    PATCH = mod.PATCH
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('returns 422 on validation failure', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ bad: 'data' })
    vi.mocked(PatchPayloadSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ path: ['task_id'], code: 'invalid_type', message: 'Required' }] },
    } as any)

    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('validation_failed')
  })

  it('returns 404 when task not found', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ task_id: MOCK_TASK_ID })
    vi.mocked(PatchPayloadSchema.safeParse).mockReturnValue({
      success: true,
      data: { task_id: MOCK_TASK_ID },
    } as any)

    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as any)

    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(404)
  })

  it('returns 409 when task status is not running', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ task_id: MOCK_TASK_ID })
    vi.mocked(PatchPayloadSchema.safeParse).mockReturnValue({
      success: true,
      data: { task_id: MOCK_TASK_ID },
    } as any)

    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(
        createMockChain({ data: { id: MOCK_TASK_ID, channel_id: MOCK_CHANNEL_ID, status: 'completed' } }),
      ),
    } as any)

    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(409)
  })

  it('completes successfully with minimal payload (no recommendations)', async () => {
    mockAuthWrite()
    vi.mocked(parseBody).mockResolvedValue({ task_id: MOCK_TASK_ID })
    vi.mocked(PatchPayloadSchema.safeParse).mockReturnValue({
      success: true,
      data: { task_id: MOCK_TASK_ID },
    } as any)

    const chain = createMockChain({ data: { id: MOCK_TASK_ID, channel_id: MOCK_CHANNEL_ID, status: 'running' } })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(chain),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any)

    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.processed).toBe(true)
  })

  it('returns 422 when video_recommendations reference missing videos', async () => {
    mockAuthWrite()
    const payload = {
      task_id: MOCK_TASK_ID,
      video_recommendations: [
        {
          video_id: MOCK_VIDEO_ID,
          action_type: 'title_test',
          priority: 'high',
          confidence: 0.9,
          reasoning: 'Test reasoning',
        },
      ],
    }
    vi.mocked(parseBody).mockResolvedValue(payload)
    vi.mocked(PatchPayloadSchema.safeParse).mockReturnValue({
      success: true,
      data: payload,
    } as any)

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // task lookup: found and running
          return createMockChain({ data: { id: MOCK_TASK_ID, channel_id: MOCK_CHANNEL_ID, status: 'running' } })
        }
        // youtube_videos lookup: no matching videos
        return createMockChain({ data: [] })
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any)

    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('validation_failed')
    expect(body.details[0].code).toBe('referential_integrity')
  })
})

// ─── GET /api/pipeline/youtube/intelligence/task ────────────────────────────

describe('GET /api/pipeline/youtube/intelligence/task', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/intelligence/task/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/intelligence/task'))
    expect(res.status).toBe(401)
  })

  it('returns 204 when no pending task exists', async () => {
    mockAuthRead()
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(createMockChain({ data: null })),
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/intelligence/task'))
    expect(res.status).toBe(204)
  })

  it('returns 204 when CAS claim fails (race condition)', async () => {
    mockAuthRead()
    const task = {
      id: MOCK_TASK_ID,
      site_id: MOCK_SITE_ID,
      channel_id: MOCK_CHANNEL_ID,
      trigger_type: 'manual',
      requested_at: '2026-05-24T10:00:00Z',
    }

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // task found
          return createMockChain({ data: task })
        }
        // CAS update: no row matched (claimed by another worker)
        const chain = createMockChain({ data: null })
        return chain
      }),
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/intelligence/task'))
    expect(res.status).toBe(204)
  })

  it('claims and returns pending task', async () => {
    mockAuthRead()
    const task = {
      id: MOCK_TASK_ID,
      site_id: MOCK_SITE_ID,
      channel_id: MOCK_CHANNEL_ID,
      trigger_type: 'scheduled',
      requested_at: '2026-05-24T10:00:00Z',
    }

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // task lookup: found
          return createMockChain({ data: task })
        }
        // CAS update + select: claimed successfully
        const chain = createMockChain({ data: { id: MOCK_TASK_ID } })
        return chain
      }),
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/intelligence/task'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(MOCK_TASK_ID)
    expect(body.channel_id).toBe(MOCK_CHANNEL_ID)
  })

  it('uses status query param (defaults to pending)', async () => {
    mockAuthRead()
    const chain = createMockChain({ data: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(chain),
    } as any)

    await GET(new NextRequest('http://localhost/api/pipeline/youtube/intelligence/task?status=failed'))
    expect(chain.eq).toHaveBeenCalledWith('status', 'failed')
  })
})
