// @vitest-environment jsdom
/**
 * The row menu ⋯ of Canais: it opens alone (never the drawer), renders in the floating layer (#flut, outside the screen),
 * is anchored to its button, follows the button when the layout changes, and keeps the menu-button keyboard. Where the
 * layer puts a surface (below, above, inside the window) is covered by flut-place.test.ts.
 *
 * jsdom has no layout, so the button's rect is simulated: the button sits where `btn` says.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Degrau "administrar o site": por padrão estes testes rodam como quem administra (o dono).
const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'

const replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))

const obs = createObservatory(datasetFromOracle(loadOracle()))
const ok = async () => ({ ok: true })
const mount = (p: Partial<CanaisParams> = {}) => render(
  <ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs="">
    <CanaisScreen view={buildCanaisView(obs, { niche: 'todos', limit: 75, ...p })} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} />
  </div></ChromeSyncContext.Provider></ToastProvider>,
)

/** Viewport of the simulation and the simulated layout. */
const VW = 2000, VH = 1100
let btn = { left: 1694, top: 534, width: 32, height: 32 }
const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

beforeEach(() => {
  replace.mockReset(); refresh.mockReset()
  btn = { left: 1694, top: 534, width: 32, height: 32 }
  Object.defineProperty(window, 'innerWidth', { value: VW, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: VH, configurable: true })
  Object.defineProperty(document.documentElement, 'clientWidth', { value: VW, configurable: true })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute('data-menu')) return rect(btn.left, btn.top, btn.width, btn.height)
    return rect(0, 0, 0, 0)
  })
})
afterEach(() => { vi.restoreAllMocks(); document.getElementById('flut')?.remove() })

const more = () => screen.getByRole('button', { name: 'Mais ações para Luke Damant' })
const menu = () => screen.queryByRole('menu', { name: 'Ações do canal' })
/** The menu's own position, as the layer wrote it (the surface has no size in jsdom, so left/top are the anchor's right/bottom + gap; the row menu's gap is 4 px, as before the layer). */
const at = () => { const m = menu()!; return { left: parseFloat(m.style.left), top: parseFloat(m.style.top) } }

