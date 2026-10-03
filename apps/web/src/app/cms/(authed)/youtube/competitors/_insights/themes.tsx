import Link from 'next/link'
import type { ThemesSection } from './view-model'
import { RichText } from './rich'

const STAMP = <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M2 6h9l3-2v3l-3 1v1H5L2 6z" /><path d="M6 9v3M9 9v3M4 13h7" /></svg>

/** Temas em alta (insights.html renderThemes); empty state when no `temas` reading exists. */
export function Themes({ s }: { s: ThemesSection }) {
  return (
    <section className="card c5" id="themeCard" aria-labelledby="themeH">
      <div className="chead"><h2 id="themeH">Temas em alta</h2><span className="meta">{s.meta}</span>
        {s.seal ? <span className="stamp right">{STAMP}{s.seal}</span> : null}</div>
      <div className="cbody">
        {s.coverageNote ? <p className="empty-note" data-coverage="low">{s.coverageNote}</p> : null}
        {s.empty ? <div className="empty"><h3>{s.empty.title}</h3><p>{s.empty.text}</p></div> : s.rows.map(x => (
          <div className="trow" key={x.theme} data-trend={x.trend ?? 'sem-tendencia'} data-theme={x.theme} data-out={x.outLink.n}>
            <div>
              <div className="tname">{x.label}</div>
              <div className="tsub">
                <span>{x.channels.weak ? <span className="weak">{x.channels.text}</span> : x.channels.text}</span>
                {x.median ? <span><RichText parts={x.median} /></span> : null}
                <span>{x.outLink.href ? <Link className="vlink" href={x.outLink.href} data-n={x.outLink.n}>{x.outLink.text}</Link> : x.outLink.text}</span>
              </div>
            </div>
            {x.spark ? (
              <div className="spark" role="img" aria-label={x.spark.aria}>
                <span className="p" style={{ height: x.spark.prev + 'px' }} /><span className="c" style={{ height: x.spark.now + 'px' }} /><em className="mono">{x.spark.text}</em>
              </div>
            ) : <div />}
            <div className="trend">{x.trendText ? <span className={x.trendCls}><RichText parts={x.trendText} /></span> : null}</div>
          </div>
        ))}
      </div>
      {s.foot ? <div className="foot">{s.foot}</div> : null}
    </section>
  )
}
