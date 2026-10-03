'use client'
/**
 * The forja in Histórico (port of historico-video.html forjaButton + renderForja): the screen's single filled button
 * "Pedir leitura à forja" (leitura-video) in the video header, and the "Leitura da forja" card. Another video of the
 * same niche with an active request disables the button with the engine's reason and a link to that video's history.
 * Actions arrive as props (askForjaReading / cancelForjaReading); nothing is imported from the server.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ForjaReadingView, ForjaView } from '../_chrome/forja-view-model'
import type { ForjaAsk, ForjaCancel } from '../_chrome/forja-view-model'
import { useToast } from '../_chrome/toasts'
import type { HistForjaCard } from './view-model'

const FORJA = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4 15h11l3-5H7zM9 15v4M14 15v4M6 19h11" /></svg>
const FORJA12 = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4 15h11l3-5H7zM9 15v4M14 15v4M6 19h11" /></svg>
const WARN = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></svg>
const endDot = (t: string) => { const s = t.trim(); return /[.!?…]$/.test(s) ? s : s + '.' }
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** The blockedBy message: the other video's title becomes the link to its history (spec 2.6). */
function Blocked({ b }: { b: NonNullable<HistForjaCard['blocked']> }) {
  const q = '“' + b.title + '”', i = b.text.indexOf(q)
  if (i < 0) return <>{b.text} <Link className="inl" href={b.href}>{b.title}</Link></>
  return <>{b.text.slice(0, i)}“<Link className="inl" href={b.href} data-go="">{b.title}</Link>”{b.text.slice(i + q.length)}</>
}

export function ForjaAskButton({ forja, card, onAsk }: { forja: ForjaView; card: HistForjaCard; onAsk?: ForjaAsk }) {
  const router = useRouter(), toast = useToast()
  const [refused, setRefused] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const b = forja.button
  const ask = async () => {
    if (!onAsk || busy || b.mode !== 'free' || !forja.videoId) return
    setBusy(true)
    let r: Awaited<ReturnType<ForjaAsk>>
    try { r = await onAsk('leitura-video', forja.niche, forja.videoId) } catch { r = { ok: false, reason: 'A fila da forja não respondeu. Tente de novo em alguns minutos.', results: [] } }
    setBusy(false)
    if (!r.ok) { setRefused(r.reason ?? 'não foi possível pedir agora'); return }
    setRefused(null)
    toast('forja', 'Pedido enviado à forja', '')
    router.refresh()
  }
  if (b.mode === 'busy') return <button className="btn forja-solid" type="button" aria-disabled="true" id="askForja">{FORJA}Pedido em andamento</button>
  if (b.mode === 'disabled') {
    return (
      <>
        <button className="btn forja-solid" type="button" aria-disabled="true" id="askForja" aria-describedby="askStatus">{FORJA}{b.label}</button>
        <span className="fstatus" id="askStatus">{card.blocked ? <Blocked b={card.blocked} /> : b.disabledText}</span>
      </>
    )
  }
  return (
    <>
      <button className="btn forja-solid" type="button" id="askForja" aria-describedby={refused ? 'askStatus' : undefined} aria-disabled={busy || undefined} onClick={ask}>{FORJA}{b.label}</button>
      {refused ? <span className="fstatus" id="askStatus" role="status">{endDot(cap(refused))}</span> : null}
    </>
  )
}

function ReadingBlock({ r, label, open }: { r: ForjaReadingView; label: string | null; open: boolean }) {
  return (
    <>
      <details className="reading" data-reading={r.id} open={open || undefined}>
        <summary className="rh">
          {label ? <span className="rlabel">{label}</span> : null}
          <span className="seal">{FORJA12}{r.seal}</span>
          <span className="rlead">{r.lead}</span>
          <span className="rmore"><span className="rm-open">Ver leitura</span><span className="rm-close">Recolher leitura</span></span>
        </summary>
        <div className="lit">
          {r.lead ? <p className="body">{r.lead}</p> : null}
          {r.items.length ? <ul>{r.items.map((t, i) => <li key={i}>{t}</li>)}</ul> : null}
        </div>
        <section className="from-site" aria-labelledby={'fs-' + r.id + (label ? '-a' : '')}>
          <h4 className="fs-h" id={'fs-' + r.id + (label ? '-a' : '')}>Do site</h4>
          <p className="src">Leitura de {r.when}. {r.sentText}</p>
          {r.since ? <p className="src">{r.since.text}</p> : null}
          {r.siteNotes.map(n => <p className="src" key={n}>{n}</p>)}
        </section>
      </details>
      {r.since ? <p className="src since-short">{r.since.shortText}</p> : null}
    </>
  )
}

const STEPS = ['na fila', 'trabalhando', 'publicado']

export function VideoReading({ card, forja, onCancel }: { card: HistForjaCard; forja: ForjaView; onCancel?: ForjaCancel }) {
  const router = useRouter(), toast = useToast()
  const cancel = async () => {
    if (!onCancel || !forja.videoId || forja.niche === 'todos') return
    const r = await onCancel('leitura-video', forja.niche, forja.videoId).catch(() => ({ ok: false, reason: 'A fila da forja não respondeu.' }))
    if (r.ok) toast('forja', 'Pedido cancelado', '')
    else toast('warn', 'Não deu para cancelar', endDot(cap(r.reason ?? '')))
    router.refresh()
  }
  return (
    <section className="card forja" id="forja" aria-labelledby="fjh" tabIndex={-1} data-forja-anchor="">
      <div className="fh">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <h3 id="fjh">Leitura da forja</h3>
          {card.pill ? <span className={'state' + (card.pill.cls ? ' ' + card.pill.cls : '')}>{card.pill.text}</span> : null}
        </div>
        <div className="f-actions">{card.cancel ? <button className="btn ghost" type="button" onClick={cancel}>Cancelar pedido</button> : null}</div>
      </div>
      {card.excluded ? <p className="ex warnline">{WARN}<span>{card.excluded}</span></p> : null}
      {card.blocked && !card.pill ? <p className="ex warnline">{WARN}<span><Blocked b={card.blocked} /></span></p> : null}
      {card.statusText ? <p className="ex">{card.statusText}</p> : null}
      {card.extra ? <p className="ex">{card.extra}</p> : null}
      {card.step != null ? (
        <div className="steps">{STEPS.map((s, k) => <span key={s} className={k < card.step! ? 'done' : k === card.step ? 'now' : undefined}><i className="dot" aria-hidden="true" />{s}</span>)}</div>
      ) : null}
      {card.intro ? <p className="ex">{card.intro}</p> : null}
      {card.fresh ? <ReadingBlock r={card.fresh} label={null} open /> : null}
      {card.reading ? <ReadingBlock r={card.reading} label={card.fresh ? 'Leitura anterior' : card.readingLabel} open={false} /> : null}
      {card.niche ? (card.niche.items.length ? (
        <section className="from-site nb" aria-labelledby="fs-nb">
          <h4 className="fs-h" id="fs-nb">Do site</h4>
          <p className="src">{card.niche.text}</p>
          <ul>{card.niche.items.map(x => <li key={x.href}>{x.text} <Link href={x.href}>{x.label}</Link></li>)}</ul>
          {card.niche.foot ? <p className="src">{card.niche.foot}</p> : null}
        </section>
      ) : <p className="ex">{card.niche.text}</p>) : null}
    </section>
  )
}
