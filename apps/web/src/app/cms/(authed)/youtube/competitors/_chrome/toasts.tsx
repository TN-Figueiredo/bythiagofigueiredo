'use client'
/**
 * Toasts of the chrome (port of chrome.js toast/dismiss): an aria-live region with no nested role; each toast is its own
 * node; ✕ of 32 px; without an action or selectable text it leaves after 6.5 s, paused while hovered or focused;
 * closing a toast that held the focus returns the focus to where it was.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './icons'

export type ToastKind = '' | 'ok' | 'warn' | 'bad' | 'forja'
export interface ToastOpts { more?: string; selectable?: string }
interface ToastItem { id: number; kind: ToastKind; title: string; text: string; opts: ToastOpts }
type ToastFn = (kind: ToastKind, title: string, text: string, opts?: ToastOpts) => void

const TOAST_MS = 6500
const Ctx = createContext<ToastFn>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const toast = useCallback<ToastFn>((kind, title, text, opts = {}) => {
    seq.current += 1
    const id = seq.current
    setItems(xs => [...xs, { id, kind, title, text, opts }])
  }, [])
  const dismiss = useCallback((id: number) => setItems(xs => xs.filter(x => x.id !== id)), [])
  const value = useMemo(() => toast, [toast])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="obs-ch-toasts" role="region" aria-label="Avisos" aria-live="polite">
        {items.map(t => <Toast key={t.id} item={t} onClose={() => dismiss(t.id)} />)}
      </div>
    </Ctx.Provider>
  )
}

function Toast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const left = useRef(TOAST_MS), since = useRef(0)
  const sticky = !!item.opts.selectable
  const close = useCallback(() => {
    const had = !!ref.current && ref.current.contains(document.activeElement)
    if (timer.current) clearTimeout(timer.current)
    const to = back.current
    onClose()
    if (had && to && to.isConnected) to.focus({ preventScroll: true })
  }, [onClose])
  const start = useCallback(() => {
    if (sticky) return
    since.current = Date.now()
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(close, left.current)
  }, [sticky, close])
  const pause = useCallback(() => {
    if (!timer.current) return
    clearTimeout(timer.current); timer.current = null
    left.current = Math.max(1000, left.current - (Date.now() - since.current))
  }, [])
  useEffect(() => {
    if (item.opts.selectable) {
      back.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const ta = ref.current?.querySelector('textarea')
      if (ta) { ta.focus({ preventScroll: true }); ta.select() }
    }
    start()
    return () => { if (timer.current) clearTimeout(timer.current) }
    // mount only: the toast starts its own timer once
  }, [])
  const icon = item.kind === 'bad' ? Icon.x() : item.kind === 'warn' ? Icon.warn() : item.kind === 'ok' ? Icon.check() : Icon.info()
  return (
    <div
      ref={ref}
      className={'obs-ch-toast' + (item.kind ? ' obs-ch-' + item.kind : '')}
      onMouseEnter={pause} onMouseLeave={start}
      onFocus={e => { if (!back.current && e.relatedTarget instanceof HTMLElement && !ref.current?.contains(e.relatedTarget)) back.current = e.relatedTarget; pause() }}
      onBlur={e => { if (!ref.current?.contains(e.relatedTarget as Node | null)) start() }}
    >
      {icon}
      <div>
        <b>{item.title}</b>
        <span>{item.text}</span>
        {item.opts.more ? <span className="obs-ch-tl">{item.opts.more}</span> : null}
        {item.opts.selectable ? <textarea className="obs-ch-copy" readOnly rows={3} aria-label="Texto do pedido para copiar" defaultValue={item.opts.selectable} /> : null}
      </div>
      <div className="obs-ch-toast-acts">
        <button className="obs-ch-btn obs-ch-ghost obs-ch-icon obs-ch-toast-x" type="button" aria-label="Fechar aviso" onClick={close}>{Icon.x()}</button>
      </div>
    </div>
  )
}
