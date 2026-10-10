// The one floating layer of the Observatório (spec telas v9, 19.1): the #flut container at the end of <body>, and
// "one popover open at a time". Module state on purpose (plan decision D1): screens are rendered alone in tests and by
// several routes, and a provider would have to wrap every one of them.
export interface OpenFlut {
  id: string
  anchor: () => Element | null
  el: () => HTMLElement | null
  /** Asks the owner to close. `focus` = give the focus back to the trigger (Esc); false for outside click / focus. */
  close: (focus: boolean) => void
}

let host: HTMLElement | null = null
let open: OpenFlut | null = null
let wired = false
const subs = new Set<() => void>()
const emit = () => { for (const f of [...subs]) f() }

const inside = (t: EventTarget | null): boolean => {
  if (!open || !(t instanceof Node)) return false
  return !!open.el()?.contains(t) || !!open.anchor()?.contains(t)
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Focusable and visible elements inside `root`, in DOM order (jsdom has no layout: visibility is read from hidden/display/visibility). */
export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => {
    if (el instanceof HTMLInputElement && el.type === 'hidden') return false
    for (let n: HTMLElement | null = el; n && n !== root.parentElement; n = n.parentElement) {
      if (n.hidden) return false
      const cs = getComputedStyle(n)
      if (cs.display === 'none' || (n === el && cs.visibility === 'hidden')) return false
    }
    return true
  })
}

/**
 * The popover lives at the end of <body>, so the natural Tab order never passes through it. These two functions stitch it
 * back to the trigger: from the trigger, Tab enters it; from its last element, Tab leaves it through the trigger (the browser
 * finishes the move from there); from its first, Shift+Tab goes back to the trigger. In a menu the focused item is both
 * the first and the last (items are roving, tabIndex -1).
 */
/** Tab with a modifier other than Shift (Ctrl/Alt/Meta+Tab) is the browser's or the system's, not ours. */
const plainTab = (e: { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }): boolean =>
  e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey

export function tabFromTrigger(e: KeyboardEvent): void {
  if (!open || !plainTab(e) || e.shiftKey || e.defaultPrevented) return
  const a = open.anchor(), el = open.el()
  if (!a || !el || document.activeElement !== a) return
  const first = focusables(el)[0]
  if (!first) return
  first.focus()
  // only swallow the Tab when the focus really got there (an item the DOM rules cannot see as unfocusable would eat the key)
  if (document.activeElement === first) e.preventDefault()
}
export function tabInside(e: { key: string; shiftKey: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; preventDefault: () => void }, el: HTMLElement | null, anchor: Element | null): void {
  if (!plainTab(e) || !el || !(anchor instanceof HTMLElement)) return
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !el.contains(active)) return
  const list = focusables(el)
  const menu = el.getAttribute('role') === 'menu'
  const first = menu ? active : list[0], last = menu ? active : list[list.length - 1]
  if (e.shiftKey) {
    if (active === first) { e.preventDefault(); anchor.focus() }
  } else if (active === last) {
    anchor.focus() // not cancelled: the browser goes on to the control after the trigger, and the focus leaving closes the popover
  }
}

function wire() {
  if (wired) return
  wired = true
  // capture: the layer answers Esc before the screen under it (one Esc closes one thing)
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); open.close(true) } }, true)
  document.addEventListener('keydown', tabFromTrigger, true)
  document.addEventListener('mousedown', e => { if (open && !inside(e.target)) open.close(false) }, true)
  document.addEventListener('focusin', e => { if (open && !inside(e.target)) open.close(false) })
}

/** The container, created on first use. `data-obs` makes it inherit the [data-obs] tokens in both themes. */
export function flutHost(): HTMLElement {
  if (!host || !host.isConnected) {
    host = document.getElementById('flut') ?? document.createElement('div')
    host.id = 'flut'
    host.setAttribute('data-obs', '')
    document.body.appendChild(host)
  }
  wire()
  return host
}

export function claimFlut(o: OpenFlut): void {
  const prev = open
  open = o
  emit()
  if (prev && prev.id !== o.id) prev.close(false)
}
export function releaseFlut(id: string): void {
  if (open?.id !== id) return
  open = null
  emit()
}
export const currentFlut = (): string | null => open?.id ?? null
export const subscribeFlut = (f: () => void): (() => void) => { subs.add(f); return () => { subs.delete(f) } }
