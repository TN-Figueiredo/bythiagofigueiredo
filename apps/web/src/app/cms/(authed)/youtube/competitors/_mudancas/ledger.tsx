'use client'
/**
 * Summary box (port of renderSummary/renderLedger/renderDigest): collapsed to one line by default; open, it shows the
 * last 7 days, the adjusted-effect ledger and the forja slot (Task 35). The median only with n ≥ RULES.effect.minN;
 * the groups outside the medians are disjoint and the total line closes the account.
 */
import { useId, useState, type ReactNode } from 'react'
import type { MudancasView } from './view-model'
import { RichText } from './rich'

export function Ledger({ view, forjaSlot }: { view: MudancasView; forjaSlot?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState(false)
  const methodId = useId()
  const L = view.ledger, S = view.summary
  return (
    <details className="sumbox" open={open} onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="sumline"><span id="sumLine" data-digest=""><RichText r={S.digest} /></span><span className="sumopen">{open ? 'Recolher resumo' : 'Ver resumo'}</span></summary>
      <div className={'summary' + (forjaSlot ? '' : ' no-forja')}>
        <section aria-labelledby="mu-week">
          <h2 id="mu-week">Últimos 7 dias</h2>
          <p className="win">{S.weekWin}</p>
          <p className="lead"><RichText r={S.weekLead} /></p>
        </section>
        <section aria-labelledby="mu-eff">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h2 id="mu-eff">Efeito ajustado <span className="win" style={{ display: 'inline', fontWeight: 400 }}>{L.winLabel}</span></h2>
            <button className="linkbtn" type="button" aria-expanded={method} aria-controls={methodId} onClick={() => setMethod(m => !m)}>Como é calculado</button>
          </div>
          <table className="led" hidden={!L.total} data-ledger="">
            <thead><tr>
              <th scope="col">Tipo</th>
              <th scope="col" className="r" title="Trocas com veredito (ganhou, perdeu ou neutro), sem reversão e sem ressalva; as demais estão em “Fora das medianas”">n</th>
              <th scope="col" className="r">Mediana</th>
              <th scope="col">Resultado</th>
            </tr></thead>
            <tbody>
              {L.medians.map(m => (
                <tr key={m.type} data-type={m.type}>
                  <th scope="row" className="rh">{m.typeLabel}</th>
                  <td className="r"><span className="num">{m.n}</span></td>
                  <td className="r">{m.median == null ? <span title={'Mediana só com ' + L.minN + ' trocas ou mais'}>—</span> : <><span className="num">{m.median.replace(/ pp$/, '')}</span>{' pp'}</>}</td>
                  <td className="read">{m.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ledout" data-ledout="">
            {L.note ? <span className="forja-note" style={{ display: 'block', margin: '0 0 4px' }}>{L.note}</span> : null}
            {L.emptyText ?? <><RichText r={L.out} /><span className="tot"><RichText r={L.totalLine} /></span></>}
          </p>
          <p className="method" id={methodId} hidden={!method}>{S.method}</p>
        </section>
        {forjaSlot ? <section className="forja" aria-label="Forja" data-forja-anchor="">{forjaSlot}</section> : null}
      </div>
    </details>
  )
}
