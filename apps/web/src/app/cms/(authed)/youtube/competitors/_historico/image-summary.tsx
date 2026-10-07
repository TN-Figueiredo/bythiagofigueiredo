'use client'
/**
 * "Resumo por imagem" (Fase 4 item 1): one row per thumbnail image, right under the lanes. Hovering or focusing a row
 * highlights that image in the lanes and in the cards; the button pins the highlight (Esc lets it go).
 */
import type { ImageSummaryView } from './view-model'

export function ImageSummary({ sum, active, pinned, onHover, onPin }: {
  sum: ImageSummaryView
  /** The image highlighted now (hover, focus or pin). */
  active: string | null; pinned: string | null
  onHover: (label: string | null) => void; onPin: (label: string) => void
}) {
  return (
    <section className="card isum-card" id="hv-isum" aria-labelledby="hv-isumh">
      <div className="sec-h"><h3 id="hv-isumh">Resumo por imagem</h3><span className="src">{sum.src}</span></div>
      <div className="isum-sc">
        <table className="isum" aria-labelledby="hv-isumh">
          <thead>
            <tr><th scope="col">Imagem</th><th scope="col" className="n">No ar</th><th scope="col" className="n">Passagens</th><th scope="col" className="n">Média de views/dia</th><th scope="col" className="wide">Quando esteve no ar</th></tr>
          </thead>
          <tbody>
            {sum.rows.map(r => {
              const on = pinned === r.label
              return (
                <tr key={r.label} data-img={r.label} data-row={r.label} className={active === r.label ? 'is-hl' : undefined}
                  onMouseEnter={() => onHover(r.label)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(r.label)} onBlur={() => onHover(null)}>
                  <th scope="row" aria-label={r.rowName}>
                    <span className="isum-c">
                      <button className="isum-b" type="button" aria-pressed={on} data-pinimg={r.label} aria-label={r.pinName} onClick={() => onPin(r.label)}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- archived blob of any host */}
                        {r.thumb?.src ? <img src={r.thumb.src} alt="" width={48} height={27} loading="lazy" /> : null}
                        <b>{r.label}</b><span className="pin" hidden={!on}>fixada</span>
                      </button>
                      {r.now ? <span className="tag now">{r.now}</span> : null}
                    </span>
                  </th>
                  <td className="n">{r.dur}</td><td className="n">{r.passes}</td><td className="n nm">{r.rate}</td>
                  <td className="wide">
                    <span className="strip" aria-hidden="true">{r.segs.map((s, i) => <i key={i} style={{ left: s.left + '%', width: s.width + '%' }} />)}</span>
                    <span className="sr">{r.segsText}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr><th scope="row">{sum.total.label}</th><td className="n">{sum.total.dur}</td><td className="n">{sum.total.passes}</td><td className="n nm">{sum.total.rate}</td><td className="wide" /></tr>
          </tfoot>
        </table>
      </div>
      <p className="src isum-n">{sum.note}</p>
    </section>
  )
}
