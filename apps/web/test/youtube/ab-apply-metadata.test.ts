import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSetThumbnail = vi.fn().mockResolvedValue({})
const mockFetchVariantImageBuffer = vi.fn().mockResolvedValue({
  buffer: Buffer.from('img'),
  contentType: 'image/jpeg',
})

vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: (...args: unknown[]) => mockSetThumbnail(...args),
  fetchVariantImageBuffer: (...args: unknown[]) => mockFetchVariantImageBuffer(...args),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({
  updateVideoMetadata: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/youtube/ab-templates', () => ({
  resolveTemplates: vi.fn((desc: string) => desc),
}))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }),
  }),
}))

import { applyVariantToYouTube } from '@/lib/youtube/ab-apply'

describe('applyVariantToYouTube – youtube_thumbnail_url capture', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.YOUTUBE_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.YOUTUBE_API_KEY
  })

  it('captures youtube_thumbnail_url in meta after successful thumbnail apply', async () => {
    const ytThumbnailUrl = 'https://i.ytimg.com/vi/YT123/hqdefault.jpg'
    mockSetThumbnail.mockResolvedValueOnce({ highUrl: ytThumbnailUrl })

    const result = await applyVariantToYouTube({
      youtubeVideoId: 'YT123',
      accessToken: 'tok',
      testType: 'thumbnail',
      variant: { blob_url: 'https://blob/img.jpg' },
    })

    expect(result.ok).toBe(true)
    expect(result.meta.thumbnail_set).toBe(true)
    expect(result.meta.youtube_thumbnail_url).toBe(ytThumbnailUrl)
    expect(mockSetThumbnail).toHaveBeenCalledWith(
      'YT123',
      expect.any(Buffer),
      'image/jpeg',
      'tok',
    )
  })

  it('sets youtube_thumbnail_url to undefined when setThumbnail returns no highUrl', async () => {
    mockSetThumbnail.mockResolvedValueOnce({})

    const result = await applyVariantToYouTube({
      youtubeVideoId: 'YT123',
      accessToken: 'tok',
      testType: 'thumbnail',
      variant: { blob_url: 'https://blob/img.jpg' },
    })

    expect(result.ok).toBe(true)
    expect(result.meta.thumbnail_set).toBe(true)
    expect(result.meta.youtube_thumbnail_url).toBeUndefined()
  })

  it('does not set youtube_thumbnail_url for title-only tests', async () => {
    globalThis.fetch = vi.fn()

    const result = await applyVariantToYouTube({
      youtubeVideoId: 'YT123',
      accessToken: 'tok',
      testType: 'title',
      variant: { title_text: 'New Title' },
    })

    expect(result.ok).toBe(true)
    expect(result.meta.youtube_thumbnail_url).toBeUndefined()
    // Should not have called the YouTube Data API for thumbnail URL
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('youtube/v3/videos'),
    )
  })
})
