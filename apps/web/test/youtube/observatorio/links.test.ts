// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { link } from '../../../src/lib/youtube/observatorio/links'

describe('links', () => {
  it('object links never carry niche', () =>
    expect(link.mudancas({ niche: 'ia', video: 'abc' })).toBe(
      '/cms/youtube/competitors/mudancas?video=abc',
    ),
  )

  it('content theme goes in topic=, colour theme only light|dark', () => {
    expect(link.outliers({ topic: 'comida-de-rua' })).toBe(
      '/cms/youtube/competitors/outliers?topic=comida-de-rua',
    )
    expect(link.outliers({ theme: 'light' as const })).toBe(
      '/cms/youtube/competitors/outliers?theme=light',
    )
  })

  it('no dangling "?"', () => expect(link.outliers({})).toBe('/cms/youtube/competitors/outliers'))

  it('historico keeps back= as the origin query', () =>
    expect(
      link.historico('v1', {
        from: 'outliers',
        back: '?niche=ia&ages=0-30',
      }),
    ).toBe('/cms/youtube/competitors/video/v1?from=outliers&back=%3Fniche%3Dia%26ages%3D0-30'),
  )

  it('changes list', () =>
    expect(link.mudancas({ changes: ['a/title/1', 'b/thumb/2'] })).toBe(
      '/cms/youtube/competitors/mudancas?changes=a%2Ftitle%2F1%2Cb%2Fthumb%2F2',
    ),
  )
})
