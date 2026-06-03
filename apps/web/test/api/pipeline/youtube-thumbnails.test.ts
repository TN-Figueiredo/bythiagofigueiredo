import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn(),
  pipelineError: vi.fn(
    (code: string, msg: string, status: number) =>
      new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
  ),
  pipelineSuccess: vi.fn(
    (data: unknown, status: number) =>
      new Response(JSON.stringify({ data }), { status }),
  ),
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
  getThumbnailLibrary: vi.fn(),
  getThumbnailFatigueAlerts: vi.fn(),
}))

import { authenticateRead } from '@/lib/pipeline/helpers'
import {
  getThumbnailLibrary,
  getThumbnailFatigueAlerts,
} from '@/lib/pipeline/services/youtube'

function mockAuthRead() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  } as any)
}

function mockAuthFail() {
  const resp = new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }) as any
  vi.mocked(authenticateRead).mockResolvedValue(resp)
}

// ─── GET /api/pipeline/youtube/thumbnails/library ───────────────────────────

describe('GET /api/pipeline/youtube/thumbnails/library', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/thumbnails/library/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/thumbnails/library'))
    expect(res.status).toBe(401)
  })

  it('returns thumbnails with lift and tags', async () => {
    mockAuthRead()
    vi.mocked(getThumbnailLibrary).mockResolvedValue({
      data: {
        thumbnails: [
          {
            id: 'aaa-111',
            videoTitle: 'How to Build an Empire',
            imageUrl: 'https://blob.vercel-storage.com/thumb-abc.jpg',
            lift: 12.5,
            tags: ['curiosity', 'bold-text'],
            longevityScore: 'stable',
            sourceType: 'ab_winner',
          },
          {
            id: 'bbb-222',
            videoTitle: 'React 19 Deep Dive',
            imageUrl: 'https://blob.vercel-storage.com/thumb-def.jpg',
            lift: -3.2,
            tags: ['technical', 'code-screen'],
            longevityScore: 'declining',
            sourceType: 'manual',
          },
        ],
      },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/thumbnails/library'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.thumbnails).toHaveLength(2)
    expect(body.data.thumbnails[0].lift).toBe(12.5)
    expect(body.data.thumbnails[0].tags).toEqual(['curiosity', 'bold-text'])
    expect(body.data.thumbnails[1].sourceType).toBe('manual')
  })

  it('includes longevity score from latest checkpoint', async () => {
    mockAuthRead()
    vi.mocked(getThumbnailLibrary).mockResolvedValue({
      data: {
        thumbnails: [
          {
            id: 'ccc-333',
            videoTitle: 'Video with Longevity',
            imageUrl: 'https://blob.vercel-storage.com/thumb-ghi.jpg',
            lift: 8.0,
            tags: [],
            longevityScore: 'improving',
            sourceType: 'ab_winner',
          },
        ],
      },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/thumbnails/library'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.thumbnails[0].longevityScore).toBe('improving')
  })

  it('returns empty when no thumbnails', async () => {
    mockAuthRead()
    vi.mocked(getThumbnailLibrary).mockResolvedValue({
      data: { thumbnails: [] },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/thumbnails/library'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.thumbnails).toEqual([])
  })

  it('returns 500 when service throws DB error', async () => {
    mockAuthRead()
    vi.mocked(getThumbnailLibrary).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to load thumbnail library', 500),
    )

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/thumbnails/library'))
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/pipeline/youtube/thumbnails/fatigue ───────────────────────────

describe('GET /api/pipeline/youtube/thumbnails/fatigue', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/thumbnails/fatigue/route')
    GET = mod.GET
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/thumbnails/fatigue'))
    expect(res.status).toBe(401)
  })

  it('returns pending alerts with video info', async () => {
    mockAuthRead()
    vi.mocked(getThumbnailFatigueAlerts).mockResolvedValue({
      data: {
        alerts: [
          {
            videoId: 'yt-vid-001',
            title: 'My Best Video',
            zScore: -2.3,
            expectedCtr: 0.085,
            actualCtr: 0.042,
            daysSinceChange: 14,
          },
          {
            videoId: 'yt-vid-002',
            title: 'Another Video',
            zScore: -1.8,
            expectedCtr: 0.072,
            actualCtr: 0.051,
            daysSinceChange: 7,
          },
        ],
      },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/thumbnails/fatigue'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.alerts).toHaveLength(2)
    expect(body.data.alerts[0].title).toBe('My Best Video')
    expect(body.data.alerts[0].zScore).toBe(-2.3)
    expect(body.data.alerts[0].expectedCtr).toBe(0.085)
    expect(body.data.alerts[0].actualCtr).toBe(0.042)
  })

  it('computes daysSinceChange', async () => {
    mockAuthRead()
    vi.mocked(getThumbnailFatigueAlerts).mockResolvedValue({
      data: {
        alerts: [
          {
            videoId: 'yt-vid-003',
            title: 'Video with Age',
            zScore: -2.0,
            expectedCtr: 0.09,
            actualCtr: 0.04,
            daysSinceChange: 30,
          },
        ],
      },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/thumbnails/fatigue'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.alerts[0].daysSinceChange).toBe(30)
    expect(typeof body.data.alerts[0].daysSinceChange).toBe('number')
  })

  it('returns empty when no pending alerts', async () => {
    mockAuthRead()
    vi.mocked(getThumbnailFatigueAlerts).mockResolvedValue({
      data: { alerts: [] },
    } as any)

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/thumbnails/fatigue'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.alerts).toEqual([])
  })

  it('returns 500 when service throws DB error', async () => {
    mockAuthRead()
    vi.mocked(getThumbnailFatigueAlerts).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to load fatigue alerts', 500),
    )

    const res = await GET(new NextRequest('http://localhost/api/pipeline/youtube/thumbnails/fatigue'))
    expect(res.status).toBe(500)
  })
})
