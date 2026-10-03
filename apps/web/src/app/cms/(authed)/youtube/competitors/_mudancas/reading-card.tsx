'use client'
/**
 * The forja card of the Mudanças summary box (port of mudancas.html renderForja): "Resumo das trocas (30 dias)", the
 * request status (one line per niche with Todos, then the engine sentence) and, per niche, the frozen reading collapsed
 * to one line ("Desde então" on its own line, no final period). Under the seal only the reading's literal text; each
 * literal item carries its "Ver as N trocas" link. New requests go through the forja button in the header.
 */
import { useState } from 'react'
import type { MudancasView } from './view-model'

const ANVIL = (
  <svg className="i" viewBox="0 0 16 16" aria-hidden="true" style={{ color: 'var(--forja)' }}><path d="M2.5 6.5h8l3-2v3l-3 1H9v2.5l2 2.5H5l2-2.5V8.5H4.5z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" /></svg>
)
const STATE_CLS: Record<string, string> = { 'publicado': 'ok', 'atrasado': 'warn', 'sem máquina': 'warn', 'nova tentativa': 'warn', 'liberado pelo vigia': 'warn', 'falhou': 'bad', 'recusado (dado velho)': 'bad' }

export function ReadingCard({ view }: { view: MudancasView }) {
  const f = view.forja, c = view.forjaCard
  const [open, setOpen] = useState<Record<string, boolean>>(c.openNiche ? { [c.openNiche]: true } : {})
  const split = f.card.lines.length > 0 || (f.niche === 'todos' && !!f.status)
  const single = f.status && !split ? f.card.stateLabel : null
  return (
    <>
      <div className="forja-h">{ANVIL}<b id="forjaH">{f.typeLabel}</b>{single ? <span className={'state ' + (STATE_CLS[single] ?? '')}>{single}</span> : null}</div>
      {f.status ? (split ? (
        <div id="forjaStatus">
          <p className="forja-status">{f.card.sentNow ? f.card.sentNow + ' Pedidos:' : 'Pedidos:'}</p>
          <ul className="forja-status fj-lines">
            {(f.card.lines.length ? f.card.lines : f.niches.filter(b => b.statusLine).map(b => b.label + ': ' + b.statusLine)).map(l => <li key={l}>{l}</li>)}
            {f.niches.filter(b => !b.statusLine).map(b => <li key={b.niche}>{b.label}: sem pedido hoje</li>)}
          </ul>
          <p className="forja-status">{f.card.statusText}</p>
        </div>
      ) : (
        <p className="forja-status" id="forjaStatus">{f.card.sentNow ? f.card.sentNow + ' ' + (f.card.statusText ?? '') : f.card.statusText}</p>
      )) : null}
      {f.card.quotaNote ? <p className="forja-note">{f.card.quotaNote}</p> : null}
      {f.niches.map(b => {
        const r = b.reading
        if (!r) return <div className="fj-niche" key={b.niche}><p className="forja-note"><b style={{ color: 'var(--text)' }}>{b.label}</b>: {b.emptyText}</p></div>
        const isOpen = !!open[b.niche]
        return (
          <details className="fj-niche" key={b.niche} data-n={b.niche} data-reading={r.id} open={isOpen}
            onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; setOpen(x => (x[b.niche] === o ? x : { ...x, [b.niche]: o })) }}>
            <summary>
              <b>{b.label}</b>
              <span>{r.isNew ? 'nova, ' : ''}{r.when}{r.countText ? ', ' + r.countText : ''}{r.since ? <span className="since-l">{r.since.shortText}</span> : null}</span>
              <span className="open">{isOpen ? 'Recolher' : 'Ver leitura'}</span>
            </summary>
            <div className="forja-read">
              <div className="rh"><span className="stamp">{ANVIL}{r.seal}</span></div>
              <div className="forja-voice">
                {r.lead ? <p style={{ margin: 0 }}>{r.lead}</p> : null}
                {r.items.length ? (
                  <ul>{r.items.map((t, i) => {
                    const ev = r.evidenceLinks[i]
                    return <li key={i}>{t}{ev ? <>{' '}<a className="lnk" href={ev.href} data-n={ev.n}>{ev.label}</a></> : null}</li>
                  })}</ul>
                ) : null}
              </div>
              <p className="forja-note" style={{ marginTop: 6 }}>{r.sentText}</p>
              {r.since ? <p className="forja-note">{r.since.text}</p> : null}
              {r.siteNotes.map(n => <p className="forja-note" key={n}>{n}</p>)}
            </div>
          </details>
        )
      })}
      <details className="method fj-more"><summary>{c.outSummary}</summary><p>{c.outText}</p></details>
      {c.shorts ? <p className="forja-note">{c.shorts.text} <a className="lnk" href={c.shorts.href}>Ver em Insights</a></p> : null}
    </>
  )
}
