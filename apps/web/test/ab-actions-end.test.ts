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

import { endAbTest } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  setThumbnail,
  fetchVariantImageBuffer,
} from '@/lib/youtube/ab-youtube'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { autoImportWinner } from '@/lib/youtube/thumbnail-library'
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

function makeVariants(overrides?: Record<string, unknown>[]) {
  return overrides ?? [
    { id: 'v-orig', label: 'A', is_original: true, blob_url: 'https://blob.example/original.jpg' },
    { id: 'v-challenger', label: 'B', is_original: false, blob_url: 'https://blob.example/challenger.jpg' },
  ]
}

interface BuildMockOpts {
  test?: unknown | null
  variants?: unknown[] | null
  video?: { youtube_video_id: string; channel_id: string } | null
  channel?: { channel_id: string } | null
  updateError?: { message: string } | null
}

function buildSupabaseMock(opts: BuildMockOpts = {}) {
  const {
    test = makeTest(),
    variants = makeVariants(),
    video = { youtube_video_id: 'YT_VIDEO_123', channel_id: 'ch-1' },
    channel = { channel_id: 'UC_CHANNEL_123' },
    updateError = null,
  } = opts

  const updateCalls: { table: string; data: unknown; filters: string[] }[] = []

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
            eq: vi.fn().mockResolvedValue({ data: null, error: updateError }),
          }
        }),
      }
    }

    if (table === 'ab_test_variants') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: variants, error: variants ? null : { message: 'not found' } }),
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
        update: vi.fn((data: unknown) => {
          updateCalls.push({ table: 'ab_test_cycles', data, filters: [] })
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
// Setup
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
  ;(autoImportWinner as ReturnType<typeof vi.fn>).mockResolvedValue({
    imported: true,
    libraryId: 'lib-1',
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('endAbTest', () => {
  it('ends test with a winner — applies winner thumbnail to YouTube', async () => {
    buildSupabaseMock()

    const result = await endAbTest('test-1', 'v-challenger')

    expect(result).toEqual({ ok: true })
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://blob.example/challenger.jpg')
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123',
    )
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
    expect(revalidateTag).toHaveBeenCalledWith('youtube')
  })

  it('ends test without winner — reverts to original', async () => {
    buildSupabaseMock()

    const result = await endAbTest('test-1')

    expect(result).toEqual({ ok: true })
    // When no winnerId, it picks the is_original variant's blob_url
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://blob.example/original.jpg')
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123',
    )
  })

  it('sets completed_at, completed_reason, winner_variant_id', async () => {
    const { updateCalls } = buildSupabaseMock()

    await endAbTest('test-1', 'v-challenger')

    const testUpdate = updateCalls.find(c => c.table === 'ab_tests')
    expect(testUpdate).toBeDefined()
    expect(testUpdate!.data).toMatchObject({
      status: 'completed',
      completed_at: expect.any(String),
      completed_reason: 'manual_winner',
      winner_variant_id: 'v-challenger',
      updated_at: expect.any(String),
    })
  })

  it('sets completed_reason to manual_archive when no winner', async () => {
    const { updateCalls } = buildSupabaseMock()

    await endAbTest('test-1')

    const testUpdate = updateCalls.find(c => c.table === 'ab_tests')
    expect(testUpdate).toBeDefined()
    expect(testUpdate!.data).toMatchObject({
      completed_reason: 'manual_archive',
      winner_variant_id: null,
    })
  })

  it('closes open cycle', async () => {
    const { updateCalls } = buildSupabaseMock()

    await endAbTest('test-1', 'v-challenger')

    const cycleUpdate = updateCalls.find(c => c.table === 'ab_test_cycles')
    expect(cycleUpdate).toBeDefined()
    expect(cycleUpdate!.data).toMatchObject({
      ended_at: expect.any(String),
    })
  })

  it('rejects non-active/paused test', async () => {
    buildSupabaseMock({ test: makeTest({ status: 'completed' }) })

    const result = await endAbTest('test-1')

    expect(result).toEqual({ ok: false, error: 'Only active or paused tests can be ended' })
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('rejects when test not found', async () => {
    buildSupabaseMock({ test: null })

    const result = await endAbTest('test-1')

    expect(result).toEqual({ ok: false, error: 'Test not found' })
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('calls autoImportWinner when a winner is selected', async () => {
    buildSupabaseMock()

    await endAbTest('test-1', 'v-challenger')

    expect(autoImportWinner).toHaveBeenCalledWith('test-1', 'site-1')
  })

  it('does not call autoImportWinner when no winner', async () => {
    buildSupabaseMock()

    await endAbTest('test-1')

    expect(autoImportWinner).not.toHaveBeenCalled()
  })
})
