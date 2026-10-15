import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'

vi.mock('@vercel/blob', () => ({ put: vi.fn() }))

import { put } from '@vercel/blob'
import { dhashOf, hqdefaultLike } from '@/lib/youtube/thumb-fingerprint'
import { dhashDoArquivo, dhashDasVariantes, guardarOriginalMaior } from '@/lib/youtube/ab-variant-dhash'

const URL_BLOB = 'https://x.public.blob.vercel-storage.com/a.png'

describe('dhashDoArquivo', () => {
  it('arquivo 1280x720 vira dHash da hqdefaultLike (com faixas)', async () => {
    const png = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#c33' } }).png().toBuffer()
    const f = (async () => new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } })) as typeof fetch
    const r = await dhashDoArquivo(URL_BLOB, f)
    expect(r).toEqual({ tipo: 'ok', dhash: await dhashOf(await hqdefaultLike(png)) })
  })
  it('Blob 404 -> sem_base blob_404 (linha 4)', async () => {
    const f = (async () => new Response('', { status: 404 })) as typeof fetch
    expect(await dhashDoArquivo(URL_BLOB, f)).toEqual({ tipo: 'sem_base', motivo: 'blob_404' })
  })
  it('Blob 503 ou rede -> falha (linha 5)', async () => {
    const f503 = (async () => new Response('', { status: 503 })) as typeof fetch
    const fRede = (async () => { throw new TypeError('fetch failed') }) as typeof fetch
    expect((await dhashDoArquivo(URL_BLOB, f503)).tipo).toBe('falha')
    expect((await dhashDoArquivo(URL_BLOB, fRede)).tipo).toBe('falha')
  })
  it('corpo do Blob cortado (arrayBuffer rejeita) -> falha tentável, não sem_base (Phil T4 PODE3)', async () => {
    const f = (async () => ({
      ok: true, status: 200,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: async () => { throw new TypeError('terminated') },
    })) as unknown as typeof fetch
    const r = await dhashDoArquivo(URL_BLOB, f)
    expect(r.tipo).toBe('falha')
    if (r.tipo === 'falha') expect(r.erro.chamada).toBe('blob')
  })
  it('bytes que o sharp não lê -> sem_base ilegivel', async () => {
    const f = (async () => new Response('não é imagem', { headers: { 'content-type': 'image/png' } })) as typeof fetch
    expect(await dhashDoArquivo(URL_BLOB, f)).toEqual({ tipo: 'sem_base', motivo: 'ilegivel' })
  })
  it('blob_url nulo -> sem_base sem_blob_url, sem fetch', async () => {
    const f = vi.fn() as unknown as typeof fetch
    expect(await dhashDoArquivo(null, f)).toEqual({ tipo: 'sem_base', motivo: 'sem_blob_url' })
    expect(f).toHaveBeenCalledTimes(0)
  })
})

describe('dhashDasVariantes', () => {
  it('calcula só os nulos e grava com where thumbnail_dhash is null e blob_url igual ao medido (F-P7)', async () => {
    const png = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#39c' } }).png().toBuffer()
    const f = vi.fn(async () => new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch
    const chamadas: Array<[string, ...unknown[]]> = []
    let payload: unknown
    const chain = {
      update: (p: unknown) => { payload = p; return chain },
      eq: (...a: unknown[]) => { chamadas.push(['eq', ...a]); return chain },
      is: (...a: unknown[]) => { chamadas.push(['is', ...a]); return chain },
      then: (r: (v: unknown) => void) => r({ error: null }),
    }
    const supabase = { from: vi.fn(() => chain) } as never
    const r = await dhashDasVariantes(supabase, [
      { id: 'v1', blob_url: URL_BLOB, thumbnail_dhash: null },
      { id: 'v2', blob_url: 'https://x.public.blob.vercel-storage.com/b.png', thumbnail_dhash: 'abcdef0123456789' },
    ], f)
    const esperado = await dhashOf(await hqdefaultLike(png))
    expect(r.get('v1')).toEqual({ tipo: 'ok', dhash: esperado })
    expect(r.get('v2')).toEqual({ tipo: 'ok', dhash: 'abcdef0123456789' })
    expect(f).toHaveBeenCalledTimes(1)
    expect(payload).toEqual({ thumbnail_dhash: esperado })
    expect(chamadas).toEqual([['eq', 'id', 'v1'], ['is', 'thumbnail_dhash', null], ['eq', 'blob_url', URL_BLOB]])
  })
  it('falha de leitura não grava nada', async () => {
    const f = (async () => new Response('', { status: 503 })) as typeof fetch
    const supabase = { from: vi.fn() } as never
    const r = await dhashDasVariantes(supabase, [{ id: 'v1', blob_url: URL_BLOB, thumbnail_dhash: null }], f)
    expect(r.get('v1')!.tipo).toBe('falha')
    expect((supabase as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled()
  })
})

describe('hqdefaultLike', () => {
  it('Y-P10: thumbnail 4:3 (1024x768) vira 480x360 e o dHash é estável entre duas chamadas', async () => {
    const png = await sharp({ create: { width: 1024, height: 768, channels: 3, background: '#39c' } }).png().toBuffer()
    const a = await dhashOf(await hqdefaultLike(png)); const b = await dhashOf(await hqdefaultLike(png))
    expect(a).toBe(b); expect(a).toMatch(/^[0-9a-f]{16}$/)
    const m = await sharp(await hqdefaultLike(png)).metadata(); expect([m.width, m.height]).toEqual([480, 360])
  })
})

describe('guardarOriginalMaior', () => {
  it('maxres disponível: guarda a maxres com dimensões e dHash', async () => {
    const jpg = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#c33' } }).jpeg().toBuffer()
    vi.mocked(put).mockResolvedValue({ url: 'https://b/x.jpg' } as never)
    const f = (async () => new Response(new Uint8Array(jpg), { headers: { 'content-type': 'image/jpeg' } })) as typeof fetch
    const r = await guardarOriginalMaior('abc', 'uuid-1', f)
    expect(r).toMatchObject({ url: 'https://b/x.jpg', largura: 1280, altura: 720 })
    expect(r.dhash).toMatch(/^[0-9a-f]{16}$/)
    expect(vi.mocked(put).mock.calls.at(-1)![0]).toBe('ab-originals/uuid-1.jpg')
  })
  it('nenhuma cópia: lança "thumbnail original indisponível"', async () => {
    const f = (async () => new Response('', { status: 404 })) as typeof fetch
    await expect(guardarOriginalMaior('abc', 'uuid-1', f)).rejects.toThrow('thumbnail original indisponível')
  })
})
