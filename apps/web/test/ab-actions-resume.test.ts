import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock modules before imports
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: vi.fn() }))
vi.mock('@/lib/youtube/ab-templates', () => ({ resolveTemplates: vi.fn() }))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getNextVariantIndex: vi.fn() }))
vi.mock('@/lib/youtube/ab-apply', () => ({ applyVariantToYouTube: vi.fn() }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))
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
  AB_SITE_SETTINGS_DEFAULTS: {},
  VARIANT_LABELS: ['A', 'B', 'C', 'D'],
  DRIFT_STATUS_NOTE: 'Thumbnail alterado externamente',
}))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ getChannelTier: vi.fn() }))
vi.mock('@/lib/youtube/prompt-scoring', () => ({ scoreForPrompt: vi.fn() }))

import { resumeAbTest } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import { applyVariantToYouTube } from '@/lib/youtube/ab-apply'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { revalidatePath, revalidateTag } from 'next/cache'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-1',
    site_id: 'site-1',
    status: 'paused',
    status_note: null,
    drift_acknowledged_at: null,
    youtube_video_id: 'db-video-1',
    test_type: 'thumbnail',
    config: { rotation_pattern: 'abba' },
    original_title: 'Original Title',
    original_description: 'Original Description',
    ...overrides,
  }
}

const DEFAULT_VARIANTS = [
  { id: 'v1', label: 'A', sort_order: 0, is_original: true, blob_url: 'https://blob.example/thumb-a.jpg', title_text: null, description_text: null },
  { id: 'v2', label: 'B', sort_order: 1, is_original: false, blob_url: 'https://blob.example/thumb-b.jpg', title_text: null, description_text: null },
]

interface BuildMockOpts {
  test?: unknown | null
  variants?: unknown[] | null
  video?: { youtube_video_id: string } | null
  channel?: { channel_id: string } | null
  cycleCount?: number
  cycleInsertError?: { message: string } | null
  testUpdateError?: { message: string } | null
}

