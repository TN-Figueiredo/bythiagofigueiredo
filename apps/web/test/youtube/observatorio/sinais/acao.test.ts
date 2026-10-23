// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { derivarAcao } from '@/lib/youtube/observatorio/sinais/acao'

describe('derivarAcao (F2 T8, r6)', () => {
  it('gravada video_novo e um próprio entrou depois: titulo_descricao com n = 1', () => {
    expect(derivarAcao('destino', 'video_novo', ['v1'])).toEqual({ acao: 'titulo_descricao', rotulo: 'abrir-seus', n: 1 })
  })
  it('o inverso: gravada titulo_descricao e o próprio virou privado (lista vazia): video_novo', () => {
    expect(derivarAcao('destino', 'titulo_descricao', [])).toEqual({ acao: 'video_novo', rotulo: 'abrir-concorrente', n: 0 })
  })
  it('playlist nunca muda, com ou sem próprios', () => {
    expect(derivarAcao('destino', 'playlist', ['a', 'b']).acao).toBe('playlist')
    expect(derivarAcao('destino', 'playlist', []).acao).toBe('playlist')
    expect(derivarAcao('destino', 'playlist', null)).toEqual({ acao: 'playlist', rotulo: 'playlist', n: null })
  })
  it('não medido (null): mantém a gravada, rótulo genérico e nenhum número a prometer', () => {
    expect(derivarAcao('destino', 'video_novo', null)).toEqual({ acao: 'video_novo', rotulo: 'generico', n: null })
    expect(derivarAcao('destino', 'titulo_descricao', null)).toEqual({ acao: 'titulo_descricao', rotulo: 'generico', n: null })
  })
  it('o caso quarenta: 10ª linha gravada video_novo e 1 vídeo hoje', () => {
    expect(derivarAcao('destino', 'video_novo', ['so-um'])).toMatchObject({ acao: 'titulo_descricao', n: 1 })
  })
})
