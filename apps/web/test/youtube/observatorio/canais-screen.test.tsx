// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen, type CanaisScreenProps } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { noJunkText, oneFilledButton, linkCountsMatch, forbiddenVocabulary, brokenLinks } from './audits'

const replace = vi.fn(), refresh = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(search),
}))

const obs = createObservatory(datasetFromOracle(loadOracle()))
const view = (p: Partial<CanaisParams> = {}) => buildCanaisView(obs, { niche: 'todos', limit: 75, ...p })
const ok = async () => ({ ok: true })
function mount(props: Partial<CanaisScreenProps> = {}, p: Partial<CanaisParams> = {}, running = false) {
  // the screen lives inside the chrome, which owns the toasts
  return render(<ToastProvider><ChromeSyncContext.Provider value={{ running }}><div data-obs=""><div data-obs-chrome=""><button type="button" aria-label="Mais ações">⋯</button></div><CanaisScreen view={view(p)} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSyncOne={ok} {...props} /></div></ChromeSyncContext.Provider></ToastProvider>)
}
/** Every "Ver os N…" link must say the count its destination shows. */
function destCounts() {
  const c: Record<string, number> = {}
  for (const ch of obs.channels) {
    c[`changes:${ch.id}`] = obs.changesIn({ channel: ch.id }).length
    for (const f of ['long', 'short'] as const) c[`outliers:${ch.id}:${f}`] = obs.outliers({ channel: ch.id, fmt: f, includeOwn: ch.own }).count
  }
  return c
}

/** The counter, as read (numbers in mono spans, joined by no-break spaces; the tooltip excluded). */
const quota = () => [...document.querySelector('.quota')!.childNodes].filter(n => !(n instanceof Element && n.classList.contains('tip'))).map(n => n.textContent).join('').replace(/\u00a0/g, ' ').trim()

beforeEach(() => { replace.mockReset(); refresh.mockReset(); search = '' })

