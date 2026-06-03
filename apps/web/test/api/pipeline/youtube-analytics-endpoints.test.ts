import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError } from '../../../src/lib/pipeline/services/types'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_CHANNEL_ID = '22222222-2222-2222-2222-222222222222'

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
  captureException: vi.fn(),
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
  getAnalyticsOverview: vi.fn(),
  getAnalyticsGrades: vi.fn(),
  getAnalyticsDemographics: vi.fn(),
  getAnalyticsSearchTerms: vi.fn(),
  listAnalyticsNotes: vi.fn(),
  createBotNote: vi.fn(),
}))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import {
  getAnalyticsOverview,
  getAnalyticsGrades,
  getAnalyticsDemographics,
  getAnalyticsSearchTerms,
  listAnalyticsNotes,
  createBotNote,
} from '@/lib/pipeline/services/youtube'

// ─── Auth helpers ───────────────────────────────────────────────────────────

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

// ─── GET /api/pipeline/youtube/analytics/overview ──────────────────────────

describe('GET /api/pipeline/youtube/analytics/overview', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/analytics/overview/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/analytics/overview?channel_id=abc'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when channel_id is missing', async () => {
    mockAuthRead()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/analytics/overview'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when channel not found', async () => {
    mockAuthRead()
    vi.mocked(getAnalyticsOverview).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Channel not found', 404),
    )

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/overview?channel_id=${MOCK_CHANNEL_ID}`),
    )
    expect(res.status).toBe(404)
  })

  it('returns health score with 6 axes and KPIs', async () => {
    mockAuthRead()
    const overview = {
      health: {
        overall: 72,
        axes: [
          { axis: 'ctr', score: 80, grade: 'B' },
          { axis: 'retention', score: 65, grade: 'B' },
          { axis: 'reach', score: 70, grade: 'B' },
          { axis: 'engagement', score: 75, grade: 'B' },
          { axis: 'growth', score: 60, grade: 'C' },
          { axis: 'sub_impact', score: 82, grade: 'B' },
        ],
      },
      kpis: { views: 120000, watchTime: 45000, subscribers: 350, avgCtr: 7.5, avgRetention: 42.3 },
      baseline: { medianCtr: 6.2, medianRetention: 38.5 },
    }
    vi.mocked(getAnalyticsOverview).mockResolvedValue({ data: overview } as any)

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/overview?channel_id=${MOCK_CHANNEL_ID}`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.health.overall).toBe(72)
    expect(body.data.health.axes).toHaveLength(6)
    expect(body.data.kpis.views).toBe(120000)
    expect(body.data.kpis.watchTime).toBe(45000)
    expect(body.data.kpis.subscribers).toBe(350)
  })

  it('returns baseline medians', async () => {
    mockAuthRead()
    const overview = {
      health: { overall: 50, axes: [] },
      kpis: { views: 0, watchTime: 0, subscribers: 0, avgCtr: 0, avgRetention: 0 },
      baseline: { medianCtr: 5.0, medianRetention: 35.0 },
    }
    vi.mocked(getAnalyticsOverview).mockResolvedValue({ data: overview } as any)

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/overview?channel_id=${MOCK_CHANNEL_ID}`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.baseline.medianCtr).toBe(5.0)
    expect(body.data.baseline.medianRetention).toBe(35.0)
  })

  it('clamps days=500 to 365', async () => {
    mockAuthRead()
    vi.mocked(getAnalyticsOverview).mockResolvedValue({
      data: {
        health: { overall: 0, axes: [] },
        kpis: { views: 0, watchTime: 0, subscribers: 0, avgCtr: 0, avgRetention: 0 },
        baseline: { medianCtr: 0, medianRetention: 0 },
      },
    } as any)

    await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/overview?channel_id=${MOCK_CHANNEL_ID}&days=500`),
    )
    expect(getAnalyticsOverview).toHaveBeenCalledWith(expect.anything(), MOCK_CHANNEL_ID, 365)
  })

  it('clamps negative days to 1', async () => {
    mockAuthRead()
    vi.mocked(getAnalyticsOverview).mockResolvedValue({
      data: {
        health: { overall: 0, axes: [] },
        kpis: { views: 0, watchTime: 0, subscribers: 0, avgCtr: 0, avgRetention: 0 },
        baseline: { medianCtr: 0, medianRetention: 0 },
      },
    } as any)

    await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/overview?channel_id=${MOCK_CHANNEL_ID}&days=-5`),
    )
    expect(getAnalyticsOverview).toHaveBeenCalledWith(expect.anything(), MOCK_CHANNEL_ID, 1)
  })
})

// ─── GET /api/pipeline/youtube/analytics/grades ────────────────────────────

describe('GET /api/pipeline/youtube/analytics/grades', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/analytics/grades/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/analytics/grades?channel_id=abc'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when channel_id is missing', async () => {
    mockAuthRead()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/analytics/grades'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid sort param', async () => {
    mockAuthRead()
    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/grades?channel_id=${MOCK_CHANNEL_ID}&sort=invalid`),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns videos sorted by score with top5 and bottom5', async () => {
    mockAuthRead()
    const videos = Array.from({ length: 10 }, (_, i) => ({
      id: `vid-${i}`,
      title: `Video ${i}`,
      score: (10 - i) * 10,
      grade: i < 3 ? 'A' : i < 7 ? 'B' : 'C',
      trend: { direction: 'up', velocity: 1.5 },
      ctr: 7.0 + i * 0.1,
      retention: 40 + i,
      views: 10000 - i * 1000,
      published_at: `2026-05-${String(i + 1).padStart(2, '0')}`,
    }))
    vi.mocked(getAnalyticsGrades).mockResolvedValue({
      data: { videos, top5: videos.slice(0, 5), bottom5: videos.slice(-5).reverse() },
    } as any)

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/grades?channel_id=${MOCK_CHANNEL_ID}&sort=score`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.videos).toHaveLength(10)
    expect(body.data.top5).toHaveLength(5)
    expect(body.data.bottom5).toHaveLength(5)
    // top5 should have the highest scores
    expect(body.data.top5[0].score).toBe(100)
    expect(body.data.bottom5[0].score).toBe(10)
  })

  it('accepts sort=published_at', async () => {
    mockAuthRead()
    vi.mocked(getAnalyticsGrades).mockResolvedValue({
      data: { videos: [], top5: [], bottom5: [] },
    } as any)

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/grades?channel_id=${MOCK_CHANNEL_ID}&sort=published_at`),
    )
    expect(res.status).toBe(200)
    expect(getAnalyticsGrades).toHaveBeenCalledWith(expect.anything(), MOCK_CHANNEL_ID, 'published_at', 50)
  })

  it('accepts sort=views', async () => {
    mockAuthRead()
    vi.mocked(getAnalyticsGrades).mockResolvedValue({
      data: { videos: [], top5: [], bottom5: [] },
    } as any)

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/grades?channel_id=${MOCK_CHANNEL_ID}&sort=views`),
    )
    expect(res.status).toBe(200)
    expect(getAnalyticsGrades).toHaveBeenCalledWith(expect.anything(), MOCK_CHANNEL_ID, 'views', 50)
  })

  it('defaults sort to score and limit to 50', async () => {
    mockAuthRead()
    vi.mocked(getAnalyticsGrades).mockResolvedValue({
      data: { videos: [], top5: [], bottom5: [] },
    } as any)

    await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/grades?channel_id=${MOCK_CHANNEL_ID}`),
    )
    expect(getAnalyticsGrades).toHaveBeenCalledWith(expect.anything(), MOCK_CHANNEL_ID, 'score', 50)
  })

  it('clamps limit between 1 and 200', async () => {
    mockAuthRead()
    vi.mocked(getAnalyticsGrades).mockResolvedValue({
      data: { videos: [], top5: [], bottom5: [] },
    } as any)

    await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/grades?channel_id=${MOCK_CHANNEL_ID}&limit=999`),
    )
    expect(getAnalyticsGrades).toHaveBeenCalledWith(expect.anything(), MOCK_CHANNEL_ID, 'score', 200)
  })

  it('returns empty arrays when no videos exist', async () => {
    mockAuthRead()
    vi.mocked(getAnalyticsGrades).mockResolvedValue({
      data: { videos: [], top5: [], bottom5: [] },
    } as any)

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/grades?channel_id=${MOCK_CHANNEL_ID}`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.videos).toEqual([])
    expect(body.data.top5).toEqual([])
    expect(body.data.bottom5).toEqual([])
  })
})

