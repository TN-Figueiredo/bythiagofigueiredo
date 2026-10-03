'use client'
/**
 * Insights screen (port of insights.html): format filter, the six site-computed cards and the Todos state. Every
 * number and text comes from the view model. The frozen-reading hero ("Leitura da forja") is the first card; the forja
 * button lives in the chrome header (solid on this screen).
 */
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { InsightsView } from './view-model'
import { Formulas } from './formulas'
import { Cadence } from './cadence'
import { Heatmap } from './heatmap'
import { Themes } from './themes'
import { YouInNiche } from './you-in-niche'
import { Gaps } from './gaps'
import { ReadingHero } from './reading-hero'

export function InsightsScreen({ view, heatMode }: { view: InsightsView; heatMode?: 'uploads' | 'views' }) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams()
  const setFmt = (f: 'long' | 'short') => {
    const q = new URLSearchParams(search?.toString() ?? '')
    if (f === 'long') q.delete('fmt'); else q.set('fmt', f)
    const s = q.toString()
    router.replace((pathname ?? '') + (s ? '?' + s : ''), { scroll: false })
  }
  return (
    <div data-obs-screen="insights">
      <div className="filters">
        {view.all ? null : <span className="sel" title={view.window.title}>{view.window.label} <small className="mono">{view.window.dates}</small></span>}
        <div className="seg" role="group" aria-label="Formato">
          {view.fmtOptions.map(o => <button type="button" key={o.key} data-fmt={o.key} aria-pressed={o.pressed} onClick={() => setFmt(o.key)}>{o.label}</button>)}
        </div>
      </div>
      {view.all ? (
        <div className="card allstate" id="allState">
          <h2>{view.all.title}</h2>
          <p>{view.all.text}</p>
          {view.all.forja.lines.length ? (
            <div data-forja-anchor="" tabIndex={-1}>
              <p style={{ margin: '0 0 6px' }}><b>{view.all.forja.title}</b></p>
              <ul className="reqs">{view.all.forja.lines.map(l => <li key={l}>{l}</li>)}</ul>
              {view.all.forja.text ? <p className="scopenote" style={{ margin: '0 0 12px' }}>{view.all.forja.text}</p> : null}
            </div>
          ) : view.all.forja.note ? <p className="scopenote" style={{ margin: '0 0 12px' }}>{view.all.forja.note}</p> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {view.all.go.map(g => <Link key={g.niche} className="btn" href={g.href} data-go={g.niche}>{g.label}</Link>)}
          </div>
        </div>
      ) : (
        <div className="grid" id="grid">
          {view.hero ? <ReadingHero hero={view.hero} /> : null}
          {view.cadence ? <Cadence s={view.cadence} /> : null}
          {view.youInNiche ? <YouInNiche s={view.youInNiche} /> : null}
          {view.gaps ? <Gaps s={view.gaps} /> : null}
          {view.formulas ? <Formulas s={view.formulas} /> : null}
          {view.heatmap ? <Heatmap s={view.heatmap} initialMode={heatMode} /> : null}
          {view.themes ? <Themes s={view.themes} /> : null}
        </div>
      )}
    </div>
  )
}
