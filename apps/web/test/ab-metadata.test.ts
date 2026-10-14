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
      await mod.updateVideoMetadata('V1', 'New Title', 'TOKEN')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      const updateBody = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(updateBody.snippet.title).toBe('New Title')
      expect(updateBody.snippet.description).toBe('Desc')
      expect(updateBody.snippet.categoryId).toBe('22')

      vi.unstubAllGlobals()
    })

    const listOk = (snippet: Record<string, unknown>) => ({
      ok: true,
      json: () => Promise.resolve({ items: [{ id: 'V1', snippet }] }),
    })

    it('reenvia a descrição lida, nunca outra', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(listOk({ title: 'T0', description: 'DESC NO AR', categoryId: '22', tags: ['a'] }))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      vi.stubGlobal('fetch', mockFetch)
      const mod = await import('@/lib/youtube/ab-metadata')
      await mod.updateVideoMetadata('V1', 'Novo', 'TOKEN')
      const body = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(body.snippet).toEqual({ title: 'Novo', description: 'DESC NO AR', categoryId: '22', tags: ['a'] })
      vi.unstubAllGlobals()
    })

    // L6 (Gio): a descrição lida volta byte a byte, qualquer que seja o conteúdo
    it.each([
      ['emoji', 'Viagem 🌍✈️ com acento: ação'],
      ['CRLF', 'linha 1\r\nlinha 2\r\n'],
      ['sinais', 'a < b > c & "d"'],
      ['5000 caracteres', 'x'.repeat(5000)],
    ])('descrição lida (%s) volta igual no PUT', async (_nome, lida) => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(listOk({ title: 'T0', description: lida, categoryId: '22', tags: [] }))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      vi.stubGlobal('fetch', mockFetch)
      const mod = await import('@/lib/youtube/ab-metadata')
      await mod.updateVideoMetadata('YT1', 'Novo', 'tok')
      const body = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(body.snippet.description).toBe(lida)
      vi.unstubAllGlobals()
    })

    it('videos.list sem snippet.description: lança e não envia PUT', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(listOk({ title: 'T0', categoryId: '22' }))
      vi.stubGlobal('fetch', mockFetch)
      const mod = await import('@/lib/youtube/ab-metadata')
      await expect(mod.updateVideoMetadata('V1', 'Novo', 'TOKEN')).rejects.toThrow(/sem snippet\.description/)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      vi.unstubAllGlobals()
    })

    it('description "" lida é reenviada como ""', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(listOk({ title: 'T0', description: '', categoryId: '22', tags: [] }))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      vi.stubGlobal('fetch', mockFetch)
      const mod = await import('@/lib/youtube/ab-metadata')
      await mod.updateVideoMetadata('V1', 'Novo', 'TOKEN')
      expect(JSON.parse(mockFetch.mock.calls[1][1].body).snippet.description).toBe('')
      vi.unstubAllGlobals()
    })

    it('throws when snippet fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: { message: 'forbidden' } }),
      }))

      const mod = await import('@/lib/youtube/ab-metadata')
      await expect(mod.updateVideoMetadata('V1', 'T', 'TOKEN'))
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
      await expect(mod.updateVideoMetadata('V1', 'New', 'TOKEN'))
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
