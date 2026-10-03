import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { YouCell, YouSection } from './view-model'

function Cell({ c }: { c: YouCell }) {
  if (c.kind === 'nodata') return <td data-nodata="1"><div className="v nd">{c.text}</div><div className="vb" title={c.baseTitle}>{c.base}</div></td>
  return (
    <td data-few={c.few ? 1 : 0}>
      <div className="v mono">{c.value}</div>
      <div className={'vd ' + c.cls}>{c.verdict}</div>
      {c.few ? <div className="vb">{c.few}</div> : null}
    </td>
  )
}

/**
 * Você no nicho (insights-n-canais.html renderYou): a table with the niche once and one row per own channel of the
 * niche; relative metrics only. A channel with no video in the format keeps its row, with the reason across the columns.
 * Rendered by the Insights screen (a client component): no text is built here.
 */
export function YouInNiche({ s }: { s: YouSection }) {
  // renderYou's youScrollHint: says the table scrolls sideways only when it really overflows
  const box = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  useEffect(() => {
    const el = box.current
    if (!el) { setOverflow(false); return }
    const on = () => setOverflow(el.scrollWidth > el.clientWidth + 2)
    on()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(on)
    ro?.observe(el)
    window.addEventListener('resize', on)
    return () => { ro?.disconnect(); window.removeEventListener('resize', on) }
  }, [s.rows, s.cols])
  return (
    <section className="card c12" id="youCard" aria-labelledby="youH">
      <div className="chead"><h2 id="youH">Você no nicho</h2><span className="meta">{s.meta}</span></div>
      <div className="cbody">
        {s.empty ? (
          <div className="empty"><h3>{s.empty.title}</h3><p>{s.empty.text}</p>
            {s.empty.links.length ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{s.empty.links.map(l => <Link key={l.href} className="btn" href={l.href}>{l.text}</Link>)}</div> : null}
          </div>
        ) : (
          <>
            {overflow ? <p className="yhint" data-you-hint="">Role a tabela para o lado para ver todas as colunas.</p> : null}
            <div className="ybox" ref={box} tabIndex={overflow ? 0 : -1} role={overflow ? 'region' : undefined} aria-label={overflow ? 'Tabela Você no nicho, rolável para o lado' : undefined}>
              <table className="yt" aria-labelledby="youH">
                <thead><tr><th scope="col">Canal</th>{s.cols.map(c => <th scope="col" key={c.key} data-col={c.key}>{c.label}<span className="unit">{c.unit}</span></th>)}</tr></thead>
                <tbody>
                  {s.ref ? (
                    <tr className="ref"><th scope="row"><div className="nm">Nicho</div><div className="vb">{s.ref.sub}</div></th>
                      {s.ref.cells.map((c, i) => <td key={s.cols[i]?.key ?? i}><div className="v mono">{c.value}</div><div className="vb">{c.range}</div></td>)}</tr>
                  ) : null}
                  {s.rows.map(r => (
                    <tr key={r.id} data-own={r.id} data-empty={r.cells ? undefined : 1}>
                      <th scope="row"><div className="nm"><Link href={r.href}>{r.name}</Link>{r.lang ? <abbr className="langtag" title={r.lang.title}>{r.lang.code}</abbr> : null}</div><div className="vb">{r.sub}</div></th>
                      {r.cells ? r.cells.map((c, i) => <Cell key={s.cols[i]?.key ?? i} c={c} />) : <td colSpan={s.cols.length}><div className="vb nd">{r.emptyText}</div></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {s.noneNote ? <p className="ynote">{s.noneNote.text}{' '}{s.noneNote.links.map((l, i) => <Fragment key={l.href}>{i ? ' · ' : null}<Link href={l.href}>{l.text}</Link></Fragment>)}</p> : null}
          </>
        )}
      </div>
      {s.foot ? <div className="foot">{s.foot}</div> : null}
    </section>
  )
}