// ─── GET /api/pipeline/youtube/analytics/demographics ──────────────────────

describe('GET /api/pipeline/youtube/analytics/demographics', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/analytics/demographics/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/analytics/demographics?channel_id=abc'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when channel_id is missing', async () => {
    mockAuthRead()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/analytics/demographics'))
    expect(res.status).toBe(400)
  })

  it('returns age/gender breakdown, countries, and devices', async () => {
    mockAuthRead()
    const demographics = {
      ageGender: [
        { ageGroup: '18-24', male: 30, female: 20 },
        { ageGroup: '25-34', male: 40, female: 25 },
      ],
      countries: [
        { country: 'BR', views: 5000, percentage: 60 },
        { country: 'US', views: 2000, percentage: 24 },
      ],
      devices: [
        { deviceType: 'MOBILE', views: 6000, percentage: 72 },
        { deviceType: 'DESKTOP', views: 2000, percentage: 24 },
      ],
    }
    vi.mocked(getAnalyticsDemographics).mockResolvedValue({ data: demographics } as any)

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/demographics?channel_id=${MOCK_CHANNEL_ID}`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.ageGender).toHaveLength(2)
    expect(body.data.ageGender[0].ageGroup).toBe('18-24')
    expect(body.data.ageGender[0].male).toBe(30)
    expect(body.data.ageGender[0].female).toBe(20)
    expect(body.data.countries).toHaveLength(2)
    expect(body.data.countries[0].country).toBe('BR')
    expect(body.data.devices).toHaveLength(2)
    expect(body.data.devices[0].deviceType).toBe('MOBILE')
  })

  it('returns 502 when upstream API fails (scope error)', async () => {
    mockAuthRead()
    vi.mocked(getAnalyticsDemographics).mockRejectedValue(
      new PipelineServiceError('UPSTREAM_ERROR', 'Failed to fetch demographics from YouTube', 502),
    )

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/demographics?channel_id=${MOCK_CHANNEL_ID}`),
    )
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error.code).toBe('UPSTREAM_ERROR')
  })

  it('passes days param with default 28', async () => {
    mockAuthRead()
    vi.mocked(getAnalyticsDemographics).mockResolvedValue({
      data: { ageGender: [], countries: [], devices: [] },
    } as any)

    await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/demographics?channel_id=${MOCK_CHANNEL_ID}`),
    )
    expect(getAnalyticsDemographics).toHaveBeenCalledWith(expect.anything(), MOCK_CHANNEL_ID, 28)
  })
})

// ─── GET /api/pipeline/youtube/analytics/search-terms ──────────────────────

describe('GET /api/pipeline/youtube/analytics/search-terms', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/analytics/search-terms/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/analytics/search-terms?channel_id=abc'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when channel_id is missing', async () => {
    mockAuthRead()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/analytics/search-terms'))
    expect(res.status).toBe(400)
  })

  it('returns terms with views and watch time', async () => {
    mockAuthRead()
    const terms = {
      terms: [
        { query: 'react hooks tutorial', views: 3200, watchTimeMinutes: 1500 },
        { query: 'nextjs app router', views: 2800, watchTimeMinutes: 1200 },
        { query: 'typescript generics', views: 1500, watchTimeMinutes: 800 },
      ],
    }
    vi.mocked(getAnalyticsSearchTerms).mockResolvedValue({ data: terms } as any)

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/search-terms?channel_id=${MOCK_CHANNEL_ID}`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.terms).toHaveLength(3)
    expect(body.data.terms[0].query).toBe('react hooks tutorial')
    expect(body.data.terms[0].views).toBe(3200)
    expect(body.data.terms[0].watchTimeMinutes).toBe(1500)
  })

  it('returns 502 when upstream fails', async () => {
    mockAuthRead()
    vi.mocked(getAnalyticsSearchTerms).mockRejectedValue(
      new PipelineServiceError('UPSTREAM_ERROR', 'Failed to fetch search terms from YouTube', 502),
    )

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/search-terms?channel_id=${MOCK_CHANNEL_ID}`),
    )
    expect(res.status).toBe(502)
  })

  it('passes custom days param', async () => {
    mockAuthRead()
    vi.mocked(getAnalyticsSearchTerms).mockResolvedValue({
      data: { terms: [] },
    } as any)

    await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/search-terms?channel_id=${MOCK_CHANNEL_ID}&days=90`),
    )
    expect(getAnalyticsSearchTerms).toHaveBeenCalledWith(expect.anything(), MOCK_CHANNEL_ID, 90)
  })
})

