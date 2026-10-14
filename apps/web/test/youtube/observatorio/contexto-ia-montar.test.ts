// @vitest-environment node
/**
 * E17 degrau 1, Tarefa 8a: a MESMA função monta a tela e o pacote. Para cada página que o passo 0 não toca, o modelo que a página entrega
 * ao componente (lido do elemento que ela devolve) é igual, por `toEqual`, ao que `montar…` devolve com os mesmos parâmetros.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'
import { a3World } from './a3-fixture'

const W = a3World()
const abrir = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({ openObservatoryPage: abrir, lerMeuCanalLembrado: async () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras', () => ({
  carregarProprioDaComparacao: async () => ({ extras: undefined, soSeuCanal: {} }),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows', async orig => {
  const m = await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows')>()
  return { ...m, loadSwipeRows: async () => ({ legacy: [], bookmarked: new Set<string>() }) }
})
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({ toggleChangeBookmark: vi.fn(), pinVideo: vi.fn(), unpinVideo: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/forja-actions', () => ({ askForjaReading: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/chrome-server', () => ({ ObservatoryChromeServer: () => null }))

const R = '@/app/cms/(authed)/youtube/competitors'
type El = ReactElement<{ children: ReactElement<Record<string, unknown>> } & Record<string, unknown>>
const SP_VAZIO = {}
const OWN = 'tnfigueiredo', CH = 'leo-khev'

function abrirCom(obs: typeof W.obs): void {
  abrir.mockReset()
  abrir.mockImplementation(async () => ({ siteId: 's', now: obs.NOW, rows: {}, obs, meuCanalLembrado: null, savedNiche: 'todos', extra: { legacy: [], bookmarked: new Set<string>() } }))
}
const semSync = (obs: typeof W.obs): typeof W.obs => Object.create(obs, { SYNC: { value: { ...obs.SYNC, last: null } } })
beforeEach(() => abrirCom(W.obs))

describe('montarMudancas', () => {
  const casos: Array<[string, Record<string, string | undefined>]> = [
    ['parâmetros vazios', SP_VAZIO], ['janela de 90 dias', { win: '90' }], ['nicho inválido na URL', { niche: '@@@' }], ['nicho que não existe', { niche: 'nao-existe' }],
  ]
  for (const [nome, sp] of casos) {
    it(`a página e montar entregam o mesmo modelo: ${nome}`, async () => {
      const { default: Page } = await import(`${R}/mudancas/page`)
      const { montarMudancas } = await import(`${R}/_mudancas/montar`)
      const el = (await Page({ searchParams: Promise.resolve(sp) })) as El
      const m = await montarMudancas(sp)
      expect(el.props.children.props.view).toEqual(m.view)
      expect(m.estado.niche).toBeTruthy()
    })
  }
  it('sem sincronização registrada: recente é nulo; com ela, é o texto da data', async () => {
    const { montarMudancas } = await import(`${R}/_mudancas/montar`)
    expect((await montarMudancas({})).recente).toBe(W.obs.SYNC.title)
    abrirCom(semSync(W.obs))
    expect((await montarMudancas({})).recente).toBeNull()
  })
})

describe('montarOutliers', () => {
  const casos: Array<[string, Record<string, string | undefined>]> = [
    ['parâmetros vazios', SP_VAZIO], ['nicho "all"', { niche: 'all' }], ['nicho inválido', { niche: '@@@' }], ['filtros', { age: '30', fmt: 'shorts', min: '2', sort: 'recent' }],
  ]
  for (const [nome, sp] of casos) {
    it(`a página e montar entregam o mesmo modelo: ${nome}`, async () => {
      const { default: Page } = await import(`${R}/outliers/page`)
      const { montarOutliers } = await import(`${R}/_outliers/montar`)
      const el = (await Page({ searchParams: Promise.resolve(sp) })) as El
      const m = await montarOutliers(sp)
      expect(el.props.children.props.view).toEqual(m.view)
      expect(m.estado.niche).toBe(m.niche)
    })
  }
  it('sem sincronização registrada: recente é nulo', async () => {
    const { montarOutliers } = await import(`${R}/_outliers/montar`)
    abrirCom(semSync(W.obs))
    expect((await montarOutliers({})).recente).toBeNull()
  })
})

describe('montarInsights', () => {
  const casos: Array<[string, Record<string, string | undefined>]> = [
    ['parâmetros vazios', SP_VAZIO], ['formato e mapa por views', { fmt: 'shorts', heat: 'views' }], ['nicho inválido', { niche: '@@@' }], ['mapa com valor estranho', { heat: 'x' }],
  ]
  for (const [nome, sp] of casos) {
    it(`a página e montar entregam o mesmo modelo: ${nome}`, async () => {
      const { default: Page } = await import(`${R}/insights/page`)
      const { montarInsights } = await import(`${R}/_insights/montar`)
      const el = (await Page({ searchParams: Promise.resolve(sp) })) as El
      const m = await montarInsights(sp)
      expect(el.props.children.props.view).toEqual(m.view)
      expect(el.props.children.props.heatMode).toBe(m.heatMode)
      expect(m.estado.heat).toBe(m.heatMode)
    })
  }
  it('sem sincronização registrada: recente é nulo', async () => {
    const { montarInsights } = await import(`${R}/_insights/montar`)
    abrirCom(semSync(W.obs))
    expect((await montarInsights({})).recente).toBeNull()
  })
})

describe('montarComparar', () => {
  const casos: Array<[string, Record<string, string | undefined>]> = [
    ['parâmetros vazios', SP_VAZIO], ['par pedido', { a: OWN, b: CH }], ['id em maiúsculas', { a: OWN.toUpperCase(), b: CH }], ['id de outro site', { a: 'canal-de-outro-site', b: CH }], ['a igual a b', { a: CH, b: CH }],
  ]
  for (const [nome, sp] of casos) {
    it(`a página e montar entregam o mesmo modelo: ${nome}`, async () => {
      const { default: Page } = await import(`${R}/comparar/page`)
      const { montarComparar } = await import(`${R}/_comparar/montar`)
      const el = (await Page({ searchParams: Promise.resolve(sp) })) as El
      const m = await montarComparar(sp)
      expect(el.props.children.props.pack).toEqual(m.pack)
      expect(el.props.children.props.inicial).toEqual(m.inicial)
      expect(m.estado).toEqual(m.inicial)
    })
  }
  it('id de outro site cai no par padrão, nunca no id de fora', async () => {
    const { montarComparar } = await import(`${R}/_comparar/montar`)
    const m = await montarComparar({ a: 'canal-de-outro-site', b: CH })
    const ids = m.pack.canais.map(c => c.id)
    expect(m.inicial && ids.includes(m.inicial.a) && ids.includes(m.inicial.b)).toBe(true)
  })
  it('sem sincronização registrada: recente é nulo', async () => {
    const { montarComparar } = await import(`${R}/_comparar/montar`)
    abrirCom(semSync(W.obs))
    expect((await montarComparar({})).recente).toBeNull()
  })
})

describe('as assinaturas', () => {
  it('nenhuma montar… recebe siteId: um só parâmetro, os da URL', async () => {
    const mods = [await import(`${R}/_mudancas/montar`), await import(`${R}/_outliers/montar`), await import(`${R}/_insights/montar`), await import(`${R}/_comparar/montar`)]
    for (const m of mods) for (const f of Object.values(m) as Array<(...a: never[]) => unknown>) expect(f.length).toBe(1)
  })
  it('a guarda vem antes: a abertura que recusa interrompe e nada é montado', async () => {
    abrir.mockReset(); abrir.mockImplementation(async () => { throw new Error('REDIRECT /cms/login') })
    const { montarComparar } = await import(`${R}/_comparar/montar`)
    await expect(montarComparar({})).rejects.toThrow('REDIRECT')
  })
})
