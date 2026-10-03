'use client'
/**
 * The forja in the Canais channel drawer (port of canais.html forjaState): the box at the top of "Trocas" (the niche's
 * request — the reading is of the whole niche, not only this channel) and the footer buttons. A channel out of the
 * request (no sincronização > 24 h) keeps the button disabled with the reason. Actions arrive as props.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Niche } from '@/lib/youtube/observatorio/types'
import type { ForjaAsk } from '../_chrome/forja-drawer'
import { useToast } from '../_chrome/toasts'
import type { CanaisDrawerForja } from './view-model'

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const endDot = (t: string) => { const s = t.trim(); return /[.!?]$/.test(s) ? s : s + '.' }

export function DrawerForjaBox({ f }: { f: CanaisDrawerForja }) {
  return (
    <div className="forjabox" id="cn-dForjaBox" data-forja-anchor="" tabIndex={-1}>
      <div className="forjastate" aria-live="polite">
        <b>forja</b> {f.head}
        {f.lines.length ? <ul className="slines" data-k="forjaLines">{f.lines.map(l => <li key={l.text} className={l.me ? 'me' : undefined}>{l.text}</li>)}</ul>
          : f.chip ? <> <span className="chip" data-k="forjaChip">{f.chip}</span></> : null}
        {f.stateText ? <>{f.lines.length ? null : <br />}<span data-k="forjaState">{f.stateText}</span></> : null}
        {f.readingHref ? <> <Link className="btn small link" href={f.readingHref}>Ver a leitura em Mudanças</Link></> : null}
      </div>
      <p className="cap" id="cn-dForjaWhy">{f.why}</p>
    </div>
  )
}

export function DrawerForjaFoot({ f, onAsk }: { f: CanaisDrawerForja; onAsk?: ForjaAsk }) {
  const router = useRouter(), toast = useToast()
  const [busy, setBusy] = useState(false)
  const ask = async (ns: Niche[]) => {
    if (!onAsk || busy) return
    setBusy(true)
    const out = await Promise.all(ns.map(n => onAsk('resumo-trocas', n).catch(() => ({ ok: false, reason: 'A fila da forja não respondeu.', results: [] }))))
    setBusy(false)
    const ok = out.filter(r => r.ok)
    if (ok.length) toast('forja', 'Pedido enviado à forja', '')
    else toast('warn', 'Pedido não enviado', 'Nada enviado: ' + endDot((out[0]?.reason ?? 'a forja recusou o pedido').replace(/^Nada enviado:\s*/, '')))
    router.refresh()
    document.getElementById('cn-dForjaBox')?.focus()
  }
  return (
    <>
      {f.free ? <button type="button" className="btn small" onClick={() => ask(f.free!.niches)} aria-disabled={busy || undefined}>{cap(f.free.label)}</button> : null}
      <button type="button" className="btn small forja" disabled={f.button.disabled} title={f.button.title} aria-describedby="cn-dForjaWhy" onClick={() => ask([f.niche])}>{f.button.label}</button>
    </>
  )
}
