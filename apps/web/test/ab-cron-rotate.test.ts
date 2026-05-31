import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn() }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getNextVariantIndex: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn(),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: vi.fn() }))
vi.mock('@/lib/youtube/ab-templates', () => ({ resolveTemplates: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn().mockResolvedValue(undefined),
  recordCronFailure: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { GET } from '@/app/api/cron/ab-rotate/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import { createNotification } from '@/lib/notifications/create'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import {
  setThumbnail,
  fetchVariantImageBuffer,
} from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { resolveTemplates } from '@/lib/youtube/ab-templates'

function createCronRequest(secret: string) {
  return new NextRequest(new URL('http://localhost:3000/api/cron/ab-rotate'), {
    headers: { authorization: `Bearer ${secret}` },
  })
}

function makeTest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-1',
    youtube_video_id: 'db-video-1',
    site_id: 'site-1',
    status: 'active',
    test_type: 'thumbnail',
    config: { rotation_pattern: 'abba' },
    original_title: 'Original Title',
    original_description: 'Original Description',
    variants: [
      { id: 'v1', sort_order: 0, blob_url: 'https://blob.example/thumb-a.jpg' },
      { id: 'v2', sort_order: 1, blob_url: 'https://blob.example/thumb-b.jpg' },
    ],
    ...overrides,
  }
}

interface BuildMockOpts {
  tests?: unknown[]
  video?: { youtube_video_id: string; channel_id?: string } | null
  cycleCount?: number
  trackedLinks?: { template_name: string; short_code: string }[]
  alreadyRotatedToday?: boolean
}

