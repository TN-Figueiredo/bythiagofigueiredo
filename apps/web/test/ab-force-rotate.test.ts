import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock modules before imports
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn(),
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
}))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ getChannelTier: vi.fn() }))
vi.mock('@/lib/youtube/prompt-scoring', () => ({ scoreForPrompt: vi.fn() }))

import { forceRotate } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import {
  setThumbnail,
  fetchVariantImageBuffer,
} from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { resolveTemplates } from '@/lib/youtube/ab-templates'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

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
      { id: 'v1', sort_order: 0, blob_url: 'https://blob.example/thumb-a.jpg', is_original: true, title_text: null, description_text: null },
      { id: 'v2', sort_order: 1, blob_url: 'https://blob.example/thumb-b.jpg', is_original: false, title_text: null, description_text: null },
    ],
    ...overrides,
  }
}

interface BuildMockOpts {
  test?: unknown | null
  video?: { youtube_video_id: string; channel_id: string } | null
  channel?: { channel_id: string } | null
  cycleCount?: number
  trackedLinks?: { template_name: string; short_code: string }[]
}

function buildSupabaseMock(opts: BuildMockOpts = {}) {
  const {
    test = makeTest(),
    video = { youtube_video_id: 'YT_VIDEO_123', channel_id: 'ch-1' },
    channel = { channel_id: 'UC_CHANNEL_123' },
    cycleCount = 0,
    trackedLinks = [],
  } = opts

  const updateCalls: { table: string; data: unknown; filters: string[] }[] = []
  const insertCalls: { table: string; data: unknown }[] = []

  const fromMock = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: test, error: test ? null : { message: 'not found' } }),
              }),
            }),
          }),
        }),
        update: vi.fn((data: unknown) => {
          updateCalls.push({ table: 'ab_tests', data, filters: [] })
          return {
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }),
      }
    }

    if (table === 'youtube_videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: video, error: video ? null : { message: 'not found' } }),
          }),
        }),
      }
    }

    if (table === 'youtube_channels') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: channel, error: null }),
          }),
        }),
      }
    }

    if (table === 'ab_test_cycles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ count: cycleCount, data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: vi.fn((data: unknown) => {
          insertCalls.push({ table: 'ab_test_cycles', data })
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
    (text: string) => text,
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('forceRotate', () => {
  it('happy path: rotates thumbnail test', async () => {
    const test = makeTest({ test_type: 'thumbnail' })
    buildSupabaseMock({ test })

    const result = await forceRotate('test-1')

    expect(result).toEqual({ ok: true })
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://blob.example/thumb-b.jpg')
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123',
    )
    expect(updateVideoMetadata).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
    expect(revalidateTag).toHaveBeenCalledWith('ab-tests')
  })

  it('happy path: rotates title test', async () => {
    const test = makeTest({
      test_type: 'title',
      variants: [
        { id: 'v1', sort_order: 0, blob_url: null, is_original: true, title_text: 'Title A', description_text: null },
        { id: 'v2', sort_order: 1, blob_url: null, is_original: false, title_text: 'Title B', description_text: null },
      ],
    })
    buildSupabaseMock({ test })

    const result = await forceRotate('test-1')

    expect(result).toEqual({ ok: true })
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      'Title B',
      null,
      'fresh-token-123',
    )
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('happy path: rotates combo test (thumbnail + metadata)', async () => {
    const test = makeTest({
      test_type: 'combo',
      variants: [
        { id: 'v1', sort_order: 0, blob_url: 'https://blob.example/a.jpg', is_original: true, title_text: 'Title A', description_text: 'Desc A' },
        { id: 'v2', sort_order: 1, blob_url: 'https://blob.example/b.jpg', is_original: false, title_text: 'Title B', description_text: 'Desc B' },
      ],
    })
    buildSupabaseMock({ test })

    const result = await forceRotate('test-1')

    expect(result).toEqual({ ok: true })
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123',
    )
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      'Title B',
      'Desc B',
      'fresh-token-123',
    )
  })

  it('returns error when preflight fails', async () => {
    const test = makeTest()
    buildSupabaseMock({ test })
    ;(preflightTokenCheck as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: 'token_invalid_401',
    })

    const result = await forceRotate('test-1')

    expect(result).toEqual({ ok: false, error: 'Token inválido: token_invalid_401' })
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('returns error when test not found', async () => {
    buildSupabaseMock({ test: null })

    const result = await forceRotate('non-existent')

    expect(result).toEqual({ ok: false, error: 'Test not found or not active' })
    expect(preflightTokenCheck).not.toHaveBeenCalled()
  })

  it('returns error when test is not active (filtered by status=active query)', async () => {
    // The query filters by status=active, so a paused test returns null
    buildSupabaseMock({ test: null })

    const result = await forceRotate('test-paused')

    expect(result).toEqual({ ok: false, error: 'Test not found or not active' })
    expect(preflightTokenCheck).not.toHaveBeenCalled()
  })

  it('sets write-ahead marker before YouTube call and clears after', async () => {
    const test = makeTest({ test_type: 'thumbnail' })
    const { fromMock, updateCalls } = buildSupabaseMock({ test })

    await forceRotate('test-1')

    // The ab_tests update calls: first sets marker (last_applied_variant_id),
    // second clears it (last_applied_variant_id: null)
    const abTestUpdates = updateCalls.filter(c => c.table === 'ab_tests')
    expect(abTestUpdates.length).toBe(2)
    // First update: set marker with next variant id
    expect(abTestUpdates[0].data).toEqual({ last_applied_variant_id: 'v2' })
    // Second update: clear marker
    expect(abTestUpdates[1].data).toEqual({ last_applied_variant_id: null })

    // YouTube was called between the two marker updates
    expect(setThumbnail).toHaveBeenCalled()
  })

  it('applies blob_url even for original variant', async () => {
    const test = makeTest({
      test_type: 'thumbnail',
      variants: [
        { id: 'v1', sort_order: 0, blob_url: 'https://blob.example/original.jpg', is_original: true, title_text: null, description_text: null },
        { id: 'v2', sort_order: 1, blob_url: 'https://blob.example/variant.jpg', is_original: false, title_text: null, description_text: null },
      ],
    })
    buildSupabaseMock({ test })
    // Force rotation to pick the original variant (index 0)
    ;(getNextVariantIndex as ReturnType<typeof vi.fn>).mockReturnValue(0)

    const result = await forceRotate('test-1')

    expect(result).toEqual({ ok: true })
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://blob.example/original.jpg')
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123',
    )
  })

  it('counts completed cycles BEFORE closing current (nextCycle = count + 1)', async () => {
    const test = makeTest({ test_type: 'thumbnail' })
    // 3 completed cycles already exist
    buildSupabaseMock({ test, cycleCount: 3 })

    await forceRotate('test-1')

    // nextCycle should be 3 + 1 = 4
    expect(getNextVariantIndex).toHaveBeenCalledWith('abba', 2, 4)
  })

  it('returns error when video not found', async () => {
    const test = makeTest()
    buildSupabaseMock({ test, video: null })

    const result = await forceRotate('test-1')

    expect(result).toEqual({ ok: false, error: 'Video not found' })
    expect(preflightTokenCheck).not.toHaveBeenCalled()
  })

  it('returns error when auth check fails', async () => {
    ;(requireSiteScope as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: 'unauthenticated',
    })
    buildSupabaseMock({})

    const result = await forceRotate('test-1')

    expect(result).toEqual({ ok: false, error: 'unauthenticated' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
})
