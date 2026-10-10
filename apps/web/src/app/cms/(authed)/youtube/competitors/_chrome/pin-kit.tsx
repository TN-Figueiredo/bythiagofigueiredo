'use client'
/**
 * Pin a competitor video (R118): the one button, its message, the chips and the live regions, shared by Histórico,
 * Mudanças and the channel drawer. The server actions arrive by props at PinProvider (never imported here).
 * The button names the action; the state is the chip's. Nothing here builds a sentence about a failure: the
 * action's `error` is shown as it came.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { HoverTip } from './flut/flut'
import type { PinResult } from '../pin-result'
import type { PinChipView, PinView } from './pin-view'

export type PinAction = (videoId: string) => Promise<PinResult>
export const PIN_TEXT = {
  pin: 'Fixar vídeo', unpin: 'Desafixar', pinBusy: 'Fixando…', unpinBusy: 'Desafixando…',
  saidPin: 'Vídeo fixado.', saidUnpin: 'Vídeo desafixado.', seePinned: 'Ver fixados',
  failPin: 'Não foi possível fixar agora. Tente de novo.', failUnpin: 'Não foi possível desafixar agora. Tente de novo.',
} as const
/** No answer after this long is a failure (the button goes back to what it was). */
const TIMEOUT_MS = 15_000
/** After a good answer the button changed action under the cursor: a second click in the same spot is ignored. */
const GUARD_MS = 700

type Kind = 'pin' | 'unpin'
interface PinMsg { kind: 'cap' | 'failed' | 'denied'; error: string; channelId: string; href: string }
interface Ctx {
  busy: Record<string, Kind>; msgs: Record<string, PinMsg>; over: Record<string, boolean>
  run: (pin: PinView, key: string, pinnedNow: boolean) => void
}
const PinCtx = createContext<Ctx | null>(null)

