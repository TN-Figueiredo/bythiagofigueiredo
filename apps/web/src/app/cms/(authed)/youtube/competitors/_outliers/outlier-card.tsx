'use client'
/**
 * Outlier card (port of outliers.html card/multBlock/ruler/thumb/actions). The main card (biggest multiplier of a
 * phase, long videos) spans two columns, follows the row's height and anchors its footer at the bottom
 * (approval 02/10). Every text and number arrives ready from the view model.
 */
import { useRef, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { HoverTip, Popover } from '../_chrome/flut/flut'
import type { OutlierCardView, Rich } from './view-model'

const P: Record<string, ReactNode> = {
  estourando: <path d="M8.5 1.5c.4 2.3-1 3.4-2.1 4.6C5.3 7.3 4.5 8.5 4.5 10a3.5 3.5 0 0 0 7 0c0-1.3-.6-2.2-1.2-2.9-.2 1-.8 1.6-1.4 1.8.4-2.6-.1-5.4-.4-7.4z" fill="currentColor" />,
  perene: <path d="M8 14.5V7M8 9c-3.2 0-4.5-2-4.5-4.5C6.5 4.5 8 6 8 9zm0-1.5c0-2.8 1.6-4.5 4.5-4.5 0 2.8-1.6 4.5-4.5 4.5z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  antigo: <><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></>,
  recente: <path d="M2.5 11.5l3.5-3.5 2.5 2.5 5-5M10 5.5h3.5V9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  novos: <path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
  'sem-ritmo': <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2.2" />,
  hist: <><path d="M2.5 13.5h11M4 11l3-3.5 2.5 2 3-4.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="7" cy="7.5" r="1.2" fill="currentColor" /></>,
  ext: <path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v4h-9v-9h4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  warn: <><path d="M8 2l6.5 11.5h-13z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" /><path d="M8 6.5v3.2M8 11.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
  grid: <path d="M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z" stroke="currentColor" strokeWidth="1.3" fill="none" />,
  list: <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
  empty: <><circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.1" fill="none" /><path d="M10.4 10.4l3.6 3.6M5 7h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></>,
}
/** Only a keyboard focus shows the tip (the old CSS was `:focus-visible`): a mouse click or the window re-focusing a link must not. */
export function focoDeTeclado(el: Element): boolean {
  try { return el.matches(':focus-visible') } catch { return true } // browser without the selector: keep the tip reachable by focus
}
export function OutIcon({ name, className = 'obs-out-i' }: { name: string; className?: string }) {
  return <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false">{P[name]}</svg>
}

export function RichText({ parts }: { parts: Rich }) {
  return <>{parts.map((p, i) => typeof p === 'string' ? <span key={i}>{p}</span>
    : 'b' in p ? <b key={i}>{p.b}</b>
    : 'w' in p ? <span key={i} className="obs-out-w">{p.w}</span>
    : <abbr key={i} title={p.title}>{p.abbr}</abbr>)}</>
}

export function Thumb({ c, rank }: { c: OutlierCardView; rank?: boolean }) {
  const art = c.art
  return (
    <span className="obs-out-thumb" data-thumb="" aria-hidden="true"
      style={art ? { background: `linear-gradient(115deg,${art.bg} 0 58%,${art.fg} 58% 100%)` } : undefined}>
      {c.thumb ? <img src={c.thumb} alt="" loading="lazy" decoding="async" /> : art ? <>
        <span className="obs-out-tbody" /><span className="obs-out-thead" />
        <span className="obs-out-word" style={{ color: art.ink }}>{art.text}</span>
      </> : null}
      {c.dur ? <span className="obs-out-dur">{c.dur}</span> : null}
      {rank ? <span className="obs-out-rankb" title="Maior multiplicador do grupo">Maior multiplicador</span> : null}
    </span>
  )
}

export function MultBlock({ c, compact, lead }: { c: OutlierCardView; compact?: boolean; lead?: boolean }) {
  const [open, setOpen] = useState(false)
  // hover and focus are separate: leaving with the mouse does not hide the account of a button that still has the focus
  const [hover, setHover] = useState(false)
  const [foco, setFoco] = useState(false)
  // Esc (or a click away) closes the popover: the account must not come back as a tip while the mouse/focus stay on the "i"
  const [off, setOff] = useState(false)
  const closing = useRef(false) // the focus handed back to the button by that same close is not a new focus
  const btn = useRef<HTMLButtonElement>(null)
  const id = 'obs-out-tip-' + c.id + (compact ? '-l' : '')
  const cls = ['obs-out-mult', c.stale ? 'obs-out-stalev' : '', c.weak ? 'obs-out-weak' : '', c.neutral ? 'obs-out-neutral' : ''].filter(Boolean).join(' ')
  const vs = compact && !c.neutral ? c.multLabel.replace(/^vs (vídeos|Shorts) do canal/, 'vs canal') : c.multLabel
  // "(n = 14)" / "(este tinha 31 dias; n = 5)" never breaks inside (mockup nTxt is .nw)
  const cut = vs.lastIndexOf(' (')
  const vsHead = cut >= 0 ? vs.slice(0, cut + 1) : vs, vsTail = cut >= 0 ? vs.slice(cut + 1) : ''
  const tipShown = (hover || foco) && !off && !open
  // inside a table the block is flush right: the box grows leftwards from the button's end; in a card it starts at the button
  const align = compact ? 'fim' : 'inicio'
  return (
    <div className={cls} data-id={c.id}>
      <span className={'obs-out-x obs-out-mono' + (c.tier ? ' obs-out-tier-' + c.tier : '')}>{c.mult}</span>
      <span className="obs-out-vs">{vsHead}<span className="obs-out-nw">{vsTail}</span>{lead ? null : <>{' '}
        <button ref={btn} className="obs-out-info" type="button" aria-label={'Como o ' + c.mult + ' é calculado'} aria-describedby={open || tipShown ? id : undefined} aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          onMouseEnter={() => { setHover(true); setOff(false) }} onMouseLeave={() => { setHover(false); setOff(false) }}
          onFocus={e => { setFoco(focoDeTeclado(e.currentTarget)); if (!closing.current) setOff(false) }} onBlur={() => { setFoco(false); setOff(false) }}
          onKeyDown={e => { if (e.key === 'Escape') { setHover(false); setFoco(false) } }}><span aria-hidden="true">i</span></button>
        <HoverTip show={tipShown} anchor={() => btn.current} id={id} className="obs-out-tip" pref="baixo" align={align} gap={0} maxW={320}><RichText parts={c.tip} /></HoverTip>
        <Popover open={open} anchor={() => btn.current} id={id} role="tooltip" className="obs-out-tip" pref="baixo" align={align} gap={0} maxW={320}
          onClose={() => { closing.current = true; queueMicrotask(() => { closing.current = false }); setOpen(false); setOff(true) }}><RichText parts={c.tip} /></Popover></>}</span>
      {c.flags.map(f => <span className="obs-out-flag" key={f}><OutIcon name="warn" /><span>{f}</span></span>)}
    </div>
  )
}

export function Ruler({ c, legend }: { c: OutlierCardView; legend?: boolean }) {
  const color = c.ruler.tone === 'muted' ? 'var(--muted)' : `var(--tier-${c.ruler.tone})`
  const [t2, t5, t10] = c.ruler.ticks
  const [l2, l5, l10] = c.ruler.legend
  return <>
    <div className="obs-out-ruler" aria-hidden="true"><div className="obs-out-track" />
      <div className="obs-out-tick obs-out-tick-base" style={{ left: 0 }} />
      {c.ruler.ticks.map((t, i) => <div className="obs-out-tick" key={i} style={{ left: t + '%' }} />)}
      <div className="obs-out-fill" style={{ left: c.ruler.from + '%', width: Math.max(0, c.ruler.pos - c.ruler.from) + '%', background: color, opacity: 0.45 }} />
      <div className="obs-out-dot" style={{ left: c.ruler.pos + '%', background: color }} />
    </div>
    {legend ? <div className="obs-out-ruler-legend" aria-hidden="true">
      <span style={{ left: 0 }}>base</span><span style={{ left: t2 + '%' }}>{l2}</span><span style={{ left: t5 + '%' }}>{l5}</span>
      <span style={{ left: t10 + '%' }}>{l10}</span><span style={{ left: '100%' }}>50× (log)</span>
    </div> : null}
  </>
}

/** Icon link with a tip in the floating layer (#flut): mouse and focus are separate, the words are already its aria-label. */
function IbLink({ tip, children, ...rest }: { tip: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const el = useRef<HTMLAnchorElement>(null)
  const [hover, setHover] = useState(false)
  const [foco, setFoco] = useState(false)
  return (
    <a {...rest} ref={el} className="obs-out-ib" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={e => setFoco(focoDeTeclado(e.currentTarget))} onBlur={() => setFoco(false)}>
      {children}
      <HoverTip show={hover || foco} anchor={() => el.current} className="obs-out-ibtip" pref="cima" align="fim" gap={4} ariaHidden>{tip}</HoverTip>
    </a>
  )
}

export function Actions({ c }: { c: OutlierCardView }) {
  // "Salvar no swipe file" per video is follow-up FU-2 (ruling R43): the swipe store is keyed by change/version.
  return (
    <div className="obs-out-acts">
      <IbLink tip="Ver histórico do vídeo" data-hist={c.id} href={c.historyHref} aria-label={'Ver histórico do vídeo: ' + c.title}><OutIcon name="hist" /></IbLink>
      <IbLink tip="Abrir no YouTube" data-yt={c.id} href={c.url} target="_blank" rel="noopener noreferrer" aria-label={'Abrir no YouTube: ' + c.title}><OutIcon name="ext" /></IbLink>
    </div>
  )
}

export function StageChip({ c }: { c: OutlierCardView }) {
  return <span className={'obs-out-stagechip obs-out-' + c.phase.tone}><OutIcon name={c.phase.id} />{c.phase.label}</span>
}

function Who({ c }: { c: OutlierCardView }) {
  return (
    <div className="obs-out-who">
      <span className="obs-out-chn" title={c.channelFull}>{c.channel}</span>
      {c.niche ? <span className={'obs-out-niche obs-out-niche-' + c.niche}>{c.nicheLabel}</span> : null}
      {c.showPhase ? <StageChip c={c} /> : null}
    </div>
  )
}

function Reuse({ c }: { c: OutlierCardView }) {
  if (!c.reuse) return null
  return <div className="obs-out-reuse">Assunto de {c.reuse.month}: <b>ainda relevante?</b> <span className="obs-out-mono">{c.reuse.vpd7}</span>/dia contra <span className="obs-out-mono">{c.reuse.median}</span>/dia da mediana do canal (últimos 7 dias).</div>
}

function Meta({ c }: { c: OutlierCardView }) {
  return (
    <div className="obs-out-meta">
      <span title={c.ageTitle}>{c.age}</span>
      <span className={c.vpdTitle && c.vpdShortNote ? 'obs-out-wrapok' : undefined} title={c.vpdTitle ?? undefined}>{c.stale || c.vpdText.startsWith('menos') ? c.vpdText : <><span className="obs-out-vpd obs-out-mono">{c.vpdShort}</span>{c.vpdText.slice(c.vpdShort.length)}</>}</span>
      <Actions c={c} />
    </div>
  )
}

export function OutlierCard({ c, shorts }: { c: OutlierCardView; shorts?: boolean }) {
  if (c.main && !shorts) {
    return (
      <article className="obs-out-card obs-out-lead" data-outlier="" data-id={c.id} data-phase={c.phase.id} data-weak="false">
        <Thumb c={c} rank />
        <div className="obs-out-body"><span className="obs-out-sr">Maior multiplicador do grupo.</span>
          <h3 className="obs-out-ttl" title={c.title}>{c.title}</h3>
          <Who c={c} />
          <MultBlock c={c} lead />
          <Ruler c={c} legend />
        </div>
        <div className="obs-out-foot">
          {c.why ? <p className="obs-out-why"><RichText parts={c.why} /></p> : null}
          <Reuse c={c} />
          <Meta c={c} />
        </div>
      </article>
    )
  }
  return (
    <article className={'obs-out-card' + (c.main ? ' obs-out-lead-s' : '')} data-outlier="" data-id={c.id} data-phase={c.phase.id} data-weak={String(c.weak)}>
      <Thumb c={c} />
      <div className="obs-out-body">
        {c.main ? <span className="obs-out-rank">Maior multiplicador do grupo</span> : null}
        <h3 className="obs-out-ttl" title={c.title}>{c.title}</h3>
        <Who c={c} />
        <MultBlock c={c} />
        <Ruler c={c} />
        {c.phaseWhy ? <p className="obs-out-pwhy">{c.phaseWhy}</p> : null}
        <Reuse c={c} />
        <Meta c={c} />
      </div>
    </article>
  )
}
