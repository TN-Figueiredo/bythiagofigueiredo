'use client'
/**
 * Global niche bar (port of chrome.js navHtml niche): Todos, then the site's niches (Viagem · IA · the owner's), valid for
 * every tab and persisted. One line, beside the tabs: when the niches do not fit, the rail scrolls sideways with the tabs'
 * fade and the active niche is brought into view (chrome.js fitNiche). The page never scrolls sideways.
 */
import { useCallback, useEffect, useId, useRef } from 'react'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import type { ChromeView } from './view-model'
import { Icon } from './icons'

/** Todos + the two built-in niches: the bar as it has always been (no scrolling rail). */
export const NICHE_BAR_FIXED = 3

export function NicheBar({ niches, pending, onPick }: { niches: ChromeView['niches']; pending: NicheScope | null; onPick: (n: NicheScope) => void }) {
  const id = useId(), lbl = id + '-l', hint = id + '-h'
  const rail = useRef<HTMLDivElement>(null)
  const scroll = niches.length > NICHE_BAR_FIXED
  const active = pending ?? niches.find(n => n.pressed)?.key ?? null
  // fades on the rail edges (the tabs' own): right = more niches after, left = scrolled
  const fades = useCallback(() => {
    const nb = rail.current
    if (!nb) return
    nb.classList.toggle('obs-ch-more', nb.scrollLeft + nb.clientWidth < nb.scrollWidth - 2)
    nb.classList.toggle('obs-ch-less', nb.scrollLeft > 2)
  }, [])
  const fit = useCallback(() => {
    const nb = rail.current
    if (!nb) return
    // the active niche always in view: the rail scrolls itself, never the page (so no scrollIntoView)
    const cur = nb.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (cur) {
      const a = nb.getBoundingClientRect(), c = cur.getBoundingClientRect(), l = c.left - a.left + nb.scrollLeft, r = l + c.width
      if (l < nb.scrollLeft) nb.scrollLeft = Math.max(0, l - 40)
      else if (r > nb.scrollLeft + nb.clientWidth) nb.scrollLeft = r - nb.clientWidth + 40
    }
    fades()
  }, [fades])
  useEffect(() => {
    const nb = rail.current
    if (!scroll || !nb) return
    fit()
    nb.addEventListener('scroll', fades, { passive: true })
    window.addEventListener('resize', fit)
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null
    ro?.observe(nb)
    return () => { nb.removeEventListener('scroll', fades); window.removeEventListener('resize', fit); ro?.disconnect() }
  }, [scroll, active, niches.length, fit, fades])
  return (
    <div className="obs-ch-niche">
      <span className="obs-ch-lbl" id={lbl}>Nicho</span>
      <div className="obs-ch-seg-ctl" role="group" aria-labelledby={lbl} aria-describedby={hint} ref={rail}>
        {niches.map(n => {
          const pressed = pending ? pending === n.key : n.pressed
          return (
            <button key={n.key} type="button" aria-pressed={pressed} data-niche={n.key} onClick={() => onPick(n.key)}>
              {n.color ? <span className="obs-ch-sw" style={{ ['--obs-sw-dark' as string]: n.color.dark, ['--obs-sw-light' as string]: n.color.light }} aria-hidden="true" /> : null}
              {n.label}
              <span className="obs-ch-n" aria-hidden="true">{n.count}</span>
              <span className="obs-ch-sr">, {n.count} canais</span>
            </button>
          )
        })}
      </div>
      <span className="obs-ch-pin" title="Vale para todas as abas e fica salvo">
        {Icon.pin()}
        <span className="obs-ch-sr" id={hint}>Vale para todas as abas e fica salvo</span>
      </span>
    </div>
  )
}
