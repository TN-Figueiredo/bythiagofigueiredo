import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('rotation dispatch logic', () => {
  describe('updateVideoMetadata guard', () => {
    it('still calls API when only title is provided', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [{ id: 'V1', snippet: { title: 'Old', description: 'D', categoryId: '22', tags: [] } }],
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-metadata')
      await mod.updateVideoMetadata('V1', 'New Title', 'TOKEN')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      vi.unstubAllGlobals()
    })
  })
})
