// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildChromeView, syncResultToast } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'
import { ObservatoryChrome } from '@/app/cms/(authed)/youtube/competitors/_chrome/observatory-chrome'
import { noJunkText, oneFilledButton, forbiddenVocabulary, brokenLinks } from './audits'

const replace = vi.fn(), refresh = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(search),
}))

const obs = createObservatory(datasetFromOracle(loadOracle()))
const view = (niche: 'todos' | 'viagem' | 'ia' = 'todos', tab: 'canais' | 'mudancas' | 'outliers' | 'insights' = 'canais') => buildChromeView(obs, { tab, niche })

function mount(props: Partial<Parameters<typeof ObservatoryChrome>[0]> = {}) {
  return render(<ObservatoryChrome view={view()} {...props}><div data-obs-screen="x">tela</div></ObservatoryChrome>)
}

beforeEach(() => { replace.mockReset(); refresh.mockReset(); search = '' })

describe('ObservatoryChrome', () => {
  it('passes the DOM audits; the header has no filled button', () => {
    const { container } = mount()
    expect(noJunkText(container)).toEqual([])
    expect(oneFilledButton(container)).toEqual([])
    expect(forbiddenVocabulary(container)).toEqual([])
    expect(brokenLinks(container)).toEqual([])
    const chrome = container.querySelector('[data-obs-chrome]')!
    expect(chrome.querySelectorAll('.obs-ch-forja-solid,.btn-primary,.btn-forja-solid')).toHaveLength(0)
  })
  it('every interactive element has an accessible name', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.click(screen.getByRole('button', { name: /Frescor dos dados/ }))
    const els = container.querySelectorAll('[data-obs-chrome] :is(button, a[href], [role="menuitem"], [tabindex="0"])')
    expect(els.length).toBeGreaterThan(8)
    els.forEach(el => expect(el).toHaveAccessibleName(/\S/))
  })
  it('the screen is outside the chrome block, which is the size container (fixed layers of a screen resolve against the viewport)', () => {
    const { container } = mount()
    const chrome = container.querySelector('[data-obs-chrome]')!, scr = container.querySelector('.obs-ch-screen')!
    expect(chrome.contains(scr)).toBe(false)
    expect(scr.parentElement).toBe(chrome.parentElement)
    expect(chrome.parentElement).toHaveClass('obs-ch-content')
    // the toasts are fixed too: they sit beside the content, never inside it
    expect(container.querySelector('.obs-ch-content .obs-ch-toasts')).toBeNull()
  })
  it('renders the screen below the tabs inside the screen container', () => {
    const { container } = mount()
    const scr = container.querySelector('.obs-ch-screen > [data-obs-screen="x"]')
    expect(scr).not.toBeNull()
  })
  it('tabs are links with counts, title= and aria-current on the current one', () => {
    render(<ObservatoryChrome view={view('ia', 'mudancas')}><div /></ObservatoryChrome>)
    const nav = screen.getByRole('navigation', { name: 'Seções do Observatório' })
    const links = within(nav).getAllByRole('link')
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/cms/youtube/competitors', '/cms/youtube/competitors/mudancas', '/cms/youtube/competitors/outliers', '/cms/youtube/competitors/insights'])
    expect(links[1]).toHaveAttribute('aria-current', 'page')
    expect(links[0]).not.toHaveAttribute('aria-current')
    expect(links[1]!.querySelector('[data-count="mudancas"]')!.textContent).toBe('10')
    expect(links[3]!.querySelector('[data-count]')).toBeNull()
    expect(links[0]).toHaveAttribute('title', '6 canais monitorados')
  })
  it('declares "Horários em São Paulo" and the engine sync text', () => {
    mount()
    expect(screen.getAllByText('Horários em São Paulo').length).toBeGreaterThan(0)
    expect(screen.getByText('sincronizado há 3 h')).toBeInTheDocument()
  })
  it('menu ⋯ opens with Enter, closes with Esc and gives the focus back', async () => {
    const user = userEvent.setup()
    mount()
    const btn = screen.getByRole('button', { name: 'Mais ações' })
    btn.focus()
    await user.keyboard('{Enter}')
    const menu = screen.getByRole('menu', { name: 'Mais ações' })
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    const items = within(menu).getAllByRole('menuitem')
    expect(items.map(i => i.getAttribute('aria-label') ?? i.textContent)).toEqual(['Copiar pedido para o Cowork', expect.stringContaining('Definir nicho dos canais')])
    expect(document.activeElement).toBe(items[0])
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(items[1])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })
  it('freshness popover lists problems first and closes with Esc', async () => {
    const user = userEvent.setup()
    mount()
    const fb = screen.getByRole('button', { name: /Frescor dos dados/ })
    await user.click(fb)
    const pop = screen.getByRole('dialog', { name: 'Frescor por canal' })
    expect(within(pop).getByText(/^Com problema \(/)).toBeInTheDocument()
    const p = view().fresh.problems[0]!
    expect(within(pop).getByText(p.phrase)).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(fb)
  })
  it('niche bar persists via the action and puts ?niche= in the URL', async () => {
    const user = userEvent.setup()
    const onSetNiche = vi.fn(async () => ({ ok: true }))
    mount({ onSetNiche })
    const group = screen.getByRole('group', { name: 'Nicho' })
    const via = within(group).getByRole('button', { name: /Viagem/ })
    expect(within(group).getByRole('button', { name: /Todos/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(via)
    expect(onSetNiche).toHaveBeenCalledWith('viagem')
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?niche=viagem', { scroll: false }))
  })
  it('a niche that could not be saved says so (warn) and still changes the view', async () => {
    const user = userEvent.setup()
    mount({ onSetNiche: vi.fn(async () => ({ ok: false })) })
    await user.click(within(screen.getByRole('group', { name: 'Nicho' })).getByRole('button', { name: /IA/ }))
    expect(await screen.findByText('Não deu para salvar o nicho')).toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?niche=ia', { scroll: false })
  })
  it('an invalid ?niche= is removed with router.replace', async () => {
    search = 'niche=xpto&add=1'
    mount({ dropNicheParam: true })
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?add=1', { scroll: false }))
  })
  it('"Sincronizar concorrentes" shows the action result, warn when there are problems', async () => {
    const user = userEvent.setup()
    const names = (id: string) => id
    const run = { ok: ['a'], problems: [{ id: 'b', label: 'erro' }], outOfRound: [{ id: 'c', label: 'buscando vídeos' }] }
    const t = syncResultToast(run, names)
    const onSyncNow = vi.fn(async () => ({ ok: true, text: t.text, problems: run.problems, outOfRound: run.outOfRound, toast: t }))
    mount({ onSyncNow })
    await user.click(screen.getByRole('button', { name: 'Sincronizar concorrentes' }))
    expect(onSyncNow).toHaveBeenCalledTimes(1)
    const queued = obs.channels.filter(c => !c.own && c.sync.state === 'ok').length
    expect(screen.getByText(`${queued} canais na fila de sincronização.`)).toBeInTheDocument()
    expect(await screen.findByText('1 de 2 canais sincronizados agora; 1 com problema')).toBeInTheDocument()
    expect(screen.getByText('Fora da rodada: c (buscando vídeos).')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Avisos' }).querySelector('.obs-ch-toast.obs-ch-warn')).not.toBeNull()
    expect(refresh).toHaveBeenCalled()
  })
  it('copy failure shows the request text selectable', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => { throw new Error('denied') }) } })
    mount()
    await user.click(screen.getByRole('button', { name: 'Mais ações' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copiar pedido para o Cowork' }))
    expect(await screen.findByText('Não deu para copiar')).toBeInTheDocument()
    const ta = screen.getByRole('textbox', { name: 'Texto do pedido para copiar' }) as HTMLTextAreaElement
    expect(ta.value).toBe(view().cowork)
    expect(ta).toHaveAttribute('readonly')
  })
  it('copy success says "cole no Cowork com ⌘V"', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    mount()
    await user.click(screen.getByRole('button', { name: 'Mais ações' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copiar pedido para o Cowork' }))
    expect(await screen.findByText('Pedido copiado para o Cowork')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(view().cowork)
    expect(screen.getByText('Cole no Cowork com ⌘V.')).toBeInTheDocument()
  })
})
