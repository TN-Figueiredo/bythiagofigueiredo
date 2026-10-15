import { describe, it, expect, vi, beforeEach } from 'vitest'
import { escreverTitulo, lerSnippet } from '@/lib/youtube/ab-metadata'

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
      await expect(mod.updateVideoMetadata('V1', 'Novo', 'TOKEN')).rejects.toMatchObject({ reason: 'snippet_sem_descricao' })
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
        .rejects.toMatchObject({ status: 403, reason: 'desconhecido', chamada: 'videos.list' })

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
        .rejects.toMatchObject({ status: 400, reason: 'desconhecido', chamada: 'videos.update' })

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
  describe('escreverTitulo e lerSnippet (P4a)', () => {
    interface YtFalsoOpcoes { snippet: Record<string, unknown>; putStatus?: number; putReason?: string }
    function ytFalso(o: YtFalsoOpcoes) {
      const corpos: Array<{ snippet: Record<string, unknown> }> = []
      const f = (async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          corpos.push(JSON.parse(String(init.body)))
          if (o.putStatus && o.putStatus >= 400) {
            return new Response(JSON.stringify({ error: { errors: [{ reason: o.putReason ?? 'x', message: 'segredo' }] } }), { status: o.putStatus })
          }
          return new Response('{}')
        }
        return new Response(JSON.stringify({ items: [{ snippet: o.snippet }] }))
      }) as typeof fetch
      return { f, corpoDoPut: () => corpos[0], puts: () => corpos.length }
    }

    it('escreverTitulo relê o snippet e reenvia descrição, categoria, tags e os dois idiomas lidos', async () => {
      const chamadas: Array<{ url: string; init?: RequestInit }> = []
      const f = (async (url: string, init?: RequestInit) => {
        chamadas.push({ url, init })
        if (!init?.method) return new Response(JSON.stringify({ items: [{ snippet: { title: 'Velho', description: 'Desc\ncom link https://x', categoryId: '19', tags: ['a'], defaultLanguage: 'pt-BR', defaultAudioLanguage: 'pt' } }] }))
        return new Response('{}')
      }) as typeof fetch
      await escreverTitulo('vid', 'Novo', 'tok', f)
      const corpo = JSON.parse(String(chamadas[1].init!.body))
      expect(corpo.snippet).toEqual({ title: 'Novo', description: 'Desc\ncom link https://x', categoryId: '19', tags: ['a'], defaultLanguage: 'pt-BR', defaultAudioLanguage: 'pt' })
    })

    it('snippet sem description aborta antes do PUT (Review Focus 2)', async () => {
      const { f, puts } = ytFalso({ snippet: { title: 'V', categoryId: '19' } })
      await expect(escreverTitulo('vid', 'Novo', 'tok', f)).rejects.toMatchObject({ reason: 'snippet_sem_descricao' })
      expect(puts()).toBe(0)
    })

    it('sem idioma lido: o PUT não inventa idioma', async () => {
      const { f, corpoDoPut } = ytFalso({ snippet: { title: 'V', description: 'D', categoryId: '19' } })
      await escreverTitulo('vid', 'Novo', 'tok', f)
      expect('defaultLanguage' in corpoDoPut().snippet).toBe(false)
      expect('defaultAudioLanguage' in corpoDoPut().snippet).toBe(false)
    })

    it('F-D9: snippet sem tags → o PUT vai sem a chave tags (não [])', async () => {
      const { f, corpoDoPut } = ytFalso({ snippet: { title: 'V', description: 'D', categoryId: '19' } })
      await escreverTitulo('vid', 'Novo', 'tok', f)
      expect('tags' in corpoDoPut().snippet).toBe(false)
    })

    it('F-D9: description "" é valor, não ausência → o PUT sai com description ""', async () => {
      const { f, corpoDoPut, puts } = ytFalso({ snippet: { title: 'V', description: '', categoryId: '19' } })
      await escreverTitulo('vid', 'Novo', 'tok', f)
      expect(puts()).toBe(1)
      expect(corpoDoPut().snippet.description).toBe('')
    })

    it('F-D9: categoryId ausente aborta antes do PUT (snippet_sem_categoria)', async () => {
      const { f, puts } = ytFalso({ snippet: { title: 'V', description: 'D' } })
      await expect(escreverTitulo('vid', 'Novo', 'tok', f)).rejects.toMatchObject({ reason: 'snippet_sem_categoria' })
      expect(puts()).toBe(0)
    })

    it('videos.list sem o vídeo → lerSnippet devolve null', async () => {
      const f = (async () => new Response(JSON.stringify({ items: [] }))) as typeof fetch
      expect(await lerSnippet('vid', 'tok', f)).toBeNull()
    })

    it('videos.list sem o vídeo → escreverTitulo lança video_inexistente (404, videos.list)', async () => {
      const f = (async () => new Response(JSON.stringify({ items: [] }))) as typeof fetch
      await expect(escreverTitulo('vid', 'Novo', 'tok', f)).rejects.toMatchObject({ status: 404, reason: 'video_inexistente', chamada: 'videos.list' })
    })

    it('PUT 403 lança YouTubeApiError com reason e chamada', async () => {
      const { f } = ytFalso({ snippet: { title: 'V', description: 'D', categoryId: '19' }, putStatus: 403, putReason: 'forbidden' })
      await expect(escreverTitulo('vid', 'Novo', 'tok', f)).rejects.toMatchObject({ status: 403, reason: 'forbidden', chamada: 'videos.update' })
    })

    it.each(['', '   ', '\n\t'])('título vazio (%j) lança titulo_vazio sem chamar o YouTube (P4a-I20)', async (titulo) => {
      const f = vi.fn() as unknown as typeof fetch
      await expect(escreverTitulo('vid', titulo, 'tok', f)).rejects.toMatchObject({ status: 0, reason: 'titulo_vazio', chamada: 'videos.update' })
      expect(f).not.toHaveBeenCalled()
    })

    it('erro de rede no PUT vira YouTubeApiError(0, rede, videos.update)', async () => {
      const f = (async (_u: string, init?: RequestInit) => {
        if (init?.method === 'PUT') throw new TypeError('fetch failed')
        return new Response(JSON.stringify({ items: [{ snippet: { title: 'V', description: 'D', categoryId: '19' } }] }))
      }) as typeof fetch
      await expect(escreverTitulo('vid', 'Novo', 'tok', f)).rejects.toMatchObject({ status: 0, reason: 'rede', chamada: 'videos.update' })
    })
  })
})
