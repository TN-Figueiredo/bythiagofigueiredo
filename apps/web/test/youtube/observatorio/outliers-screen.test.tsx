// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildOutliersView } from '@/app/cms/(authed)/youtube/competitors/_outliers/view-model'
import { OutliersScreen } from '@/app/cms/(authed)/youtube/competitors/_outliers/outliers-screen'
import { focoDeTeclado } from '@/app/cms/(authed)/youtube/competitors/_outliers/outlier-card'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { noJunkText, oneFilledButton, forbiddenVocabulary, brokenLinks, linkCountsMatch } from './audits'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/outliers',
  useSearchParams: () => new URLSearchParams(''),
}))

const obs = createObservatory(datasetFromOracle(loadOracle()))
const mount = (p: Record<string, string> = {}) => render(<OutliersScreen view={buildOutliersView(obs, p)} />)
const CSS = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/competitors/_outliers/outliers.css'), 'utf8')
const rule = (sel: string) => { const i = CSS.indexOf(sel + '{'); return i < 0 ? '' : CSS.slice(i, CSS.indexOf('}', i)) }

beforeEach(() => { push.mockReset() })
afterEach(() => { document.getElementById('flut')?.remove() })

describe('OutliersScreen', () => {
  it('passes the DOM audits on the default view and in the empty state', () => {
    for (const p of [{}, { age: '181-365', niche: 'ia', fmt: 'short' }, { formula: 'preco', min: '0' }, { age: '99-100', formula: 'nope' }]) {
      const { container, unmount } = mount(p)
      expect(noJunkText(container), JSON.stringify(p)).toEqual([])
      expect(oneFilledButton(container), JSON.stringify(p)).toEqual([])
      expect(forbiddenVocabulary(container), JSON.stringify(p)).toEqual([])
      expect(brokenLinks(container), JSON.stringify(p)).toEqual([])
      unmount()
    }
  })
  it('groups follow PHASES order and the default shows 11 outliers', () => {
    const { container } = mount()
    expect([...container.querySelectorAll('.obs-out-group h2')].map(h => h.textContent)).toEqual(['Estourando agora', 'Recentes', 'Sem ritmo medido'])
    expect(container.querySelectorAll('[data-outlier][data-weak="false"]')).toHaveLength(11)
    expect(container.querySelector('.obs-out-cnt')!.textContent).toBe('11 outliers entre 303 vídeos longos com até 90 dias; agrupados por fase.')
  })
  it('layout: each grid is a row group; the main card spans 2 columns with an anchored footer; cards stretch to the row', () => {
    const { container } = mount()
    const grids = [...container.querySelectorAll('[data-outlier-row]')]
    expect(grids.length).toBe(3)
    for (const g of grids) expect(g.classList.contains('obs-out-grid')).toBe(true)
    const lead = container.querySelector('[data-outlier].obs-out-lead')!
    expect(lead).not.toBeNull()
    expect(lead.parentElement!.firstElementChild).toBe(lead)
    expect(lead.lastElementChild!.classList.contains('obs-out-foot')).toBe(true)
    expect(lead.querySelector('.obs-out-foot .obs-out-meta')).not.toBeNull()
    for (const c of container.querySelectorAll('[data-outlier]:not(.obs-out-lead)')) expect(c.querySelector('.obs-out-body')!.lastElementChild!.classList.contains('obs-out-meta')).toBe(true)
    // the CSS rules behind the approval of 02/10
    expect(rule('.obs-out .obs-out-card.obs-out-lead')).toMatch(/grid-column:span 2/)
    expect(rule('.obs-out .obs-out-card.obs-out-lead')).toMatch(/grid-template-rows:1fr auto/)
    expect(rule('.obs-out .obs-out-card > .obs-out-foot')).toMatch(/margin-top:auto/)
    expect(rule('.obs-out .obs-out-card')).toMatch(/align-self:stretch/)
    expect(rule('.obs-out .obs-out-meta')).toMatch(/margin-top:auto/)
    expect(rule('.obs-out .obs-out-grid')).toMatch(/grid-template-columns:repeat\(auto-fill,minmax\(232px,1fr\)\)/)
  })
  it('the first card comes right after the controls, summary and first group header (above the fold)', () => {
    const { container } = mount()
    const first = container.querySelector('[data-outlier]')!
    const before = [...container.querySelectorAll('.obs-out-controls, .obs-out-sumbar, .obs-out-ghead')]
    expect(before).toHaveLength(1 + 1 + 3) // controls, summary bar, 3 group headers
    expect(before[1]!.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(first.compareDocumentPosition(before[3]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // nothing but the first group's header sits between the summary and the first card
    expect(first.closest('.obs-out-group')).toBe(container.querySelector('.obs-out-group'))
  })
  it('the age windows: "Até 90 dias" pressed by default; a window click navigates to its href', async () => {
    const user = userEvent.setup()
    const v = buildOutliersView(obs, {})
    mount()
    const tl = screen.getByRole('group', { name: 'Idade do vídeo (faixas combináveis)' })
    expect(within(tl).getByRole('button', { name: /^Atalho até 90 dias/ }).getAttribute('aria-pressed')).toBe('true')
    expect(within(tl).getAllByRole('button').filter(b => b.getAttribute('aria-pressed') === 'true')).toHaveLength(3)
    await user.click(within(tl).getByRole('button', { name: /^91–180 d/ }))
    expect(push).toHaveBeenCalledWith(v.timeline.find(t => t.id === '91-180')!.href, { scroll: false })
  })
  it('sort and format navigate; the forja bar fills its slot (Task 35)', () => {
    const { container } = mount()
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar por' }), { target: { value: 'vpd' } })
    expect(push).toHaveBeenLastCalledWith(expect.stringContaining('sort=vpd'), { scroll: false })
    fireEvent.click(within(screen.getByRole('group', { name: 'Formato' })).getByRole('button', { name: 'Shorts' }))
    expect(push).toHaveBeenLastCalledWith(expect.stringContaining('fmt=short'), { scroll: false })
    const slot = container.querySelector('[data-forja-slot]') as HTMLElement
    expect(slot).not.toBeNull()
    expect(slot.hidden).toBe(false)
    // collapsed line: the readings' dates, then "Desde então" on its own line (no final period)
    const bar = slot.querySelector('#forjabar')!
    expect(bar.querySelector('summary')!.textContent).toMatch(/Leituras da forja: IA 20\/10, Viagem 20\/10/)
    bar.querySelectorAll('[data-fsince], .obs-out-fsince').forEach(x => expect(x.textContent!.trim().endsWith('.')).toBe(false))
    // under each seal only the literal reading text
    const P = obs.forja.byId['padroes-titulo-ia-20-10']!
    const sealed = bar.querySelector('[data-reading="padroes-titulo-ia-20-10"] [data-sealed]')!
    expect([...sealed.querySelectorAll('[data-lit]')].map(x => x.textContent)).toEqual([P.text.title, P.text.lead, ...P.text.items, ...(P.text.theme ? [P.text.theme] : [])])
  })
  it('invalid params are dashed removable chips', () => {
    mount({ age: '99-100', formula: 'nope' })
    const chips = screen.getByRole('group', { name: 'Filtros vindos do link' })
    const bad = [...chips.querySelectorAll('[data-invalid]')]
    expect(bad.map(b => b.getAttribute('data-chip')).sort()).toEqual(['age', 'formula'])
    for (const b of bad) {
      expect(b.classList.contains('obs-out-bad')).toBe(true)
      const x = within(b as HTMLElement).getByRole('link', { name: /^Dispensar aviso do filtro/ })
      expect(x.getAttribute('href')).toMatch(/^\/cms\/youtube\/competitors\/outliers/)
    }
  })
  it('every empty-state button shows the N its destination counts', () => {
    const p = { age: '181-365', niche: 'ia', fmt: 'short' }
    const { container } = mount(p)
    const empty = container.querySelector('.obs-out-empty')!
    const links = [...empty.querySelectorAll('[data-link-n]')]
    expect(links.length).toBeGreaterThan(0)
    const counts: Record<string, number> = {}
    for (const a of links) {
      const key = a.getAttribute('data-link-key')!, href = key.slice(key.indexOf(':') + 1)
      const dest = { niche: p.niche, ...Object.fromEntries(new URLSearchParams(href.split('?')[1] ?? '')) }
      counts[key] = key.startsWith('outliers:') ? buildOutliersView(obs, dest).count : Number(a.getAttribute('data-link-n'))
      const n = a.getAttribute('data-link-n')!
      // N = 1 is said by the label itself ("Ver <canal> em Canais", "Ver o outlier"), CONVENCOES plural rule
      if (n === '1' && !/\(1\)/.test(a.textContent!)) expect(a.textContent).toMatch(/^Ver (o |.+ em Canais$)/)
      else expect(a.textContent).toMatch(new RegExp('\\(' + n + '\\)|Ver ' + n + ' '))
    }
    expect(linkCountsMatch(container, counts)).toEqual([])
    expect(empty.querySelectorAll('.btn-primary').length).toBeLessThanOrEqual(1)
  })
  it('the "i" opens the explanation of the multiplier in #flut; Esc hides it', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    const card = container.querySelectorAll('[data-outlier]:not(.obs-out-lead)')[0] as HTMLElement
    const info = within(card).getByRole('button', { name: /^Como o .+× é calculado$/ })
    expect(info.getAttribute('aria-describedby')).toBeNull() // the box is not rendered: nothing to describe
    await user.click(info)
    const tip = document.getElementById(info.getAttribute('aria-describedby')!)!
    expect(tip.closest('#flut')).not.toBeNull()
    expect(tip.textContent).toMatch(/÷/)
    expect(info.getAttribute('aria-expanded')).toBe('true')
    await user.keyboard('{Escape}')
    expect(info.getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('#flut .obs-out-tip')).toBeNull()
  })
  it('the main card explains the base in the open (no tooltip) and links to the history and YouTube', () => {
    const { container } = mount()
    const lead = container.querySelector('.obs-out-lead') as HTMLElement
    expect(lead.querySelector('.obs-out-info')).toBeNull()
    expect(lead.querySelector('.obs-out-why')!.textContent).toMatch(/views de \d\d\/\d\d \d\d:\d\d ÷ .+ sem contar este\. Método: /)
    expect(within(lead).getByRole('link', { name: /^Ver histórico do vídeo: / }).getAttribute('href')).toMatch(/^\/cms\/youtube\/competitors\/video\/.+from=outliers/)
    expect(within(lead).getByRole('link', { name: /^Abrir no YouTube: / }).getAttribute('target')).toBe('_blank')
  })
  it('channels with a sync problem: one line, the rest behind a toggle', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    const probs = container.querySelector('[data-probs]') as HTMLElement
    expect(probs.textContent).toMatch(/podem faltar\./)
    const btn = within(probs).getByRole('button')
    await user.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(probs.textContent).toMatch(/Ocultar/)
  })
  it('a channel of another niche: the screen says which niche it shows and that the saved one did not change', async () => {
    const iaCh = obs.channels.find(c => !c.own && c.niche === 'ia')!
    render(<ToastProvider><OutliersScreen view={buildOutliersView(obs, { niche: 'viagem', channel: iaCh.id })} /></ToastProvider>)
    expect(await screen.findByText('Mostrando IA para exibir este canal')).toBeTruthy()
    expect(screen.getByText('Seu nicho salvo não mudou.')).toBeTruthy()
  })
  it('the cards have no swipe button (follow-up FU-2)', () => {
    const { container } = mount()
    expect(container.querySelector('[data-save]')).toBeNull()
  })
  it('every interactive element has an accessible name', () => {
    const { container } = mount({ formula: 'preco', min: '0', age: 'zzz' })
    for (const el of container.querySelectorAll('a, button, select')) {
      const name = el.getAttribute('aria-label') ?? el.textContent?.trim()
      expect(name, el.outerHTML.slice(0, 120)).toBeTruthy()
    }
  })
})

describe('Outliers · flutuantes na camada única (A0.1)', () => {
  const info = (container: HTMLElement) => container.querySelector<HTMLButtonElement>('.obs-out-info')!
  // jsdom answers `:focus-visible` as true for any focus(), so the test says which kind of focus it is (keyboard vs mouse/window)
  const focar = (el: HTMLElement, teclado: boolean) => {
    const orig = el.matches.bind(el)
    el.matches = (sel: string) => sel === ':focus-visible' ? teclado : orig(sel)
    fireEvent.focus(el)
  }
  const dica = () => document.querySelector('#flut .obs-out-tip, #flut .obs-out-ibtip')
  it('focoDeTeclado: segue o :focus-visible e, se o navegador não conhece o seletor, mantém a dica alcançável', () => {
    const el = document.createElement('button')
    el.matches = () => true
    expect(focoDeTeclado(el)).toBe(true)
    el.matches = () => false
    expect(focoDeTeclado(el)).toBe(false)
    el.matches = () => { throw new SyntaxError('not a valid selector') }
    expect(focoDeTeclado(el)).toBe(true)
  })
  it('o ⓘ do múltiplo abre a conta em #flut por clique e fecha com Esc, com o foco de volta', () => {
    const { container } = mount()
    const btn = info(container)
    expect(container.querySelector('.obs-out-tip')).toBeNull()
    fireEvent.click(btn)
    const tip = document.querySelector('#flut .obs-out-tip')!
    expect(tip.closest('.obs-out-card, td')).toBeNull()
    expect(tip.getAttribute('role')).toBe('tooltip')
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(btn.getAttribute('aria-describedby')).toBe(tip.id)
    fireEvent.keyDown(btn, { key: 'Escape' })
    expect(document.querySelector('#flut .obs-out-tip')).toBeNull()
    expect(document.activeElement).toBe(btn)
  })
  it('depois do Esc a conta não volta como dica enquanto o mouse e o foco ficam no ⓘ', () => {
    const { container } = mount()
    const btn = info(container)
    fireEvent.mouseEnter(btn)
    fireEvent.click(btn)
    expect(document.querySelector('#flut .obs-out-tip.obs-fl-pop')).not.toBeNull()
    fireEvent.keyDown(btn, { key: 'Escape' })
    expect(document.querySelector('#flut .obs-out-tip')).toBeNull()
    fireEvent.mouseLeave(btn)
    fireEvent.mouseEnter(btn)
    expect(document.querySelector('#flut .obs-out-tip.obs-fl-tip')).not.toBeNull()
  })
  it('passar o mouse no ⓘ mostra a mesma conta, sem abrir popover', () => {
    const { container } = mount()
    const btn = info(container)
    fireEvent.mouseEnter(btn)
    const tip = document.querySelector('#flut .obs-out-tip.obs-fl-tip')!
    expect(tip).not.toBeNull()
    expect(btn.getAttribute('aria-describedby')).toBe(tip.id)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.mouseLeave(btn)
    expect(document.querySelector('#flut .obs-out-tip')).toBeNull()
    expect(btn.getAttribute('aria-describedby')).toBeNull()
  })
  it('sair com o mouse não esconde a conta de um ⓘ que ainda tem o foco', () => {
    const { container } = mount()
    const btn = info(container)
    fireEvent.mouseEnter(btn)
    focar(btn, true)
    fireEvent.mouseLeave(btn)
    expect(document.querySelector('#flut .obs-out-tip')).not.toBeNull()
    fireEvent.blur(btn)
    expect(document.querySelector('#flut .obs-out-tip')).toBeNull()
  })
  it('a dica do ícone "Ver histórico do vídeo" abre em #flut no foco e some ao sair', () => {
    const { container } = mount()
    const a = container.querySelector<HTMLAnchorElement>('a.obs-out-ib[data-hist]')!
    expect(a.hasAttribute('data-tip')).toBe(false)
    focar(a, true)
    expect(document.querySelector('#flut .obs-out-ibtip')!.textContent).toBe('Ver histórico do vídeo')
    fireEvent.blur(a)
    expect(document.querySelector('#flut .obs-out-ibtip')).toBeNull()
  })
  it('a dica do ícone aceita mouse e foco separados e vale para "Abrir no YouTube"', () => {
    const { container } = mount()
    const a = container.querySelector<HTMLAnchorElement>('a.obs-out-ib[data-yt]')!
    fireEvent.mouseEnter(a)
    focar(a, true)
    fireEvent.mouseLeave(a)
    expect(document.querySelector('#flut .obs-out-ibtip')!.textContent).toBe('Abrir no YouTube')
    fireEvent.blur(a)
    expect(document.querySelector('#flut .obs-out-ibtip')).toBeNull()
  })
  it('Esc esconde a dica do ícone (foco ou mouse); o mouse que entra de novo a mostra', () => {
    const { container } = mount()
    const a = container.querySelector<HTMLAnchorElement>('a.obs-out-ib[data-yt]')!
    focar(a, true)
    expect(document.querySelector('#flut .obs-out-ibtip')).not.toBeNull()
    fireEvent.keyDown(a, { key: 'Escape' })
    expect(document.querySelector('#flut .obs-out-ibtip')).toBeNull()
    // the mouse still over the icon does not bring it back; leaving and entering again does
    fireEvent.mouseEnter(a)
    expect(document.querySelector('#flut .obs-out-ibtip')).not.toBeNull()
    fireEvent.keyDown(a, { key: 'Escape' })
    expect(document.querySelector('#flut .obs-out-ibtip')).toBeNull()
  })
  it('foco de teclado no ⓘ mostra a conta; foco de mouse (clique) não', () => {
    const { container } = mount()
    const btn = info(container)
    focar(btn, false)
    expect(dica()).toBeNull()
    expect(btn.getAttribute('aria-describedby')).toBeNull()
    fireEvent.blur(btn)
    focar(btn, true)
    expect(dica()).not.toBeNull()
    expect(btn.getAttribute('aria-describedby')).toBe(dica()!.id)
  })
  it('foco de mouse no ícone do vídeo não mostra a dica; o de teclado mostra', () => {
    const { container } = mount()
    const a = container.querySelector<HTMLAnchorElement>('a.obs-out-ib[data-yt]')!
    focar(a, false)
    expect(dica()).toBeNull()
    fireEvent.blur(a)
    focar(a, true)
    expect(dica()!.textContent).toBe('Abrir no YouTube')
  })
  it('clicar no ⓘ para abrir e de novo para fechar, e tirar o mouse: a conta não fica presa', () => {
    const { container } = mount()
    const btn = info(container)
    fireEvent.mouseEnter(btn)
    focar(btn, false) // the mouse down focuses the button, but it is not a keyboard focus
    fireEvent.click(btn)
    expect(document.querySelector('#flut .obs-out-tip.obs-fl-pop')).not.toBeNull()
    fireEvent.click(btn)
    expect(document.querySelector('#flut .obs-out-tip.obs-fl-pop')).toBeNull()
    fireEvent.mouseLeave(btn)
    expect(dica()).toBeNull()
  })
  it('clicar em "Abrir no YouTube" e a janela devolver o foco ao link: a dica não reaparece sem mouse', () => {
    const { container } = mount()
    const a = container.querySelector<HTMLAnchorElement>('a.obs-out-ib[data-yt]')!
    fireEvent.mouseEnter(a)
    focar(a, false)
    fireEvent.click(a)
    fireEvent.mouseLeave(a)
    fireEvent.blur(a) // the tab opened in the background takes the focus
    expect(dica()).toBeNull()
    focar(a, false) // coming back, the window re-focuses the link
    expect(dica()).toBeNull()
  })
  it('as regras das caixas têm duas classes (vencem a base #flut .obs-fl-* por especificidade, não por ordem)', () => {
    expect(CSS).toMatch(/#flut \.obs-fl-pop\.obs-out-tip,#flut \.obs-fl-tip\.obs-out-tip\{/)
    expect(CSS).toMatch(/#flut \.obs-fl-tip\.obs-out-ibtip\{/)
    expect(CSS).toMatch(/\[data-theme="light"\] #flut \.obs-fl-pop\.obs-out-tip/)
    expect(CSS).not.toMatch(/(^|\n)#flut \.obs-out-(tip|ibtip)\{/)
  })
})
