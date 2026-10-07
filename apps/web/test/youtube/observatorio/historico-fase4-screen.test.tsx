// @vitest-environment jsdom
// Histórico com muitas versões, na tela (plan 2026-10-07-observatorio-historico-muitas-versoes, Tasks 6 a 8).
// jsdom has no layout: the timeline is 1100 px wide (the component's default) and the pointer is fine (32 px targets).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within, fireEvent } from '@testing-library/react'
import { loadFase4, VID } from './fase4-world'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams('from=mudancas'),
}))
beforeEach(() => replace.mockClear())

const { ds } = loadFase4(), obs = createObservatory(ds)
function mount(id: string, p: Record<string, string | undefined> = {}) {
  const view = buildHistoricoView(obs, id, p)
  const r = render(<ToastProvider><HistoricoScreen view={view} /></ToastProvider>)
  const root = r.container.querySelector<HTMLElement>('[data-obs-screen="historico"]')!
  const laneOf = (t: string) => root.querySelector<HTMLElement>('[data-lane="' + t + '"]')!
  return { ...r, view, root, laneOf }
}
const key = (el: Element, k: string) => fireEvent.keyDown(el, { key: k })

describe('faixas densas (Task 6)', () => {
  it('cada faixa é UMA parada de Tab e tem nome de grupo', () => {
    const { root, laneOf } = mount(VID.many)
    for (const t of ['title', 'thumb', 'desc']) {
      expect(laneOf(t).getAttribute('role')).toBe('group')
      expect(laneOf(t).querySelectorAll('.ln-i[tabindex="0"]').length).toBe(1)
    }
    expect(root.querySelectorAll('.lanes [tabindex="0"]').length).toBe(3)
    expect(laneOf('thumb').getAttribute('aria-label')).toBe('Faixa de thumbnail: 24 períodos e 23 trocas, em ordem de tempo. As setas para a esquerda e para a direita andam pela faixa.')
  })
  it('as setas, Home e End andam pela faixa e levam a parada de Tab junto', () => {
    const { laneOf } = mount(VID.many)
    const items = [...laneOf('title').querySelectorAll<HTMLElement>('.ln-i')]
    items[0]!.focus()
    key(items[0]!, 'ArrowRight')
    expect(document.activeElement).toBe(items[1])
    expect(items.map(i => i.tabIndex).filter(t => t === 0).length).toBe(1)
    expect(items[1]!.tabIndex).toBe(0)
    key(items[1]!, 'End'); expect(document.activeElement).toBe(items[items.length - 1])
    key(items[items.length - 1]!, 'ArrowRight'); expect(document.activeElement).toBe(items[items.length - 1])
    key(items[items.length - 1]!, 'Home'); expect(document.activeElement).toBe(items[0])
    key(items[0]!, 'ArrowLeft'); expect(document.activeElement).toBe(items[0])
  })
  it('o grupo NÃO abre ao receber foco: mostra só a dica; abre com clique (Enter e espaço são o clique do botão)', () => {
    const { root, laneOf } = mount(VID.many)
    const g = laneOf('thumb').querySelector<HTMLElement>('.cgrp')!
    expect(g.getAttribute('aria-label')).toMatch(/^\d+ períodos de thumbnail, de 13\/10 11:00 até .+: A, B, A/)
    fireEvent.focus(g)
    expect(g.getAttribute('aria-expanded')).toBe('false')
    const tip = root.querySelector('#hv-tip')!
    expect(tip.classList.contains('show')).toBe(true)
    expect(tip.textContent).toContain('Enter, espaço ou clique abre a lista.')
    const pop = root.querySelector<HTMLElement>('#' + g.getAttribute('aria-controls'))!
    expect(pop.hidden).toBe(true)
    fireEvent.click(g)
    expect(g.getAttribute('aria-expanded')).toBe('true')
    expect(pop.hidden).toBe(false)
    expect(tip.classList.contains('show')).toBe(false)
    fireEvent.click(g)
    expect(g.getAttribute('aria-expanded')).toBe('false')
  })
  it('Esc fecha a lista aberta e devolve o foco ao contador; clique fora também fecha', () => {
    const { laneOf } = mount(VID.many)
    const g = laneOf('thumb').querySelector<HTMLElement>('.mkg')!
    expect(g.textContent).toMatch(/^\d+ (trocas|tr\.)$/)
    fireEvent.click(g)
    const first = laneOf('thumb').querySelector<HTMLElement>('#' + g.getAttribute('aria-controls') + ' button')!
    first.focus()
    key(first, 'Escape')
    expect(g.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(g)
    fireEvent.click(g); expect(g.getAttribute('aria-expanded')).toBe('true')
    fireEvent.mouseDown(document.body); expect(g.getAttribute('aria-expanded')).toBe('false')
  })
  it('dentro da lista de um grupo as setas para baixo e para cima andam pelas linhas', () => {
    const { laneOf } = mount(VID.many)
    const g = laneOf('thumb').querySelector<HTMLElement>('.mkg')!
    fireEvent.click(g)
    const rows = [...laneOf('thumb').querySelectorAll<HTMLElement>('#' + g.getAttribute('aria-controls') + ' button')]
    rows[0]!.focus(); key(rows[0]!, 'ArrowDown')
    expect(document.activeElement).toBe(rows[1])
    key(rows[1]!, 'ArrowUp'); expect(document.activeElement).toBe(rows[0])
  })
  it('escolher uma troca na lista de um contador seleciona a comparação dela', () => {
    const { root, laneOf } = mount(VID.many)
    const g = laneOf('thumb').querySelector<HTMLElement>('.mkg')!
    fireEvent.click(g)
    const row = laneOf('thumb').querySelector<HTMLElement>('#' + g.getAttribute('aria-controls') + ' button[data-pair]')!
    fireEvent.click(row)
    const sel = root.querySelector('#hv-compare [data-k="' + row.dataset.pair + '"]')!
    expect(sel.getAttribute('aria-pressed') === 'true' || sel.getAttribute('aria-selected') === 'true').toBe(true)
    expect(g.getAttribute('aria-expanded')).toBe('false')
  })
  it('trocas em sequência: barra com nome completo em cada faixa que tem; descrição não tem', () => {
    const { laneOf } = mount(VID.open)
    expect(laneOf('thumb').querySelector('.runb')!.getAttribute('aria-label')).toBe('Trocas em sequência: 5 trocas em 9 dias, ainda aberta (thumbnail). Pode ser um teste; o YouTube não informa.')
    expect(laneOf('thumb').classList.contains('has-run')).toBe(true)
    expect(laneOf('title').querySelector('.runb')).toBeNull()
    expect(laneOf('desc').querySelector('.runb')).toBeNull()
  })
  it('legenda: a entrada dos grupos só aparece quando há grupo; a das sequências, quando há sequência', () => {
    expect(mount(VID.many).root.querySelector('[data-legend-kind="grp"]')!.textContent).toContain('o contador diz quantos são e abre a lista')
    const few = mount(VID.few).root
    expect([few.querySelector('[data-legend-kind="grp"]'), few.querySelector('[data-legend-kind="run"]')]).toEqual([null, null])
  })
  it('toda thumbnail da tela tem width e height', () => {
    const { root } = mount(VID.many)
    const imgs = [...root.querySelectorAll('img')]
    expect(imgs.length).toBeGreaterThan(24)
    expect(imgs.filter(i => !i.getAttribute('width') || !i.getAttribute('height'))).toEqual([])
  })
})

describe('filtro de período (Task 6)', () => {
  it('fica na linha do título do gráfico, com os quatro botões; "tudo" vem marcado', () => {
    const { root } = mount(VID.many)
    const ctl = root.querySelector<HTMLElement>('.timeline .sec-h .rng-ctl')!
    expect(within(ctl).getAllByRole('button').map(b => [b.textContent, b.getAttribute('aria-pressed'), b.getAttribute('aria-label')])).toEqual([
      ['7 d', 'false', '7 d: últimos 7 dias'], ['30 d', 'false', '30 d: últimos 30 dias'], ['90 d', 'false', '90 d: últimos 90 dias'], ['tudo', 'true', 'tudo: desde a publicação']])
  })
  it('escolher um período escreve ?range= na URL sem rolar a página; "tudo" tira o parâmetro', () => {
    const a = mount(VID.many)
    fireEvent.click(within(a.root.querySelector<HTMLElement>('.rng-ctl')!).getByRole('button', { name: '7 d: últimos 7 dias' }))
    expect(replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/video/x?from=mudancas&range=7', { scroll: false })
    a.unmount()
    const b = mount(VID.many, { range: '7' })
    expect(within(b.root.querySelector<HTMLElement>('.rng-ctl')!).getByRole('button', { name: '7 d: últimos 7 dias' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(b.root.querySelector<HTMLElement>('.rng-ctl')!).getByRole('button', { name: 'tudo: desde a publicação' }))
    expect(replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/video/x?from=mudancas', { scroll: false })
  })
  it('com 7 d: a frase fica abaixo das faixas e as faixas só têm o que está dentro', () => {
    const { root, laneOf } = mount(VID.many, { range: '7' })
    const txt = root.querySelector('#hv-rngtxt')!
    expect(txt.getAttribute('role')).toBe('status')
    expect(txt.textContent).toBe('De 05/12 15:02 até agora: 3 de 24 períodos de thumbnail, 2 de 9 títulos, 1 de 3 descrições, 3 de 33 trocas e 7 de 60 dias de views. O cabeçalho e o resultado de cada troca continuam os do vídeo inteiro.')
    expect(txt.compareDocumentPosition(root.querySelector('.lanes')!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(laneOf('thumb').querySelectorAll('[data-k]').length + laneOf('thumb').querySelectorAll('[data-sl]').length).toBe(3)
    expect(root.querySelectorAll('.vlines > *').length).toBe(3)
  })
  it('vídeo curto: o filtro não aparece', () => {
    const { root } = mount(VID.few, { range: '7' })
    expect([root.querySelector('.rng-ctl'), root.querySelector('#hv-rngtxt')]).toEqual([null, null])
  })
})
