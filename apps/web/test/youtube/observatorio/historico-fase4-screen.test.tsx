// @vitest-environment jsdom
// Histórico com muitas versões, na tela (plan 2026-10-07-observatorio-historico-muitas-versoes, Tasks 6 a 8).
// jsdom has no layout: the timeline is 1100 px wide (the component's default) and the pointer is fine (32 px targets).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within, fireEvent, act } from '@testing-library/react'
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

describe('resumo por imagem e grade recolhida (Task 7)', () => {
  it('o resumo vem logo depois da linha do tempo e antes de "Antes e depois"', () => {
    const { root } = mount(VID.many)
    const order = [...root.querySelectorAll('.page > section')].map(s => s.id || s.className)
    expect(order.indexOf('hv-isum')).toBe(order.indexOf('card timeline') + 1)
    expect(order.indexOf('hv-compare')).toBe(order.indexOf('hv-isum') + 1)
    const rows = [...root.querySelectorAll('#hv-isum tbody tr')]
    expect(rows.map(r => r.querySelector('th')!.getAttribute('aria-label'))).toEqual(['Imagem A', 'Imagem B', 'Imagem C', 'Imagem D', 'Imagem E, no ar'])
    expect(root.querySelector('#hv-isum tfoot')!.textContent).toContain('5 imagens')
    expect(mount(VID.few).root.querySelector('#hv-isum')).toBeNull()
  })
  it('passar o mouse numa linha destaca a imagem nas faixas e nos cartões; sair tira', () => {
    const { root } = mount(VID.many)
    const row = root.querySelector<HTMLElement>('#hv-isum tr[data-row="E"]')!
    fireEvent.mouseEnter(row)
    expect(row.classList.contains('is-hl')).toBe(true)
    expect(root.querySelectorAll('.fcard.is-hl').length).toBe(6)
    expect([...root.querySelectorAll('.fcard.is-hl')].every(c => c.getAttribute('data-img') === 'E')).toBe(true)
    expect(root.querySelectorAll('[data-lane="thumb"] .is-hl').length).toBeGreaterThan(0)
    fireEvent.mouseLeave(row)
    expect(root.querySelectorAll('.is-hl').length).toBe(0)
  })
  it('fixar: o botão diz "fixada", a região viva anuncia, Esc solta e o foco fica no botão', () => {
    const { root } = mount(VID.many)
    const btn = within(root.querySelector<HTMLElement>('#hv-isum')!).getByRole('button', { name: 'A: fixar o destaque desta imagem' })
    btn.focus(); fireEvent.click(btn)
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    expect(btn.querySelector<HTMLElement>('.pin')!.hidden).toBe(false)
    expect(root.querySelector('#hv-live')!.textContent).toBe('Imagem A fixada no destaque. Esc solta.')
    expect(root.querySelectorAll('.fcard.is-hl').length).toBe(5)
    expect(root.querySelector('#hv-hlnote')!.textContent).toBe('5 cartões da imagem A estão recolhidos.')
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    expect(root.querySelector('#hv-live')!.textContent).toBe('Destaque solto.')
    expect(document.activeElement).toBe(btn)
    expect(root.querySelectorAll('.is-hl').length).toBe(0)
  })
  it('grade: 24 períodos, só os 8 mais recentes à vista; "Ver todas (24)" abre e o mesmo botão recolhe', () => {
    const { root } = mount(VID.many)
    const cards = [...root.querySelectorAll<HTMLElement>('#hv-film .fcard')]
    expect([cards.length, cards.filter(c => c.hidden).length, cards.slice(0, 16).every(c => c.hidden)]).toEqual([24, 16, true])
    const more = root.querySelector<HTMLElement>('#hv-more')!
    expect([more.textContent, more.getAttribute('aria-expanded'), more.getAttribute('aria-controls')]).toEqual(['Ver todas (24)', 'false', 'hv-film'])
    expect(more.parentElement!.textContent).toContain('mostrando os 8 períodos mais recentes de 24')
    fireEvent.click(more)
    expect([cards.filter(c => c.hidden).length, more.textContent, more.getAttribute('aria-expanded')]).toEqual([0, 'Mostrar só as 8 mais recentes', 'true'])
    fireEvent.click(more)
    expect(cards.filter(c => c.hidden).length).toBe(16)
    expect(mount(VID.open).root.querySelector('#hv-more')).toBeNull()
  })
  it('escolher na faixa um período recolhido expande a grade ANTES e leva o foco ao cartão, com o anel de destino', () => {
    const { root, laneOf } = mount(VID.many)
    const g = laneOf('thumb').querySelector<HTMLElement>('.cgrp')!
    fireEvent.click(g)
    const item = laneOf('thumb').querySelector<HTMLElement>('#' + g.getAttribute('aria-controls') + ' button[data-go]')!
    const card = root.querySelector<HTMLElement>('[data-ver="' + item.dataset.go + '"]')!
    expect(card.hidden).toBe(true)
    fireEvent.click(item)
    expect(card.hidden).toBe(false)
    expect(root.querySelector('#hv-more')!.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(card)
    expect(card.classList.contains('target')).toBe(true)
    fireEvent.blur(card)
    expect(card.classList.contains('target')).toBe(false)
  })
  it('notas da sequência: thumbnails e títulos, com a ressalva; a nota "alternância típica" vem antes da grade', () => {
    const { root } = mount(VID.many)
    const th = root.querySelector<HTMLElement>('section[aria-labelledby="hv-thh"]')!
    expect(th.querySelector('.note.seq')!.textContent).toContain('Trocas em sequência: 12 trocas em 20 dias, encerrada em 04/11 (de 15/10 09:14 a 04/11 13:22).')
    expect(th.querySelector('.note.seq')!.textContent).toContain('Pode ser um teste; o YouTube não informa.')
    const ab = [...th.querySelectorAll('.note')].find(n => /alternância típica/.test(n.textContent ?? ''))!
    expect(ab.compareDocumentPosition(th.querySelector('#hv-film')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(root.querySelector('section[aria-labelledby="hv-tih"] .note.seq')!.textContent).toContain('3 trocas em 9 dias, ainda aberta')
    expect(root.querySelector('#hv-desc .note.seq')).toBeNull()
  })
  it('com filtro de 7 d a grade mostra só os cartões do período', () => {
    const { root } = mount(VID.many, { range: '7' })
    expect(root.querySelectorAll('#hv-film .fcard').length).toBe(3)
    expect(root.querySelector('#hv-more')).toBeNull()
    expect(root.querySelectorAll('.tlist li').length).toBe(2)
  })
})
