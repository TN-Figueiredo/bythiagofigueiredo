import Link from 'next/link'
import type { YouSection } from './view-model'

/** Você no nicho (insights.html renderYou): relative metrics only; empty state when the own channel has no video. */
export function YouInNiche({ s }: { s: YouSection }) {
  return (
    <section className="card c4" id="youCard" aria-labelledby="youH">
      <div className="chead"><h2 id="youH">Você no nicho</h2><span className="meta">{s.meta}</span></div>
      <div className="cbody">
        {s.empty ? (
          <div className="empty"><h3>{s.empty.title}</h3><p>{s.empty.text}</p>{s.empty.link ? <Link className="btn" href={s.empty.link.href}>{s.empty.link.text}</Link> : null}</div>
        ) : (
          <>
            {s.head ? (
              <div className="youhead"><span className="av" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }} aria-hidden="true">{s.head.ini}</span>
                <div><div style={{ fontWeight: 500 }}>{s.head.title}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.head.sub}</div></div></div>
            ) : null}
            {s.rows.map(r => (
              <div className="you-row" key={r.key} data-you={r.key} data-few={r.few ? 1 : 0}>
                <div className="you-top"><span className="lbl">{r.label}</span><span className="val mono">{r.value}</span></div>
                <div className="scale" role="img" aria-label={r.scale.aria}><span className="nich" style={{ left: r.scale.niche }} /><span className="me" style={{ left: r.scale.me }} /></div>
                <div className="ends mono" aria-hidden="true"><span>{r.scale.lo}</span><span>{r.scale.hi}</span></div>
                <div className="you-cmp"><span>mediana do nicho <span className="mono">{r.median}</span></span>
                  <span><span className={r.verdict.cls}>{r.verdict.text}</span>{r.fewText ? <> · <span className="flat">{r.fewText}</span></> : null}</span></div>
              </div>
            ))}
          </>
        )}
      </div>
      {s.foot ? <div className="foot">{s.foot}</div> : null}
    </section>
  )
}
