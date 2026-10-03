import Link from 'next/link'
import type { FormulasSection } from './view-model'
import { RichText } from './rich'

/** Fórmulas de título (insights.html renderFormulas, "Hoje" branch: the reading's numbers arrive with Task 35). */
export function Formulas({ s }: { s: FormulasSection }) {
  return (
    <section className="card c7" id="formCard" aria-labelledby="formH">
      <div className="chead"><h2 id="formH">Fórmulas de título</h2><span className="meta">{s.meta}</span></div>
      <div className="cbody">
        {s.empty ? (
          <div className="empty"><h3>{s.empty.title}</h3><p>{s.empty.text}</p></div>
        ) : s.rows.map(r => (
          <div className="frow" key={r.id} data-formula={r.id} data-verdict={r.verdict}>
            <div className="ftitle">{r.label}<span className={r.chip.kind === 'ok' ? 'chip-ok' : r.chip.kind} title={r.chip.title ?? undefined}>{r.chip.text}</span></div>
            <div className="fsent">
              <RichText parts={r.sentence} />
              {r.example ? <><br /><span>Ex.: “{r.example}”</span></> : null}
              <span className="sr">{r.verdictText}</span>
            </div>
            <div>{r.link.href ? <Link className="vlink" href={r.link.href} data-n={r.link.n}>{r.link.text}</Link> : <span className="nw">{r.link.text}</span>}</div>
            <div className="fbars" aria-hidden="true">
              {r.bars.map(b => (
                <div className={'fb ' + b.kind} key={b.kind}><span>{b.label}</span><div className="tr"><span style={{ width: b.width }} /></div><span className="v mono">{b.value}</span></div>
              ))}
            </div>
          </div>
        ))}
        {s.zero ? <p className="formzero" data-zero={s.zero.ids.join(',')}>{s.zero.text}</p> : null}
      </div>
      <div className="foot"><RichText parts={s.foot} /></div>
    </section>
  )
}
