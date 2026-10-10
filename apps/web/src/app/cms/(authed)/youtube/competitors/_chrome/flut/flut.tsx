'use client'
/**
 * Floating surfaces of the Observatório: every tooltip, popover and menu renders through one of these two, into #flut
 * (spec telas v9, 19.1). <Popover> opens by click or keyboard and is the only one open; <HoverTip> follows the mouse
 * or the focus, never takes a click, and hides while a popover is open.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { place, maxWidthFor, type PlaceOpts, type Side } from './place'
import { flutHost, claimFlut, releaseFlut, currentFlut, subscribeFlut, tabInside } from './store'

/**
 * The trigger, looked up when needed: a ref's current, or a DOM lookup (a row's button is found by id).
 * It must CONTAIN the element that toggles the surface: a click outside the anchor closes an open popover, so a toggle
 * button that is only next to the anchor would close it on mousedown and reopen it on the click that follows.
 */
export type Anchor = () => Element | null
type Opts = PlaceOpts & { maxW?: number; maxWvw?: number }

/**
 * Whether a HoverTip is really on screen: `show` and no popover open (a popover hides every tip). A trigger that points to
 * the tip with aria-describedby uses this, so the attribute never names an id that is not in the document.
 */
export function useTipShown(show: boolean): boolean {
  const popover = useSyncExternalStore(subscribeFlut, currentFlut, () => null)
  return show && popover == null
}

const noSub = () => () => {}
/** false on the server and during hydration, true after: a portal cannot render on the server. */
const useIsClient = () => useSyncExternalStore(noSub, () => true, () => false)

