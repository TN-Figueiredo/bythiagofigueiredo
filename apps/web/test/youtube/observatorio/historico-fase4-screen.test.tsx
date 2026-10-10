// @vitest-environment jsdom
// Histórico com muitas versões, na tela (plan 2026-10-07-observatorio-historico-muitas-versoes, Tasks 6 a 8).
// jsdom has no layout: the timeline is 1100 px wide (the component's default) and the pointer is fine (32 px targets).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, within, fireEvent, act } from '@testing-library/react'
import { loadFase4, setThumbs, VID } from './fase4-world'
import { noJunkText, oneFilledButton, forbiddenVocabulary, brokenLinks } from './audits'
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
// the tips and group lists live in the one floating layer (#flut, end of <body>): empty it between tests
afterEach(() => { document.getElementById('flut')?.remove() })
const flut = () => document.getElementById('flut')

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
    const tip = document.getElementById('hv-tip')!
    expect(tip.parentElement).toBe(flut())
    expect(tip.textContent).toContain('Enter, espaço ou clique abre a lista.')
    expect(g.hasAttribute('aria-controls')).toBe(false)
    fireEvent.click(g)
    const id = g.getAttribute('aria-controls')!
    expect(g.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(id)!.parentElement).toBe(flut())
    expect(document.getElementById('hv-tip')).toBeNull()
    fireEvent.click(g)
    expect(g.getAttribute('aria-expanded')).toBe('false')
  })
  it('Esc fecha a lista aberta e devolve o foco ao contador; clique fora também fecha', () => {
    const { laneOf } = mount(VID.many)
    const g = laneOf('thumb').querySelector<HTMLElement>('.mkg')!
    expect(g.textContent).toMatch(/^\d+ (trocas|tr\.)$/)
    fireEvent.click(g)
    const first = document.querySelector<HTMLElement>('#' + g.getAttribute('aria-controls') + ' button')!
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
    const rows = [...document.querySelectorAll<HTMLElement>('#' + g.getAttribute('aria-controls') + ' button')]
    rows[0]!.focus(); key(rows[0]!, 'ArrowDown')
    expect(document.activeElement).toBe(rows[1])
    key(rows[1]!, 'ArrowUp'); expect(document.activeElement).toBe(rows[0])
  })
  it('escolher uma troca na lista de um contador seleciona a comparação dela', () => {
    const { root, laneOf } = mount(VID.many)
    const g = laneOf('thumb').querySelector<HTMLElement>('.mkg')!
    fireEvent.click(g)
    const row = document.querySelector<HTMLElement>('#' + g.getAttribute('aria-controls') + ' button[data-pair]')!
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
    const item = document.querySelector<HTMLElement>('#' + g.getAttribute('aria-controls') + ' button[data-go]')!
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

describe('comparação em lista (Task 8)', () => {
  const sel = (root: HTMLElement) => root.querySelector<HTMLElement>('#hv-clist [aria-selected="true"]')!
  it('7 trocas ou mais: lista com uma linha por troca; até 6, os botões de hoje', () => {
    const many = mount(VID.many).root
    expect([many.querySelectorAll('#hv-clist [role="option"]').length, many.querySelectorAll('.pair').length]).toEqual([33, 0])
    expect(many.querySelector('#hv-clist')!.getAttribute('aria-label')).toBe('Trocas, da mais recente para a mais antiga')
    expect(sel(many).textContent).toContain('Thumbnail D → E')
    expect(many.querySelector('.cmp-sum')!.textContent).toMatch(/^33 trocas: /)
    const open = mount(VID.open).root
    expect([open.querySelectorAll('#hv-clist').length, open.querySelectorAll('.pair').length, open.querySelectorAll('.flt').length]).toEqual([0, 4, 0])
  })
  it('filtro por campo e por situação: as contagens de um respeitam o outro, e a frase é sempre o MESMO nó', () => {
    const { root } = mount(VID.many)
    const count = root.querySelector('#hv-cmpcount')!
    expect(count.getAttribute('role')).toBe('status')
    expect(count.textContent).toBe('Mostrando 33 de 33 trocas. Selecionada: Thumbnail D → E.')
    const btn = (g: string, v: string) => root.querySelector<HTMLElement>('[data-flt="' + g + '"][data-v="' + v + '"]')!
    expect(['all', 'title', 'thumb', 'desc'].map(v => btn('field', v).querySelector('.c')!.textContent)).toEqual(['33', '8', '23', '2'])
    fireEvent.click(btn('field', 'title'))
    expect(root.querySelector('#hv-cmpcount')).toBe(count)
    expect(root.querySelectorAll('#hv-clist [role="option"]').length).toBe(8)
    expect(count.textContent).toMatch(/^Mostrando 8 de 33 trocas\. Selecionada: Título T8 → T9\.$/)
    expect(btn('field', 'title').getAttribute('aria-pressed')).toBe('true')
    expect(btn('situation', 'aguardando').querySelector('.c')!.textContent).toBe('1')
    expect(btn('situation', 'all').querySelector('.c')!.textContent).toBe('8')
  })
  it('a instrução da lista fica fora da região viva', () => {
    const { root } = mount(VID.many)
    expect(root.querySelector('#hv-cmphint')!.textContent).toBe('A lista rola; as setas andam e Enter escolhe.')
    expect(root.querySelector('#hv-cmphint')!.getAttribute('role')).toBeNull()
    expect(root.querySelector('#hv-cmpcount')!.textContent).not.toContain('A lista rola')
  })
  it('combinação sem nenhuma troca: diz o que há nos outros filtros e oferece limpar', () => {
    const { root } = mount(VID.many)
    const btn = (g: string, v: string) => root.querySelector<HTMLElement>('[data-flt="' + g + '"][data-v="' + v + '"]')!
    fireEvent.click(btn('field', 'desc')); fireEvent.click(btn('situation', 'aguardando'))
    expect(root.querySelector('#hv-clist')).toBeNull()
    expect(root.querySelector('#hv-cmpcount')!.textContent).toBe('Nenhuma troca de descrição na situação “aguardando”. Há 2 trocas de descrição em outras situações e 3 trocas na situação “aguardando” em outros campos.')
    fireEvent.click(root.querySelector<HTMLElement>('#hv-fltclear')!)
    expect(root.querySelectorAll('#hv-clist [role="option"]').length).toBe(33)
  })
  it('a lista é uma parada de Tab: setas, Home, End, PageDown; Enter escolhe', () => {
    const { root } = mount(VID.many)
    const items = [...root.querySelectorAll<HTMLElement>('#hv-clist [role="option"]')]
    expect(items.filter(i => i.tabIndex === 0).length).toBe(1)
    items[0]!.focus()
    key(items[0]!, 'ArrowDown'); expect(document.activeElement).toBe(items[1])
    key(items[1]!, 'PageDown'); expect(document.activeElement).toBe(items[6])
    key(items[6]!, 'End'); expect(document.activeElement).toBe(items[32])
    key(items[32]!, 'Home'); expect(document.activeElement).toBe(items[0])
    key(items[0]!, 'ArrowDown'); key(items[1]!, 'Enter')
    expect(sel(root).dataset.k).toBe(items[1]!.dataset.k)
    expect(root.querySelector('#hv-cdet')!.textContent).toContain('Parte de 11 trocas em sequência em 20 dias. Pode ser um teste; o YouTube não informa.')
  })
  it('marcador de uma troca que o filtro esconde: limpa os filtros e seleciona', () => {
    const { root, laneOf } = mount(VID.many)
    fireEvent.click(root.querySelector<HTMLElement>('[data-flt="field"][data-v="desc"]')!)
    expect(root.querySelectorAll('#hv-clist [role="option"]').length).toBe(2)
    const mk = laneOf('title').querySelector<HTMLElement>('.mk')!
    fireEvent.click(mk)
    expect(root.querySelectorAll('#hv-clist [role="option"]').length).toBe(33)
    expect(sel(root).textContent).toContain('Título')
  })
  it('com 7 d: a frase diz quantas trocas há no período e no vídeo inteiro', () => {
    const { root } = mount(VID.many, { range: '7' })
    expect(root.querySelector('#hv-cmpcount')!.textContent).toBe('Mostrando 3 de 3 trocas no período (33 no vídeo inteiro). Selecionada: Thumbnail D → E.')
  })
  it('período sem nenhuma troca: diz isso e oferece voltar ao vídeo inteiro', () => {
    const w = loadFase4(), t = w.ds.now
    setThumbs(w.ds, VID.closed, [['A'], ...Array.from({ length: 8 }, (_, i): [string, number] => ['ABC'[(i + 1) % 3]!, t - (40 - i) * 864e5])])
    const view = buildHistoricoView(createObservatory(w.ds), VID.closed, { range: '7' })
    const root = render(<ToastProvider><HistoricoScreen view={view} /></ToastProvider>).container
    expect(root.querySelector('#hv-cmpcount')!.textContent).toBe('Nenhuma troca neste período.')
    const back = root.querySelector<HTMLElement>('#hv-fltclear')!
    expect(back.textContent).toBe('Mostrar o vídeo inteiro')
    fireEvent.click(back)
    expect(replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/video/x?from=mudancas', { scroll: false })
  })
})

describe('a tela inteira, nos cinco vídeos do mockup (Task 8)', () => {
  it.each(Object.entries(VID))('%s: auditorias de DOM limpas, com e sem filtro, e todo controle com nome', (_k, id) => {
    for (const p of [{}, { range: '7' }]) {
      const { root, unmount } = mount(id, p)
      // "+3 −0 linhas" is the engine's own label of a description comparison with nothing removed (text-diff.ts); the audit reads
      // "−0" as a broken number. Older than this plan and outside it (follow-up FU-55): only that one message is let through.
      expect(noJunkText(root).filter(m => !/^texto quebrado "−0" em “[^”]*D\d+ → D\d+: \+\d+ −0 linha/.test(m))).toEqual([])
      expect(oneFilledButton(root)).toEqual([])
      expect(forbiddenVocabulary(root)).toEqual([])
      expect(brokenLinks(root)).toEqual([])
      for (const el of root.querySelectorAll('button,a[href],input,summary,[role="option"]')) {
        const name = (el.getAttribute('aria-label') ?? '') + (el.textContent ?? '') + (el.closest('label')?.textContent ?? '')
        expect([el.outerHTML.slice(0, 80), name.trim().length > 0]).toEqual([el.outerHTML.slice(0, 80), true])
      }
      expect(new Set([...root.querySelectorAll('[id]')].map(e => e.id)).size).toBe(root.querySelectorAll('[id]').length)
      for (const el of root.querySelectorAll('[aria-controls],[aria-labelledby],[aria-describedby]')) for (const a of ['aria-controls', 'aria-labelledby', 'aria-describedby'])
        for (const ref of (el.getAttribute(a) ?? '').split(' ').filter(Boolean)) expect([a, ref, !!root.querySelector('#' + CSS.escape(ref))]).toEqual([a, ref, true])
      unmount()
    }
  })
})

describe('Histórico · flutuantes na camada única (A0.1)', () => {
  it('a dica do marcador mora em #flut com o mesmo id e some no blur', () => {
    const { laneOf } = mount(VID.few)
    const mk = laneOf('title').querySelector<HTMLElement>('.mk') ?? laneOf('thumb').querySelector<HTMLElement>('.mk')!
    expect(mk.hasAttribute('aria-describedby')).toBe(false)
    expect(document.getElementById('hv-tip')).toBeNull()
    fireEvent.focus(mk)
    expect(mk.getAttribute('aria-describedby')).toBe('hv-tip')
    const tip = document.getElementById('hv-tip')!
    expect(tip.parentElement).toBe(flut())
    expect(tip.getAttribute('role')).toBe('tooltip')
    expect(tip.querySelector('h4')!.textContent!.length).toBeGreaterThan(3)
    fireEvent.blur(mk)
    expect(document.getElementById('hv-tip')).toBeNull()
  })
  it('as referências ARIA só existem com a caixa aberta: fechada não há atributo, aberta ele aponta para um id que existe', () => {
    const { root, laneOf } = mount(VID.many)
    const mk = laneOf('thumb').querySelector<HTMLElement>('.mk') ?? laneOf('title').querySelector<HTMLElement>('.mk') ?? laneOf('desc').querySelector<HTMLElement>('.mk')
    const g = laneOf('thumb').querySelector<HTMLElement>('.mkg')!
    // closed: no marker points at the tooltip, no counter at its list
    expect(root.querySelectorAll('[aria-describedby="hv-tip"]').length).toBe(0)
    expect(g.hasAttribute('aria-controls')).toBe(false)
    expect(root.querySelectorAll('.gbtn[aria-controls]').length).toBe(0)
    // the tooltip of a marker: only the marker whose tooltip is shown points at it (the fixture must have a marker, or this part would not run)
    expect(mk).not.toBeNull()
    fireEvent.focus(mk!)
    expect(mk!.getAttribute('aria-describedby')).toBe('hv-tip')
    expect(document.getElementById('hv-tip')).not.toBeNull()
    expect(root.querySelectorAll('[aria-describedby="hv-tip"]').length).toBe(1)
    fireEvent.blur(mk!)
    expect(mk!.hasAttribute('aria-describedby')).toBe(false)
    // the list of a group: the counter points at it only while it is open
    fireEvent.click(g)
    const id = g.getAttribute('aria-controls')
    expect(id).toMatch(/^hv-gp-/)
    expect(document.getElementById(id!)).not.toBeNull()
    expect(root.querySelectorAll('.gbtn[aria-controls]').length).toBe(1)
    fireEvent.click(g)
    expect(g.hasAttribute('aria-controls')).toBe(false)
    expect(document.getElementById(id!)).toBeNull()
  })
  it('a lista de um grupo abre em #flut no clique, nunca no foco; as setas andam nas linhas; Esc devolve o foco ao contador', () => {
    const { laneOf } = mount(VID.many)
    const g = laneOf('thumb').querySelector<HTMLButtonElement>('.gbtn')!
    g.focus(); fireEvent.focus(g)
    expect(document.querySelector('#flut .hv-gpop')).toBeNull()
    fireEvent.click(g)
    const pop = document.querySelector<HTMLElement>('#flut .hv-gpop')!
    expect(pop.id).toBe(g.getAttribute('aria-controls'))
    expect(pop.getAttribute('role')).toBe('group')
    const rows = pop.querySelectorAll<HTMLButtonElement>('button')
    expect(rows.length).toBeGreaterThan(1)
    act(() => { rows[0]!.focus() })
    expect(document.querySelector('#flut .hv-gpop')).not.toBeNull() // the focus inside the list does not close it
    key(rows[0]!, 'ArrowDown')
    expect(document.activeElement).toBe(rows[1])
    key(rows[1]!, 'Escape')
    expect(document.querySelector('#flut .hv-gpop')).toBeNull()
    expect(document.activeElement).toBe(g)
  })
  it('o foco que anda de uma linha para outra não fecha a lista; o foco que sai dela fecha', () => {
    const { laneOf } = mount(VID.many)
    const g = laneOf('thumb').querySelector<HTMLButtonElement>('.mkg')!
    fireEvent.click(g)
    const rows = document.querySelectorAll<HTMLButtonElement>('#' + g.getAttribute('aria-controls') + ' button')
    act(() => { rows[0]!.focus() }); act(() => { rows[1]!.focus() })
    expect(g.getAttribute('aria-expanded')).toBe('true')
    act(() => { laneOf('title').querySelector<HTMLElement>('.ln-i')!.focus() })
    expect(g.getAttribute('aria-expanded')).toBe('false')
  })
  it('escolher uma linha do grupo seleciona a troca e fecha a lista', () => {
    const { root, laneOf } = mount(VID.many)
    fireEvent.click(laneOf('thumb').querySelector<HTMLButtonElement>('.mkg')!)
    const linha = document.querySelector<HTMLButtonElement>('#flut .hv-gpop button[data-pair]')!
    fireEvent.click(linha)
    expect(document.querySelector('#flut .hv-gpop')).toBeNull()
    const sel = root.querySelector('#hv-compare [data-k="' + linha.dataset.pair + '"]')!
    expect(sel.getAttribute('aria-pressed') === 'true' || sel.getAttribute('aria-selected') === 'true').toBe(true)
  })
  it('Esc com uma imagem fixada e a lista de um grupo aberta: o primeiro fecha só a lista (a fixação fica); o segundo solta a imagem', () => {
    const { root, laneOf } = mount(VID.many)
    const pin = within(root.querySelector<HTMLElement>('#hv-isum')!).getByRole('button', { name: 'A: fixar o destaque desta imagem' })
    pin.focus(); fireEvent.click(pin)
    expect(pin.getAttribute('aria-pressed')).toBe('true')
    const g = laneOf('thumb').querySelector<HTMLButtonElement>('.mkg')!
    fireEvent.click(g)
    expect(document.querySelector('#flut .hv-gpop')).not.toBeNull()
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })) })
    expect(document.querySelector('#flut .hv-gpop')).toBeNull()
    expect(pin.getAttribute('aria-pressed')).toBe('true') // one Esc, one thing
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })) })
    expect(pin.getAttribute('aria-pressed')).toBe('false')
  })
  it('Esc com a lista aberta solta também o destaque de passagem e a dica armada (como antes da camada: uma tecla, as duas coisas)', () => {
    const { root, laneOf } = mount(VID.many)
    const item = laneOf('title').querySelector<HTMLElement>('[data-k]') ?? laneOf('thumb').querySelector<HTMLElement>('[data-k]')!
    fireEvent.mouseEnter(item)
    expect(root.querySelectorAll('.is-hl').length).toBeGreaterThan(0)
    fireEvent.click(laneOf('thumb').querySelector<HTMLButtonElement>('.mkg')!)
    expect(document.querySelector('#flut .hv-gpop')).not.toBeNull()
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })) })
    expect(document.querySelector('#flut .hv-gpop')).toBeNull()
    expect(root.querySelectorAll('.is-hl').length).toBe(0)
  })
  it('a lista de um grupo é nomeada pelo próprio título (aria-labelledby), sem repetir o texto num aria-label', () => {
    const { laneOf } = mount(VID.many)
    fireEvent.click(laneOf('thumb').querySelector<HTMLButtonElement>('.mkg')!)
    const pop = document.querySelector<HTMLElement>('#flut .hv-gpop')!
    expect(pop.hasAttribute('aria-label')).toBe(false)
    const h = document.getElementById(pop.getAttribute('aria-labelledby')!)!
    expect(pop.contains(h)).toBe(true)
    expect(h.tagName).toBe('H4')
    expect(h.textContent).toMatch(/neste trecho$/)
  })
  it('Esc de qualquer lugar fecha a lista aberta', () => {
    const { laneOf } = mount(VID.many)
    const g = laneOf('thumb').querySelector<HTMLButtonElement>('.mkg')!
    fireEvent.click(g)
    expect(document.querySelector('#flut .hv-gpop')).not.toBeNull()
    key(document.body, 'Escape')
    expect(g.getAttribute('aria-expanded')).toBe('false')
  })
})
