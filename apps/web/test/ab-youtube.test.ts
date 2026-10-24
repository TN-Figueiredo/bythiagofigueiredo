import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('A/B YouTube API helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('setThumbnail', () => {
    it('calls YouTube API with correct endpoint and headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [{ high: { url: 'https://i.ytimg.com/vi/VIDEO123/hqdefault.jpg' } }] }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-youtube')
      await mod.setThumbnail('VIDEO123', Buffer.from('img'), 'image/jpeg', 'TOKEN')

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('thumbnails/set')
      expect(calledUrl).toContain('videoId=VIDEO123')
      expect(calledUrl).toContain('uploadType=media')

      const opts = mockFetch.mock.calls[0][1]
      expect(opts.method).toBe('POST')
      expect(opts.headers['Content-Type']).toBe('image/jpeg')
      expect(opts.headers.Authorization).toBe('Bearer TOKEN')

      vi.unstubAllGlobals()
    })

    it('throws on API failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'bad request' }),
      }))

      const mod = await import('@/lib/youtube/ab-youtube')
      await expect(mod.setThumbnail('V1', Buffer.from('x'), 'image/png', 'T'))
        .rejects.toMatchObject({ status: 400, reason: 'desconhecido', chamada: 'thumbnails.set' })

      vi.unstubAllGlobals()
    })
  })

  describe('fetchVariantImageBuffer', () => {
    it('returns buffer and detects JPEG content type', async () => {
      const imgBytes = new Uint8Array([0xff, 0xd8, 0xff])
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: () => Promise.resolve(imgBytes.buffer),
      }))

      const mod = await import('@/lib/youtube/ab-youtube')
      const result = await mod.fetchVariantImageBuffer('https://abc.public.blob.vercel-storage.com/test.jpg')

      expect(result.contentType).toBe('image/jpeg')
      expect(result.buffer).toBeInstanceOf(Buffer)

      vi.unstubAllGlobals()
    })

    it('defaults to PNG for non-JPEG', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      }))

      const mod = await import('@/lib/youtube/ab-youtube')
      const result = await mod.fetchVariantImageBuffer('https://abc.public.blob.vercel-storage.com/test.png')
      expect(result.contentType).toBe('image/png')

      vi.unstubAllGlobals()
    })

    it('throws on fetch failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }))

      const mod = await import('@/lib/youtube/ab-youtube')
      await expect(mod.fetchVariantImageBuffer('https://abc.public.blob.vercel-storage.com/missing.jpg'))
        .rejects.toMatchObject({ status: 404, reason: 'blob_404', chamada: 'blob' })

      vi.unstubAllGlobals()
    })
  })

  describe('getCurrentThumbnailUrl', () => {
    it('returns high thumbnail URL on success', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          items: [{ snippet: { thumbnails: { high: { url: 'https://i.ytimg.com/vi/V1/hqdefault.jpg' } } } }],
        }),
      }))

      const mod = await import('@/lib/youtube/ab-youtube')
      const result = await mod.getCurrentThumbnailUrl('V1', 'TOKEN')
      expect(result).toBe('https://i.ytimg.com/vi/V1/hqdefault.jpg')

      vi.unstubAllGlobals()
    })

    it('returns null on API failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      }))

      const mod = await import('@/lib/youtube/ab-youtube')
      const result = await mod.getCurrentThumbnailUrl('V1', 'TOKEN')
      expect(result).toBeNull()

      vi.unstubAllGlobals()
    })

    it('returns null when no items in response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      }))

      const mod = await import('@/lib/youtube/ab-youtube')
      const result = await mod.getCurrentThumbnailUrl('V1', 'TOKEN')
      expect(result).toBeNull()

      vi.unstubAllGlobals()
    })

    it('returns null when no high thumbnail', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          items: [{ snippet: { thumbnails: { default: { url: 'https://i.ytimg.com/vi/V1/default.jpg' } } } }],
        }),
      }))

      const mod = await import('@/lib/youtube/ab-youtube')
      const result = await mod.getCurrentThumbnailUrl('V1', 'TOKEN')
      expect(result).toBeNull()

      vi.unstubAllGlobals()
    })
  })
})
