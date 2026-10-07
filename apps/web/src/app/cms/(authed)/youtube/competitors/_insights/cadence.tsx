'use client'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import type { CadenceSection } from './view-model'
import { ChannelAvatar } from '../_chrome/channel-avatar'

/** Fits each hatch label to its band (insights.html fitIdle): full text, then the short "⚠", then hidden (title keeps it). */
function fitIdle(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.lane .idle span').forEach(sp => {
    const box = sp.parentElement!
    sp.classList.remove('cut'); box.classList.remove('mini')
    if (sp.dataset.full) sp.textContent = sp.dataset.full
    if (sp.offsetWidth <= box.clientWidth - 12) return
    if (sp.dataset.short) { sp.textContent = sp.dataset.short; box.classList.add('mini'); if (sp.offsetWidth <= box.clientWidth) return }
    sp.classList.add('cut')
  })
}

/** Cadência por canal (insights.html renderCad): ticks, hatches and texts all come from the view model. */
export function Cadence({ s }: { s: CadenceSection }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    fitIdle(el)
    const on = () => fitIdle(el)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [s])
  // no competitor in the niche: the card only says so — no legend, no axis, no foot (mockup 04/10, renderCad noComp)
  if (s.noComp) {
    return (
      <section className="card c8" id="cadCard" aria-labelledby="cadH" ref={ref}>
        <div className="chead"><h2 id="cadH">Cadência por canal</h2><span className="meta">{s.meta}</span></div>
        <div className="cbody"><div className="empty"><p>{s.empty}</p></div></div>
      </section>
    )
  }
  return (
    <section className="card c8" id="cadCard" aria-labelledby="cadH" ref={ref}>
      <div className="chead"><h2 id="cadH">Cadência por canal</h2><span className="meta">{s.meta}</span>
        <div className="legend right">{s.legend.map(l => <span key={l.text}><i style={{ background: l.color }} />{l.text}</span>)}</div></div>
      <div className="cbody">
        {s.empty ? <p className="empty-note">{s.empty}</p> : null}
        <div className="cad-axis" aria-hidden="true"><span>Canal e ritmo</span>
          <div className="ticks">{s.axis.map(a => <span key={a.left} style={{ left: a.left }}>{a.text}</span>)}</div>
          <span style={{ textAlign: 'right' }}>Último upload</span></div>
        {s.rows.map(r => (
          <div className="cad-row" role="group" key={r.id} data-ch={r.id} data-sync-off={r.syncOff ? 1 : 0} data-habit={r.costuma ? 1 : 0} data-partial={r.partial ? 1 : 0} aria-label={r.aria}>
            <div className="cad-id"><ChannelAvatar src={r.avatar} ini={r.ini} color={r.color} ink="#fff" />
              <div style={{ minWidth: 0 }}>
                <div className="cad-name" id={'cadn-' + r.id} title={r.fullName}>{r.name}</div>
                <div className="cad-sub">
                  {r.noneSub ? r.noneSub : (
                    <>
                      <span className="mono">{r.pace}</span>/sem{r.partial ? <> <span className="warnc">(ritmo parcial)</span></> : null}<br />{/* a recurring time of day, not an event: exempt from the future-time audit */}<span data-future="">{r.habit}</span><br />
                      {r.outLink?.href ? <Link className="vlink" href={r.outLink.href} data-n={r.outLink.n} aria-describedby={'cadn-' + r.id}>{r.outLink.text}</Link> : <span className="nolink">{r.outLink?.text}</span>}
                    </>
                  )}
                  {r.warn ? <><br /><span className="warnc">{r.warn}</span></> : null}
                </div>
              </div>
            </div>
            <div className="lane" aria-hidden="true">
              {r.none ? <div className="none">{r.none}</div> : null}
              {r.ticks.map((t, i) => <span key={i} className={'tk' + (t.tier ? ' ' + t.tier : '')} style={{ left: t.left, height: t.height + 'px' }} title={t.title} />)}
              {r.hatches.map(h => (
                <div key={h.kind} className={'idle' + (h.kind === 'part' ? ' part' : h.kind === 'sync' ? ' sync' : '')} style={{ width: h.width, ...(h.left != null ? { left: h.left, right: 'auto' } : {}) }} title={h.title}>
                  <span data-full={h.short ? h.text : undefined} data-short={h.short ?? undefined}>{h.text}</span>
                </div>
              ))}
            </div>
            <div className="last">
              {r.last.kind === 'none' ? <span style={{ color: 'var(--muted)' }}>{r.last.text}</span>
                : r.last.kind === 'parado' ? <span className="w" title={r.last.title ?? undefined}>{r.last.text}</span>
                : <>{r.last.warn ? <span className="warnc" aria-hidden="true">⚠ </span> : null}<span className="mono" title={r.last.title ?? undefined}>{r.last.text}</span>{r.last.srNote ? <span className="sr">{r.last.srNote}</span> : null}</>}
            </div>
          </div>
        ))}
      </div>
      <div className="foot">{s.foot}</div>
    </section>
  )
}
