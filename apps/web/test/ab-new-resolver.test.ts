import { describe, it, expect } from 'vitest'
import { resolverVideoPedido, thumbReferenciaSegura } from '../src/app/cms/(authed)/youtube/ab-lab/new/resolver'

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
    expect(r.aviso).toMatch(/teste em andamento/)
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
