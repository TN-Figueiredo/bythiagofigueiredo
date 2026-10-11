// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, cleanup, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mountCanal } from './canal-mount'

const push = vi.fn(), replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
}))

const URL0 = '/cms/youtube/competitors/canal/matt-wolfe'
const cards = () => [...document.querySelectorAll<HTMLElement>('ul.ct-list > li.ct-card')]
const norm = (s: string | null | undefined) => (s ?? '').replace(/[\s ]+/g, ' ').trim()
const comTroca = (sp: Record<string, string | undefined> = {}) => mountCanal({ sp: { tab: 'trocas', ...sp } })

beforeEach(() => { push.mockReset(); replace.mockReset(); refresh.mockReset(); window.history.replaceState(null, '', URL0) })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('aba Trocas: os cartões', () => {
  it('cada cartão é um h3 (o título do vídeo); a aba ativa é um h2 com o título da seção', () => {
    const { view } = comTroca()
    const t = view.trocas!
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2.textContent).toBe(t.titulo)
    const h3s = screen.getAllByRole('heading', { level: 3 })
    expect(h3s.map(h => norm(h.textContent))).toEqual(t.cards.map(c => c.title))
    expect(cards()).toHaveLength(t.cards.length)
    expect(document.querySelector('.cv-ctl')).toBeNull()             // a aba Vídeos não é montada
  })

  it('N cartões = N botões "Abrir histórico do vídeo: <título>", cada um com o href do modelo', () => {
    const { view } = comTroca()
    const bs = screen.getAllByRole('link', { name: /^Abrir histórico do vídeo: / })
    expect(bs).toHaveLength(view.trocas!.cards.length)
    bs.forEach((b, i) => {
      expect(b.getAttribute('aria-label')).toBe(view.trocas!.cards[i]!.hrefLabel)
      expect(b.getAttribute('href')).toBe(view.trocas!.cards[i]!.href)
    })
  })

  it('"Abrir nesta troca" só em cartão com duas ou mais, com o nome acessível do modelo', () => {
    const { view } = comTroca()
    const lks = screen.getAllByRole('link', { name: /^Abrir o histórico do vídeo na troca de / })
    const esperados = view.trocas!.cards.filter(c => c.trocas.length > 1).flatMap(c => c.trocas)
    expect(lks.map(l => l.getAttribute('aria-label'))).toEqual(esperados.map(t => t.hrefLabel))
    expect(lks.map(l => l.getAttribute('href'))).toEqual(esperados.map(t => t.href))
    const um = cards().find(c => c.querySelectorAll('li.ct-sw').length === 1)!
    expect(within(um).queryByText(/Abrir nesta troca/)).toBeNull()
    const varias = cards().find(c => c.querySelectorAll('li.ct-sw').length > 1)!
    expect(within(varias).getByText(/neste vídeo/)).toBeTruthy()
    expect(within(varias).getAllByText(/Abrir nesta troca/)).toHaveLength(varias.querySelectorAll('li.ct-sw').length)
  })

  it('cada troca mostra o campo, o horário em <time datetime>, o antes e o agora e a frase de efeito', () => {
    const { view } = comTroca()
    const c0 = view.trocas!.cards[0]!
    const li = cards()[0]!.querySelectorAll<HTMLElement>('li.ct-sw')
    c0.trocas.forEach((t, i) => {
      const row = li[i]!
      expect(within(row).getByText(t.campo)).toBeTruthy()
      const time = row.querySelector('time')!
      expect(time.getAttribute('datetime')).toBe(t.iso)
      expect(norm(time.textContent)).toBe(norm(t.quando))
      expect(time.getAttribute('title')).toBe(t.quandoTitle)
      expect(norm(row.querySelector('.ct-efeito')!.textContent)).toBe('No histórico, efeito em 7 dias: ' + t.efeito)
      if (t.antes.texto != null) { expect(norm(row.textContent)).toContain(t.antes.texto); expect(norm(row.textContent)).toContain(t.agora.texto!) }
    })
  })

  it('thumbnail anterior não arquivada: o texto "imagem anterior não arquivada" na classe de dado ausente, sem <img> do "antes"', () => {
    comTroca()
    const nao = [...document.querySelectorAll('.ct-na')]
    expect(nao.length).toBeGreaterThan(0)
    for (const n of nao) expect(norm(n.textContent)).toMatch(/^imagem (anterior )?não arquivada$/)
  })

  it('a thumbnail do cartão fica fora da ordem de Tab; a lupa É uma parada de Tab aqui', () => {
    comTroca()
    for (const c of cards()) {
      const thumb = c.querySelector<HTMLAnchorElement>('a.ct-thumb')!
      expect(thumb.getAttribute('tabindex')).toBe('-1'); expect(thumb.getAttribute('aria-hidden')).toBe('true')
      expect(thumb.querySelector('img')!.getAttribute('alt')).toBe('')
      const lupa = within(c).getByRole('button', { name: /^Ampliar a thumbnail: / })
      expect(lupa.getAttribute('tabindex')).not.toBe('-1')
      // título (h3 > a) e botão levam ao mesmo destino da thumbnail
      expect(c.querySelector('h3 a')!.getAttribute('href')).toBe(thumb.getAttribute('href'))
    }
  })

  it('a lupa amplia a thumbnail do vídeo no visualizador (A2.3), como na grade, não em nova aba', async () => {
    const open = vi.fn(); vi.stubGlobal('open', open)
    const { view } = comTroca()
    const c0 = view.trocas!.cards[0]!
    await userEvent.setup().click(within(cards()[0]!).getByRole('button', { name: 'Ampliar a thumbnail: ' + c0.title }))
    expect(screen.getByRole('dialog').querySelector('h2')!.textContent).toBe('Thumbnail: ' + c0.title)
    expect(open).not.toHaveBeenCalled()
  })

  it('a linha de uma troca é clicável com o mouse (vai ao destino dela); clicar num link não dispara a linha', async () => {
    const { view } = comTroca()
    const c0 = view.trocas!.cards[0]!, row = cards()[0]!.querySelector<HTMLElement>('li.ct-sw')!
    const user = userEvent.setup()
    await user.click(within(row).getByText(c0.trocas[0]!.campo))
    expect(push).toHaveBeenCalledWith(c0.trocas[0]!.href)
    push.mockReset()
    const lnk = row.querySelector<HTMLAnchorElement>('a.ct-rowgo')
    if (lnk) { lnk.addEventListener('click', e => e.preventDefault()); await user.click(lnk); expect(push).not.toHaveBeenCalled() }
  })

  it('termina com o link "Ver as N trocas em Mudanças"', () => {
    const { view } = comTroca()
    const a = screen.getByRole('link', { name: view.trocas!.mudancasLink!.text })
    expect(a.getAttribute('href')).toBe(view.trocas!.mudancasLink!.href)
    expect(a.closest('section')!.lastElementChild!.contains(a)).toBe(true)
  })

  it('canal sem troca: a frase de aba vazia, sem lista e sem link de Mudanças', () => {
    const { view } = mountCanal({ sp: { tab: 'trocas' }, mut: (ds, id) => { ds.videos.forEach(v => { if (v.ch === id) { v.titles = v.titles.slice(0, 1); v.thumbs = v.thumbs.slice(0, 1); v.descs = v.descs.slice(0, 1) } }) } })
    expect(view.trocas!.total).toBe(0)
    expect(screen.getByText('Nenhuma troca de título ou thumbnail nos últimos 30 dias.')).toBeTruthy()
    expect(document.querySelector('ul.ct-list')).toBeNull()
    expect(screen.queryByRole('link', { name: /em Mudanças/ })).toBeNull()
  })
})

