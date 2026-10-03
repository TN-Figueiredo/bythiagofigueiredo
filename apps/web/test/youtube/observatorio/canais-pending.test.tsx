// @vitest-environment jsdom
/**
 * Immediate feedback of the Canais screen. Every URL state (drawer, format, scale, layout, sort, filter, add form) is
 * a navigation that re-renders the page on the server; these tests hold that navigation open (the router mock returns
 * a promise, which keeps the screen's transition pending exactly like a real navigation does) and assert what is on
 * screen BEFORE the server answers, then what replaces it once it does.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { noJunkText, forbiddenVocabulary } from './audits'

/** The navigation in flight: `land()` is the server answering. */
const flights: Array<() => void> = []
const land = () => { for (const f of flights.splice(0)) f() }
const hold = () => new Promise<void>(r => { flights.push(r) })
const replace = vi.fn((..._a: unknown[]) => hold()), push = vi.fn((..._a: unknown[]) => hold()), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))

const obs = createObservatory(datasetFromOracle(loadOracle()))
const ok = async () => ({ ok: true })
const view = (p: Partial<CanaisParams> = {}) => buildCanaisView(obs, { niche: 'todos', limit: 75, ...p })
const tree = (p: Partial<CanaisParams> = {}) => (
  <ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs="">
    <CanaisScreen view={view(p)} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} />
  </div></ChromeSyncContext.Provider></ToastProvider>
)
const root = () => document.querySelector<HTMLElement>('[data-obs-screen="canais"]')!
const drawerEl = () => document.querySelector<HTMLElement>('.cn-drawer')
/** The server answered: the page re-renders with the new view and the navigation ends. */
async function answer(r: ReturnType<typeof render>, p: Partial<CanaisParams>) {
  await act(async () => { r.rerender(tree(p)); land(); await Promise.resolve() })
}

beforeEach(() => { replace.mockClear(); push.mockClear(); refresh.mockClear() })
// no navigation outlives its test (still mounted here: this hook runs before the library's cleanup)
afterEach(async () => { await act(async () => { land(); await Promise.resolve() }) })

