// @vitest-environment jsdom
/**
 * The row menu ⋯ of Canais: it opens alone (never the drawer), anchored to its button whatever the containing block
 * of `position: fixed` is, follows the button when the layout changes, and keeps the menu-button keyboard.
 *
 * jsdom has no layout, so the rects are simulated: the button sits where `btn` says, and the menu sits at its inline
 * left/top PLUS `origin` — the origin of the block that resolves `position: fixed` (the CMS shell has an ancestor
 * that captures it: in production the menu landed ~495 px to the right of where the code asked).
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

const MENU = { w: 230, h: 189 }
/** Viewport of the simulation and the simulated layout. */
const VW = 2000, VH = 1100
let btn = { left: 1694, top: 534, width: 32, height: 32 }
let origin = { x: 0, y: 0 }
/** Where the menu would be drawn with no left/top of its own (end of the screen's flow). */
const STATIC = { x: 777, y: 3333 }
const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

beforeEach(() => {
  replace.mockReset(); refresh.mockReset()
  btn = { left: 1694, top: 534, width: 32, height: 32 }
  origin = { x: 0, y: 0 }
  Object.defineProperty(window, 'innerWidth', { value: VW, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: VH, configurable: true })
  Object.defineProperty(document.documentElement, 'clientWidth', { value: VW, configurable: true })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    // a fixed box with left/top `auto` sits at its static position (where it would be in the flow), not at the origin
    if (this.getAttribute('role') === 'menu') return rect(this.style.left === '' ? STATIC.x : origin.x + parseFloat(this.style.left), this.style.top === '' ? STATIC.y : origin.y + parseFloat(this.style.top), MENU.w, MENU.h)
    if (this.hasAttribute('data-menu')) return rect(btn.left, btn.top, btn.width, btn.height)
    return rect(0, 0, 0, 0)
  })
})
afterEach(() => { vi.restoreAllMocks() })

const more = () => screen.getByRole('button', { name: 'Mais ações para Luke Damant' })
const menu = () => screen.queryByRole('menu', { name: 'Ações do canal' })
/** Where the menu is on screen (viewport coordinates), as the simulated layout resolves its inline position. */
const at = () => { const r = menu()!.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }

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

  it('opens right below its button, right edges aligned', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(more())
    expect(at()).toMatchObject({ right: btn.left + btn.width, top: btn.top + btn.height + 4 })
  })

  it('stays on its button when an ancestor captures position: fixed (the production defect)', async () => {
    const user = userEvent.setup()
    origin = { x: 495, y: -136 }
    mount()
    await user.click(more())
    expect(at()).toMatchObject({ right: btn.left + btn.width, top: btn.top + btn.height + 4 })
  })

  it('opens above the button when there is no room below, and never leaves the viewport', async () => {
    const user = userEvent.setup()
    btn = { left: 1694, top: VH - 60, width: 32, height: 32 }
    mount()
    await user.click(more())
    expect(at().bottom).toBe(btn.top - 4)
    await user.keyboard('{Escape}')
    // a button near the left edge: the menu is pushed inside instead of hanging out
    btn = { left: 20, top: 300, width: 32, height: 32 }
    await user.click(more())
    expect(at().left).toBeGreaterThanOrEqual(8)
    expect(at().right).toBeLessThanOrEqual(VW - 8)
    await user.keyboard('{Escape}')
    // no room on either side: it is kept whole inside the viewport
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true })
    btn = { left: 1694, top: 140, width: 32, height: 32 }
    await user.click(more())
    expect(at().top).toBeGreaterThanOrEqual(8)
    expect(at().bottom).toBeLessThanOrEqual(300 - 8)
  })

  it('follows its button when the layout changes with the menu open (drawer opening, resize, scroll)', async () => {
    const user = userEvent.setup()
    origin = { x: 495, y: -136 }
    mount()
    await user.click(more())
    // the drawer opened: the table shrank and the button moved left
    btn = { left: 1287, top: 524, width: 32, height: 32 }
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(at()).toMatchObject({ right: 1287 + 32, top: 524 + 32 + 4 })
    // the page scrolled
    btn = { left: 1287, top: 300, width: 32, height: 32 }
    act(() => { fireEvent.scroll(document) })
    expect(at()).toMatchObject({ right: 1287 + 32, top: 300 + 32 + 4 })
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

  it('is placed from its first render without a ResizeObserver: the menu never starts from its static position', async () => {
    const user = userEvent.setup()
    // jsdom has no ResizeObserver; a browser's would re-place the menu before the paint and hide a wrong first measure
    expect(typeof ResizeObserver).toBe('undefined')
    origin = { x: 495, y: -136 }
    mount()
    await user.click(more())
    expect(menu()!.style.left).not.toBe('')
    expect(at()).toMatchObject({ right: btn.left + btn.width, top: btn.top + btn.height + 4 })
  })

  it('the cards view anchors the same way', async () => {
    const user = userEvent.setup()
    origin = { x: 495, y: -136 }
    mount({ layout: 'cards' })
    const b = document.querySelector<HTMLElement>('article.card[data-id="luke-damant"] [data-menu]')!
    await user.click(b)
    expect(at()).toMatchObject({ right: btn.left + btn.width, top: btn.top + btn.height + 4 })
  })
})
