'use client'
/**
 * Insights screen (port of insights.html): format filter, the six site-computed cards and the Todos state. Every
 * number and text comes from the view model. The frozen-reading hero and the forja button arrive in Task 35
 * (`view.reading` is null; the slot stays hidden).
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {view.all.go.map(g => <Link key={g.niche} className="btn" href={g.href} data-go={g.niche}>{g.label}</Link>)}
          </div>
        </div>
      ) : (
        <div className="grid" id="grid">
          {/* Task 35: the frozen-reading hero ("Leitura da forja") fills this slot. */}
          <section className="card forja c12" id="forjaCard" data-reading-slot="" hidden aria-hidden="true" />
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