function usePlacement(active: boolean, ref: RefObject<HTMLDivElement | null>, anchor: Anchor, posAnchor: Anchor | undefined, o: Opts, onGone: () => void) {
  const live = useRef({ anchor, posAnchor, o, onGone })
  // while the trigger is missing from the document: watches the DOM so the surface comes back without a render of ours
  const watch = useRef<MutationObserver | null>(null)
  // layout effect, declared BEFORE the one that runs `run`: they run in declaration order, so `run` reads this render's
  // props (a passive effect would run after it and leave `run` one render behind)
  useLayoutEffect(() => { live.current = { anchor, posAnchor, o, onGone } })
  const run = useCallback((): void => {
    const el = ref.current, { anchor: at, posAnchor: pos, o: opts, onGone: gone } = live.current
    if (!el) return
    const a = at()
    // the trigger left the document (its row was removed, the list was sorted): nothing to point at
    if (!a || !a.isConnected) {
      el.style.visibility = 'hidden'
      if (!watch.current && typeof MutationObserver !== 'undefined') {
        watch.current = new MutationObserver(() => run())
        watch.current.observe(document.body, { childList: true, subtree: true })
      }
      gone()
      return
    }
    watch.current?.disconnect(); watch.current = null
    const m = pos?.()
    // the position is measured on `posAnchor` when it is given (focus, Esc and Tab stay on the trigger)
    const r = (m && m.isConnected ? m : a).getBoundingClientRect()
    const vp = { w: document.documentElement.clientWidth || window.innerWidth, h: window.innerHeight }
    // scrolled out of the window (a rect with no size says nothing: no layout, as in jsdom)
    if ((r.width || r.height) && (r.bottom < 0 || r.top > vp.h || r.right < 0 || r.left > vp.w)) { el.style.visibility = 'hidden'; gone(); return }
    el.style.maxWidth = maxWidthFor(vp.w, opts.maxW, opts.maxWvw) + 'px'
    el.style.maxHeight = ''
    el.style.overflowY = ''
    // measured from the corner: a left/top left from the last placement could wrap the text near the edge and measure a width that is too small
    el.style.left = '0px'
    el.style.top = '0px'
    const p = place(r, { w: el.offsetWidth, h: el.offsetHeight }, vp, opts)
    if (p.maxHeight != null) { el.style.maxHeight = p.maxHeight + 'px'; el.style.overflowY = 'auto' }
    el.style.left = p.left + 'px'
    el.style.top = p.top + 'px'
    el.dataset.lado = p.side
    el.style.visibility = ''
  }, [ref])
  // before every paint while it is open: a render of the screen may have moved the trigger
  useLayoutEffect(() => { if (active) run() })
  useEffect(() => {
    if (!active) return
    const on = (e: Event) => { if (e.type === 'scroll' && e.target instanceof Node && ref.current?.contains(e.target)) return; run() }
    window.addEventListener('resize', on)
    document.addEventListener('scroll', on, { capture: true, passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => run())
    const a = live.current.anchor(), m = live.current.posAnchor?.()
    if (a) ro?.observe(a)
    if (m) ro?.observe(m)
    if (ref.current) ro?.observe(ref.current) // content that grows by its own state moves the bottom edge
    ro?.observe(document.documentElement)
    return () => {
      window.removeEventListener('resize', on); document.removeEventListener('scroll', on, { capture: true }); ro?.disconnect()
      watch.current?.disconnect(); watch.current = null
    }
  }, [active, run, ref])
}

export function Popover({ open, anchor, posAnchor, onClose, children, id, className, role = 'dialog', label, labelledBy, pref, align, maxW, maxWvw, gap, gapQueda, lado, queda }: {
  open: boolean; anchor: Anchor
  /** Measure the position on this element instead of the trigger (focus, Esc and Tab still use the trigger). */
  posAnchor?: Anchor
  /** Close it (set your state). The focus goes back to the trigger by itself when it was Esc; `viaEsc` tells that case apart (outside click, focus out and "trigger gone" are false). */
  onClose: (viaEsc: boolean) => void
  children: ReactNode
  id?: string; className?: string; role?: 'dialog' | 'menu' | 'tooltip' | 'group'; label?: string
  /** The id of the element that names the box (use it instead of `label` when a visible heading already says it). */
  labelledBy?: string
  pref?: Side; align?: 'fim' | 'meio' | 'inicio'; maxW?: number
  /** Also at most this fraction of the window width (0.86 = 86vw). */
  maxWvw?: number
  /** Placement knobs of place(): the distance to the trigger, and for pref 'lado' the side tried first and the fallback. */
  gap?: number; gapQueda?: number; lado?: PlaceOpts['lado']; queda?: PlaceOpts['queda']
}) {
  const client = useIsClient()
  const auto = useId(), pid = id ?? 'flut-' + auto
  const ref = useRef<HTMLDivElement>(null)
  const live = useRef({ anchor, onClose })
  useLayoutEffect(() => { live.current = { anchor, onClose } }) // before usePlacement's layout effect (same reason as there)
  useEffect(() => {
    if (!open) return
    claimFlut({
      id: pid, anchor: () => live.current.anchor(), el: () => ref.current,
      close: focus => {
        const a = live.current.anchor()
        live.current.onClose(focus)
        if (focus && a instanceof HTMLElement) a.focus()
      },
    })
    return () => releaseFlut(pid)
  }, [open, pid])
  // Safari and Firefox on macOS do not focus a button on click, so "Tab on the trigger enters the popover" would never
  // start: if the focus is neither on the trigger nor inside the box, it goes to the trigger. Declared after the claim and
  // run before the owner's own effects (a menu that focuses its first item runs later and keeps the focus).
  useEffect(() => {
    if (!open || !client) return
    const a = live.current.anchor(), act = document.activeElement
    if (a instanceof HTMLElement && act !== a && !a.contains(act) && !ref.current?.contains(act)) a.focus({ preventScroll: true })
  }, [open, client])
  usePlacement(open && client, ref, anchor, posAnchor, { pref, align, maxW, maxWvw, gap, gapQueda, lado, queda }, () => live.current.onClose(false))
  if (!open || !client) return null
  return createPortal(
    // tabIndex -1: the box can take the focus (the owner moves it in when it wants; the keyboard ring below needs a focusable box)
    <div ref={ref} id={pid} role={role} aria-label={label} aria-labelledby={labelledBy} tabIndex={-1} className={'obs-fl-pop' + (className ? ' ' + className : '')} style={{ position: 'fixed', left: 0, top: 0 }}
      onKeyDown={e => tabInside(e, ref.current, live.current.anchor())}>{children}</div>,
    flutHost(),
  )
}

export function HoverTip({ show, anchor, posAnchor, children, id, className, pref = 'cima', align = 'meio', cx, maxW, gap, gapQueda, lado, queda, outroLado, ariaHidden }: {
  show: boolean; anchor: Anchor; children: ReactNode
  /** Measure the position on this element instead of the trigger. */
  posAnchor?: Anchor
  id?: string; className?: string; pref?: Side; align?: 'fim' | 'meio' | 'inicio'; cx?: number; maxW?: number
  gap?: number; gapQueda?: number; lado?: PlaceOpts['lado']; queda?: PlaceOpts['queda']; outroLado?: PlaceOpts['outroLado']
  /** true when the same words are already the trigger's accessible name or description. */
  ariaHidden?: boolean
}) {
  const client = useIsClient()
  const shown = useTipShown(show)
  const ref = useRef<HTMLDivElement>(null)
  const active = shown && client
  // no onClose here: usePlacement itself keeps the tip hidden (visibility) until it is placed and while the trigger is gone,
  // and shows it again as soon as the trigger is back; it never sticks, since every placement decides it anew
  usePlacement(active, ref, anchor, posAnchor, { pref, align, cx, maxW, gap, gapQueda, lado, queda, outroLado }, () => {})
  if (!active) return null
  return createPortal(
    <div ref={ref} id={id} role="tooltip" aria-hidden={ariaHidden || undefined} className={'obs-fl-tip' + (className ? ' ' + className : '')} style={{ position: 'fixed', left: 0, top: 0, visibility: 'hidden' }}>{children}</div>,
    flutHost(),
  )
}
