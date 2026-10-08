// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { DataApiError, LOTE_VIDEOS, videosList } from '@/lib/youtube/coleta/videos-list'

const item = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  snippet: { title: `Título ${id}`, description: `Descrição ${id}`, tags: ['a', 'b'] },
  contentDetails: { duration: 'PT10M' },
  status: { privacyStatus: 'public' },
  ...extra,
})
const ok = (items: unknown[]) => new Response(JSON.stringify({ items }), { status: 200 })

describe('videosList', () => {
  it('uma chamada autenticada com o token do canal, sem chave de API, com as três partes', async () => {
    const f = vi.fn().mockResolvedValue(ok([item('aaaaaaaaaaa')]))
    const m = await videosList('tok-do-canal', ['aaaaaaaaaaa'], f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0]!
    const u = new URL(String(url))
    expect(u.origin + u.pathname).toBe('https://www.googleapis.com/youtube/v3/videos')
    expect(u.searchParams.get('part')).toBe('snippet,contentDetails,status')
    expect(u.searchParams.get('id')).toBe('aaaaaaaaaaa')
    expect(u.searchParams.has('key')).toBe(false)
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer tok-do-canal' })
    expect(m.get('aaaaaaaaaaa')).toEqual({
      id: 'aaaaaaaaaaa', title: 'Título aaaaaaaaaaa', description: 'Descrição aaaaaaaaaaa', tags: ['a', 'b'],
      durationSeconds: 600, privacyStatus: 'public',
    })
  })

  it('120 ids → 3 chamadas de no máximo 50', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `v${String(i).padStart(10, '0')}`)
    const f = vi.fn(async (url: string) => {
      const pedidos = new URL(url).searchParams.get('id')!.split(',')
      return ok(pedidos.map(id => item(id)))
    })
    const m = await videosList('t', ids, f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledTimes(3)
    expect(f.mock.calls.map(c => new URL(String(c[0])).searchParams.get('id')!.split(',').length)).toEqual([LOTE_VIDEOS, LOTE_VIDEOS, 20])
    expect(m.size).toBe(120)
  })

  it('id ausente da resposta (privado para o token, ou apagado) fica fora do mapa', async () => {
    const f = vi.fn().mockResolvedValue(ok([item('aaaaaaaaaaa')]))
    const m = await videosList('t', ['aaaaaaaaaaa', 'bbbbbbbbbbb'], f as unknown as typeof fetch)
    expect([...m.keys()]).toEqual(['aaaaaaaaaaa'])
  })

  it('campo que não veio é nulo, nunca inventado; sem tags vira lista vazia (o YouTube omite a chave quando não há)', async () => {
    const f = vi.fn().mockResolvedValue(ok([{ id: 'aaaaaaaaaaa', snippet: {}, contentDetails: {}, status: {} }, { id: 'bbbbbbbbbbb' }]))
    const m = await videosList('t', ['aaaaaaaaaaa', 'bbbbbbbbbbb'], f as unknown as typeof fetch)
    expect(m.get('aaaaaaaaaaa')).toEqual({ id: 'aaaaaaaaaaa', title: null, description: null, tags: [], durationSeconds: null, privacyStatus: null })
    expect(m.get('bbbbbbbbbbb')).toEqual({ id: 'bbbbbbbbbbb', title: null, description: null, tags: [], durationSeconds: null, privacyStatus: null })
  })

  it('resposta não-ok lança DataApiError só com status e reason; a mensagem não leva o corpo', async () => {
    const corpo = { error: { message: 'segredo no corpo', errors: [{ reason: 'insufficientPermissions' }] } }
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status: 403 }))
    const e = await videosList('t', ['aaaaaaaaaaa'], f as unknown as typeof fetch).catch(x => x)
    expect(e).toBeInstanceOf(DataApiError)
    expect(e).toMatchObject({ status: 403, reason: 'insufficientPermissions' })
    expect(String(e.message)).not.toContain('segredo')
  })

  it('lista vazia não chama a rede', async () => {
    const f = vi.fn()
    expect((await videosList('t', [], f as unknown as typeof fetch)).size).toBe(0)
    expect(f).not.toHaveBeenCalled()
  })

  it('erro do fetch (prazo, rede) sobe como veio', async () => {
    const f = vi.fn().mockRejectedValue(new Error('rede'))
    await expect(videosList('t', ['aaaaaaaaaaa'], f as unknown as typeof fetch)).rejects.toThrow('rede')
  })
})
