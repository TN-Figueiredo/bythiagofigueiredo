// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { IMAGEM_PADRAO_YT, instanteDoEtag, mesmaImagem } from '@/lib/youtube/teste-youtube/imagem'
import * as d from '@/lib/youtube/teste-youtube/dhash'
import * as tf from '@/lib/youtube/thumb-fingerprint'
import * as th from '@/lib/youtube/thumb-hamming'
import type { ImagemComparavel } from '@/lib/youtube/teste-youtube/tipos'

const hq = (dhash: string | null, largura: number | null = 480, altura: number | null = 360, variante = 'hqdefault'): ImagemComparavel => ({
  variante,
  largura,
  altura,
  dhash,
})

/** Troca n bits (de baixo para cima) de um hex de 16 caracteres. */
function viraBits(hex: string, n: number): string {
  let v = BigInt('0x' + hex)
  for (let i = 0; i < n; i++) v ^= 1n << BigInt(i)
  return v.toString(16).padStart(16, '0')
}

describe('mesmaImagem', () => {
  it('C9: mesma, diferente e incomparável', () => {
    expect(mesmaImagem(hq('106068c9a7a3c3c8'), hq('106068cba7a3c3c8'))).toBe('mesma')
    expect(mesmaImagem(hq('686068cfa7a3a3c6', 1280, 720), hq('e9f9e90c1a3a3a9c', 1280, 720))).toBe('diferente')
    expect(mesmaImagem(hq('106068c9a7a3c3c8'), hq('106068c9a7a3c3c8', 480, 360, 'maxresdefault'))).toBe('incomparavel')
    expect(mesmaImagem(hq('106068c9a7a3c3c8', 480, 360), hq('106068c9a7a3c3c8', 336, 188))).toBe('incomparavel')
    expect(mesmaImagem(hq('106068c9a7a3c3c8', null, null), hq('106068c9a7a3c3c8'))).toBe('incomparavel')
    expect(mesmaImagem(hq('zzzzzzzzzzzzzzzz'), hq('zzzzzzzzzzzzzzzz'))).toBe('incomparavel')
    expect(mesmaImagem(hq('106068c9a7a3c3c'), hq('106068c9a7a3c3c'))).toBe('incomparavel')
    expect(mesmaImagem(hq('106068CBA7A3C3C8'), hq('106068CBA7A3C3C8'))).toBe('incomparavel')
    expect(mesmaImagem(hq(null), hq('106068c9a7a3c3c8'))).toBe('incomparavel')
  })

  it('limiar: 6 bits é mesma, 7 é diferente', () => {
    const z = '0000000000000000'
    expect(mesmaImagem(hq(z), hq(viraBits(z, 6)))).toBe('mesma')
    expect(mesmaImagem(hq(z), hq(viraBits(z, 7)))).toBe('diferente')
  })

  it('limiar customizado', () => {
    const z = '0000000000000000'
    expect(mesmaImagem(hq(z), hq(viraBits(z, 4)), 3)).toBe('diferente')
    expect(mesmaImagem(hq(z), hq(viraBits(z, 3)), 3)).toBe('mesma')
  })

  it('C8: a imagem cinza do 404 é incomparável com qualquer uma', () => {
    expect(IMAGEM_PADRAO_YT).toBe('400e716969691648')
    expect(mesmaImagem(hq(IMAGEM_PADRAO_YT), hq(IMAGEM_PADRAO_YT))).toBe('incomparavel')
    expect(mesmaImagem(hq(IMAGEM_PADRAO_YT), hq('106068c9a7a3c3c8'))).toBe('incomparavel')
    expect(mesmaImagem(hq('106068c9a7a3c3c8'), hq(IMAGEM_PADRAO_YT))).toBe('incomparavel')
  })
})

describe('C32b: reexportação', () => {
  it('hamming e limiar vêm de thumb-hamming', () => {
    expect(tf.hamming).toBe(th.hamming)
    expect(d.hamming).toBe(th.hamming)
    expect(tf.DHASH_MAX_SAME).toBe(6)
    expect(d.DHASH_MAX_SAME).toBe(6)
    expect(d.sameThumb).toBe(th.sameThumb)
    expect(d.thumbRepresentatives).toBe(th.thumbRepresentatives)
  })
})

describe('instanteDoEtag', () => {
  it('ETag numérico vira instante', () => {
    expect(instanteDoEtag('"1792341745"')).toBe('2026-10-18T16:42:25.000Z')
    expect(instanteDoEtag('W/"1792341745"')).toBe('2026-10-18T16:42:25.000Z')
    expect(instanteDoEtag('"0"')).toBeNull()
    expect(instanteDoEtag(null)).toBeNull()
    expect(instanteDoEtag('"abc"')).toBeNull()
    expect(instanteDoEtag('"12345678"')).toBeNull()
  })
})

describe('fechamento do lote: guardas de imagem e etag', () => {
  it('I7: duas imagens sem dimensão e com o mesmo dHash são incomparáveis (a guarda nula vale por si)', () => {
    expect(mesmaImagem(hq('106068c9a7a3c3c8', null, null), hq('106068c9a7a3c3c8', null, null))).toBe('incomparavel')
  })

  it('I5: ETag de 12 e 13 dígitos não é instante de envio (null, não uma data absurda)', () => {
    expect(instanteDoEtag('"179234174500"')).toBeNull()
    expect(instanteDoEtag('"1792341745000"')).toBeNull()
  })
})
