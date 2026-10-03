import { Fragment } from 'react'
import Link from 'next/link'
import type { GapsSection } from './view-model'
import { RichText } from './rich'
import { NoRef } from './no-ref'

/**
 * Lacunas (insights-n-canais.html renderGaps): one list, by theme and never by tag; each theme says in how many and in
 * which own channels of the niche it is missing, and who already has it. "Criar ideia" is not drawn: it is follow-up
 * FU-16 (no action creates an idea with theme + format + destination channel yet), so there is no button here.
 */
export function Gaps({ s }: { s: GapsSection }) {
  return (
    <section className="card c4" id="gapCard" aria-labelledby="gapH">
      <div className="chead"><h2 id="gapH">Lacunas</h2><span className="meta">{s.meta}</span></div>
      <div className="cbody">
        {s.noRef ? <NoRef b={s.noRef} /> : s.empty ? (
          <div className="empty"><h3>{s.empty.title}</h3><p>{s.empty.text}</p>
            {s.empty.links?.length ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{s.empty.links.map(l => <Link key={l.href} className="btn" href={l.href}>{l.text}</Link>)}</div> : null}
          </div>
        ) : (
          <>
            {s.rows.length ? s.rows.map(t => (
              <div className="grow" key={t.theme} data-theme={t.theme} data-lacks={t.lacks.length}>
                <div><div className="gtag">{t.label}</div><div className="gsub"><RichText parts={t.sub} /></div><div className="glack">{t.lack}</div>{t.have ? <div className="gsub">{t.have}</div> : null}</div>
              </div>
            )) : <p style={{ color: 'var(--muted)', margin: 0 }}>{s.none}</p>}
            {s.notes.map(n => (
              <p className="ynote" key={n.text}>{n.text}{n.links.length ? ' ' : null}{n.links.map((l, i) => <Fragment key={l.href}>{i ? ' · ' : null}<Link href={l.href}>{l.text}</Link></Fragment>)}</p>
            ))}
          </>
        )}
      </div>
      {s.foot ? <div className="foot">{s.foot}</div> : null}
    </section>
  )
}
