'use client'
/**
 * The forja in the chrome header (port of chrome.js forjaHtml + the heartbeat segment of headHtml). Everything comes
 * from ForjaView. Clicking the status NEVER creates a request: it scrolls to the screen's [data-forja-anchor]
 * (CONVENCOES:215: "abre/rola até o andamento na tela"; it never creates a request). Only the ask button asks.
 */
import type { ForjaView } from './forja-view-model'
import { Icon } from './icons'

/** "a" + ". " + "b" with no space before the punctuation and no double period (chrome.js srJoin). */
export function srJoin(a: string, b: string): string {
  const x = a.trim(), y = b.trim()
  if (!y) return x
  if (!x) return y
  return (/[.!?…:;]$/.test(x) ? x : x + '.') + ' ' + y
}

/** chrome.js goToAnchor: scroll to the screen's progress anchor and focus it; never creates a request. */
export function goToForjaAnchor(): void {
  const a = document.querySelector<HTMLElement>('[data-forja-anchor]')
  if (!a) return
  if (!a.hasAttribute('tabindex')) a.setAttribute('tabindex', '-1')
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  a.scrollIntoView?.({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  a.focus({ preventScroll: true })
}

export function ForjaHeaderButtons({ forja, onOpen, onStatus }: {
  forja: ForjaView
  /** The ask (R58): the screen asks directly, or opens its own confirm (Mudanças). */
  onOpen: () => void
  /** The status click: scrolls to the anchor; NEVER asks. */
  onStatus?: () => void
}) {
  const v = forja.headerVariant
  const cls = 'obs-ch-btn ' + (v === 'solid' ? 'obs-ch-forja-solid' : 'obs-ch-forja')
  const st = forja.status, b = forja.button
  const status = onStatus ?? goToForjaAnchor
  if (st && st.active) {
    const ask = b.mode === 'free-niche' && v !== 'none'
      ? (
        <button className={cls} type="button" data-ck="forja-ask" title={b.label} aria-label={b.ariaLabel} onClick={onOpen}>
          {Icon.anvil()}<span className="obs-ch-lbl-t"><span className="obs-ch-lf" aria-hidden="true">{b.label}</span><span className="obs-ch-ls" aria-hidden="true">{b.short ?? b.label}</span></span>
        </button>
      )
      : v === 'none' ? null : (
        <button className="obs-ch-btn obs-ch-forja obs-ch-busy" type="button" disabled title="Pedido em andamento">{Icon.anvil()}<span className="obs-ch-lbl-t">Pedido em andamento</span></button>
      )
    return (
      <>
        {ask}
        <button className={'obs-ch-btn obs-ch-forja' + (st.warn ? ' obs-ch-warn' : '')} type="button" id="obs-ch-req-status" data-ck="forja" aria-describedby="obs-ch-req-desc"
          title={srJoin('Pedido em andamento: ' + st.text, st.statusText)} onClick={status}>{st.text}</button>
        <span className="obs-ch-sr" id="obs-ch-req-desc">{srJoin('Pedido em andamento', st.statusText)}</span>
        {st.secondary.map(t => <span key={t} className="obs-ch-pill obs-ch-pill-2" title={t}><span className="obs-ch-sr">Outro pedido, </span>{t}</span>)}
      </>
    )
  }
  const pill = st && st.terminal && st.text ? (
    <span className={'obs-ch-pill' + (st.warn ? ' obs-ch-warn' : '')} title={st.statusText}>
      <span aria-hidden="true">{st.text}</span><span className="obs-ch-sr">{srJoin('Último pedido: ' + st.text, st.statusText)}</span>
    </span>
  ) : null
  if (v === 'none') return pill
  if (b.mode === 'disabled' || b.mode === 'busy') {
    return (
      <>
        {pill}
        <button className={cls} type="button" disabled title={b.disabledText ?? b.label} aria-describedby="obs-ch-forja-why">{Icon.anvil()}<span className="obs-ch-lbl-t">{b.label}</span></button>
        <span className="obs-ch-sr" id="obs-ch-forja-why">{b.disabledText ?? ''}</span>
      </>
    )
  }
  const short = b.mode === 'free-niche' ? b.short ?? b.label : 'Pedir à forja'
  return (
    <>
      {pill}
      <button className={cls} type="button" data-ck="forja" title={b.label} aria-label={pill || b.mode === 'free-niche' ? b.ariaLabel : undefined} onClick={onOpen}>
        {Icon.anvil()}
        <span className="obs-ch-lbl-t">{pill || b.mode === 'free-niche'
          ? <><span className="obs-ch-lf" aria-hidden="true">{b.label}</span><span className="obs-ch-ls" aria-hidden="true">{short}</span></>
          : b.label}</span>
      </button>
    </>
  )
}

/** The heartbeat segment of the freshness row: "forja consultou às 14:55" / "forja sem máquina · 12:55". */
export function ForjaMachineSegment({ machine }: { machine: ForjaView['machine'] }) {
  return (
    <span className={'obs-ch-forja-seg' + (machine.alive ? '' : ' obs-ch-off')} title={machine.title} data-forja-machine="">
      <span className={'obs-ch-dot ' + (machine.alive ? 'obs-ch-forja' : 'obs-ch-warn')} aria-hidden="true" />
      {machine.alive
        ? <><span>forja<span className="obs-ch-long"> consultou às</span></span>{' '}<b className="obs-ch-num">{machine.time}</b></>
        : <>forja <b>{machine.text.replace(/^forja /, '')}</b></>}
    </span>
  )
}
