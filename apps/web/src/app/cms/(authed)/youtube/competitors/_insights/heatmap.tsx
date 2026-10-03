'use client'
import { useRef, useState } from 'react'
import type { HeatmapSection } from './view-model'
import { RichText } from './rich'

/** Quando publicam (insights.html renderHeat): day × 2 h block in São Paulo; both measures precomputed. */
export function Heatmap({ s, initialMode = 'uploads' }: { s: HeatmapSection; initialMode?: 'uploads' | 'views' }) {
  const [mode, setMode] = useState<'uploads' | 'views'>(initialMode)
  const btns = useRef<Record<string, HTMLButtonElement | null>>({})
  const m = mode === 'uploads' ? s.uploads : s.mult
  const pick = (k: 'uploads' | 'views') => { setMode(k); btns.current[k]?.focus() }
  return (
    <section className="card c5" id="heatCard" aria-labelledby="heatH">
      <div className="chead"><h2 id="heatH">Quando publicam</h2><span className="meta">{s.meta}</span>
        {s.empty ? null : (
          <div className="seg right" role="group" aria-label="Medida">
            <button type="button" ref={el => { btns.current.uploads = el }} data-hm="uploads" aria-pressed={mode === 'uploads'} onClick={() => pick('uploads')}>Uploads</button>
            <button type="button" ref={el => { btns.current.views = el }} data-hm="views" aria-pressed={mode === 'views'} onClick={() => pick('views')}>Multiplicador mediano</button>
          </div>
        )}</div>
      <div className="cbody">
        {s.empty ? <div className="empty"><p>{s.empty}</p>{s.excluded ? <p className="exc">{s.excluded}</p> : null}</div> : (
          <>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{m.intro}</div>
            <div className="hm" role="img" aria-label={m.aria}>
              <span />{s.hourLabels.map((h, i) => <span className="hl" key={i}>{h}</span>)}
              {m.cells.map((row, d) => [
                <span className="dl" key={'d' + d}>{s.days[d]}</span>,
                ...row.map((c, b) => <div key={d + '-' + b} className={'cell ' + c.cls + (c.peak ? ' pk' : '')} style={c.bg ? { background: c.bg } : undefined} title={c.title}>{c.text}</div>),
              ])}
            </div>
            <div className="sr">
              <table>
                <caption>{m.caption}</caption>
                <thead><tr><th scope="col">Dia</th>{s.blocks.map(b => <th scope="col" key={b}>{b}</th>)}</tr></thead>
                <tbody>{m.table.map((r, d) => <tr key={d}><th scope="row">{s.days[d]}</th>{r.map((t, b) => <td key={b}>{t}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="hscale" aria-hidden="true">
              {m.scale.map((x, i) => <span className="lg" key={i}><span className={'cell' + (x.cls ? ' ' + x.cls : '')} style={{ ...(x.bg ? { background: x.bg } : {}), ...(x.hidden ? { visibility: 'hidden' } : {}) }} /><span className={x.mono ? 'mono' : undefined}>{x.text}</span></span>)}
            </div>
            <div className="note"><RichText parts={m.note} />{s.excluded ? <> <span className="exc">{s.excluded}</span></> : null}</div>
          </>
        )}
      </div>
    </section>
  )
}
