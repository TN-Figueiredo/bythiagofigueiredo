'use client'
/**
 * The forja bar of Outliers (port of outliers.html forjaBar): one collapsed line (the request state or the readings'
 * dates, then "Desde então" on its own line), which opens to the request notice, the readings — each with its seal
 * above the LITERAL text and "Do site" apart — and the scope of the next request. New requests go through the forja
 * button in the header.
 */
import Link from 'next/link'
import { useState } from 'react'
import type { OutliersForjaBar } from './view-model'

const FORJA = <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5h8l3-2v3l-3 1H9v2.5l2 2.5H5l2-2.5V8.5H4.5z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" /></svg>
const WARN = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></svg>

export function ForjaBar({ bar }: { bar: OutliersForjaBar }) {
  const [open, setOpen] = useState(false)
  const [outs, setOuts] = useState(false)
  const s = bar.summary
  return (
    <details className={'obs-out-forjabar' + (bar.bad ? ' obs-out-bad' : '')} id="forjabar" open={open} data-forja-anchor=""
      onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary data-fsum="1">
        {bar.bad ? WARN : FORJA}
        <span className="obs-out-fmain">
          <span className="obs-out-fhead">
            {s.kind === 'request' ? <>
              <span className={'obs-out-state' + (s.chipCls ? ' obs-out-' + s.chipCls : '')}>{s.chip}</span>
              {s.split
                ? <span className="obs-out-rline2 obs-out-split" data-reqline=""><span>{s.line}</span><span className="obs-out-sttext" data-status-text="">{s.statusText}</span></span>
                : <span className="obs-out-rline2" data-reqline="">{s.line}</span>}
            </> : <span><b>Leituras da forja:</b> {s.when}</span>}
          </span>
          {bar.since.items.length ? (bar.since.multi
            ? <span className="obs-out-fsince">Desde então — {bar.since.items.map((x, i) => <span key={x.id} data-fsince={x.id}>{i ? '; ' : ''}<b>{x.label}:</b> {x.body}</span>)}</span>
            : bar.since.items.map(x => <span key={x.id} className="obs-out-fsince" data-fsince={x.id}>Desde então: {x.body}</span>)) : null}
        </span>
        <span className="obs-out-more">{open ? 'Recolher' : 'Abrir'}</span>
      </summary>
      <div className="obs-out-fbody">
        {bar.req ? (
          <div className={'obs-out-notice obs-out-' + bar.req.cls + ' obs-out-reqline'} role="status">
            {bar.req.cls === 'refused' ? WARN : FORJA}
            <div>{bar.req.text}</div>
            {bar.req.trackHref ? <Link className="obs-out-act" href={bar.req.trackHref}>Acompanhar na fila</Link> : null}
          </div>
        ) : null}
        {bar.sideBad.map(t => <div key={t} className="obs-out-notice obs-out-refused obs-out-reqline">{WARN}<div>{t}</div></div>)}
        {bar.rows.map(x => (
          <div className="obs-out-rwrap" key={x.reading.id}>
            <details className="obs-out-rrow" data-reading={x.reading.id}>
              <summary>
                {x.isNew ? <span className="obs-out-state">leitura nova</span> : null}
                <b className="obs-out-rn">{x.niche}</b>
                <span className="obs-out-rline" data-lit="">{x.first}</span>
              </summary>
              <div className="obs-out-rbody">
                <div className="obs-out-sealed" data-sealed="">
                  <span className="obs-out-seal">{x.reading.seal}</span>
                  <div className="obs-out-lit">
                    <p data-lit="">{x.reading.title}</p>
                    {x.reading.lead ? <p data-lit="">{x.reading.lead}</p> : null}
                    {x.reading.items.length ? <ul>{x.reading.items.map((t, i) => <li key={i} data-lit="">{t}</li>)}</ul> : null}
                    {x.reading.theme ? <p data-lit="">{x.reading.theme}</p> : null}
                  </div>
                </div>
                <div className="obs-out-fromsite">
                  <small className="obs-out-lbl">Do site</small>
                  <small>{x.reading.sentText}</small>
                  {x.reading.since ? <small data-since={x.reading.id}>{x.reading.since.text}</small> : null}
                  {x.reading.siteNotes.map(n => <small key={n}>{n}</small>)}
                </div>
              </div>
            </details>
            <Link className="obs-out-act" href={x.href}>Ver leitura</Link>
          </div>
        ))}
        {bar.scope ? (
          <p className="obs-out-scope"><small id="askScope">{bar.scope.text}{bar.scope.outs.length ? <>. <span className="obs-out-outd">
            <button type="button" className="obs-out-outn" aria-expanded={outs} onClick={() => setOuts(o => !o)}>{bar.scope.outs.length === 1 ? '1 canal fica fora' : bar.scope.outs.length + ' canais ficam fora'}</button>
            <span hidden={!outs}>. {bar.scope.outs.join('. ')}</span>
          </span></> : null}</small></p>
        ) : null}
      </div>
    </details>
  )
}
