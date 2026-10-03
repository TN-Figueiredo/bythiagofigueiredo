// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { link } from '../../../src/lib/youtube/observatorio/links'

describe('links', () => {
  // Original tests from brief
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

  // Additional tests from fix round 1
  it('outliers with min parameter', () =>
    expect(link.outliers({ min: 0 })).toBe('/cms/youtube/competitors/outliers?min=0'),
  )

  it('outliers ages parameter maps to age= query param', () => {
    // Array of ages → comma-joined with %2C encoding
    expect(link.outliers({ ages: ['0-30', '31-90'] })).toBe(
      '/cms/youtube/competitors/outliers?age=0-30%2C31-90',
    )
    // 'all' special value
    expect(link.outliers({ ages: 'all' })).toBe('/cms/youtube/competitors/outliers?age=all')
  })

  it('niche is kept when no object key is present', () =>
    expect(link.outliers({ niche: 'ia' })).toBe('/cms/youtube/competitors/outliers?niche=ia'),
  )

  it('niche is dropped when object keys are present', () =>
    expect(link.mudancas({ niche: 'ia', channel: 'c1' })).toBe(
      '/cms/youtube/competitors/mudancas?channel=c1',
    ),
  )

  it('niche is dropped for reading in outliers', () =>
    expect(link.outliers({ niche: 'ia', reading: 'r1' })).toBe(
      '/cms/youtube/competitors/outliers?reading=r1',
    ),
  )

  it('theme parameter handling with existing topic', () => {
    // Theme moves to topic when not light|dark
    expect(link.outliers({ theme: 'comida-de-rua' as never })).toBe(
      '/cms/youtube/competitors/outliers?topic=comida-de-rua',
    )
    // Theme does not override existing topic
    expect(
      link.outliers({
        topic: 'original-topic',
        theme: 'comida-de-rua' as never,
      }),
    ).toBe('/cms/youtube/competitors/outliers?topic=original-topic')
  })

  it('canais with add and filter parameters', () => {
    expect(link.canais({ add: 1 })).toBe('/cms/youtube/competitors?add=1')
    expect(link.canais({ filter: 'problemas' })).toBe(
      '/cms/youtube/competitors?filter=problemas',
    )
  })

  it('insights with niche parameter', () =>
    expect(link.insights({ niche: 'viagem' })).toBe(
      '/cms/youtube/competitors/insights?niche=viagem',
    ),
  )

  it('empty changes array emits no changes param', () =>
    expect(link.mudancas({ changes: [] })).toBe('/cms/youtube/competitors/mudancas'),
  )

  it('historico ignores back parameter that does not start with ?', () => {
    // Valid back (starts with ?) is included
    expect(link.historico('v1', { back: '?niche=ia' })).toBe(
      '/cms/youtube/competitors/video/v1?back=%3Fniche%3Dia',
    )
    // Invalid back (no ?) is ignored
    expect(link.historico('v1', { back: 'niche=ia' })).toBe('/cms/youtube/competitors/video/v1')
  })
})
