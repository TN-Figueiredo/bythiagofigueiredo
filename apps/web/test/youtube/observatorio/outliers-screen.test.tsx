// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildOutliersView } from '@/app/cms/(authed)/youtube/competitors/_outliers/view-model'
import { OutliersScreen } from '@/app/cms/(authed)/youtube/competitors/_outliers/outliers-screen'
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
  it('sort and format navigate; the forja slot is there and hidden (Task 35)', () => {
    const { container } = mount()
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar por' }), { target: { value: 'vpd' } })
    expect(push).toHaveBeenLastCalledWith(expect.stringContaining('sort=vpd'), { scroll: false })
    fireEvent.click(within(screen.getByRole('group', { name: 'Formato' })).getByRole('button', { name: 'Shorts' }))
    expect(push).toHaveBeenLastCalledWith(expect.stringContaining('fmt=short'), { scroll: false })
    const slot = container.querySelector('[data-forja-slot]') as HTMLElement
    expect(slot).not.toBeNull()
    expect(slot.hidden).toBe(true)
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
  it('the "i" opens the explanation of the multiplier; Esc hides it', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    const card = container.querySelectorAll('[data-outlier]:not(.obs-out-lead)')[0] as HTMLElement
    const info = within(card).getByRole('button', { name: /^Como o .+× é calculado$/ })
    const tip = document.getElementById(info.getAttribute('aria-describedby')!)!
    expect(tip.textContent).toMatch(/÷/)
    await user.click(info)
    expect(info.closest('.obs-out-mult')!.classList.contains('obs-out-open')).toBe(true)
    await user.keyboard('{Escape}')
    expect(info.closest('.obs-out-mult')!.classList.contains('obs-out-open')).toBe(false)
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
