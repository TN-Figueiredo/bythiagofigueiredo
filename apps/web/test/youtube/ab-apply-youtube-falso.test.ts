// Sem vi.mock: applyVariantToYouTube real sobre ab-youtube/ab-metadata reais, com `fetch` falso (Y-D1, Y-D8).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { applyVariantToYouTube } from '@/lib/youtube/ab-apply'

const BLOB = 'https://abc.public.blob.vercel-storage.com/i.jpg'
const SNIPPET = { title: 'V', description: 'D', categoryId: '19' }

function instalarFetch(opts: { thumbStatus?: number; thumbReason?: string }) {
  const chamadas: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith(BLOB)) { chamadas.push('blob'); return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } }) }
    if (url.includes('thumbnails/set')) {
      chamadas.push('thumbnails.set')
      if (opts.thumbStatus) return new Response(JSON.stringify({ error: { errors: [{ reason: opts.thumbReason ?? 'forbidden', message: 'segredo' }] } }), { status: opts.thumbStatus })
      return new Response(JSON.stringify({ items: [{ high: { url: 'https://i.ytimg.com/x.jpg' } }] }))
    }
    if (init?.method === 'PUT') { chamadas.push('videos.update'); return new Response('{}') }
    chamadas.push('videos.list')
    return new Response(JSON.stringify({ items: [{ snippet: SNIPPET }] }))
  }))
  return chamadas
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.unstubAllGlobals() })

describe('applyVariantToYouTube com fetch falso', () => {
  it('Y-D1: 403 em thumbnails.set → error contém 403 (string), erroApi.status 403, erroGravado {status, reason, chamada}', async () => {
    instalarFetch({ thumbStatus: 403, thumbReason: 'forbidden' })
    const r = await applyVariantToYouTube({ youtubeVideoId: 'v', accessToken: 'tok', testType: 'thumbnail', variant: { blob_url: BLOB } })
    expect(r.ok).toBe(false)
    expect(typeof r.error).toBe('string')
    expect(r.error).toContain('403')
    expect(r.erroApi?.status).toBe(403)
    expect(r.erroGravado).toEqual({ status: 403, reason: 'forbidden', chamada: 'thumbnails.set' })
    expect(JSON.stringify(r)).not.toContain('segredo')
  })

  it('403 de cota em thumbnails.set chega com reason quotaExceeded (alimenta a pausa, T8)', async () => {
    instalarFetch({ thumbStatus: 403, thumbReason: 'quotaExceeded' })
    const r = await applyVariantToYouTube({ youtubeVideoId: 'v', accessToken: 'tok', testType: 'thumbnail', variant: { blob_url: BLOB } })
    expect(r.erroApi?.reason).toBe('quotaExceeded')
  })

  it('Y-D8: antesDeEscrever é chamado antes da thumbnail e antes do título; false para sem escrever e devolve perdeuAVez', async () => {
    const chamadas = instalarFetch({})
    const ordem: string[] = []
    const r = await applyVariantToYouTube(
      { youtubeVideoId: 'v', accessToken: 'tok', testType: 'combo', variant: { blob_url: BLOB, title_text: 'T' } },
      { antesDeEscrever: async () => { ordem.push('antes'); return ordem.length < 2 } },
    )
    expect(ordem).toEqual(['antes', 'antes'])
    expect(r).toMatchObject({ ok: false, perdeuAVez: true, appliedThumbnail: true, appliedMetadata: false })
    expect(chamadas).toContain('thumbnails.set')
    expect(chamadas).not.toContain('videos.update')
    expect(chamadas).not.toContain('videos.list')
  })

  it('Y-D8: false na primeira releitura → nada é escrito (nem thumbnail nem título)', async () => {
    const chamadas = instalarFetch({})
    const r = await applyVariantToYouTube(
      { youtubeVideoId: 'v', accessToken: 'tok', testType: 'combo', variant: { blob_url: BLOB, title_text: 'T' } },
      { antesDeEscrever: async () => false },
    )
    expect(r).toMatchObject({ ok: false, perdeuAVez: true, appliedThumbnail: false, appliedMetadata: false })
    expect(chamadas).not.toContain('thumbnails.set')
    expect(chamadas).not.toContain('videos.update')
  })

  it('combo com tudo verdadeiro: duas releituras e as duas escritas', async () => {
    const chamadas = instalarFetch({})
    let n = 0
    const r = await applyVariantToYouTube(
      { youtubeVideoId: 'v', accessToken: 'tok', testType: 'combo', variant: { blob_url: BLOB, title_text: 'T' } },
      { antesDeEscrever: async () => { n++; return true } },
    )
    expect(r.ok).toBe(true)
    expect(n).toBe(2)
    expect(chamadas).toEqual(expect.arrayContaining(['thumbnails.set', 'videos.update']))
  })
})