describe('Canais · immediate feedback', () => {
  it('a row click opens the drawer at once with what the row already shows, busy until the server answers', async () => {
    const user = userEvent.setup()
    const r = render(tree())
    await user.click(screen.getByRole('button', { name: 'Abrir detalhes de Luke Damant' }))
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?channel=luke-damant', { scroll: false })
    const d = drawerEl()!
    expect(d).not.toBeNull()
    expect(d).toHaveAttribute('data-drawer', 'luke-damant')
    expect(d).toHaveAttribute('aria-busy', 'true')
    expect(within(d).getByRole('heading', { name: 'Luke Damant' })).toBeInTheDocument()
    expect(within(d).getByRole('combobox', { name: 'Nicho de Luke Damant' })).toHaveValue('viagem')
    expect(within(d).getByText('1,93 mi')).toBeInTheDocument()
    expect(root()).toHaveClass('drawer-open')
    expect(root()).toHaveAttribute('data-nav-pending')
    expect(document.querySelector('tr.obs-cn-row[data-id="luke-damant"]')).toHaveClass('sel')
    // the close button has the focus from the first frame, and it is the same button once the content arrives
    const close = within(d).getByRole('button', { name: 'Fechar detalhes do canal' })
    expect(document.activeElement).toBe(close)
    // nothing the server has not sent: no stat, no count, no panel text
    expect(d.querySelector('.dstats .v')).toBeNull()
    expect(d.querySelector('.dtabs .n')).toBeNull()
    expect(d.querySelector('.swapcard, .vrow, .sec, .sech')).toBeNull()
    expect(noJunkText(r.container)).toEqual([])
    expect(forbiddenVocabulary(r.container)).toEqual([])

    await answer(r, { channel: 'luke-damant' })
    expect(drawerEl()).toBe(d)
    expect(d).not.toHaveAttribute('aria-busy')
    expect(d.querySelector('.dstats .v')).not.toBeNull()
    expect(within(d).getByText('Trocas nos últimos 30 dias')).toBeInTheDocument()
    expect(within(d).getByRole('button', { name: 'Fechar detalhes do canal' })).toBe(close)
    expect(document.activeElement).toBe(close)
    expect(root()).not.toHaveAttribute('data-nav-pending')
  })

  it('the tab picked while the drawer loads is the tab shown when it arrives', async () => {
    const user = userEvent.setup()
    const r = render(tree())
    await user.click(screen.getByRole('button', { name: 'Abrir detalhes de Matt Wolfe' }))
    const d = drawerEl()!
    await user.click(within(d).getByRole('tab', { name: 'Vídeos' }))
    expect(within(d).getByRole('tab', { name: 'Vídeos' })).toHaveAttribute('aria-selected', 'true')
    await answer(r, { channel: 'matt-wolfe' })
    expect(within(d).getByRole('tab', { name: /^Vídeos/ })).toHaveAttribute('aria-selected', 'true')
    expect(d.querySelector('#cn-pVid')).not.toHaveAttribute('hidden')
    expect(d.querySelector('#cn-pSwaps')).toHaveAttribute('hidden')
  })

  it('another row while a drawer is open swaps to that channel at once; closing is instant', async () => {
    const user = userEvent.setup()
    const r = render(tree({ channel: 'matt-wolfe' }))
    expect(drawerEl()).toHaveAttribute('data-drawer', 'matt-wolfe')
    // below 1280 px the open drawer is modal (the table is inert), so the second open comes from the row menu path
    await act(async () => { screen.getByRole('button', { name: 'Abrir detalhes de Luke Damant', hidden: true }).click() })
    expect(drawerEl()).toHaveAttribute('data-drawer', 'luke-damant')
    expect(drawerEl()).toHaveAttribute('aria-busy', 'true')
    expect(within(drawerEl()!).queryByText('Matt Wolfe')).toBeNull()
    await user.keyboard('{Escape}')
    expect(drawerEl()).toBeNull()
    expect(root()).not.toHaveClass('drawer-open')
    await answer(r, {})
    expect(drawerEl()).toBeNull()
  })

  it('reopening the channel that was just closed opens it again', async () => {
    const user = userEvent.setup()
    const r = render(tree({ channel: 'matt-wolfe' }))
    await user.keyboard('{Escape}')
    expect(drawerEl()).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Abrir detalhes de Matt Wolfe' }))
    expect(drawerEl()).toHaveAttribute('data-drawer', 'matt-wolfe')
    await answer(r, { channel: 'matt-wolfe' })
    expect(drawerEl()).toHaveAttribute('data-drawer', 'matt-wolfe')
    expect(drawerEl()).not.toHaveAttribute('aria-busy')
  })

  it('format and scale mark the clicked option at once and the list as busy; the numbers change only with the server', async () => {
    const user = userEvent.setup()
    const r = render(tree())
    const before = document.querySelector('.tablebox')!.textContent
    await user.click(screen.getByRole('button', { name: 'Shorts' }))
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?fmt=short', { scroll: false })
    expect(screen.getByRole('button', { name: 'Shorts' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Longos' })).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelector('.tablebox')).toHaveAttribute('aria-busy', 'true')
    expect(document.querySelector('.tablebox')!.textContent).toBe(before)
    expect(root()).toHaveAttribute('data-nav-pending')
    await answer(r, { fmt: 'short' })
    expect(screen.getByRole('button', { name: 'Shorts' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('.tablebox')).not.toHaveAttribute('aria-busy')
    expect(root()).not.toHaveAttribute('data-nav-pending')

    await user.click(screen.getByRole('button', { name: 'Absoluto' }))
    expect(screen.getByRole('button', { name: 'Absoluto' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Por mil inscritos' })).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelector('.tablebox')).toHaveAttribute('aria-busy', 'true')
  })

  it('Tabela/Cards switches at once, with the data already on the client', async () => {
    const user = userEvent.setup()
    const r = render(tree())
    await user.click(screen.getByRole('button', { name: 'Cards' }))
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?layout=cards', { scroll: false })
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('.tablebox')).toBeNull()
    expect(document.querySelectorAll('article.card').length).toBeGreaterThan(10)
    expect(document.querySelector('.cards')).not.toHaveAttribute('aria-busy')
    await answer(r, { layout: 'cards' })
    expect(document.querySelectorAll('article.card').length).toBeGreaterThan(10)
  })

  it('a sort click marks the clicked header as busy until the new order arrives', async () => {
    const user = userEvent.setup()
    const r = render(tree())
    const th = () => document.querySelector<HTMLElement>('th.sortable[data-k="vpd"]')!
    await user.click(within(th()).getByRole('button'))
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?sort=vpd', { scroll: false })
    expect(within(th()).getByRole('button')).toHaveAttribute('aria-busy', 'true')
    expect(document.querySelector('.tablebox')).toHaveAttribute('aria-busy', 'true')
    // the arrow never claims an order the rows do not have yet
    expect(th()).not.toHaveAttribute('aria-sort')
    await answer(r, { sort: 'vpd' })
    expect(th()).toHaveAttribute('aria-sort', 'descending')
    expect(within(th()).getByRole('button')).not.toHaveAttribute('aria-busy')
  })

  it('"Adicionar canal" opens its form at once; the problem filter marks the list as busy', async () => {
    const user = userEvent.setup()
    const r = render(tree())
    await user.click(screen.getByText('Adicionar canal').closest('a')!)
    expect(push).toHaveBeenCalledWith('/cms/youtube/competitors?add=1', { scroll: false })
    expect(screen.getByRole('dialog', { name: 'Adicionar canal' })).toBeInTheDocument()
    await answer(r, { add: '1' })
    expect(screen.getByRole('dialog', { name: 'Adicionar canal' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Adicionar canal' })).toBeNull()
    await answer(r, {})

    await user.click(screen.getByRole('link', { name: /Ver só canais com problema/ }))
    expect(push).toHaveBeenLastCalledWith(expect.stringContaining('filter=problemas'), { scroll: false })
    expect(document.querySelector('.tablebox')).toHaveAttribute('aria-busy', 'true')
  })

  it('a modified click on a link is left to the browser (new tab)', async () => {
    const user = userEvent.setup()
    render(tree())
    await user.keyboard('{Meta>}')
    await user.click(screen.getByRole('link', { name: /Ver só canais com problema/ }))
    await user.keyboard('{/Meta}')
    expect(push).not.toHaveBeenCalled()
  })

  it('at rest nothing says busy and the loading bar is not in the DOM', () => {
    render(tree({ channel: 'matt-wolfe' }))
    expect(document.querySelector('[aria-busy]')).toBeNull()
    expect(root()).not.toHaveAttribute('data-nav-pending')
    expect(document.querySelector('.cn-navbar')).toBeNull()
  })
})
