import { describe, it, expect } from 'vitest'
import { resolverVideoPedido, thumbReferenciaSegura, filtroBuscaVideo } from '../src/app/cms/(authed)/youtube/ab-lab/new/resolver'

const el = [{ id: 'u1', hasActiveTest: false }, { id: 'u2', hasActiveTest: true }]

describe('resolverVideoPedido', () => {
  it('sem pedido: nada', () => {
    expect(resolverVideoPedido(el, undefined, null)).toEqual({ videoId: null, aviso: null })
  })
  it('uuid elegível pré-seleciona', () => {
    expect(resolverVideoPedido(el, 'u1', null).videoId).toBe('u1')
  })
  it('id do YouTube resolvido para uuid elegível', () => {
    expect(resolverVideoPedido(el, 'yt123', 'u1').videoId).toBe('u1')
  })
  it('teste ativo: aviso, sem seleção', () => {
    const r = resolverVideoPedido(el, 'u2', null)
    expect(r.videoId).toBeNull()
    expect(r.aviso).toMatch(/teste \(ou rascunho\) aberto/)
  })
  it('existe mas fora da lista: aviso', () => {
    expect(resolverVideoPedido(el, 'yt9', 'u9').aviso).toMatch(/mais recentes/)
  })
  it('inexistente: aviso', () => {
    expect(resolverVideoPedido(el, 'zzz', null).aviso).toMatch(/Não encontramos/)
  })
})

describe('thumbReferenciaSegura', () => {
  it('aceita i.ytimg.com', () => {
    expect(thumbReferenciaSegura('https://i.ytimg.com/vi/a/hq.jpg')).toBe('https://i.ytimg.com/vi/a/hq.jpg')
  })
  it('recusa outros hosts, http e lixo', () => {
    expect(thumbReferenciaSegura('https://evil.com/a.jpg')).toBeNull()
    expect(thumbReferenciaSegura('http://i.ytimg.com/a.jpg')).toBeNull()
    expect(thumbReferenciaSegura('x')).toBeNull()
    expect(thumbReferenciaSegura(undefined)).toBeNull()
  })
})

describe('filtroBuscaVideo', () => {
  it('id do YouTube: só o ramo youtube_video_id', () => {
    expect(filtroBuscaVideo('dQw4w9WgXcQ')).toBe('youtube_video_id.eq.dQw4w9WgXcQ')
  })
  it('uuid: só o ramo id', () => {
    const u = '123e4567-e89b-12d3-a456-426614174000'
    expect(filtroBuscaVideo(u)).toBe(`id.eq.${u}`)
  })
  it('entrada hostil: null', () => {
    for (const h of ['x,site_id.neq.0', 'a)or(id.not.is.null', '-'.repeat(36), 'ééé', 'dQw4w9WgXc,', '', 'abc']) {
      expect(filtroBuscaVideo(h)).toBeNull()
    }
  })
})

describe('erro do banco e rascunho', () => {
  it('falha na consulta: aviso próprio, não "não encontramos"', () => {
    const r = resolverVideoPedido(el, 'yt123', null, true)
    expect(r.aviso).toMatch(/Não foi possível/)
    expect(r.aviso).not.toMatch(/Não encontramos/)
  })
  it('aviso de teste aberto cobre rascunho', () => {
    expect(resolverVideoPedido(el, 'u2', null).aviso).toMatch(/rascunho/)
  })
})

describe('thumbReferenciaSegura (blob)', () => {
  it('aceita Blob do Vercel e descarta query/usuário', () => {
    expect(thumbReferenciaSegura('https://abc.public.blob.vercel-storage.com/observatorio/thumbs/u/h.jpg?x=1'))
      .toBe('https://abc.public.blob.vercel-storage.com/observatorio/thumbs/u/h.jpg')
    expect(thumbReferenciaSegura('https://evil.com@i.ytimg.com/a')).toBe('https://i.ytimg.com/a')
  })
  it('recusa host parecido', () => {
    expect(thumbReferenciaSegura('https://x.blob.vercel-storage.com.evil.com/a')).toBeNull()
    expect(thumbReferenciaSegura('https://x.public.blob.vercel-storage.com.evil.com/a')).toBeNull()
  })
})
