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

describe('link.canal', () => {
  it('padrões ficam fora da URL', () => {
    expect(link.canal('abc')).toBe('/cms/youtube/competitors/canal/abc')
    expect(link.canal('abc', { tab: 'videos', fmt: 'todos', sort: 'recentes', ver: 'capas', n: 0 })).toBe('/cms/youtube/competitors/canal/abc')
  })
  it('estado fora do padrão vai na URL', () => {
    expect(link.canal('abc', { tab: 'trocas', video: 'v1' })).toBe('/cms/youtube/competitors/canal/abc?tab=trocas&video=v1')
    expect(link.canal('abc', { fmt: 'fixados', sort: 'vistos', dir: 'asc', q: 'são joão', ver: 'lista', n: 80, nums: 1 }))
      .toBe('/cms/youtube/competitors/canal/abc?fmt=fixados&sort=vistos&dir=asc&q=s%C3%A3o+jo%C3%A3o&ver=lista&n=80&nums=1')
  })
  it('canal próprio: sort=imp e tab=retencao entram na URL; os padrões continuam fora', () => {
    expect(link.canal('abc', { sort: 'imp', dir: 'asc' })).toBe('/cms/youtube/competitors/canal/abc?sort=imp&dir=asc')
    expect(link.canal('abc', { tab: 'retencao', sort: 'recentes' })).toBe('/cms/youtube/competitors/canal/abc?tab=retencao')
  })
  it('id com caractere especial é codificado', () => {
    expect(link.canal('a/b?c')).toBe('/cms/youtube/competitors/canal/a%2Fb%3Fc')
  })
  it('back só vale começando por "?" e só com from', () => {
    expect(link.canal('abc', { from: 'outliers', back: '?fmt=short' })).toContain('back=%3Ffmt%3Dshort')
    expect(link.canal('abc', { from: 'outliers', back: 'https://x' })).not.toContain('back=')
    expect(link.canal('abc', { back: '?x=1' })).not.toContain('back=')
  })
})
describe('link.historico com origem no canal', () => {
  it('leva canal e troca', () => {
    expect(link.historico('v1', { from: 'canais', canal: 'abc', troca: 'chg-9', back: '?fmt=longos' }))
      .toBe('/cms/youtube/competitors/video/v1?from=canais&back=%3Ffmt%3Dlongos&canal=abc&troca=chg-9')
  })
})
describe('link.comparar', () => {
  it('a e b na ordem fixa; sem argumentos, a rota sem query', () => {
    expect(link.comparar()).toBe('/cms/youtube/competitors/comparar')
    expect(link.comparar('x', 'y')).toBe('/cms/youtube/competitors/comparar?a=x&b=y')
    expect(link.comparar(undefined, 'y')).toBe('/cms/youtube/competitors/comparar?b=y')
  })
})

// E5a Tarefa 4: parâmetros novos. O "retrato" abaixo foi escrito com o texto que as ligações de hoje geram, antes da mudança.
describe('E5a T4: ligações e parâmetros', () => {
  const B = '/cms/youtube/competitors'
  it('os links existentes de todas as abas não mudam (retrato de dez ligações de hoje)', () => {
    expect(link.canais()).toBe(B)
    expect(link.canais({ filter: 'problemas' })).toBe(`${B}?filter=problemas`)
    expect(link.canais({ niche: 'ia', fmt: 'shorts', sort: 'vpd' })).toBe(`${B}?niche=ia&fmt=shorts&sort=vpd`)
    expect(link.canais({ channel: 'abc', tab: 'outliers' })).toBe(`${B}?channel=abc&tab=outliers`)
    expect(link.mudancas({ niche: 'ia', type: 'title', win: 7 })).toBe(`${B}/mudancas?niche=ia&type=title&win=7`)
    expect(link.mudancas({ channel: 'abc' })).toBe(`${B}/mudancas?channel=abc`)
    expect(link.outliers({ niche: 'viagem', fmt: 'long', ages: ['0-30'], min: 2 })).toBe(`${B}/outliers?niche=viagem&fmt=long&min=2&age=0-30`)
    expect(link.insights({ niche: 'ia' })).toBe(`${B}/insights?niche=ia`)
    expect(link.insights()).toBe(`${B}/insights`)
    expect(link.comparar('x', 'y')).toBe(`${B}/comparar?a=x&b=y`)
  })
  it('cada parâmetro novo aparece e é lido de volta', () => {
    const lido = (u: string) => Object.fromEntries(new URL(u, 'http://x').searchParams)
    expect(lido(link.canais({ filter: 'parados' }))).toEqual({ filter: 'parados' })
    for (const f of ['em-queda', 'sairam', 'sem-videos'] as const) expect(lido(link.canais({ filter: f }))).toEqual({ filter: f })
    for (const d of ['sobe', 'estavel', 'desce', 'nao-medido'] as const) expect(lido(link.canais({ direcao: d }))).toEqual({ direcao: d })
    expect(lido(link.mudancas({ vista: 'outras' }))).toEqual({ vista: 'outras' })
    for (const t of ['tags', 'categoria', 'duracao', 'capitulos'] as const) expect(lido(link.mudancas({ tipo: t }))).toEqual({ tipo: t })
    expect(lido(link.outliers({ sort: 'v7' }))).toEqual({ sort: 'v7' })
    expect(lido(link.outliers({ sort: 'v30' }))).toEqual({ sort: 'v30' })
    expect(lido(link.outliers({ view: 'list' }))).toEqual({ view: 'list' })
    for (const l of ['com', 'nao-e-o-caso', 'nao-medido'] as const) expect(lido(link.outliers({ leitura: l }))).toEqual({ leitura: l })
    expect(lido(link.insights({ leitura: 'b' }))).toEqual({ leitura: 'b' })
    expect(lido(link.insights({ leitura: 'c' }))).toEqual({ leitura: 'c' })
  })
  it('valor padrão some da URL (um por parâmetro novo)', () => {
    expect(link.mudancas({ vista: 'trocas' })).toBe(`${B}/mudancas`)
    expect(link.outliers({ sort: 'mult' })).toBe(`${B}/outliers`)
    expect(link.outliers({ view: 'grid' })).toBe(`${B}/outliers`)
    expect(link.outliers({ leitura: 'todos' })).toBe(`${B}/outliers`)
    expect(link.insights({ leitura: 'a' })).toBe(`${B}/insights`)
    expect(link.canais({ direcao: undefined })).toBe(B)
  })
  it('direcao não colide com dir: uma URL com os dois é lida de volta com os dois', () => {
    const q = new URL(link.canais({ direcao: 'desce', sort: 'vpd' }) + '&dir=asc', 'http://x').searchParams
    expect(q.get('direcao')).toBe('desce'); expect(q.get('dir')).toBe('asc'); expect(q.get('sort')).toBe('vpd')
  })
  it('tipo e type convivem na mesma URL', () => {
    const q = new URL(link.mudancas({ type: 'title', tipo: 'tags', win: 90 }), 'http://x').searchParams
    expect(q.get('type')).toBe('title'); expect(q.get('tipo')).toBe('tags'); expect(q.get('win')).toBe('90')
  })
  it('o padrão da vista só some quando é o padrão: "outras" continua na URL com os outros filtros', () => {
    expect(link.mudancas({ vista: 'outras', tipo: 'tags', win: 30 })).toBe(`${B}/mudancas?vista=outras&tipo=tags&win=30`)
  })
})
