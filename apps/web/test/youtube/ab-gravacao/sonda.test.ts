// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { probeThumb } from '@/lib/youtube/thumb-fingerprint'
import { classificarLeitura, erroDaSonda, enviadaEmDoEtag, etagUtil, horaDe } from '@/lib/youtube/ab-gravacao/sonda'

const H_A = '0000000000000000'
const H_B = 'ffffffffffffffff'
const H_PERTO_B = 'fffffffffffffff0' // distância 4 de B (<= 6)
const H_OUTRO = 'ff00ff00ff00ff00'

describe('classificarLeitura', () => {
  it('igual a B é bate com variante_vista B', () => {
    expect(classificarLeitura(H_B, [{ variant_id: 'A', dhash: H_A }, { variant_id: 'B', dhash: H_B }])).toEqual({ leitura_estado: 'bate', variante_vista: 'B', variantes_sem_referencia: 0 })
  })
  it('dentro da distância de B ainda bate', () => {
    expect(classificarLeitura(H_PERTO_B, [{ variant_id: 'A', dhash: H_A }, { variant_id: 'B', dhash: H_B }]).variante_vista).toBe('B')
  })
  it('igual a A e a B (referências idênticas) é ambigua e sem variante', () => {
    expect(classificarLeitura(H_B, [{ variant_id: 'A', dhash: H_B }, { variant_id: 'B', dhash: H_B }])).toEqual({ leitura_estado: 'ambigua', variante_vista: null, variantes_sem_referencia: 0 })
  })
  it('B igual e A sem referência é bate e conta 1 sem referência', () => {
    expect(classificarLeitura(H_B, [{ variant_id: 'A', dhash: null }, { variant_id: 'B', dhash: H_B }])).toEqual({ leitura_estado: 'bate', variante_vista: 'B', variantes_sem_referencia: 1 })
  })
  it('nada igual e A sem referência é sem_referencia', () => {
    expect(classificarLeitura(H_OUTRO, [{ variant_id: 'A', dhash: null }, { variant_id: 'B', dhash: H_B }])).toEqual({ leitura_estado: 'sem_referencia', variante_vista: null, variantes_sem_referencia: 1 })
  })
  it('nada igual e todas com referência é nenhuma_bate', () => {
    expect(classificarLeitura(H_OUTRO, [{ variant_id: 'A', dhash: H_A }, { variant_id: 'B', dhash: H_B }])).toEqual({ leitura_estado: 'nenhuma_bate', variante_vista: null, variantes_sem_referencia: 0 })
  })
})

describe('erroDaSonda', () => {
  it('timeout', () => {
    expect(erroDaSonda(new DOMException('x', 'TimeoutError'))).toBe('timeout')
    expect(erroDaSonda(new DOMException('x', 'AbortError'))).toBe('timeout')
  })
  it('http_<status>', () => expect(erroDaSonda({ status: 404 })).toBe('http_404'))
  it('rede', () => expect(erroDaSonda(new TypeError('fetch failed'))).toBe('rede'))
  it('imagem inválida (falha do sharp)', () => expect(erroDaSonda(new Error('Input buffer contains unsupported image format'))).toBe('imagem_invalida'))
  it('valor estranho cai em rede', () => expect(erroDaSonda('boom')).toBe('rede'))
})

describe('enviadaEmDoEtag', () => {
  it('ETag numérico vira ISO', () => expect(enviadaEmDoEtag('"1760774400"')).toBe('2025-10-18T08:00:00.000Z'))
  it('"0", fraco não numérico e nulo viram nulo', () => {
    expect(enviadaEmDoEtag('"0"')).toBeNull()
    expect(enviadaEmDoEtag('W/"abc"')).toBeNull()
    expect(enviadaEmDoEtag(null)).toBeNull()
  })
  it('fraco numérico também vale', () => expect(enviadaEmDoEtag('W/"1760774400"')).toBe('2025-10-18T08:00:00.000Z'))

  // A paridade de uploadInstant só fixa o caso ETag numérico: o i.ytimg.com não manda Last-Modified.
  it('paridade com probeThumb: o mesmo instante', async () => {
    const etag = '"1760774400"'
    const f = (async () => new Response(null, { status: 200, headers: { etag } })) as unknown as typeof fetch
    const p = await probeThumb('abcdefghijk', { etag, dhash: H_A }, f)
    expect(Date.parse(enviadaEmDoEtag(etag)!)).toBe(Date.parse(p.lastModified!))
  })
})

describe('etagUtil', () => {
  it('"0" é nulo, W/"123" vira 123, nulo é nulo', () => {
    expect(etagUtil('"0"')).toBeNull()
    expect(etagUtil('W/"0"')).toBeNull()
    expect(etagUtil('W/"123"')).toBe('123')
    expect(etagUtil('"abc"')).toBe('abc')
    expect(etagUtil(null)).toBeNull()
  })
  it('paridade com usableEtag via probeThumb: ETag "0" nunca reusa o dHash anterior', async () => {
    // probeThumb com ETag "0" nos dois lados não reusa (vai ao GET, que aqui falha) → dhash nulo, não o anterior.
    const f = (async (_u: string, init?: RequestInit) => init?.method === 'HEAD'
      ? new Response(null, { status: 200, headers: { etag: '"0"' } })
      : new Response(null, { status: 500 })) as unknown as typeof fetch
    const p = await probeThumb('abcdefghijk', { etag: '"0"', dhash: H_A }, f)
    expect(p.dhash).toBeNull()
    expect(etagUtil('"0"')).toBeNull()
  })
})

describe('horaDe', () => {
  it('início da hora UTC em ISO', () => {
    expect(horaDe(new Date('2026-10-18T10:15:42.123Z'))).toBe('2026-10-18T10:00:00.000Z')
  })
})