export type PinIconName = 'pin' | 'pinOn' | 'unpin' | 'out' | 'spin' | 'warn' | 'err' | 'info'
const PIN_PATH = <path d="M9 3h6l-1 6 4 4H6l4-4z" />
const ICONS: Record<PinIconName, ReactNode> = {
  pin: <>{PIN_PATH}<path d="M12 13v8" /></>,
  pinOn: <><path d="M9 3h6l-1 6 4 4H6l4-4z" fill="currentColor" /><path d="M12 13v8" /></>,
  unpin: <>{PIN_PATH}<path d="M12 13v8" /><path d="M4 4l16 16" /></>,
  out: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>,
  spin: <path d="M12 3a9 9 0 1 1-9 9" />,
  warn: <><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></>,
  err: <><circle cx="12" cy="12" r="9" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>,
}
/** Decorative: always aria-hidden. data-fx-icon lets a test tell the three message treatments apart without the colour. */
export function PinIcon({ name }: { name: PinIconName }) {
  return (
    <svg className={'fx-i' + (name === 'spin' ? ' fx-spin' : '')} data-fx-icon={name} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export function PinProvider({ onPin, onUnpin, children }: { onPin?: PinAction; onUnpin?: PinAction; children: ReactNode }) {
  const router = useRouter()
  const [busy, setBusy] = useState<Record<string, Kind>>({})
  const [msgs, setMsgs] = useState<Record<string, PinMsg>>({})
  /** What the last good answer said, until the refreshed page brings it (videoId → pinned). */
  const [over, setOver] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState(''), [alert, setAlert] = useState('')
  const busyRef = useRef<Record<string, Kind>>({}), lock = useRef<Record<string, number>>({})

  const run = useCallback((pin: PinView, key: string, pinnedNow: boolean) => {
    const id = pin.videoId, kind: Kind = pinnedNow ? 'unpin' : 'pin', fn = kind === 'pin' ? onPin : onUnpin
    if (!fn || busyRef.current[id] || (lock.current[id] ?? 0) > Date.now()) return
    busyRef.current = { ...busyRef.current, [id]: kind }
    setBusy(busyRef.current); setStatus(kind === 'pin' ? PIN_TEXT.pinBusy : PIN_TEXT.unpinBusy)
    const failed: PinResult = { ok: false, kind: 'failed', error: kind === 'pin' ? PIN_TEXT.failPin : PIN_TEXT.failUnpin }
    let timer: ReturnType<typeof setTimeout> | undefined
    const late = new Promise<PinResult>(resolve => { timer = setTimeout(() => resolve(failed), TIMEOUT_MS) })
    void Promise.race([fn(id).catch(() => failed), late]).then(res => {
      if (timer) clearTimeout(timer)
      const rest = { ...busyRef.current }; delete rest[id]
      busyRef.current = rest; setBusy(rest)
      // any answer drops the messages of the same channel: the count they quote may be stale
      setMsgs(m => {
        const next: Record<string, PinMsg> = {}
        for (const [k, x] of Object.entries(m)) if (x.channelId !== pin.channelId) next[k] = x
        if (!res.ok) next[key] = { kind: res.kind, error: res.error, channelId: pin.channelId, href: pin.pinnedHref }
        return next
      })
      if (!res.ok) { setStatus(''); setAlert(res.error); return }
      lock.current[id] = Date.now() + GUARD_MS
      setAlert(''); setOver(o => ({ ...o, [id]: kind === 'pin' }))
      setStatus(kind === 'pin' ? PIN_TEXT.saidPin : PIN_TEXT.saidUnpin)
      router.refresh()
    })
  }, [onPin, onUnpin, router])

  const value = useMemo<Ctx>(() => ({ busy, msgs, over, run }), [busy, msgs, over, run])
  return (
    <PinCtx.Provider value={value}>
      {children}
      {/* live regions: mounted empty with the screen, only their text changes. The visible message is not a live region. */}
      <div id="fx-status" className="fx-live" role="status" aria-live="polite">{status}</div>
      <div id="fx-alert" className="fx-live" role="alert" aria-live="assertive">{alert}</div>
    </PinCtx.Provider>
  )
}

/**
 * The pin control of one video. Fixed width (CSS): it does not move or resize between "Fixar vídeo", "Fixando…",
 * "Desafixar" and "Desafixando…". `k` = the card's key when the same video shows in several cards (unique ids).
 */
export function PinButton({ pin, k, className }: { pin: PinView; k?: string; className: string }) {
  const c = useContext(PinCtx)
  const [hint, setHint] = useState(false)
  const pointer = useRef(false)
  const btn = useRef<HTMLButtonElement>(null)
  if (!c) return null
  const key = k ?? pin.videoId
  const pinned = c.over[pin.videoId] ?? pin.pinned, b = c.busy[pin.videoId] ?? null, msg = c.msgs[key] ?? null
  const act: Kind = pinned ? 'unpin' : 'pin'
  const label = b ? (b === 'pin' ? PIN_TEXT.pinBusy : PIN_TEXT.unpinBusy) : act === 'pin' ? PIN_TEXT.pin : PIN_TEXT.unpin
  const hintId = 'fx-hint-' + key
  // V1: the hint never shares the screen with a message, and never stays after the button was activated
  const open = hint && act === 'pin' && !b && !msg
  const describedBy = [msg ? 'fx-msg-' + key : null, b ? 'fx-status' : act === 'pin' ? hintId : null].filter(Boolean).join(' ')
  return (
    <span className="fx-anchor">
      <button ref={btn} type="button" className={className + ' fx-btn'} data-pin={pin.videoId} data-fx-k={key} data-pin-act={act}
        aria-label={label + ': ' + pin.title} aria-busy={b ? true : undefined} aria-disabled={b ? true : undefined} aria-describedby={describedBy || undefined}
        onPointerDown={() => { pointer.current = true }}
        onFocus={() => { setHint(!pointer.current); pointer.current = false }}
        onBlur={() => { setHint(false); pointer.current = false }}
        onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setHint(false) } }}
        onClick={() => { setHint(false); if (!b) c.run(pin, key, pinned) }}>
        <PinIcon name={b ? 'spin' : act} /><span>{label}</span>
      </button>
      {act === 'pin' ? <span id={hintId} className="fx-hint" role="tooltip" data-open={open ? '' : undefined}>{pin.hint}</span> : null}
      {/* the visible box lives in #flut; the span above stays for screen readers (it is the button's description) */}
      {act === 'pin' ? <HoverTip show={open} anchor={() => btn.current} className="fx-hint-pop" pref="lado" lado="esquerda" queda="cima" outroLado={false} align="inicio" gap={8} gapQueda={6} maxW={300} ariaHidden>{pin.hint}</HoverTip> : null}
    </span>
  )
}

/** The action's answer for one control, below it. Three treatments by `kind`, each with its own icon (not colour alone). */
export function PinMessage({ k }: { k: string }) {
  const msg = useContext(PinCtx)?.msgs[k]
  if (!msg) return null
  const cls = msg.kind === 'cap' ? 'fx-cap' : msg.kind === 'failed' ? 'fx-err' : 'fx-info'
  return (
    <p className={'fx-msg ' + cls} id={'fx-msg-' + k} data-fx-msg={msg.kind}>
      <PinIcon name={msg.kind === 'cap' ? 'warn' : msg.kind === 'failed' ? 'err' : 'info'} />
      <span>{msg.error}{msg.kind === 'cap' ? <> <a href={msg.href}>{PIN_TEXT.seePinned}</a></> : null}</span>
    </p>
  )
}

export function PinChips({ chips, small }: { chips: PinChipView[]; small?: boolean }) {
  return (
    <>
      {chips.map(ch => (
        <span key={ch.kind} className={'fx-chip' + (ch.how == null ? ' fx-out' : '') + (small ? ' fx-sm' : '')} data-fx={ch.kind}>
          <span className="fx-st">
            {ch.kind === 'fixado' || ch.kind === 'fixado-agora' || ch.kind === 'sem-resposta' ? <PinIcon name="pinOn" /> : ch.kind === 'fora' ? <PinIcon name="out" /> : null}
            {ch.label}{ch.how ? <span className="fx-sr">, </span> : null}
          </span>
          {ch.how ? <span className="fx-how">{ch.how}</span> : null}
        </span>
      ))}
    </>
  )
}
