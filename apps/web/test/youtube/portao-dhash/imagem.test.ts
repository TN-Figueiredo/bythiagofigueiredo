import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { hamming, dhashOf } from '@/lib/youtube/thumb-fingerprint'
import { maiorCopia, baixar, dhashComoHq, gerarImagemTeste, hqdefaultLike, distancias } from '@/lib/youtube/portao-dhash/imagem'
import { imagemSintetica, respostaImagem, fetchFalso } from './util'

describe('maiorCopia', () => {
  it('prefere maxresdefault', async () => {
    const big = await imagemSintetica(1280, 720, 3)
    const f = fetchFalso({ maxresdefault: respostaImagem(big) })
    expect(await maiorCopia('6jL-jeux_1Y', f)).toMatchObject({ variante: 'maxresdefault', largura: 1280, altura: 720 })
  })
  it('404 passa para a próxima; só hqdefault → hqdefault', async () => {
    const hq = await imagemSintetica(480, 360, 3)
    const f = fetchFalso({ hqdefault: respostaImagem(hq) })
    expect((await maiorCopia('6jL-jeux_1Y', f)).variante).toBe('hqdefault')
  })
  it('erro de rede ou 5xx lança (não confunde "não sei" com "não existe")', async () => {
    const f = fetchFalso({ maxresdefault: new Response('', { status: 503 }) })
    await expect(maiorCopia('6jL-jeux_1Y', f)).rejects.toThrow(/503/)
  })
  it('nenhuma variante → recusa', async () => {
    await expect(maiorCopia('6jL-jeux_1Y', fetchFalso({}))).rejects.toThrow(/nenhuma cópia/)
  })
  it('resposta que não é imagem conta como inexistente', async () => {
    expect(await baixar('https://i.ytimg.com/x.jpg', fetchFalso({ x: new Response('<html>', { headers: { 'content-type': 'text/html' } }) }))).toBeNull()
  })
})

describe('comparação como hqdefault', () => {
  it('1280×720 e a hqdefault 480×360 com faixas dão o mesmo dHash', async () => {
    const big = await imagemSintetica(1280, 720, 3)
    expect(hamming(await dhashComoHq(big), await dhashOf(await hqdefaultLike(big)))).toBe(0)
  })
  it('o negativo fica longe da original', async () => {
    const big = await imagemSintetica(1280, 720, 3)
    const teste = await gerarImagemTeste(big)
    const meta = await sharp(teste).metadata()
    expect([meta.width, meta.height, meta.format]).toEqual([1280, 720, 'jpeg'])
    expect(hamming(await dhashComoHq(teste), await dhashComoHq(big))).toBeGreaterThanOrEqual(20)
  })
  it('distancias lista os pares', async () => {
    const a = await imagemSintetica(1280, 720, 3), b = await imagemSintetica(1280, 720, 7)
    const l = await distancias([a, a, b], ['a', 'a2', 'b'])
    expect(l).toHaveLength(3)
    expect(l[0]).toBe('a × a2: 0')
  })
})
