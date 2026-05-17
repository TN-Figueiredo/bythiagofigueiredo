import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('A/B YouTube API helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchAnalyticsForDateRange', () => {
    it('builds correct query parameters', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rows: [['2026-05-10', 1000, 0.05]] }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-youtube')
      await mod.fetchAnalyticsForDateRange('VIDEO123', '2026-05-10', '2026-05-12', 'TOKEN')

      const calledUrl = new URL(mockFetch.mock.calls[0][0] as string)
      expect(calledUrl.searchParams.get('ids')).toBe('channel==MINE')
      expect(calledUrl.searchParams.get('metrics')).toBe('impressions,impressionClickThroughRate')
      expect(calledUrl.searchParams.get('dimensions')).toBe('day')
      expect(calledUrl.searchParams.get('filters')).toBe('video==VIDEO123')
      expect(calledUrl.searchParams.get('startDate')).toBe('2026-05-10')
      expect(calledUrl.searchParams.get('endDate')).toBe('2026-05-12')

      vi.unstubAllGlobals()
    })

    it('returns empty array when API returns no rows', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rows: null }),
      }))

      const mod = await import('@/lib/youtube/ab-youtube')
      const result = await mod.fetchAnalyticsForDateRange('V1', '2026-01-01', '2026-01-02', 'T')
      expect(result).toEqual([])

      vi.unstubAllGlobals()
    })

    it('throws on API error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: { message: 'forbidden' } }),
      }))

      const mod = await import('@/lib/youtube/ab-youtube')
      await expect(mod.fetchAnalyticsForDateRange('V1', '2026-01-01', '2026-01-02', 'T'))
        .rejects.toThrow('Analytics query failed: 403')

      vi.unstubAllGlobals()
    })

    it('maps row data correctly (CTR as ratio)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          rows: [
            ['2026-05-10', 500, 0.08],
            ['2026-05-11', 600, 0.06],
          ],
        }),
      }))

      const mod = await import('@/lib/youtube/ab-youtube')
      const result = await mod.fetchAnalyticsForDateRange('V1', '2026-05-10', '2026-05-11', 'T')

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ day: '2026-05-10', impressions: 500, ctr: 0.08 })
      expect(result[1]).toEqual({ day: '2026-05-11', impressions: 600, ctr: 0.06 })

      vi.unstubAllGlobals()
    })
  })

  describe('setThumbnail', () => {
    it('calls YouTube API with correct endpoint and headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
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
        .rejects.toThrow('thumbnails.set failed: 400')

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
      const result = await mod.fetchVariantImageBuffer('https://blob.vercel-storage.com/test.jpg')

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
      const result = await mod.fetchVariantImageBuffer('https://blob.vercel-storage.com/test.png')
      expect(result.contentType).toBe('image/png')

      vi.unstubAllGlobals()
    })

    it('throws on fetch failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }))

      const mod = await import('@/lib/youtube/ab-youtube')
      await expect(mod.fetchVariantImageBuffer('https://blob.vercel-storage.com/missing.jpg'))
        .rejects.toThrow('Failed to fetch variant image: 404')

      vi.unstubAllGlobals()
    })
  })
})
