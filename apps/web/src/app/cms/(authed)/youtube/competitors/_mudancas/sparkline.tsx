'use client'
/**
 * Views/day before and after the change (port of drawSparks). The values, the expected projection and the max/min
 * labels come from the view model (effect.daily); this file only maps them to pixels. The projection is the site's
 * calculation: dashed in --muted, never in the forja colour (CONVENCOES).
 */
import { useEffect, useRef, useState } from 'react'
import type { SparkView } from './view-model'

const H = 64, PT = 14, PB = 3

export function Sparkline({ s }: { s: SparkView }) {
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(300)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setW(Math.max(120, Math.round(el.getBoundingClientRect().width) || 300))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const b = s.before, a = s.after
  const pad = (s.max - s.min) * 0.12 || s.max * 0.05 || 1, max = s.max + pad, min = Math.max(0, s.min - pad)
  const step = W / 13, off = 7 - b.length
  const x = (i: number) => (i + off) * step
  const y = (v: number) => PT + (H - PT - PB) * (1 - (v - min) / (max - min || 1))
  const xm = b.length ? (x(b.length - 1) + x(b.length)) / 2 : x(0)
  const last = x(b.length + 6)
  const path = (arr: Array<number | null>, start: number) => {
    let d = '', pen = false
    arr.forEach((v, i) => { if (v == null) { pen = false; return } d += (pen ? 'L' : 'M') + x(start + i).toFixed(1) + ' ' + y(v).toFixed(1) + ' '; pen = true })
    return d.trim()
  }
  const e = s.expected
  return (
    <div className="sparkbox" ref={box}>
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.aria}>
        {e ? <>
          <polygon points={`${xm},${y(e.base)} ${last},${y(e.hi)} ${last},${y(e.lo)}`} fill="var(--band)" />
          <line x1={xm} x2={last} y1={y(e.base)} y2={y(e.exp)} stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 3" />
        </> : null}
        <line x1={xm} x2={xm} y1={PT - 2} y2={H} stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="3 2" />
        {b.length ? <path d={path(b, 0)} fill="none" stroke="var(--spark-before)" strokeWidth={2} strokeLinejoin="round" /> : null}
        {b.length === 1 && b[0] != null ? <circle cx={x(0)} cy={y(b[0])} r={3} fill="var(--spark-before)" /> : null}
        {a.length ? <path d={path(a, b.length)} fill="none" stroke="var(--spark-after)" strokeWidth={2} strokeLinejoin="round" /> : null}
        {a.length === 1 && a[0] != null ? <circle cx={x(b.length)} cy={y(a[0])} r={3} fill="var(--spark-after)" /> : null}
        {a.length < 7 ? <line x1={x(b.length + Math.max(0, a.length - 1)) + 4} x2={last} y1={H - 4} y2={H - 4} stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="2 4" /> : null}
      </svg>
      <span className="spark-lbl" style={{ left: xm + 4 }} aria-hidden="true">troca</span>
      <span className="spark-lbl" style={{ left: 0 }} aria-hidden="true">{s.maxLabel}</span>
      <span className="spark-lbl" style={{ left: 0, top: 'auto', bottom: -15 }} aria-hidden="true">{s.minLabel}</span>
    </div>
  )
}
