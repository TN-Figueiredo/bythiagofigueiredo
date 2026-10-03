'use client'
/**
 * Age windows (CONVENCOES: exclusive bands 0–30 · 31–90 · 91–180 · 181–365 · mais de 1 ano, plus "Todos"; the
 * default is the shortcut "Até 90 dias" = the first two). Each button navigates to the href the view model built.
 */
import { useRouter } from 'next/navigation'
import type { OutliersView } from './view-model'

export function AgeTimeline({ v }: { v: OutliersView }) {
  const router = useRouter()
  const go = (href: string) => router.push(href, { scroll: false })
  const s = v.shortcut
  return (
    <>
      <span className="obs-out-sr" id="obs-out-when">Idade do vídeo (faixas combináveis)</span>
      <div className="obs-out-timeline" role="group" aria-labelledby="obs-out-when">
        <div className="obs-out-tl-group">
          <button type="button" className="obs-out-tl-btn" data-quick="90" aria-pressed={s.selected} aria-disabled={s.disabled || undefined}
            title={s.title ?? undefined} aria-label={s.ariaLabel} onClick={() => { if (!s.disabled) go(s.href) }}>
            <span className="obs-out-t">{s.label}</span><span className="obs-out-c"><span className="obs-out-mono" data-count="q90">{s.count}</span></span>
          </button>
        </div>
        <div className="obs-out-tl-group">
          {v.timeline.map(w => (
            <button key={w.id} type="button" className="obs-out-tl-btn" data-age={w.id} aria-pressed={w.selected} title={w.title ?? undefined}
              aria-label={w.ariaLabel} onClick={() => go(w.href)}>
              <span className="obs-out-t">{w.label}</span>
              <span className="obs-out-c"><span className="obs-out-mono" data-count={'age-' + w.id}>{w.count}</span><span className="obs-out-bar" style={{ width: w.barPx }} /></span>
            </button>
          ))}
        </div>
        <div className="obs-out-tl-group">
          <button type="button" className="obs-out-tl-btn" data-quick={v.allLabel === 'Leitura' ? 'scope' : 'all'} aria-pressed={v.allSelected}
            title={v.allTitle ?? undefined} aria-label={v.allLabel === 'Leitura' ? undefined : v.allAriaLabel}
            onClick={() => { if (v.allLabel !== 'Leitura') go(v.allHref) }}>
            <span className="obs-out-t">{v.allLabel}</span><span className="obs-out-c"><span className="obs-out-mono" data-count="all">{v.allCount}</span></span>
          </button>
        </div>
      </div>
    </>
  )
}
