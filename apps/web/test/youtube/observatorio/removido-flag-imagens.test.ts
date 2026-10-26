// @vitest-environment jsdom
// M3b T12/Q4: o aviso "Apagado" que viaja da página do canal para a lista leva o que se sabe das imagens, e só o que tem forma de dado.
import { describe, it, expect, beforeEach } from 'vitest'
import { lerRemovido, marcarRemovido } from '@/app/cms/(authed)/youtube/competitors/_canais/removido-flag'

beforeEach(() => sessionStorage.clear())
describe('removido-flag · imagens', () => {
  it('ida e volta', () => {
    marcarRemovido({ nome: 'Canal', videos: 3, imagens: { imagensRestantes: 47, imagensAoAbrir: 47, capacidade: 'nao-sim', dataDoComando: '2026-12-05' } }, 1000)
    expect(lerRemovido(1500)).toEqual({ nome: 'Canal', videos: 3, imagens: { imagensRestantes: 47, imagensAoAbrir: 47, capacidade: 'nao-sim', dataDoComando: '2026-12-05' } })
  })
  it('leitura de depois do clique ausente continua ausente (nunca vira 0)', () => {
    marcarRemovido({ nome: 'Canal', videos: 3, imagens: { imagensAoAbrir: 47, capacidade: 'nao-nao' } }, 1000)
    const r = lerRemovido(1500)!
    expect(r.imagens).toEqual({ imagensAoAbrir: 47, capacidade: 'nao-nao' })
    expect('imagensRestantes' in r.imagens!).toBe(false)
  })
  it('lixo no storage: capacidade inventada e números inválidos são descartados', () => {
    sessionStorage.setItem('obs-canal-removido', JSON.stringify({ nome: 'C', videos: 1, em: 1000, imagens: { imagensRestantes: -4, imagensAoAbrir: 'x', capacidade: 'talvez' } }))
    expect(lerRemovido(1500)).toEqual({ nome: 'C', videos: 1 })
  })
})