// ─── GET /api/pipeline/youtube/analytics/notes ─────────────────────────────

describe('GET /api/pipeline/youtube/analytics/notes', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/analytics/notes/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/analytics/notes?channel_id=abc'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when channel_id is missing', async () => {
    mockAuthRead()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/analytics/notes'))
    expect(res.status).toBe(400)
  })

  it('returns notes for a channel', async () => {
    mockAuthRead()
    const notes = {
      notes: [
        { id: 'n1', author: 'Cowork', text: 'CTR dropped below baseline this week', timestamp: '2026-06-01T10:00:00Z', isBot: true, source: 'cowork' },
        { id: 'n2', author: 'Thiago', text: 'Investigating thumbnail changes', timestamp: '2026-06-01T09:00:00Z', isBot: false, source: null },
      ],
    }
    vi.mocked(listAnalyticsNotes).mockResolvedValue({ data: notes } as any)

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/notes?channel_id=${MOCK_CHANNEL_ID}`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.notes).toHaveLength(2)
    expect(body.data.notes[0].id).toBe('n1')
    expect(body.data.notes[0].isBot).toBe(true)
    expect(body.data.notes[0].source).toBe('cowork')
    expect(body.data.notes[1].isBot).toBe(false)
    expect(body.data.notes[1].source).toBeNull()
  })

  it('returns 404 when channel not found', async () => {
    mockAuthRead()
    vi.mocked(listAnalyticsNotes).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Channel not found', 404),
    )

    const res = await GET(
      new NextRequest(`http://localhost/api/pipeline/youtube/analytics/notes?channel_id=${MOCK_CHANNEL_ID}`),
    )
    expect(res.status).toBe(404)
  })
})

