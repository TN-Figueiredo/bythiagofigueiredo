// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  hrefNovoTesteProprio, hrefNovoTesteConcorrente, thumbDoVideoDeReferencia, thumbOriginalYtimg,
  tituloReferencia, tipoDaLane, hrefListaAb, hrefTesteAb,
} from '../../src/lib/youtube/ab-referencia'

const sp = (h: string) => new URL(h, 'http://x').searchParams

describe('hrefNovoTesteProprio', () => {
  it('com tipo', () => {
    expect(hrefNovoTesteProprio('0b4c', 'thumbnail')).toBe('/cms/youtube/ab-lab/new?videoId=0b4c&changeType=thumbnail')
  })
  it('sem tipo', () => {
    expect(hrefNovoTesteProprio('0b4c')).toBe('/cms/youtube/ab-lab/new?videoId=0b4c')
  })
})

describe('hrefNovoTesteConcorrente', () => {
  it('título hostil chega inteiro e sem competitorThumb', () => {
    const titulo = 'Japão & Coreia #1 ?x="y" 🇯🇵'
    const q = sp(hrefNovoTesteConcorrente({ tipo: 'title', thumb: null, titulo, refVideoId: 'u', refTroca: 'c1' }))
    expect(q.get('ref')).toBe('competitor')
    expect(q.get('changeType')).toBe('title')
    expect(q.get('competitorTitle')).toBe(titulo)
    expect(q.get('refVideoId')).toBe('u')
    expect(q.get('refTroca')).toBe('c1')
    expect(q.has('competitorThumb')).toBe(false)
  })
  it.each(['http://i.ytimg.com/a.jpg', 'https://evil.com/a.jpg', 'https://i.ytimg.com.evil.com/a.jpg'])('thumb fora da regra: %s', (thumb) => {
    expect(sp(hrefNovoTesteConcorrente({ tipo: 'thumbnail', thumb, titulo: null, refVideoId: 'u' })).has('competitorThumb')).toBe(false)
  })
  it('blob perde a query', () => {
    const q = sp(hrefNovoTesteConcorrente({ tipo: 'thumbnail', thumb: 'https://x.public.blob.vercel-storage.com/a.jpg?t=1', titulo: null, refVideoId: 'u' }))
    expect(q.get('competitorThumb')).toBe('https://x.public.blob.vercel-storage.com/a.jpg')
  })
  it('título de 301 caracteres some; 95 com 6 bandeiras é aceito', () => {
    expect(sp(hrefNovoTesteConcorrente({ tipo: 'title', thumb: null, titulo: 'a'.repeat(301), refVideoId: 'u' })).has('competitorTitle')).toBe(false)
    const t = 'a'.repeat(89) + '🇯🇵🇰🇷🇧🇷'
    expect(t.length).toBeGreaterThan(100)
    expect(sp(hrefNovoTesteConcorrente({ tipo: 'title', thumb: null, titulo: t, refVideoId: 'u' })).get('competitorTitle')).toBe(t)
  })
})

describe('thumbDoVideoDeReferencia', () => {
  const blob = (id: string) => `https://s.public.blob.vercel-storage.com/observatorio/thumbs/${id}/abc.jpg`
  it('blob com o refVideoId certo', () => expect(thumbDoVideoDeReferencia(blob('V1'), 'V1', null)).toBe(blob('V1')))
  it('blob com outro refVideoId', () => expect(thumbDoVideoDeReferencia(blob('V1'), 'V2', null)).toBeNull())
  it('blob sem refVideoId', () => expect(thumbDoVideoDeReferencia(blob('V1'), null, 'dQw4w9WgXcQ')).toBeNull())
  it('ytimg com o ytId certo', () => {
    const u = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    expect(thumbDoVideoDeReferencia(u, null, 'dQw4w9WgXcQ')).toBe(u)
    expect(thumbDoVideoDeReferencia(u, null, 'aaaaaaaaaaa')).toBeNull()
    expect(thumbDoVideoDeReferencia(u, null, null)).toBeNull()
  })
  it('url nula ou recusada', () => {
    expect(thumbDoVideoDeReferencia(null, 'V1', 'x')).toBeNull()
    expect(thumbDoVideoDeReferencia('https://evil.com/a.jpg', 'V1', 'x')).toBeNull()
  })
})

describe('demais', () => {
  it('thumbOriginalYtimg', () => {
    expect(thumbOriginalYtimg('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    expect(thumbOriginalYtimg('x')).toBeNull()
    expect(thumbOriginalYtimg(null)).toBeNull()
    expect(thumbOriginalYtimg('a/b')).toBeNull()
  })
  it('tituloReferencia', () => {
    expect(tituloReferencia('  oi ')).toBe('oi')
    expect(tituloReferencia('   ')).toBeNull()
    expect(tituloReferencia(null)).toBeNull()
  })
  it('tipoDaLane e hrefs', () => {
    expect(tipoDaLane('thumb')).toBe('thumbnail')
    expect(tipoDaLane('title')).toBe('title')
    expect(tipoDaLane('desc')).toBeNull()
    expect(hrefListaAb()).toBe('/cms/youtube/ab-lab')
    expect(hrefTesteAb('a b')).toBe('/cms/youtube/ab-lab/a%20b')
  })
})
