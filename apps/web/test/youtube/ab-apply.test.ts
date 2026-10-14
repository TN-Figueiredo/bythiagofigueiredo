import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }),
  fetchVariantImageBuffer: vi.fn().mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/jpeg' }),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({
  updateVideoMetadata: vi.fn().mockResolvedValue(undefined),
}))

import { applyVariantToYouTube } from '@/lib/youtube/ab-apply'
import { setThumbnail } from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import type { TestType } from '@/lib/youtube/ab-types'

beforeEach(() => { vi.clearAllMocks() })

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
      testType: 'combo', variant: { blob_url: 'https://b/i.jpg', title_text: 'T' },
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

  it.each(['title', 'combo', 'thumbnail', 'description'] as const)(
    'tipo %s: nunca chama updateVideoMetadata com descrição',
    async (testType) => {
      await applyVariantToYouTube({
        youtubeVideoId: 'YT1', accessToken: 'tok', testType: testType as TestType,
        // variante antiga com descrição gravada no banco: o campo chega por cast, e é ignorado
        variant: { id: 'v1', blob_url: null, title_text: 'Novo', ...({ description_text: 'DESC NOVA' } as object) },
        originalTitle: 'Antigo',
      })
      for (const call of vi.mocked(updateVideoMetadata).mock.calls) {
        expect(call).toHaveLength(3)
        expect(call.join('|')).not.toContain('DESC NOVA')
      }
    },
  )

  it('tipo description não escreve nada no YouTube', async () => {
    const r = await applyVariantToYouTube({ youtubeVideoId: 'YT1', accessToken: 'tok', testType: 'description' as TestType, variant: { id: 'v1', title_text: null } })
    expect(updateVideoMetadata).not.toHaveBeenCalled()
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(r).toMatchObject({ ok: true, appliedThumbnail: false, appliedMetadata: false })
  })
})
