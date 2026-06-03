import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock modules before imports — must match ab-force-rotate.test.ts pattern exactly
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: vi.fn() }))
vi.mock('@/lib/youtube/ab-templates', () => ({ resolveTemplates: vi.fn() }))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getNextVariantIndex: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@/lib/youtube/ab-types', () => ({
  AB_TEST_CONFIG_DEFAULTS: {},
  VARIANT_LABELS: ['A', 'B', 'C', 'D'],
  DRIFT_STATUS_NOTE: 'Thumbnail alterado externamente',
}))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ getChannelTier: vi.fn() }))
vi.mock('@/lib/youtube/prompt-scoring', () => ({ scoreForPrompt: vi.fn() }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))

import { pauseAbTest } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  setThumbnail,
  fetchVariantImageBuffer,
} from '@/lib/youtube/ab-youtube'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { revalidatePath, revalidateTag } from 'next/cache'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-1',
    site_id: 'site-1',
    status: 'active',
    youtube_video_id: 'db-video-1',
    original_thumbnail_url: 'https://i.ytimg.com/vi/orig/hqdefault.jpg',
    ...overrides,
  }
}

function makeVariants(overrides?: Partial<{ originalBlobUrl: string | null }>) {
  return [
    {
      id: 'v1',
      label: 'A',
      is_original: true,
      blob_url: overrides?.originalBlobUrl !== undefined ? overrides.originalBlobUrl : 'https://blob.example/original.jpg',
    },
    {
      id: 'v2',
      label: 'B',
      is_original: false,
      blob_url: 'https://blob.example/variant-b.jpg',
    },
  ]
}

interface BuildMockOpts {
  test?: unknown | null
  variants?: unknown[] | null
  videoData?: { youtube_video_id: string; youtube_channels: { channel_id: string } } | null
  updateError?: { message: string } | null
}

function buildSupabaseMock(opts: BuildMockOpts = {}) {
  const {
    test = makeTest(),
    variants = makeVariants(),
    videoData = { youtube_video_id: 'YT_VIDEO_123', youtube_channels: { channel_id: 'UC_CHANNEL_123' } },
    updateError = null,
  } = opts

  const updateCalls: { table: string; data: unknown }[] = []

  const fromMock = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: test,
                error: test ? null : { message: 'not found' },
              }),
            }),
          }),
        }),
        update: vi.fn((data: unknown) => {
          updateCalls.push({ table: 'ab_tests', data })
          return {
            eq: vi.fn().mockResolvedValue({ data: null, error: updateError }),
          }
        }),
      }
    }

    if (table === 'ab_test_variants') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: variants,
            error: variants ? null : { message: 'not found' },
          }),
        }),
      }
    }

    if (table === 'youtube_videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: videoData,
              error: videoData ? null : { message: 'not found' },
            }),
          }),
        }),
      }
    }

    if (table === 'ab_test_cycles') {
      return {
        update: vi.fn((data: unknown) => {
          updateCalls.push({ table: 'ab_test_cycles', data })
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }
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

  return { client, fromMock, updateCalls }
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    accessToken: 'fresh-token-123',
  })
  ;(fetchVariantImageBuffer as ReturnType<typeof vi.fn>).mockResolvedValue({
    buffer: Buffer.from('img'),
    contentType: 'image/jpeg',
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pauseAbTest', () => {
  it('reverts thumbnail to original variant blob_url', async () => {
    const variants = makeVariants({ originalBlobUrl: 'https://blob.example/original.jpg' })
    buildSupabaseMock({ variants })

    const result = await pauseAbTest('test-1')

    expect(result).toEqual({ ok: true })
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://blob.example/original.jpg')
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123',
    )
  })

  it('falls back to test.original_thumbnail_url when original variant has no blob_url', async () => {
    const variants = makeVariants({ originalBlobUrl: null })
    const test = makeTest({ original_thumbnail_url: 'https://i.ytimg.com/vi/fallback/hqdefault.jpg' })
    buildSupabaseMock({ test, variants })

    const result = await pauseAbTest('test-1')

    expect(result).toEqual({ ok: true })
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://i.ytimg.com/vi/fallback/hqdefault.jpg')
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123',
    )
  })

  it('updates status to paused and sets paused_at', async () => {
    const { updateCalls } = buildSupabaseMock()

    const result = await pauseAbTest('test-1')

    expect(result).toEqual({ ok: true })
    const abTestUpdate = updateCalls.find(c => c.table === 'ab_tests')
    expect(abTestUpdate).toBeDefined()
    const data = abTestUpdate!.data as Record<string, unknown>
    expect(data.status).toBe('paused')
    expect(data.paused_at).toBeDefined()
    expect(typeof data.paused_at).toBe('string')
    expect(data.updated_at).toBeDefined()
  })

  it('closes open cycle', async () => {
    const { updateCalls } = buildSupabaseMock()

    const result = await pauseAbTest('test-1')

    expect(result).toEqual({ ok: true })
    const cycleUpdate = updateCalls.find(c => c.table === 'ab_test_cycles')
    expect(cycleUpdate).toBeDefined()
    const data = cycleUpdate!.data as Record<string, unknown>
    expect(data.ended_at).toBeDefined()
    expect(typeof data.ended_at).toBe('string')
  })

  it('rejects non-active test', async () => {
    const test = makeTest({ status: 'paused' })
    buildSupabaseMock({ test })

    const result = await pauseAbTest('test-1')

    expect(result).toEqual({ ok: false, error: 'Only active tests can be paused' })
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(fetchVariantImageBuffer).not.toHaveBeenCalled()
  })

  it('returns error when test not found', async () => {
    buildSupabaseMock({ test: null })

    const result = await pauseAbTest('non-existent')

    expect(result).toEqual({ ok: false, error: 'Test not found' })
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('revalidates cache after success', async () => {
    buildSupabaseMock()

    const result = await pauseAbTest('test-1')

    expect(result).toEqual({ ok: true })
    expect(revalidateTag).toHaveBeenCalledWith('youtube')
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
  })
})