describe('Canais · row menu ⋯', () => {
  it('clicking ⋯ opens only the menu: no drawer, no navigation', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(more())
    expect(menu()).not.toBeNull()
    expect(more()).toHaveAttribute('aria-expanded', 'true')
    expect(document.querySelector('.cn-drawer')).toBeNull()
    expect(replace).not.toHaveBeenCalled()
    expect(screen.getAllByRole('menuitem').map(x => x.textContent)).toEqual(['Abrir detalhes', 'Sincronizar só este canal', 'Abrir no YouTube', 'Copiar pedido para o Cowork', 'Remover canal…'])
  })

  it('editora (não administra o site): o menu não tem "Remover canal…"; no lugar, o motivo escrito', async () => {
    siteAdmin.value = false
    try {
      const user = userEvent.setup()
      mount()
      await user.click(more())
      expect(screen.getAllByRole('menuitem').map(x => x.textContent)).toEqual(['Abrir detalhes', 'Sincronizar só este canal', 'Abrir no YouTube', 'Copiar pedido para o Cowork'])
      expect(menu()!.querySelector('[data-testid="admin-only-note"]')!.textContent).toBe('Só quem administra o site pode remover um canal.')
    } finally {
      siteAdmin.value = true
    }
  })

  it('renders in the floating layer, outside the screen, and an outside press closes it', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(more())
    expect(menu()!.closest('#flut')).not.toBeNull()
    expect(document.querySelector('[data-obs-screen="canais"] [role="menu"]')).toBeNull()
    fireEvent.mouseDown(document.body)
    expect(menu()).toBeNull()
    expect(more()).toHaveAttribute('aria-expanded', 'false')
  })

  it('follows its button when the layout changes with the menu open (drawer opening, resize, scroll)', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(more())
    expect(at()).toMatchObject({ left: btn.left + btn.width, top: btn.top + btn.height + 4 })
    // the drawer opened: the table shrank and the button moved left
    btn = { left: 1287, top: 524, width: 32, height: 32 }
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(at()).toMatchObject({ left: 1287 + 32, top: 524 + 32 + 4 })
    // the page scrolled
    btn = { left: 1287, top: 300, width: 32, height: 32 }
    act(() => { fireEvent.scroll(document) })
    expect(at()).toMatchObject({ left: 1287 + 32, top: 300 + 32 + 4 })
  })

  it('closes when its button leaves the viewport', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(more())
    btn = { left: 1694, top: -80, width: 32, height: 32 }
    act(() => { fireEvent.scroll(document) })
    expect(menu()).toBeNull()
    expect(more()).toHaveAttribute('aria-expanded', 'false')
  })

  it('keyboard: Enter and Space open on the first item, arrows move, Esc closes and returns the focus', async () => {
    const user = userEvent.setup()
    mount()
    more().focus()
    await user.keyboard('{Enter}')
    const items = () => screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items()[0])
    expect(document.querySelector('.cn-drawer')).toBeNull()
    expect(replace).not.toHaveBeenCalled()
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(items()[1])
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(document.activeElement).toBe(items()[4])
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(items()[0])
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(items()[4])
    await user.keyboard('{Escape}')
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(more())
    await user.keyboard(' ')
    expect(menu()).not.toBeNull()
    expect(document.activeElement).toBe(items()[0])
    expect(replace).not.toHaveBeenCalled()
  })

  it('Tab no menu sai pelo ⋯ (o foco segue para o controle depois dele e o menu fecha); Shift+Tab volta ao ⋯ e o menu fica', async () => {
    const user = userEvent.setup()
    mount()
    more().focus()
    await user.keyboard('{Enter}')
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(more())
    expect(menu()).not.toBeNull()
    await user.tab() // back in through the trigger: the first item
    expect(menu()!.contains(document.activeElement)).toBe(true)
    // user-event computes the destination from the element the key was sent to, a browser from the current focus: so the
    // second half is checked by hand. The key puts the focus on the ⋯ and is not cancelled; the focus then leaving closes the menu.
    expect(fireEvent.keyDown(document.activeElement!, { key: 'Tab' })).toBe(true)
    expect(document.activeElement).toBe(more())
    expect(menu()).not.toBeNull()
    const fora = document.createElement('button'); document.body.appendChild(fora)
    act(() => { fora.focus() })
    expect(menu()).toBeNull()
    fora.remove()
  })

  it('clicar no ⋯ com o menu aberto fecha (o gatilho conta como dentro: não fecha e reabre)', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(more())
    expect(menu()).not.toBeNull()
    await user.click(more())
    expect(menu()).toBeNull()
    expect(more()).toHaveAttribute('aria-expanded', 'false')
  })
  it('Tab num item fecha o menu pelo foco que sai (o ⋯ recebe o foco primeiro, depois o controle seguinte)', async () => {
    const user = userEvent.setup()
    mount()
    more().focus()
    await user.keyboard('{Enter}')
    expect(menu()!.contains(document.activeElement)).toBe(true)
    expect(fireEvent.keyDown(document.activeElement!, { key: 'Tab' })).toBe(true)
    expect(document.activeElement).toBe(more())
    const seguinte = document.createElement('button'); document.body.appendChild(seguinte)
    act(() => { seguinte.focus() })
    expect(menu()).toBeNull()
    seguinte.remove()
  })

  it('the cards view anchors the same way', async () => {
    const user = userEvent.setup()
    mount({ layout: 'cards' })
    const b = document.querySelector<HTMLElement>('article.card[data-id="luke-damant"] [data-menu]')!
    await user.click(b)
    expect(at()).toMatchObject({ left: btn.left + btn.width, top: btn.top + btn.height + 4 })
  })
})
