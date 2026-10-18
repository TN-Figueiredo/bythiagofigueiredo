// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { lerParamsNovoTeste, canalDaReferencia } from '../src/app/cms/(authed)/youtube/ab-lab/new/params'

const U = '0b4c1e6a-1111-4222-8333-444455556666'
const base = { draft: null, videoId: null, tipo: null, referencia: null }

describe('lerParamsNovoTeste', () => {
  it('nada', () => expect(lerParamsNovoTeste({})).toEqual(base))
  it('videoId repetido usa o primeiro', () => expect(lerParamsNovoTeste({ videoId: ['a', 'b'] }).videoId).toBe('a'))
  it('videoId vazio ou longo', () => {
    expect(lerParamsNovoTeste({ videoId: '   ' }).videoId).toBeNull()
    expect(lerParamsNovoTeste({ videoId: 'x'.repeat(65) }).videoId).toBeNull()
  })
  it('draft não uuid', () => {
    expect(lerParamsNovoTeste({ draft: 'x' }).draft).toBeNull()
    expect(lerParamsNovoTeste({ draft: U }).draft).toBe(U)
  })
  it('changeType sem ref chega como tipo, sem faixa (B1)', () => {
    expect(lerParamsNovoTeste({ videoId: U, changeType: 'title' })).toEqual({ ...base, videoId: U, tipo: 'title' })
  })
  it('ref=competitor sem changeType ou com combo', () => {
    expect(lerParamsNovoTeste({ ref: 'competitor' })).toEqual(base)
    expect(lerParamsNovoTeste({ ref: 'competitor', changeType: 'combo' })).toEqual(base)
  })
  it('ref=outro com changeType', () => {
    expect(lerParamsNovoTeste({ ref: 'outro', changeType: 'title' })).toEqual({ ...base, tipo: 'title' })
  })
  it('thumb de host recusado vira null', () => {
    const p = lerParamsNovoTeste({ ref: 'competitor', changeType: 'thumbnail', competitorThumb: 'https://evil.com/a.jpg' })
    expect(p.referencia?.thumb).toBeNull()
    expect(p.referencia?.tipo).toBe('thumbnail')
  })
  it('título de 301 caracteres', () => {
    expect(lerParamsNovoTeste({ ref: 'competitor', changeType: 'title', competitorTitle: 'a'.repeat(301) }).referencia?.titulo).toBeNull()
  })
  it('refVideoId inválido derruba refTroca', () => {
    const p = lerParamsNovoTeste({ ref: 'competitor', changeType: 'title', refVideoId: 'nao-uuid', refTroca: 'c1' })
    expect(p.referencia?.refVideoId).toBeNull()
    expect(p.referencia?.refTroca).toBeNull()
  })
  it('refTroca inválido', () => {
    expect(lerParamsNovoTeste({ ref: 'competitor', changeType: 'title', refVideoId: U, refTroca: 'a b<' }).referencia?.refTroca).toBeNull()
    expect(lerParamsNovoTeste({ ref: 'competitor', changeType: 'title', refVideoId: U, refTroca: 'c1' }).referencia?.refTroca).toBe('c1')
  })
})

describe('canalDaReferencia (Foco 5)', () => {
  const linha = (site: string, vid: unknown = 'dQw4w9WgXcQ') => ({ id: U, video_id: vid, competitor_channels: { channel_name: 'Fulano', site_id: site } })
  it('mesmo site', () => expect(canalDaReferencia(linha('s1'), 's1')).toEqual({ canal: 'Fulano', ytId: 'dQw4w9WgXcQ' }))
  it('outro site não vaza nome nem id', () => expect(canalDaReferencia(linha('s2'), 's1')).toBeNull())
  it('video_id fora do formato', () => expect(canalDaReferencia(linha('s1', 'curto'), 's1')).toEqual({ canal: 'Fulano', ytId: null }))
  it('lixo', () => {
    expect(canalDaReferencia(null, 's1')).toBeNull()
    expect(canalDaReferencia({ video_id: 'x' }, 's1')).toBeNull()
  })
})
