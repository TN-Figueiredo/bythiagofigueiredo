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

function wire() {
  if (wired) return
  wired = true
  // capture: the layer answers Esc before the screen under it (one Esc closes one thing)
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); open.close(true) } }, true)
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