describe('aba Trocas: "Ver trocas" de um vídeo (video=<id>)', () => {
  it('mostra só as dele, a linha "Só as trocas de “<título>”: N de M" e "Ver as M trocas do canal"', async () => {
    const { view, all } = comTroca()
    const card = view.trocas!.cards.find(c => c.trocas.length > 1)!
    cleanup(); window.history.replaceState(null, '', URL0)
    const m = comTroca({ video: card.videoId })
    const chip = document.querySelector('.ct-chip')!
    const titulo = all.find(v => v.id === card.videoId)!.title
    expect(norm(chip.textContent)).toContain(`Só as trocas de “${titulo}”: ${card.trocas.length} de ${m.view.trocas!.total}`)
    expect(cards()).toHaveLength(1)
    const todas = within(chip as HTMLElement).getByRole('link', { name: `Ver as ${m.view.trocas!.total} trocas do canal` })
    await userEvent.setup().click(todas)
    expect(cards()).toHaveLength(m.view.trocas!.cards.length)
    expect(document.querySelector('.ct-chip')).toBeNull()
    expect(new URL(window.location.href).searchParams.has('video')).toBe(false)
    expect(new URL(window.location.href).searchParams.get('tab')).toBe('trocas')
  })

  it('video=<id> de vídeo sem troca: "Este vídeo não teve troca de título nem de thumbnail nos últimos 30 dias."', () => {
    const { obs, chId } = mountCanal()
    cleanup()
    const comT = new Set(obs.changesIn({ days: 30, channel: chId }).filter(c => c.type !== 'desc').map(c => c.video))
    const sem = obs.videos.find(v => v.ch === chId && v.tracked && !comT.has(v.id))!
    comTroca({ video: sem.id })
    expect(screen.getByText('Este vídeo não teve troca de título nem de thumbnail nos últimos 30 dias.')).toBeTruthy()
    expect(norm(document.querySelector('.ct-chip')!.textContent)).toContain(`Só as trocas de “${sem.title}”: 0 de `)
    expect(cards()).toHaveLength(0)
  })

  it('video=<id> que não é deste canal: mostra todas, sem erro e sem a linha de filtro', () => {
    const { view } = comTroca({ video: 'nao-e-deste-canal' })
    expect(cards()).toHaveLength(view.trocas!.cards.length)
    expect(document.querySelector('.ct-chip')).toBeNull()
  })

  it('"Ver trocas" do menu de um cartão abre a aba só com as trocas do vídeo e põe o foco no título da aba', async () => {
    const { all } = mountCanal()
    const v = all.find(x => x.swaps > 0)!
    const user = userEvent.setup()
    await user.click(within(document.getElementById('cv-lnk-' + v.id)!.closest('li')!).getByRole('button', { name: /^Ações do vídeo: / }))
    await user.click(await screen.findByRole('menuitem', { name: /^Ver trocas/ }))
    expect(new URL(window.location.href).searchParams.get('tab')).toBe('trocas')
    expect(new URL(window.location.href).searchParams.get('video')).toBe(v.id)
    expect(norm(document.querySelector('.ct-chip')!.textContent)).toContain(`Só as trocas de “${v.title}”`)
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }))
  })
})

