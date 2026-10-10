'use client'
/**
 * Floating surfaces of the Observatório: every tooltip, popover and menu renders through one of these two, into #flut
 * (spec telas v9, 19.1). <Popover> opens by click or keyboard and is the only one open; <HoverTip> follows the mouse
 * or the focus, never takes a click, and hides while a popover is open.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { place, maxWidthFor, type PlaceOpts, type Side } from './place'
import { flutHost, claimFlut, releaseFlut, currentFlut, subscribeFlut } from './store'

/** The trigger, looked up when needed: a ref's current, or a DOM lookup (a row's button is found by id). */
export type Anchor = () => Element | null
type Opts = PlaceOpts & { maxW?: number }

const noSub = () => () => {}
/** false on the server and during hydration, true after: a portal cannot render on the server. */
const useIsClient = () => useSyncExternalStore(noSub, () => true, () => false)

function usePlacement(active: boolean, ref: RefObject<HTMLDivElement | null>, anchor: Anchor, o: Opts, onGone: () => void) {
  const live = useRef({ anchor, o, onGone })
  // layout effect, declared BEFORE the one that runs `run`: they run in declaration order, so `run` reads this render's
  // props (a passive effect would run after it and leave `run` one render behind)
  useLayoutEffect(() => { live.current = { anchor, o, onGone } })
  const run = useCallback(() => {
    const el = ref.current, { anchor: at, o: opts, onGone: gone } = live.current
    if (!el) return
    const a = at()
    // the trigger left the document (its row was removed, the list was sorted): nothing to point at
    if (!a || !a.isConnected) { el.style.visibility = 'hidden'; gone(); return }
    const r = a.getBoundingClientRect()
    const vp = { w: document.documentElement.clientWidth || window.innerWidth, h: window.innerHeight }
    // scrolled out of the window (a rect with no size says nothing: no layout, as in jsdom)
    if ((r.width || r.height) && (r.bottom < 0 || r.top > vp.h || r.right < 0 || r.left > vp.w)) { el.style.visibility = 'hidden'; gone(); return }
    el.style.maxWidth = maxWidthFor(vp.w, opts.maxW) + 'px'
    el.style.maxHeight = ''
    el.style.overflowY = ''
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
    const a = live.current.anchor()
    if (a) ro?.observe(a)
    ro?.observe(document.documentElement)
    return () => { window.removeEventListener('resize', on); document.removeEventListener('scroll', on, { capture: true }); ro?.disconnect() }
  }, [active, run, ref])
}

export function Popover({ open, anchor, onClose, children, id, className, role = 'dialog', label, pref, align, maxW }: {
  open: boolean; anchor: Anchor
  /** Close it (set your state). The focus goes back to the trigger by itself when it was Esc. */
  onClose: () => void
  children: ReactNode
  id?: string; className?: string; role?: 'dialog' | 'menu' | 'tooltip' | 'group'; label?: string
  pref?: Side; align?: 'fim' | 'meio' | 'inicio'; maxW?: number
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
        live.current.onClose()
        if (focus && a instanceof HTMLElement) a.focus()
      },
    })
    return () => releaseFlut(pid)
  }, [open, pid])
  usePlacement(open && client, ref, anchor, { pref, align, maxW }, () => live.current.onClose())
  if (!open || !client) return null
  return createPortal(
    <div ref={ref} id={pid} role={role} aria-label={label} className={'obs-fl-pop' + (className ? ' ' + className : '')} style={{ position: 'fixed', left: 0, top: 0 }}>{children}</div>,
    flutHost(),
  )
}

export function HoverTip({ show, anchor, children, id, className, pref = 'cima', align = 'meio', cx, maxW, ariaHidden }: {
  show: boolean; anchor: Anchor; children: ReactNode
  id?: string; className?: string; pref?: Side; align?: 'fim' | 'meio' | 'inicio'; cx?: number; maxW?: number
  /** true when the same words are already the trigger's accessible name or description. */
  ariaHidden?: boolean
}) {
  const client = useIsClient()
  const popover = useSyncExternalStore(subscribeFlut, currentFlut, () => null)
  const ref = useRef<HTMLDivElement>(null)
  const active = show && client && popover == null
  // no onClose here: usePlacement itself keeps the tip hidden (visibility) until it is placed and while the trigger is gone,
  // and shows it again as soon as the trigger is back; it never sticks, since every placement decides it anew
  usePlacement(active, ref, anchor, { pref, align, cx, maxW }, () => {})
  if (!active) return null
  return createPortal(
    <div ref={ref} id={id} role="tooltip" aria-hidden={ariaHidden || undefined} className={'obs-fl-tip' + (className ? ' ' + className : '')} style={{ position: 'fixed', left: 0, top: 0, visibility: 'hidden' }}>{children}</div>,
    flutHost(),
  )
}
