import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('YouTube metadata helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('updateVideoMetadata', () => {
    it('fetches current snippet then updates with new title', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [{
              id: 'V1',
              snippet: { title: 'Old Title', description: 'Desc', categoryId: '22', tags: ['a'] },
            }],
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-metadata')
      await mod.updateVideoMetadata('V1', 'New Title', null, 'TOKEN')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      const updateBody = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(updateBody.snippet.title).toBe('New Title')
      expect(updateBody.snippet.description).toBe('Desc')
      expect(updateBody.snippet.categoryId).toBe('22')

      vi.unstubAllGlobals()
    })

    it('updates description while preserving title', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [{
              id: 'V1',
              snippet: { title: 'Title', description: 'Old', categoryId: '22', tags: [] },
            }],
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-metadata')
      await mod.updateVideoMetadata('V1', null, 'New Desc', 'TOKEN')

      const updateBody = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(updateBody.snippet.title).toBe('Title')
      expect(updateBody.snippet.description).toBe('New Desc')

      vi.unstubAllGlobals()
    })

    it('updates both title and description atomically', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [{
              id: 'V1',
              snippet: { title: 'Old', description: 'Old', categoryId: '22', tags: [] },
            }],
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-metadata')
      await mod.updateVideoMetadata('V1', 'New Title', 'New Desc', 'TOKEN')

      const updateBody = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(updateBody.snippet.title).toBe('New Title')
      expect(updateBody.snippet.description).toBe('New Desc')

      vi.unstubAllGlobals()
    })

    it('throws when snippet fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: { message: 'forbidden' } }),
      }))

      const mod = await import('@/lib/youtube/ab-metadata')
      await expect(mod.updateVideoMetadata('V1', 'T', null, 'TOKEN'))
        .rejects.toThrow('videos.list failed: 403')

      vi.unstubAllGlobals()
    })

    it('throws when videos.update fails', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [{ id: 'V1', snippet: { title: 'T', description: 'D', categoryId: '22', tags: [] } }],
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: { message: 'bad' } }),
        })
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-metadata')
      await expect(mod.updateVideoMetadata('V1', 'New', null, 'TOKEN'))
        .rejects.toThrow('videos.update failed: 400')

      vi.unstubAllGlobals()
    })
  })

  describe('captureOriginalMetadata', () => {
    it('returns title and description from YouTube', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          items: [{
            id: 'V1',
            snippet: { title: 'My Video', description: 'Hello World', categoryId: '22', tags: [] },
          }],
        }),
      }))

      const mod = await import('@/lib/youtube/ab-metadata')
      const result = await mod.captureOriginalMetadata('V1', 'TOKEN')
      expect(result).toEqual({ title: 'My Video', description: 'Hello World' })

      vi.unstubAllGlobals()
    })

    it('returns null when video not found', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      }))

      const mod = await import('@/lib/youtube/ab-metadata')
      const result = await mod.captureOriginalMetadata('MISSING', 'TOKEN')
      expect(result).toBeNull()

      vi.unstubAllGlobals()
    })
  })
})