describe('abas do canal', () => {
  it('são nav "Seções do canal" com links e aria-current="page", não tablist', () => {
    const { view } = mountCanal()
    const nav = screen.getByRole('navigation', { name: 'Seções do canal' })
    expect(screen.queryByRole('tablist')).toBeNull()
    const links = within(nav).getAllByRole('link')
    expect(links.map(l => norm(l.textContent))).toEqual([`Vídeos ${view.videos.videos.length}`, `Trocas ${view.trocas!.tabCount}`, 'Leitura'])
    expect(links.map(l => l.getAttribute('aria-current'))).toEqual(['page', null, null])
    expect(links[1]!.getAttribute('href')).toBe('/cms/youtube/competitors/canal/matt-wolfe?tab=trocas')
    expect(links[0]!.getAttribute('href')).toBe('/cms/youtube/competitors/canal/matt-wolfe')
  })

  it('os links das abas levam a origem junto (from e back)', () => {
    mountCanal({ sp: { from: 'outliers', back: '?min=3' } })
    const nav = screen.getByRole('navigation', { name: 'Seções do canal' })
    const href = within(nav).getByRole('link', { name: /^Trocas/ }).getAttribute('href')!
    const p = new URL(href, 'http://x').searchParams
    expect(p.get('tab')).toBe('trocas'); expect(p.get('from')).toBe('outliers'); expect(p.get('back')).toBe('?min=3')
  })

  it('a aba Trocas aberta pela URL marca Trocas como atual', () => {
    comTroca()
    const nav = screen.getByRole('navigation', { name: 'Seções do canal' })
    expect(within(nav).getByRole('link', { name: /^Trocas/ }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: /^Vídeos/ }).getAttribute('aria-current')).toBeNull()
  })

  it('trocar entre Vídeos e Trocas não navega (history.pushState) e põe o foco no título da aba', async () => {
    const push0 = vi.spyOn(window.history, 'pushState')
    const { view } = mountCanal()
    const nav = screen.getByRole('navigation', { name: 'Seções do canal' })
    const user = userEvent.setup()
    await user.click(within(nav).getByRole('link', { name: /^Trocas/ }))
    expect(push0).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?tab=trocas')
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: view.trocas!.titulo }))
    expect(within(nav).getByRole('link', { name: /^Trocas/ }).getAttribute('aria-current')).toBe('page')
    await user.click(within(nav).getByRole('link', { name: /^Vídeos/ }))
    expect(push0).toHaveBeenCalledTimes(2)
    expect(window.location.search).toBe('')
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Vídeos' }))
    expect(document.querySelector('.cv-ctl')).not.toBeNull()
  })

  it('clique com Ctrl/Cmd nas abas segue o link do navegador (nova aba): não troca a tela', async () => {
    const push0 = vi.spyOn(window.history, 'pushState')
    mountCanal()
    const nav = screen.getByRole('navigation', { name: 'Seções do canal' })
    const a = within(nav).getByRole('link', { name: /^Trocas/ })
    a.addEventListener('click', e => e.preventDefault())
    fireEvent.click(a, { ctrlKey: true })
    expect(push0).not.toHaveBeenCalled()
    expect(document.querySelector('.cv-ctl')).not.toBeNull()
  })

  it('o Voltar do navegador (popstate) relê a URL: a aba volta e o estado dos controles junto', async () => {
    mountCanal()
    const nav = screen.getByRole('navigation', { name: 'Seções do canal' })
    await userEvent.setup().click(within(nav).getByRole('link', { name: /^Trocas/ }))
    expect(document.querySelector('ul.ct-list')).not.toBeNull()
    act(() => { window.history.replaceState(null, '', URL0 + '?fmt=shorts'); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(document.querySelector('ul.ct-list')).toBeNull()
    expect(document.querySelector('.cv-ctl')).not.toBeNull()
    expect(screen.getByRole('button', { name: /^Shorts, / }).getAttribute('aria-pressed')).toBe('true')
    act(() => { window.history.replaceState(null, '', URL0 + '?tab=trocas'); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(document.querySelector('ul.ct-list')).not.toBeNull()
  })

  describe('rolagem ao trocar de aba', () => {
    const rolar = vi.fn()
    const alvos = () => rolar.mock.contexts as Element[]
    const reduzir = (on: boolean) => {
      window.matchMedia = vi.fn().mockImplementation((q: string) => ({ matches: on && q.includes('prefers-reduced-motion: reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia
    }
    beforeEach(() => { rolar.mockReset(); Element.prototype.scrollIntoView = rolar; reduzir(false) })
    afterEach(() => { delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView })

    it('a primeira montagem não rola, nem na aba Vídeos nem na aba Trocas aberta pela URL', () => {
      mountCanal(); cleanup()
      comTroca()
      expect(rolar).not.toHaveBeenCalled()
    })

    it('clicar numa aba rola até o título da aba nova, com o topo do título no topo (o scroll-margin cuida da barra presa)', async () => {
      mountCanal()
      const nav = screen.getByRole('navigation', { name: 'Seções do canal' })
      const user = userEvent.setup()
      await user.click(within(nav).getByRole('link', { name: /^Trocas/ }))
      expect(rolar).toHaveBeenCalledTimes(1)
      expect(alvos()[0]).toBe(document.getElementById('ct-h2'))
      expect(rolar).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
      await user.click(within(nav).getByRole('link', { name: /^Vídeos/ }))
      expect(rolar).toHaveBeenCalledTimes(2)
      expect(alvos()[1]).toBe(document.getElementById('cv-h2'))
    })

    it('"Ver trocas" de um cartão rola até o título da aba Trocas, para a linha "Só as trocas de…" aparecer', async () => {
      const { all } = mountCanal()
      const v = all.find(x => x.swaps > 0)!
      const user = userEvent.setup()
      await user.click(within(document.getElementById('cv-lnk-' + v.id)!.closest('li')!).getByRole('button', { name: /^Ações do vídeo: / }))
      await user.click(await screen.findByRole('menuitem', { name: /^Ver trocas/ }))
      expect(rolar).toHaveBeenCalledTimes(1)
      expect(alvos()[0]).toBe(document.getElementById('ct-h2'))
    })

    it('o Voltar do navegador (popstate) também rola até o título da aba, mas não mexe no foco', () => {
      mountCanal()
      const antes = document.activeElement
      act(() => { window.history.replaceState(null, '', URL0 + '?tab=trocas'); window.dispatchEvent(new PopStateEvent('popstate')) })
      expect(rolar).toHaveBeenCalledTimes(1)
      expect(alvos()[0]).toBe(document.getElementById('ct-h2'))
      expect(document.activeElement).toBe(antes)
    })

    it('mudar só filtro ou busca (mesma aba) não rola', async () => {
      mountCanal()
      await userEvent.setup().click(screen.getByRole('button', { name: /^Shorts, / }))
      expect(rolar).not.toHaveBeenCalled()
    })

    it('com prefers-reduced-motion: reduce a rolagem é instantânea', async () => {
      reduzir(true)
      mountCanal()
      await userEvent.setup().click(within(screen.getByRole('navigation', { name: 'Seções do canal' })).getByRole('link', { name: /^Trocas/ }))
      expect(rolar).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' })
    })
  })

  it('--obs-sticky-h: ida e volta Vídeos → Trocas → Vídeos remove a variável ao sair e a reescreve, medindo a barra nova, ao voltar', async () => {
    const observers: Array<{ cb: () => void; el: Element | null; off: boolean }> = []
    vi.stubGlobal('ResizeObserver', class {
      o = { cb: () => {}, el: null as Element | null, off: false }
      constructor(cb: () => void) { this.o.cb = cb; observers.push(this.o) }
      observe(el: Element) { this.o.el = el } disconnect() { this.o.off = true } unobserve() {}
    })
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia
    try {
      const alturas = new Map<Element, number>()
      const real = Element.prototype.getBoundingClientRect
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        return this.classList.contains('cv-ctl') ? ({ height: alturas.get(this) ?? 40 } as DOMRect) : real.call(this)
      })
      mountCanal()
      const raiz = document.querySelector<HTMLElement>('[data-obs-screen="canal"]')!
      const barra1 = document.querySelector('.cv-ctl')!
      alturas.set(barra1, 50)
      act(() => { observers.filter(o => !o.off).forEach(o => o.cb()) })
      expect(raiz.style.getPropertyValue('--obs-sticky-h')).toBe('50px')

      const nav = screen.getByRole('navigation', { name: 'Seções do canal' })
      const user = userEvent.setup()
      await user.click(within(nav).getByRole('link', { name: /^Trocas/ }))
      expect(document.querySelector('.cv-ctl')).toBeNull()
      expect(raiz.style.getPropertyValue('--obs-sticky-h')).toBe('')
      expect(observers.every(o => o.off)).toBe(true)

      await user.click(within(nav).getByRole('link', { name: /^Vídeos/ }))
      const barra2 = document.querySelector('.cv-ctl')!
      expect(barra2).not.toBe(barra1)                                  // elemento novo
      alturas.set(barra2, 64)
      act(() => { observers.filter(o => !o.off).forEach(o => o.cb()) })
      expect(observers.filter(o => !o.off).map(o => o.el)).toEqual([barra2])
      expect(raiz.style.getPropertyValue('--obs-sticky-h')).toBe('64px')
    } finally {
      // @ts-expect-error limpa o stub do jsdom
      delete window.matchMedia
    }
  })
})