function buildSupabaseMock(opts: BuildMockOpts = {}) {
  const {
    test = makeTest(),
    variants = DEFAULT_VARIANTS,
    video = { youtube_video_id: 'YT_VIDEO_123' },
    channel = { channel_id: 'UC_CHANNEL_123' },
    cycleCount = 0,
    cycleInsertError = null,
    testUpdateError = null,
  } = opts

  const updateCalls: { table: string; data: unknown; filters: string[] }[] = []
  const insertCalls: { table: string; data: unknown }[] = []

  const fromMock = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: test, error: test ? null : { message: 'not found' } }),
            }),
          }),
        }),
        update: vi.fn((data: unknown) => {
          updateCalls.push({ table: 'ab_tests', data, filters: [] })
          return {
            eq: vi.fn().mockResolvedValue({ data: null, error: testUpdateError }),
          }
        }),
      }
    }

    if (table === 'ab_test_variants') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: variants, error: variants ? null : { message: 'not found' } }),
          }),
        }),
      }
    }

    if (table === 'ab_test_cycles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: cycleCount, data: null, error: null }),
        }),
        insert: vi.fn((data: unknown) => {
          insertCalls.push({ table: 'ab_test_cycles', data })
          return Promise.resolve({ data: null, error: cycleInsertError })
        }),
      }
    }

    if (table === 'youtube_videos') {
      // resolveChannelAccountId uses a join: select('youtube_channels!inner(channel_id)')
      // resolveYouTubeVideoId uses: select('youtube_video_id')
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(async () => {
              // Both resolveChannelAccountId and resolveYouTubeVideoId query the same table
              // Return an object that satisfies both lookups
              if (!video) return { data: null, error: { message: 'not found' } }
              return {
                data: {
                  youtube_video_id: video.youtube_video_id,
                  youtube_channels: channel ? { channel_id: channel.channel_id } : undefined,
                },
                error: null,
              }
            }),
          }),
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

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  ;(getNextVariantIndex as ReturnType<typeof vi.fn>).mockReturnValue(1)
  ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    accessToken: 'fresh-token-123',
  })
  ;(applyVariantToYouTube as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    appliedThumbnail: true,
    appliedMetadata: false,
    meta: { thumbnail_set: true, youtube_thumbnail_url: 'https://i.ytimg.com/vi/YT_VIDEO_123/hq.jpg' },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resumeAbTest', () => {
  it('resumes paused test and calls applyVariantToYouTube', async () => {
    buildSupabaseMock()

    const result = await resumeAbTest('test-1')

    expect(result).toEqual({ ok: true })
    expect(applyVariantToYouTube).toHaveBeenCalledWith(
      expect.objectContaining({
        youtubeVideoId: 'YT_VIDEO_123',
        accessToken: 'fresh-token-123',
        testType: 'thumbnail',
        variant: expect.objectContaining({
          id: 'v2',
          blob_url: 'https://blob.example/thumb-b.jpg',
        }),
        originalTitle: 'Original Title',
        originalDescription: 'Original Description',
      }),
    )
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
    expect(revalidateTag).toHaveBeenCalledWith('youtube')
  })

  it('stores applied_metadata on new cycle', async () => {
    const meta = { thumbnail_set: true, youtube_thumbnail_url: 'https://i.ytimg.com/vi/YT_VIDEO_123/hq.jpg' }
    ;(applyVariantToYouTube as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      appliedThumbnail: true,
      appliedMetadata: false,
      meta,
    })

    const { insertCalls } = buildSupabaseMock()

    const result = await resumeAbTest('test-1')

    expect(result).toEqual({ ok: true })
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]!.table).toBe('ab_test_cycles')
    expect(insertCalls[0]!.data).toEqual(
      expect.objectContaining({
        test_id: 'test-1',
        variant_id: 'v2',
        cycle_number: 0,
        applied_metadata: meta,
      }),
    )
    // started_at should be an ISO string
    expect(insertCalls[0]!.data).toHaveProperty('started_at')
  })

  it('uses configured rotation_pattern (not hardcoded ABBA)', async () => {
    const test = makeTest({ config: { rotation_pattern: 'round_robin' } })
    buildSupabaseMock({ test })

    const result = await resumeAbTest('test-1')

    expect(result).toEqual({ ok: true })
    expect(getNextVariantIndex).toHaveBeenCalledWith('round_robin', 2, 0)
  })

  it('blocks resume when drift not acknowledged', async () => {
    const test = makeTest({
      status_note: 'Thumbnail alterado externamente',
      drift_acknowledged_at: null,
    })
    buildSupabaseMock({ test })

    const result = await resumeAbTest('test-1')

    expect(result).toEqual({
      ok: false,
      error: 'Drift não reconhecido. Reconheça a mudança antes de retomar o teste.',
    })
    expect(applyVariantToYouTube).not.toHaveBeenCalled()
  })

  it('allows resume when drift acknowledged', async () => {
    const test = makeTest({
      status_note: 'Thumbnail alterado externamente',
      drift_acknowledged_at: '2026-06-01T12:00:00.000Z',
    })
    buildSupabaseMock({ test })

    const result = await resumeAbTest('test-1')

    expect(result).toEqual({ ok: true })
    expect(applyVariantToYouTube).toHaveBeenCalled()
  })

  it('clears paused_at, drift_acknowledged_at, status_note on resume', async () => {
    const { updateCalls } = buildSupabaseMock()

    const result = await resumeAbTest('test-1')

    expect(result).toEqual({ ok: true })
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0]!.table).toBe('ab_tests')
    expect(updateCalls[0]!.data).toEqual(
      expect.objectContaining({
        status: 'active',
        paused_at: null,
        drift_acknowledged_at: null,
        status_note: null,
      }),
    )
    // updated_at should be an ISO string
    expect((updateCalls[0]!.data as Record<string, unknown>).updated_at).toEqual(expect.any(String))
  })

  it('rejects non-paused test', async () => {
    const test = makeTest({ status: 'active' })
    buildSupabaseMock({ test })

    const result = await resumeAbTest('test-1')

    expect(result).toEqual({
      ok: false,
      error: 'Only paused tests can be resumed',
    })
    expect(applyVariantToYouTube).not.toHaveBeenCalled()
  })

  it('handles applyVariantToYouTube failure', async () => {
    ;(applyVariantToYouTube as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      appliedThumbnail: false,
      appliedMetadata: false,
      meta: {},
      error: 'quota',
    })
    buildSupabaseMock()

    const result = await resumeAbTest('test-1')

    expect(result).toEqual({ ok: false, error: 'quota' })
    // Cycle should NOT be inserted on failure
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
