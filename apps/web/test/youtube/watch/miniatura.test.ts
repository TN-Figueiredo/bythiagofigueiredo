// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'

vi.mock('@/lib/youtube/thumb-fingerprint', async orig => {
  const real = await orig<typeof import('@/lib/youtube/thumb-fingerprint')>()
  return { ...real, dhashOf: vi.fn(real.dhashOf) }
})

import { dhashOf } from '@/lib/youtube/thumb-fingerprint'
import { IMAGEM_PADRAO_YT } from '@/lib/youtube/teste-youtube/imagem'
import { leituraWatchSchema } from '@/lib/youtube/teste-youtube/tipos'
import { sondarMiniatura, type MiniaturaSondada } from '@/lib/youtube/watch/miniatura'

const ID = 'abcdefghijk'

async function jpeg(): Promise<Buffer> {
  const raw = Buffer.alloc(480 * 360 * 3)
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7) % 256
  return sharp(raw, { raw: { width: 480, height: 360, channels: 3 } }).jpeg().toBuffer()
}

function resp(body: Buffer, status = 200, headers: Record<string, string> = {}): typeof fetch {
  return (async () => new Response(new Uint8Array(body), { status, headers })) as typeof fetch
}

function leitura(m: MiniaturaSondada) {
  return {
    youtubeVideoId: ID, lidaEm: '2026-10-18T10:00:00Z', rodadaId: 'r1', origemRede: null, idioma: null, erro: null,
    tituloOficial: null, titulo_oficial_fonte: null, rendicoesSqp: null, titulosExibidos: [], miniaturas: [m],
  }
}


describe('sondarMiniatura', () => {
  it('200 com JPEG 480x360', async () => {
    const m = await sondarMiniatura(ID, resp(await jpeg(), 200, { etag: '"abc"' }))
    expect(m).toMatchObject({ url: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`, host: 'i.ytimg.com', variante: 'hqdefault', largura: 480, altura: 360, http: 200, etag: '"abc"' })
    expect(m.dhash).toMatch(/^[0-9a-f]{16}$/)
    expect(m.sha16).toMatch(/^[0-9a-f]{16}$/)
    expect(leituraWatchSchema.safeParse(leitura(m)).success).toBe(true)
  })

  it('404 com corpo de imagem não gera dhash nem dimensões', async () => {
    const m = await sondarMiniatura(ID, resp(await jpeg(), 404))
    expect(m).toMatchObject({ http: 404, dhash: null, largura: null, altura: null })
    expect(leituraWatchSchema.safeParse(leitura(m)).success).toBe(true)
  })

  it('200 cujo dHash é a imagem padrão vira nulo', async () => {
    vi.mocked(dhashOf).mockResolvedValueOnce(IMAGEM_PADRAO_YT)
    const m = await sondarMiniatura(ID, resp(await jpeg(), 200))
    expect(m).toMatchObject({ http: 200, dhash: null, largura: null, altura: null })
    expect(leituraWatchSchema.safeParse(leitura(m)).success).toBe(true)
  })

  it('rede lança: http null e o resto nulo', async () => {
    const m = await sondarMiniatura(ID, (async () => { throw new Error('x') }) as typeof fetch)
    expect(m).toMatchObject({ http: null, etag: null, sha16: null, dhash: null, largura: null, altura: null })
    expect(leituraWatchSchema.safeParse(leitura(m)).success).toBe(true)
  })

  it('etag vazio ou com mais de 200 caracteres vira null', async () => {
    const b = await jpeg()
    expect((await sondarMiniatura(ID, resp(b, 200, { etag: '' }))).etag).toBeNull()
    expect((await sondarMiniatura(ID, resp(b, 200, { etag: 'a'.repeat(201) }))).etag).toBeNull()
  })

  it('usa GET sem query', async () => {
    const f = vi.fn(resp(await jpeg()))
    await sondarMiniatura(ID, f)
    const [u, init] = f.mock.calls[0]!
    expect(String(u)).not.toContain('?')
    expect(init?.method).toBe('GET')
  })
})
