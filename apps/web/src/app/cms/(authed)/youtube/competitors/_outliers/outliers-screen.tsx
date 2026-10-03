'use client'
/**
 * The Outliers screen (port of outliers.html #screen): age windows, format and order; the summary with
 * "Como contamos"; the forja bar (Task 35); the link chips; and the result grouped by phase in PHASES
 * order, or the empty state whose every button carries the N its destination shows.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useToast } from '../_chrome/toasts'
import type { OutliersView } from './view-model'
import { AgeTimeline } from './age-timeline'
import { ParamChips } from './param-chips'
import { PhaseGroup } from './phase-group'
import { OutIcon, RichText } from './outlier-card'
import { ForjaBar } from './forja-bar'

export function OutliersScreen({ view: v }: { view: OutliersView }) {
  const router = useRouter()
  const go = (href: string) => router.push(href, { scroll: false })
  const [probsOpen, setProbsOpen] = useState(false)
  // outliers.html: below 821 px the link's filters move right under the controls (#chips.near), before the summary
  const [near, setNear] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(min-width:821px)'), on = () => setNear(!mq.matches)
    on(); mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const toast = useToast()
  // The screen shows another niche than the saved one (channel or reading of that niche): say so; nothing is persisted.
  const notice = v.nicheNotice
  useEffect(() => { if (notice) toast('', notice.title, notice.body) }, [notice?.niche, notice?.title]) // eslint-disable-line react-hooks/exhaustive-deps
  const shorts = v.query.fmt === 'short'
  const hasChips = v.chips.length > 0 || !!v.chipsLead
  return (
    <div className="obs-out" data-obs-screen="outliers">
      <section className="obs-out-controls" aria-label="Filtros">
        <AgeTimeline v={v} />
        <div className="obs-out-filters">
          <div className="obs-out-seg" role="group" aria-label="Formato">
            {v.fmtLinks.map(f => <button key={f.value} type="button" data-v={f.value} aria-pressed={f.pressed} onClick={() => go(f.href)}>{f.label}</button>)}
          </div>
          <select className="obs-out-select" aria-label="Ordenar por" value={v.query.sort}
            onChange={e => { const o = v.sortOptions.find(x => x.value === e.target.value); if (o) go(o.href) }}>
            {v.sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </section>

      {near ? <ParamChips v={v} near /> : null}

      <div className="obs-out-sumbar">
        <details className="obs-out-rule">
          <summary><span className="obs-out-cnt" aria-live="polite"><RichText parts={v.baseParts} /></span> <span className="obs-out-more">Como contamos</span></summary>
          <div>{v.basisMore.map((t, i) => <p key={i}>{t}</p>)}</div>
        </details>
        {/* Forja bar (Task 35): the request state, the readings and the next request's scope. Beside the count only
            when a link brought filters (outliers.html renderAll: #fbSlot); otherwise in the notices after the bar. */}
        {v.forjaBar && hasChips ? <div className="obs-out-fbslot" data-forja-slot=""><ForjaBar bar={v.forjaBar} /></div> : null}
        {v.problems ? (
          <div className="obs-out-probs" data-probs="">
            <OutIcon name="warn" />
            <span className="obs-out-ptxt">
              {v.problems.shown.map((p, i) => <span key={p.name}>{i ? '; ' : ''}<b>{p.name}</b>: {p.phrase}</span>)}
              {v.problems.shown.length ? '. ' : ''}{v.problems.tail}
              {v.problems.rest.length ? <>{' '}
                <button type="button" className="obs-out-probbtn" aria-expanded={probsOpen} aria-controls="obs-out-probs-list" onClick={() => setProbsOpen(o => !o)}>
                  {probsOpen ? v.problems.hideLabel : v.problems.restLabel}
                </button>
                <span id="obs-out-probs-list" hidden={!probsOpen}>{probsOpen ? <>. {v.problems.rest.map((p, i) => <span key={p.name}>{i ? '; ' : ''}<b>{p.name}</b>: {p.phrase}</span>)}</> : null}</span>
              </> : null}
            </span>
          </div>
        ) : null}
        <div className="obs-out-seg obs-out-viewseg" role="group" aria-label="Visualização">
          {v.viewLinks.map(x => <button key={x.value} type="button" data-v={x.value} aria-pressed={x.pressed} onClick={() => go(x.href)}><OutIcon name={x.value} /> {x.label}</button>)}
        </div>
      </div>

      {near ? null : <ParamChips v={v} />}
      {v.forjaBar && !hasChips ? <div className="obs-out-notices" data-forja-slot=""><ForjaBar bar={v.forjaBar} /></div> : null}

      <div className="obs-out-results">
        {v.empty ? (
          <div className="obs-out-empty" role="status">
            <OutIcon name="empty" />
            <div>
              <h3>{v.empty.title}</h3>
              <p>{v.empty.text}</p>
              <div className="obs-out-opts">
                {v.empty.actions.map(a => (
                  <Link key={a.label} href={a.href} scroll={false} className={'obs-out-btn' + (a.primary ? ' btn-primary' : '')}
                    data-link-n={a.n} data-link-key={a.dest + ':' + a.href}>{a.label}</Link>
                ))}
              </div>
            </div>
          </div>
        ) : <>
          {v.groups.map(g => <PhaseGroup key={g.id} g={g} view={v.query.view} shorts={shorts} />)}
          {v.more ? <div className="obs-out-morebar"><Link className="obs-out-btn" href={v.more.href} scroll={false} data-more="">{v.more.label}</Link><span className="obs-out-pagenote">{v.more.note}</span></div> : null}
        </>}
      </div>
    </div>
  )
}
