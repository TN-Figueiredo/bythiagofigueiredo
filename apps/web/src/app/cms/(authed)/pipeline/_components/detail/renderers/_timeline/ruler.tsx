'use client'

import { memo, useMemo } from 'react'
import { RULER_H, TH, MONO_SM_CLS } from './constants'
import { fmtTime, tickInterval } from './utils'

interface RulerProps {
  duration: number
  pxPerSec: number
  totalW: number
}

function RulerRaw({ duration, pxPerSec, totalW }: RulerProps) {
  const intv = tickInterval(duration)

  const { ticks, subs } = useMemo(() => {
    const t: number[] = []
    for (let i = 0; i <= duration; i += intv) t.push(i)
    if (t[t.length - 1]! < duration && duration - t[t.length - 1]! > intv * 0.35) t.push(duration)

    const s: number[] = []
    const subIntv = intv / 2
    if (subIntv >= 1) {
      for (let i = subIntv; i < duration; i += intv) s.push(i)
    }
    return { ticks: t, subs: s }
  }, [duration, intv])

  return (
    <div
      className="relative select-none"
      style={{ height: RULER_H, background: TH.ruler, borderBottom: `1px solid ${TH.border}`, width: totalW }}
    >
      {subs.map(t => (
        <div key={`s${t}`} className="absolute top-0" style={{ left: t * pxPerSec, width: 1, height: 6, background: TH.dim }} />
      ))}
      {ticks.map(t => (
        <div key={t} className="absolute top-0" style={{ left: t * pxPerSec }}>
          <div style={{ width: 1, height: 10, background: TH.brdLight }} />
          <span className={MONO_SM_CLS} style={{ color: TH.muted, position: 'absolute', left: 3, top: 10, fontSize: 9 }}>
            {fmtTime(t)}
          </span>
        </div>
      ))}
      {/* Playhead at 0 */}
      <div className="absolute top-0 z-[2]" style={{ left: 0, width: 2, height: '100%', background: TH.playhead }} />
    </div>
  )
}

export const Ruler = memo(RulerRaw)
Ruler.displayName = 'Ruler'
