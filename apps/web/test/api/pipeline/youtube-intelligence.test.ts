import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

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

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
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
  getIntelligenceSnapshot: vi.fn(),
  submitIntelRecommendations: vi.fn(),
  claimNextTask: vi.fn(),
}))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import {
  getIntelligenceSnapshot,
  submitIntelRecommendations,
  claimNextTask,
} from '@/lib/pipeline/services/youtube'

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
    vi.mocked(getIntelligenceSnapshot).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Channel not found', 404),
    )

    const res = await GET(new NextRequest(`http://localhost/api/pipeline/youtube/intelligence?channel_id=${MOCK_CHANNEL_ID}`))
    expect(res.status).toBe(404)
  })

  it('returns full intelligence payload', async () => {
    mockAuthRead()
    const snapshot = {
      channel: {
        id: MOCK_CHANNEL_ID,
        channel_id: 'UC123',
        name: 'Test Channel',
        subscriber_count: 10000,
      },
      videos: [
        {
          id: MOCK_VIDEO_ID,
          video_id: 'yt123',
          title: 'Test Video',
          thumbnail_url: 'https://img.youtube.com/vi/yt123/hq.jpg',
          published_at: '2026-05-01',
          view_count: 5000,
          ctr: 0.08,
          impressions: 60000,
          avg_view_percentage: 45,
          retention_curve: null,
          traffic_sources: null,
        },
      ],
      grade_history: [
        { youtube_video_id: 'yt123', grade: 'B', score: 72, ctr: 7, retention: 6, reach: 8, engagement: 7, growth: 6, sub_impact: 5, week_iso: '2026-W20' },
      ],
      optimization_cycles: [{ id: 'c1', state: 'flagged', youtube_video_id: 'yt123' }],
      ab_tests: [{ id: 'ab1', youtube_video_id: 'yt123', name: 'Title test', status: 'running' }],
      intelligence: [{ id: 'int1', type: 'video', source: 'cowork' }],
    }
    vi.mocked(getIntelligenceSnapshot).mockResolvedValue({ data: snapshot } as any)

    const res = await GET(new NextRequest(`http://localhost/api/pipeline/youtube/intelligence?channel_id=${MOCK_CHANNEL_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.channel.name).toBe('Test Channel')
    expect(body.data.videos).toHaveLength(1)
    expect(body.data.videos[0].video_id).toBe('yt123')
    expect(body.data.grade_history).toHaveLength(1)
    expect(body.data.optimization_cycles).toHaveLength(1)
    expect(body.data.ab_tests).toHaveLength(1)
    expect(body.data.intelligence).toHaveLength(1)
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

    vi.mocked(submitIntelRecommendations).mockRejectedValue(
      new PipelineServiceError('VALIDATION_FAILED', 'Validation failed', 422, {
        details: [{ path: ['task_id'], code: 'invalid_type', message: 'Required' }],
      }),
    )

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

    vi.mocked(submitIntelRecommendations).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Task not found', 404),
    )

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

    vi.mocked(submitIntelRecommendations).mockRejectedValue(
      new PipelineServiceError('VERSION_CONFLICT', "Task status is 'completed', expected 'running'", 409),
    )

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

    vi.mocked(submitIntelRecommendations).mockResolvedValue({
      data: { status: 'ok', processed: true },
    } as any)

    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('ok')
    expect(body.data.processed).toBe(true)
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

    vi.mocked(submitIntelRecommendations).mockRejectedValue(
      new PipelineServiceError('VALIDATION_FAILED', 'Referential integrity check failed', 422, {
        details: [{ code: 'referential_integrity', video_ids: [MOCK_VIDEO_ID] }],
      }),
    )

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
    vi.mocked(claimNextTask).mockResolvedValue({ data: null } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/intelligence/task'))
    expect(res.status).toBe(204)
  })

  it('returns 204 when CAS claim fails (race condition)', async () => {
    mockAuthRead()
    // CAS claim returns null (task was claimed by another worker)
    vi.mocked(claimNextTask).mockResolvedValue({ data: null } as any)

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
    vi.mocked(claimNextTask).mockResolvedValue({ data: task } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/intelligence/task'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(MOCK_TASK_ID)
    expect(body.data.channel_id).toBe(MOCK_CHANNEL_ID)
  })

  it('uses status query param (defaults to pending)', async () => {
    mockAuthRead()
    vi.mocked(claimNextTask).mockResolvedValue({ data: null } as any)

    await GET(new NextRequest('http://localhost/api/pipeline/youtube/intelligence/task?status=failed'))
    expect(claimNextTask).toHaveBeenCalledWith(expect.anything(), 'failed')
  })
})
