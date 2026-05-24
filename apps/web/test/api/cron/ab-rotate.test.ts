import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const CRON_SECRET = 'test-cron-secret'
process.env.CRON_SECRET = CRON_SECRET

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

// ── Token refresh mock ───────────────────────────────────────────────────────
const mockEnsureFreshToken = vi.fn()
vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
}))

// ── YouTube mocks ────────────────────────────────────────────────────────────
vi.mock('@/lib/youtube/ab-rotation', () => ({
  getNextVariantIndex: vi.fn().mockReturnValue(1),
}))

const mockSetThumbnail = vi.fn().mockResolvedValue(undefined)
const mockFetchVariantImageBuffer = vi.fn().mockResolvedValue({
  buffer: Buffer.from('img'),
  contentType: 'image/png',
})

vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: (...args: unknown[]) => mockSetThumbnail(...args),
  fetchVariantImageBuffer: (...args: unknown[]) =>
    mockFetchVariantImageBuffer(...args),
}))

vi.mock('@/lib/youtube/ab-metadata', () => ({
  updateVideoMetadata: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/youtube/ab-templates', () => ({
  resolveTemplates: vi.fn((text: string) => text),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '@/app/api/cron/ab-rotate/route'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(authHeader?: string): NextRequest {
  return {
    headers: new Headers(authHeader ? { authorization: authHeader } : {}),
  } as unknown as NextRequest
}

function makeTest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-1',
    site_id: 'site-1',
    youtube_video_id: 'vid-1',
    status: 'active',
    test_type: 'thumbnail',
    original_title: null,
    original_description: null,
    config: { rotation_pattern: 'abba' },
    variants: [
      { id: 'var-a', sort_order: 0, label: 'A', blob_url: 'https://blob/a.png', title_text: null, description_text: null, metadata: {}, is_original: true },
      { id: 'var-b', sort_order: 1, label: 'B', blob_url: 'https://blob/b.png', title_text: null, description_text: null, metadata: {}, is_original: false },
    ],
    ...overrides,
  }
}

function activeTestsQuery(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  }
}

function singleQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

function countQuery(count: number) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockResolvedValue({ count, error: null }),
      }),
    }),
  }
}

function updateQuery() {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }
}

function insertQuery() {
  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/ab-rotate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns processed: 0 when no active tests', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_tests') return activeTestsQuery([])
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.processed).toBe(0)
  })

  it('happy path: rotates variant and opens new cycle', async () => {
    const test = makeTest()
    const video = { youtube_video_id: 'yt-abc' }

    mockEnsureFreshToken.mockResolvedValue({ accessToken: 'tok-123' })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_tests') {
        return {
          ...activeTestsQuery([test]),
          ...updateQuery(),
        }
      }
      if (table === 'youtube_videos') return singleQuery(video)
      if (table === 'ab_test_cycles') {
        return {
          ...updateQuery(),
          ...countQuery(4),
          ...insertQuery(),
        }
      }
      if (table === 'ab_test_tracked_links') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      }
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.processed).toBe(1)
    expect(body.errors).toBe(0)
    expect(mockSetThumbnail).toHaveBeenCalled()
  })

  it('auto-pauses test on 401 auth error', async () => {
    const test = makeTest()
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    mockEnsureFreshToken.mockRejectedValue(new Error('401 unauthorized'))

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_tests') {
        return {
          ...activeTestsQuery([test]),
          update: mockUpdate,
        }
      }
      if (table === 'youtube_videos') return singleQuery({ youtube_video_id: 'yt-abc' })
      if (table === 'ab_test_cycles') return updateQuery()
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.errors).toBe(1)
    expect(mockUpdate).toHaveBeenCalled()
  })
})
