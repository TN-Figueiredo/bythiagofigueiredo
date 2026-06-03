import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }),
  fetchVariantImageBuffer: vi.fn().mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/jpeg' }),
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
import { setThumbnail } from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'

describe('applyVariantToYouTube', () => {
  it('applies thumbnail only for thumbnail test', async () => {
    const result = await applyVariantToYouTube({
      youtubeVideoId: 'YT123', accessToken: 'tok',
      testType: 'thumbnail', variant: { blob_url: 'https://blob/img.jpg' },
    })
    expect(result.ok).toBe(true)
    expect(setThumbnail).toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('applies metadata only for title test', async () => {
    const result = await applyVariantToYouTube({
      youtubeVideoId: 'YT123', accessToken: 'tok',
      testType: 'title', variant: { title_text: 'New Title' },
    })
    expect(result.ok).toBe(true)
    expect(updateVideoMetadata).toHaveBeenCalled()
  })

  it('applies both for combo test', async () => {
    const result = await applyVariantToYouTube({
      youtubeVideoId: 'YT123', accessToken: 'tok',
      testType: 'combo', variant: { blob_url: 'https://b/i.jpg', title_text: 'T', description_text: 'D' },
    })
    expect(result.ok).toBe(true)
  })

  it('returns error on YouTube failure', async () => {
    ;(setThumbnail as any).mockRejectedValueOnce(new Error('quota exceeded'))
    const result = await applyVariantToYouTube({
      youtubeVideoId: 'YT123', accessToken: 'tok',
      testType: 'thumbnail', variant: { blob_url: 'https://b/i.jpg' },
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('quota exceeded')
  })

  it('captures youtube_thumbnail_url from setThumbnail response', async () => {
    const result = await applyVariantToYouTube({
      youtubeVideoId: 'YT123', accessToken: 'tok',
      testType: 'thumbnail', variant: { blob_url: 'https://blob/img.jpg' },
    })
    expect(result.ok).toBe(true)
    expect(result.meta.youtube_thumbnail_url).toBe('https://i.ytimg.com/vi/test/hqdefault.jpg')
  })

  it('does not set youtube_thumbnail_url when highUrl is undefined', async () => {
    ;(setThumbnail as any).mockResolvedValueOnce({ highUrl: undefined })
    const result = await applyVariantToYouTube({
      youtubeVideoId: 'YT123', accessToken: 'tok',
      testType: 'thumbnail', variant: { blob_url: 'https://blob/img.jpg' },
    })
    expect(result.ok).toBe(true)
    expect(result.meta.youtube_thumbnail_url).toBeUndefined()
  })

  it('skips thumbnail when blob_url is null', async () => {
    const result = await applyVariantToYouTube({
      youtubeVideoId: 'YT123', accessToken: 'tok',
      testType: 'thumbnail', variant: { blob_url: null },
    })
    expect(result.ok).toBe(true)
  })
})
