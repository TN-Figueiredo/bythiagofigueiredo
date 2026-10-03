import type { GapsSection } from './view-model'
import { RichText } from './rich'

/** Lacunas (insights.html renderGaps): by theme, never by tag; "Criar ideia no pipeline" is out of scope (spec §6). */
export function Gaps({ s }: { s: GapsSection }) {
  return (
    <section className="card c4" id="gapCard" aria-labelledby="gapH">
      <div className="chead"><h2 id="gapH">Lacunas</h2><span className="meta">{s.meta}</span></div>
      <div className="cbody">
        {s.empty ? <div className="empty"><h3>{s.empty.title}</h3><p>{s.empty.text}</p></div>
          : s.rows.length ? s.rows.map(t => (
            <div className="grow" key={t.theme} data-theme={t.theme}><div><div className="gtag">{t.label}</div><div className="gsub"><RichText parts={t.sub} /></div></div></div>
          )) : <p style={{ color: 'var(--muted)', margin: 0 }}>{s.none}</p>}
      </div>
      {s.foot ? <div className="foot">{s.foot}</div> : null}
    </section>
  )
}
