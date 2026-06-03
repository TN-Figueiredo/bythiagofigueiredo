/**
 * Drift lifecycle sequence test.
 *
 * Exercises the complete chain: applyVariantToYouTube → checkDrift → normalizeYouTubeThumbnailUrl
 * as a sequence of function calls with shared mock state, verifying data flow at each step.
 *
 * NOT a true E2E test — no real DB or YouTube API calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ---------- mocks (must precede imports) ---------- */

vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/VIDEO/hqdefault.jpg' }),
  fetchVariantImageBuffer: vi.fn().mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/jpeg' }),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: vi.fn() }))
vi.mock('@/lib/youtube/ab-templates', () => ({ resolveTemplates: vi.fn((d: string) => d) }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }),
  }),
}))
vi.mock('@sentry/nextjs', () => ({ addBreadcrumb: vi.fn() }))

/* ---------- imports (actual implementations) ---------- */

import { applyVariantToYouTube } from '@/lib/youtube/ab-apply'
import { checkDrift, normalizeYouTubeThumbnailUrl } from '@/lib/youtube/ab-drift'
import { setThumbnail } from '@/lib/youtube/ab-youtube'

/* ---------- helpers ---------- */

/** Mock the YouTube Data API response used by checkDrift's internal fetch. */
function mockYouTubeDataApi(thumbnailHighUrl: string): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        items: [{
          snippet: {
            thumbnails: { high: { url: thumbnailHighUrl } },
          },
        }],
      }),
    ),
  )
}

/* ---------- tests ---------- */

beforeEach(() => {
  vi.clearAllMocks()
  // Re-set the default return value after clearAllMocks wipes it
  vi.mocked(setThumbnail).mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/VIDEO/hqdefault.jpg' })
})

describe('drift lifecycle: apply → check → normalize', () => {
  it('apply → drift check with same URL → no drift', async () => {
    // Step 1: Apply variant, capture the URL YouTube returned
    const applyResult = await applyVariantToYouTube({
      youtubeVideoId: 'VIDEO',
      accessToken: 'tok',
      testType: 'thumbnail',
      variant: { blob_url: 'https://blob/img.jpg' },
    })

    expect(applyResult.ok).toBe(true)
    expect(applyResult.meta.youtube_thumbnail_url).toBe(
      'https://i.ytimg.com/vi/VIDEO/hqdefault.jpg',
    )

    const appliedUrl = applyResult.meta.youtube_thumbnail_url!

    // Step 2: YouTube still has the same URL — no drift expected
    mockYouTubeDataApi(appliedUrl)

    const drift = await checkDrift('test-1', 'VIDEO', appliedUrl, 'fake-key')

    expect(drift.drifted).toBe(false)
  })

  it('apply → drift check with different CDN subdomain → no drift (normalized)', async () => {
    // Step 1: Apply returns URL on canonical i.ytimg.com
    const applyResult = await applyVariantToYouTube({
      youtubeVideoId: 'VIDEO',
      accessToken: 'tok',
      testType: 'thumbnail',
      variant: { blob_url: 'https://blob/img.jpg' },
    })

    expect(applyResult.ok).toBe(true)
    const appliedUrl = applyResult.meta.youtube_thumbnail_url!
    expect(appliedUrl).toContain('i.ytimg.com')

    // Step 2: YouTube returns same path but on CDN subdomain i4.ytimg.com
    const cdnVariantUrl = appliedUrl.replace('i.ytimg.com', 'i4.ytimg.com')
    mockYouTubeDataApi(cdnVariantUrl)

    const drift = await checkDrift('test-1', 'VIDEO', appliedUrl, 'fake-key')

    expect(drift.drifted).toBe(false)
  })

  it('apply → drift check with truly different URL → drift detected', async () => {
    // Step 1: Apply returns hqdefault
    const applyResult = await applyVariantToYouTube({
      youtubeVideoId: 'VIDEO',
      accessToken: 'tok',
      testType: 'thumbnail',
      variant: { blob_url: 'https://blob/img.jpg' },
    })

    expect(applyResult.ok).toBe(true)
    const appliedUrl = applyResult.meta.youtube_thumbnail_url!
    expect(appliedUrl).toContain('hqdefault.jpg')

    // Step 2: YouTube now has maxresdefault — someone changed the thumbnail externally
    const differentUrl = appliedUrl.replace('hqdefault.jpg', 'maxresdefault.jpg')
    mockYouTubeDataApi(differentUrl)

    const drift = await checkDrift('test-1', 'VIDEO', appliedUrl, 'fake-key')

    expect(drift.drifted).toBe(true)
    expect(drift.currentUrl).toBe(differentUrl)
  })

  it('apply → drift check with same URL + different query params → no drift', async () => {
    // Step 1: Apply
    const applyResult = await applyVariantToYouTube({
      youtubeVideoId: 'VIDEO',
      accessToken: 'tok',
      testType: 'thumbnail',
      variant: { blob_url: 'https://blob/img.jpg' },
    })

    expect(applyResult.ok).toBe(true)
    const appliedUrl = applyResult.meta.youtube_thumbnail_url!

    // Step 2: YouTube returns same URL but with query params (common CDN behavior)
    const urlWithParams = appliedUrl + '?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBtest'
    mockYouTubeDataApi(urlWithParams)

    const drift = await checkDrift('test-1', 'VIDEO', appliedUrl, 'fake-key')

    expect(drift.drifted).toBe(false)
  })

  it('normalizeYouTubeThumbnailUrl is consistent across apply and check URLs', () => {
    // These represent the same thumbnail but with CDN/query variations
    // that can appear between the apply step and the check step.
    const applyUrl = 'https://i.ytimg.com/vi/VIDEO/hqdefault.jpg'
    const checkUrls = [
      'https://i4.ytimg.com/vi/VIDEO/hqdefault.jpg',
      'https://i1.ytimg.com/vi/VIDEO/hqdefault.jpg?sqp=-oaymwE',
      'https://i9.ytimg.com/vi/VIDEO/hqdefault.jpg?sqp=abc&rs=def',
      'https://i.ytimg.com/vi/VIDEO/hqdefault.jpg?v=1',
      'https://i2.ytimg.com/vi/VIDEO/hqdefault.jpg/',
    ]

    const normalizedApply = normalizeYouTubeThumbnailUrl(applyUrl)

    for (const checkUrl of checkUrls) {
      expect(normalizeYouTubeThumbnailUrl(checkUrl)).toBe(normalizedApply)
    }
  })
})