describe('CanaisScreen', () => {
  it('passes the DOM audits; the only filled button is "Adicionar canal"', () => {
    const { container } = mount()
    expect(noJunkText(container)).toEqual([])
    expect(oneFilledButton(container)).toEqual([])
    expect(forbiddenVocabulary(container)).toEqual([])
    expect(brokenLinks(container)).toEqual([])
    const filled = container.querySelectorAll('.btn-primary')
    expect(filled).toHaveLength(1)
    expect(filled[0]!.textContent).toBe('Adicionar canal')
    expect(quota()).toBe('14 de 75 canais')
  })
  it('every drawer passes the audits and link counts match their destinations, on every tab', async () => {
    const user = userEvent.setup()
    for (const id of ['matt-wolfe', 'luke-damant', 'nomade-raiz', 'vou-sem-volta', 'esq-unltd-daily', 'bald-and-bankrupt', 'tnfigueiredo']) {
      const { container, unmount } = mount({}, { channel: id })
      const d = screen.getByRole('dialog', { name: obs.channel(id)!.name })
      for (const t of ['Trocas', 'Outliers', 'Vídeos']) {
        await user.click(within(d).getByRole('tab', { name: new RegExp('^' + t) }))
        expect(noJunkText(container)).toEqual([])
        expect(forbiddenVocabulary(container)).toEqual([])
        expect(linkCountsMatch(container, destCounts())).toEqual([])
        expect(brokenLinks(container)).toEqual([])
      }
      unmount()
    }
  })
  it('the stalled channel says "até o registro diário de DD/MM HH:MM"', () => {
    mount({}, { channel: 'bald-and-bankrupt' })
    expect(screen.getAllByText(/até o registro diário de \d\d\/\d\d \d\d:\d\d/).length).toBeGreaterThan(0)
  })
  it('full: "Adicionar canal" is disabled with the sentence of canais.html', async () => {
    const user = userEvent.setup()
    mount({}, { limit: 14 })
    expect(quota()).toBe('14 de 14 canais')
    const add = screen.getByText('Adicionar canal').closest('a')!
    expect(add).toHaveAttribute('aria-disabled', 'true')
    expect(add).not.toHaveAttribute('href')
    expect(add).toHaveAttribute('title', 'Sem vagas: 14 de 14 concorrentes. Remova um canal para adicionar outro.')
    await user.click(add)
    expect(await screen.findByText('Sem vagas: 14 de 14 concorrentes. Remova um canal para adicionar outro.', { selector: '.obs-ch-toast b' })).toBeInTheDocument()
  })
  it('admin "+25" only for admins and only near the limit', async () => {
    const user = userEvent.setup()
    const onUnlock = vi.fn(async () => ({ ok: true }))
    const { unmount } = mount({ canUnlock: true, onUnlock }, { limit: 16 })
    await user.click(screen.getByRole('button', { name: 'Destravar mais 25 vagas' }))
    expect(onUnlock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    unmount()
    const r2 = mount({ canUnlock: false }, { limit: 16 })
    expect(screen.queryByRole('button', { name: 'Destravar mais 25 vagas' })).toBeNull()
    r2.unmount()
    mount({ canUnlock: true }, { limit: 75 })
    expect(screen.queryByRole('button', { name: 'Destravar mais 25 vagas' })).toBeNull()
  })
  it('?add=1 opens the form; invalid input and a duplicate (with the niche) are rejected', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn(async () => ({ ok: false, error: 'Matt Wolfe já está no observatório (IA).' }))
    mount({ onAdd }, { add: '1' })
    const dlg = screen.getByRole('dialog', { name: 'Adicionar canal' })
    const input = within(dlg).getByLabelText('Canal do YouTube')
    expect(document.activeElement).toBe(input)
    await user.type(input, 'xx')
    await user.click(within(dlg).getByRole('button', { name: 'Adicionar canal' }))
    expect(within(dlg).getByText('Use o @handle (ex.: @LukeDamant) ou a URL do canal (youtube.com/@…).')).toBeInTheDocument()
    expect(onAdd).not.toHaveBeenCalled()
    await user.clear(input)
    await user.type(input, '@MattWolfe')
    await user.click(within(dlg).getByRole('button', { name: 'Adicionar canal' }))
    expect(onAdd).toHaveBeenCalledWith({ channel: '@MattWolfe', niche: 'viagem', videoLimit: 50 })
    expect(await within(dlg).findByText('Matt Wolfe já está no observatório (IA).')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Adicionar canal' })).toBeNull()
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors', { scroll: false })
  })
  it('?filter=problemas lists only channels in trouble and offers "Mostrar todos"', () => {
    mount({}, { filter: 'problemas' })
    const rows = [...document.querySelectorAll('tr.obs-cn-row')].map(r => r.getAttribute('data-id'))
    expect(rows).toEqual(expect.arrayContaining(['paddy-doyle', 'vou-sem-volta', 'esq-unltd-daily']))
    expect(rows).not.toContain('matt-wolfe')
    expect(screen.getByRole('link', { name: 'Mostrar todos' })).toHaveAttribute('href', '/cms/youtube/competitors')
  })
  it('drawer (below 1280 px = modal): Esc closes it and returns the focus to the row button', async () => {
    const user = userEvent.setup()
    mount({}, { channel: 'matt-wolfe' })
    const d = screen.getByRole('dialog', { name: 'Matt Wolfe' })
    expect(d).toHaveAttribute('aria-modal', 'true')
    expect(document.activeElement).toBe(within(d).getByRole('button', { name: 'Fechar detalhes do canal' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Matt Wolfe' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir detalhes de Matt Wolfe' }))
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors', { scroll: false })
  })
  it('drawer focus trap and tab keys', async () => {
    const user = userEvent.setup()
    mount({}, { channel: 'matt-wolfe' })
    const d = screen.getByRole('dialog', { name: 'Matt Wolfe' })
    const tabs = within(d).getAllByRole('tab')
    tabs[0]!.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(tabs[1])
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    // Tab from the last focusable wraps to the first
    const f = [...d.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],select,input,[tabindex="0"]')].filter(x => !x.closest('[hidden]'))
    f[f.length - 1]!.focus()
    await user.tab()
    expect(document.activeElement).toBe(f[0])
  })
  it('opening a row puts ?channel= in the URL', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Abrir detalhes de Luke Damant' }))
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?channel=luke-damant', { scroll: false })
  })
  it('removing asks first with the texts of canais.html, then calls the action', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn(async () => ({ ok: true }))
    mount({ onRemove })
    await user.click(screen.getByRole('button', { name: 'Mais ações para Luke Damant' }))
    await user.click(screen.getByRole('menuitem', { name: 'Remover canal…' }))
    const dlg = screen.getByRole('dialog', { name: 'Remover Luke Damant?' })
    expect(within(dlg).getByText('Não dá para desfazer. Se adicionar de novo, a coleta recomeça do zero.')).toBeInTheDocument()
    await user.click(within(dlg).getByRole('button', { name: 'Remover canal' }))
    expect(onRemove).toHaveBeenCalledWith('luke-damant')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
  it('changing a niche calls the action', async () => {
    const user = userEvent.setup()
    const onSetNiche = vi.fn(async () => ({ ok: true }))
    mount({ onSetNiche })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nicho de Luke Damant' }), 'ia')
    expect(onSetNiche).toHaveBeenCalledWith('luke-damant', 'ia')
  })
  it('"Sincronizar só este canal" shows the in-progress state, then the result', async () => {
    const user = userEvent.setup()
    let done: (v: { ok: boolean }) => void = () => {}
    const onSyncOne = vi.fn(() => new Promise<{ ok: boolean }>(r => { done = r }))
    mount({ onSyncOne })
    await user.click(screen.getByRole('button', { name: 'Mais ações para Luke Damant' }))
    await user.click(screen.getByRole('menuitem', { name: 'Sincronizar só este canal' }))
    expect(screen.getAllByText('Sincronizando agora').length).toBeGreaterThan(0)
    done({ ok: true })
    expect(await screen.findByText('Luke Damant sincronizado')).toBeInTheDocument()
  })
  it('while the chrome runs the round: the sync bar and "Na fila desta rodada"', () => {
    const { container, unmount } = mount({}, {}, true)
    const bar = container.querySelector('.syncbar')!
    expect(bar).toHaveClass('on')
    expect(within(bar as HTMLElement).getByText(/^Sincronização em andamento: 11 concorrentes na rodada/)).toBeInTheDocument()
    expect(screen.getAllByText('Na fila desta rodada').length).toBe(11)
    expect(noJunkText(container)).toEqual([])
    unmount()
    const r = mount()
    expect(r.container.querySelector('.syncbar')).not.toHaveClass('on')
    expect(screen.queryByText('Na fila desta rodada')).toBeNull()
  })
  it('niche editor (?nicheEditor=1): all competitors even in IA, focus on the first select, back to the opener on close', async () => {
    const user = userEvent.setup()
    const opener = document.createElement('button'); opener.textContent = 'abrir'; document.body.appendChild(opener); opener.focus()
    mount({}, { niche: 'ia', nicheEditor: '1' })
    const dlg = screen.getByRole('dialog', { name: 'Definir nicho dos canais' })
    const selects = within(dlg).getAllByRole('combobox')
    expect(selects).toHaveLength(14)
    expect(within(dlg).getByRole('combobox', { name: 'Nicho de Luke Damant' })).toBeInTheDocument()
    expect(document.activeElement).toBe(selects[0])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Definir nicho dos canais' })).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors', { scroll: false })
    opener.remove()
  })
  it('niche editor with no focused opener returns the focus to the chrome menu ⋯', async () => {
    const user = userEvent.setup()
    ;(document.activeElement as HTMLElement | null)?.blur()
    mount({}, { nicheEditor: '1' })
    await user.click(within(screen.getByRole('dialog', { name: 'Definir nicho dos canais' })).getByRole('button', { name: 'Fechar' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mais ações' }))
  })
})

