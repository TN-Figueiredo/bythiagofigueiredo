'use client'
/** Global niche bar (port of chrome.js navHtml niche): Todos · Viagem · IA, valid for every tab and persisted. */
import { useId } from 'react'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import type { ChromeView } from './view-model'
import { Icon } from './icons'

export function NicheBar({ niches, pending, onPick }: { niches: ChromeView['niches']; pending: NicheScope | null; onPick: (n: NicheScope) => void }) {
  const id = useId(), lbl = id + '-l', hint = id + '-h'
  return (
    <div className="obs-ch-niche">
      <span className="obs-ch-lbl" id={lbl}>Nicho</span>
      <div className="obs-ch-seg-ctl" role="group" aria-labelledby={lbl} aria-describedby={hint}>
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