function buildSupabaseMock(opts: BuildMockOpts = {}) {
  const {
    tests = [],
    video = { youtube_video_id: 'YT_VIDEO_123', channel_id: 'ch-1' },
    cycleCount = 0,
    trackedLinks = [],
    alreadyRotatedToday = false,
  } = opts

  const updateCalls: { table: string; data: unknown; filters: unknown[] }[] = []
  const insertCalls: { table: string; data: unknown }[] = []
  let cyclesSelectCallCount = 0

  const fromMock = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      // May be a SELECT (active tests) or UPDATE (pause)
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: tests }),
        }),
        update: vi.fn((data: unknown) => {
          const chain = {
            eq: vi.fn((_col: string, _val: string) => {
              updateCalls.push({ table, data, filters: [{ _col, _val }] })
              return Promise.resolve({ data: null, error: null })
            }),
          }
          return chain
        }),
      }
    }

    if (table === 'youtube_videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: video, error: null }),
          }),
        }),
      }
    }

    if (table === 'ab_test_cycles') {
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        select: vi.fn().mockImplementation(() => {
          cyclesSelectCallCount++
          if (cyclesSelectCallCount % 2 === 1) {
            // Odd calls = idempotency check (select('id').eq.gte.limit.maybeSingle)
            return {
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: alreadyRotatedToday ? { id: 'existing-cycle' } : null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }
          }
          // Even calls = cycle count (select('*', { count }).eq.not)
          return {
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ count: cycleCount, data: null, error: null }),
            }),
          }
        }),
        insert: vi.fn((data: unknown) => {
          insertCalls.push({ table, data })
          return Promise.resolve({ data: null, error: null })
        }),
      }
    }

    if (table === 'ab_test_tracked_links') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: trackedLinks, error: null }),
        }),
      }
    }

    // Fallback
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

  const client = { from: fromMock }
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)

  return { client, fromMock, updateCalls, insertCalls }
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret')
  vi.stubEnv('LINKS_SHORT_DOMAIN', 'go.test.com')
  vi.clearAllMocks()
  ;(preflightTokenCheck as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    accessToken: 'fresh-token-123',
  })
  ;(getNextVariantIndex as ReturnType<typeof vi.fn>).mockReturnValue(1)
  ;(fetchVariantImageBuffer as ReturnType<typeof vi.fn>).mockResolvedValue({
    buffer: Buffer.from('img'),
    contentType: 'image/jpeg',
  })
  ;(resolveTemplates as ReturnType<typeof vi.fn>).mockImplementation(
    (text: string) => text
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/cron/ab-rotate', () => {
  it('returns 401 when no auth header', async () => {
    const req = new NextRequest(
      new URL('http://localhost:3000/api/cron/ab-rotate')
    )
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 401 with wrong secret', async () => {
    const req = createCronRequest('wrong-secret')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns { processed: 0 } when no active tests', async () => {
    buildSupabaseMock({ tests: [] })
    const req = createCronRequest('test-secret')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
  })

  it('rotates a thumbnail test', async () => {
    const test = makeTest({ test_type: 'thumbnail' })
    buildSupabaseMock({ tests: [test] })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(1)
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith(
      'https://blob.example/thumb-b.jpg'
    )
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123'
    )
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('rotates a title test', async () => {
    const test = makeTest({
      test_type: 'title',
      variants: [
        { id: 'v1', sort_order: 0, title_text: 'Title A' },
        { id: 'v2', sort_order: 1, title_text: 'Title B' },
      ],
    })
    buildSupabaseMock({ tests: [test] })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(1)
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      'Title B',
      null,
      'fresh-token-123'
    )
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('rotates a description test with link templates', async () => {
    const test = makeTest({
      test_type: 'description',
      variants: [
        { id: 'v1', sort_order: 0, description_text: 'Desc A {{link:newsletter}}' },
        { id: 'v2', sort_order: 1, description_text: 'Desc B {{link:curso}}' },
      ],
    })
    const trackedLinks = [
      { template_name: 'curso', short_code: 'AbC123' },
    ]
    buildSupabaseMock({ tests: [test], trackedLinks })
    ;(resolveTemplates as ReturnType<typeof vi.fn>).mockReturnValue(
      'Desc B https://go.test.com/AbC123'
    )

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(1)
    expect(resolveTemplates).toHaveBeenCalledWith(
      'Desc B {{link:curso}}',
      { curso: 'https://go.test.com/AbC123' }
    )
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      null,
      'Desc B https://go.test.com/AbC123',
      'fresh-token-123'
    )
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('rotates a combo test', async () => {
    const test = makeTest({
      test_type: 'combo',
      variants: [
        {
          id: 'v1',
          sort_order: 0,
          blob_url: 'https://blob.example/a.jpg',
          title_text: 'Title A',
          description_text: 'Desc A',
        },
        {
          id: 'v2',
          sort_order: 1,
          blob_url: 'https://blob.example/b.jpg',
          title_text: 'Title B',
          description_text: 'Desc B',
        },
      ],
    })
    buildSupabaseMock({ tests: [test] })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(1)
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123'
    )
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      'Title B',
      'Desc B',
      'fresh-token-123'
    )
  })

  it('skips rotation and sends notification when preflight fails', async () => {
    const test = makeTest()
    buildSupabaseMock({ tests: [test] })
    ;(preflightTokenCheck as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: 'token_invalid_401',
    })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(0)
    expect(body.errors).toBe(0)
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: 'site-1',
        type: 'youtube.token_invalid',
        domain: 'youtube',
        priority: 1,
        title: 'Token YouTube inválido',
        message: expect.stringContaining('token_invalid_401'),
      })
    )
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('uses rotation_pattern from config', async () => {
    const test = makeTest({
      config: { rotation_pattern: 'round_robin' },
    })
    buildSupabaseMock({ tests: [test], cycleCount: 3 })

    const req = createCronRequest('test-secret')
    await GET(req)

    expect(getNextVariantIndex).toHaveBeenCalledWith('round_robin', 2, 4)
  })

  it('skips test if already rotated today (idempotency)', async () => {
    const test = makeTest()
    buildSupabaseMock({ tests: [test], alreadyRotatedToday: true })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(0)
    expect(preflightTokenCheck).not.toHaveBeenCalled()
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('skips test when getNextVariantIndex returns out-of-bounds index', async () => {
    const test = makeTest()
    buildSupabaseMock({ tests: [test] })
    ;(getNextVariantIndex as ReturnType<typeof vi.fn>).mockReturnValue(99)

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(0)
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })
})