// ─── POST /api/pipeline/youtube/analytics/notes ────────────────────────────

describe('POST /api/pipeline/youtube/analytics/notes', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/analytics/notes/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail('write')
    const req = new NextRequest('http://localhost/api/pipeline/youtube/analytics/notes', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('creates bot note with is_bot=true and source=cowork', async () => {
    mockAuthWrite()
    const noteBody = { channel_id: MOCK_CHANNEL_ID, text: 'Your CTR is improving week over week' }
    vi.mocked(parseBody).mockResolvedValue(noteBody)
    vi.mocked(createBotNote).mockResolvedValue({
      data: { ok: true, id: 'new-note-id' },
    } as any)

    const req = new NextRequest('http://localhost/api/pipeline/youtube/analytics/notes', {
      method: 'POST',
      body: JSON.stringify(noteBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.ok).toBe(true)
    expect(body.data.id).toBe('new-note-id')
    expect(createBotNote).toHaveBeenCalledWith(expect.anything(), noteBody)
  })

  it('returns validation error for empty text', async () => {
    mockAuthWrite()
    const noteBody = { channel_id: MOCK_CHANNEL_ID, text: '' }
    vi.mocked(parseBody).mockResolvedValue(noteBody)
    vi.mocked(createBotNote).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'String must contain at least 1 character(s)', 400),
    )

    const req = new NextRequest('http://localhost/api/pipeline/youtube/analytics/notes', {
      method: 'POST',
      body: JSON.stringify(noteBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns validation error for text exceeding 5000 chars', async () => {
    mockAuthWrite()
    const noteBody = { channel_id: MOCK_CHANNEL_ID, text: 'x'.repeat(5001) }
    vi.mocked(parseBody).mockResolvedValue(noteBody)
    vi.mocked(createBotNote).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'String must contain at most 5000 character(s)', 400),
    )

    const req = new NextRequest('http://localhost/api/pipeline/youtube/analytics/notes', {
      method: 'POST',
      body: JSON.stringify(noteBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when channel not found', async () => {
    mockAuthWrite()
    const noteBody = { channel_id: MOCK_CHANNEL_ID, text: 'Some note' }
    vi.mocked(parseBody).mockResolvedValue(noteBody)
    vi.mocked(createBotNote).mockRejectedValue(
      new PipelineServiceError('NOT_FOUND', 'Channel not found', 404),
    )

    const req = new NextRequest('http://localhost/api/pipeline/youtube/analytics/notes', {
      method: 'POST',
      body: JSON.stringify(noteBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('returns 500 when DB insert fails', async () => {
    mockAuthWrite()
    const noteBody = { channel_id: MOCK_CHANNEL_ID, text: 'Valid note text' }
    vi.mocked(parseBody).mockResolvedValue(noteBody)
    vi.mocked(createBotNote).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to create note', 500),
    )

    const req = new NextRequest('http://localhost/api/pipeline/youtube/analytics/notes', {
      method: 'POST',
      body: JSON.stringify(noteBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('DB_ERROR')
  })
})
