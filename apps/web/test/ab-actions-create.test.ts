import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock modules before imports
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({
  updateVideoMetadata: vi.fn(),
  captureOriginalMetadata: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-templates', () => ({ resolveTemplates: vi.fn(), parseTemplateTokens: vi.fn() }))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getNextVariantIndex: vi.fn(), getVariantForCycle: vi.fn() }))
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
  AB_TEST_CONFIG_DEFAULTS: { duration_days: 14, confidence_threshold: 0.95, auto_apply_winner: false, rotation_pattern: 'abba' },
  VARIANT_LABELS: ['A', 'B', 'C', 'D'],
  DRIFT_STATUS_NOTE: 'Thumbnail alterado externamente',
}))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ getChannelTier: vi.fn() }))
vi.mock('@/lib/youtube/prompt-scoring', () => ({ scoreForPrompt: vi.fn() }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))
vi.mock('@/lib/youtube/ab-apply', () => ({ applyVariantToYouTube: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/queries', () => ({
  getVideoTestHistory: vi.fn(),
  getLearnings: vi.fn(),
}))

import { createAbTest } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { put } from '@vercel/blob'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import type { AbTestCreateInput } from '@/lib/youtube/ab-types'

const BLOB_URL = 'https://xxx.blob.vercel-storage.com/ab-originals/uuid/original.jpg'

function makeInput(overrides: Partial<AbTestCreateInput> = {}): AbTestCreateInput {
  return {
    site_id: 'site-1',
    youtube_video_id: 'video-1',
    name: 'Test AB',
    config: {},
    ...overrides,
  } as AbTestCreateInput
}

interface BuildMockOpts {
  video?: { id: string; duration_seconds: number; thumbnail_hq_url: string | null } | null
  existingTest?: { id: string } | null
  insertTestResult?: { data: { id: string } | null; error: { message: string } | null }
  insertVariantResult?: { data: null; error: { message: string } | null }
}

function buildSupabaseMock(opts: BuildMockOpts = {}) {
  const {
    video = { id: 'video-1', duration_seconds: 600, thumbnail_hq_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' },
    existingTest = null,
    insertTestResult = { data: { id: 'new-test-id' }, error: null },
    insertVariantResult = { data: null, error: null },
  } = opts

  const insertCalls: { table: string; data: unknown }[] = []
  const deleteCalls: { table: string; id: string }[] = []

  const fromMock = vi.fn((table: string) => {
    if (table === 'youtube_videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: video,
                error: video ? null : { message: 'not found' },
              }),
            }),
          }),
        }),
      }
    }

    if (table === 'ab_tests') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: existingTest,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
        insert: vi.fn((data: unknown) => {
          insertCalls.push({ table: 'ab_tests', data })
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(insertTestResult),
            }),
          }
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn((col: string, val: string) => {
            deleteCalls.push({ table: 'ab_tests', id: val })
            return Promise.resolve({ data: null, error: null })
          }),
        }),
      }
    }

    if (table === 'ab_test_variants') {
      return {
        insert: vi.fn((data: unknown) => {
          insertCalls.push({ table: 'ab_test_variants', data })
          return Promise.resolve(insertVariantResult)
        }),
      }
    }

    if (table === 'youtube_fatigue_alerts') {
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
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

  return { client, fromMock, insertCalls, deleteCalls }
}

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()

  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(Buffer.from('fake-image-bytes'), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }),
  )
  ;(put as ReturnType<typeof vi.fn>).mockResolvedValue({ url: BLOB_URL })
})

afterEach(() => {
  fetchSpy.mockRestore()
})

describe('createAbTest', () => {
  it('creates test with Blob URL for original thumbnail (not YouTube CDN URL)', async () => {
    const { insertCalls } = buildSupabaseMock({
      video: {
        id: 'video-1',
        duration_seconds: 600,
        thumbnail_hq_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
      },
    })

    const result = await createAbTest(makeInput())

    expect(result).toEqual({ ok: true, id: 'new-test-id' })

    // preserveOriginalThumbnail should have fetched the YouTube CDN URL
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://i.ytimg.com/vi/abc/hqdefault.jpg',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )

    // Should have uploaded to Vercel Blob
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^ab-originals\/.+\/original\.jpg$/),
      expect.any(Buffer),
      { access: 'public', contentType: 'image/jpeg', addRandomSuffix: true },
    )

    // ab_tests insert should have the blob URL, not the YouTube CDN URL
    const testInsert = insertCalls.find(c => c.table === 'ab_tests')
    expect(testInsert).toBeDefined()
    expect((testInsert!.data as Record<string, unknown>).original_thumbnail_url).toBe(BLOB_URL)

    // Revalidation
    expect(revalidateTag).toHaveBeenCalledWith('youtube')
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
  })

  it('preserves original when URL is ggpht.com', async () => {
    buildSupabaseMock({
      video: {
        id: 'video-1',
        duration_seconds: 600,
        thumbnail_hq_url: 'https://yt3.ggpht.com/thumb',
      },
    })

    const result = await createAbTest(makeInput())

    expect(result).toEqual({ ok: true, id: 'new-test-id' })
    // Should have fetched the ggpht URL
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://yt3.ggpht.com/thumb',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    // Should have uploaded to blob
    expect(put).toHaveBeenCalled()
  })

  it('rejects Shorts (≤60s)', async () => {
    buildSupabaseMock({
      video: {
        id: 'video-1',
        duration_seconds: 30,
        thumbnail_hq_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
      },
    })

    const result = await createAbTest(makeInput())

    expect(result).toEqual({ ok: false, error: 'Shorts (≤ 60s) are not eligible for A/B tests' })
    // Should NOT have attempted to preserve thumbnail or insert
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('rejects when existing active/draft/paused test for same video', async () => {
    buildSupabaseMock({
      existingTest: { id: 'existing-test-id' },
    })

    const result = await createAbTest(makeInput())

    expect(result).toEqual({
      ok: false,
      error: 'An active, paused or draft test already exists for this video',
    })
  })

  it('creates original variant with blob_url matching test original_thumbnail_url', async () => {
    const { insertCalls } = buildSupabaseMock()

    const result = await createAbTest(makeInput())

    expect(result).toEqual({ ok: true, id: 'new-test-id' })

    const variantInsert = insertCalls.find(c => c.table === 'ab_test_variants')
    expect(variantInsert).toBeDefined()

    const variantData = variantInsert!.data as Record<string, unknown>
    expect(variantData).toMatchObject({
      test_id: 'new-test-id',
      label: 'original',
      is_original: true,
      blob_url: BLOB_URL,
      blob_key: null,
      sort_order: 0,
    })
  })

  it('returns error when video not found', async () => {
    buildSupabaseMock({ video: null })

    const result = await createAbTest(makeInput())

    expect(result).toEqual({ ok: false, error: 'Video not found' })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('returns error when preserveOriginalThumbnail fails', async () => {
    buildSupabaseMock({
      video: {
        id: 'video-1',
        duration_seconds: 600,
        thumbnail_hq_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
      },
    })

    fetchSpy.mockRejectedValueOnce(new Error('Network error'))

    const result = await createAbTest(makeInput())

    expect(result).toEqual({
      ok: false,
      error: 'Falha ao salvar thumbnail original. Tente novamente.',
    })
  })
})
