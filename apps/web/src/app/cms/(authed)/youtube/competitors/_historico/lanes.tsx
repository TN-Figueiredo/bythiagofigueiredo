'use client'
/**
 * Title / thumbnail / description lanes under the curve (port of renderLanes). Pixel mapping only: every text,
 * hour and window comes from the view model.
 */
import type { LaneType, LaneView, MarkerView } from './view-model'
import { HIcon, TYPE_COLOR } from './icons'
import { Thumb } from './thumb'

export interface Hl { type: LaneType; i: number; ev: number | null }
export interface Geom { w: number; H: number; x: (h: number) => number }

/** Markers closer than 32 px are pushed apart (the mockup's spread). */
function spread(ms: MarkerView[], x: (h: number) => number): Array<MarkerView & { px: number }> {
  const out = ms.map(m => ({ ...m, px: x(m.h) }))
  for (let i = 1; i < out.length; i++) {
    if (out[i]!.px - out[i - 1]!.px < 32) { const c = (out[i]!.px + out[i - 1]!.px) / 2; out[i - 1]!.px = c - 16; out[i]!.px = c + 16 }
  }
  return out
}

export function isHl(hl: Hl | null, lane: LaneView, i: number): boolean {
  if (!hl || hl.type !== lane.type) return false
  if (hl.i === i) return true
  return lane.type === 'thumb' && lane.versions[i]?.label === lane.versions[hl.i]?.label
}

export function Lanes({ lanes, geom, stale, fewAxis, hl, onHl, onMarker, onMarkerClick, onClip }: {
  lanes: LaneView[]; geom: Geom
  stale: { fromH: number; title: string } | null
  fewAxis: Array<{ h: number; label: string }> | null
  hl: Hl | null
  onHl: (h: Hl | null) => void
  onMarker: (m: MarkerView, type: LaneType, el: HTMLElement | null) => void
  onMarkerClick: (m: MarkerView) => void
  onClip: (type: LaneType, i: number) => void
}) {
  const { x, H } = geom
  return (
    <div className="lanes">
      {lanes.map(lane => {
        const c = TYPE_COLOR[lane.type]
        return (
          <div key={lane.type} className={'lane' + (lane.type === 'thumb' ? ' thumbs' : '')} data-lane={lane.type}>
            <div className="lane-l"><i style={{ background: c }} aria-hidden="true" />{lane.label}</div>
            {lane.pre ? (
              <div className="pre" title={lane.pre.title} style={{ left: x(lane.pre.fromH), width: Math.max(0, x(lane.pre.toH) - x(lane.pre.fromH) - 2) }}>
                <span>{lane.pre.text}</span>
              </div>
            ) : null}
            {stale ? <div className="stale" title={stale.title} style={{ left: x(stale.fromH), width: Math.max(0, x(H) - x(stale.fromH)) }} /> : null}
            {lane.versions.map((v, i) => v.win ? (
              <div key={'w' + i} className="win" title="janela entre duas sincronizações"
                style={{ left: x(v.win[0]), width: Math.max(2, x(v.win[1]) - x(v.win[0])), ['--c' as string]: c, ['--wa' as string]: lane.type === 'desc' ? 'var(--t-desc-a)' : 'var(--t-title-a)' }} />
            ) : null)}
            {lane.versions.map((v, i) => {
              let L = x(v.fromH) + 1, W = Math.max(8, x(v.toH) - x(v.fromH) - 2)
              const cls = isHl(hl, lane, i) ? ' is-hl' : ''
              const common = {
                type: 'button' as const, 'data-k': lane.type + ':' + i, 'aria-label': v.aria,
                onMouseEnter: () => onHl({ type: lane.type, i, ev: null }), onFocus: () => onHl({ type: lane.type, i, ev: null }),
                onMouseLeave: () => onHl(null), onBlur: () => onHl(null), onClick: () => onClip(lane.type, i),
              }
              if (W < 32) {
                const bw = W; L = L + W / 2 - 16; W = 32
                return (
                  <button key={i} {...common} className={'clip tiny' + cls} title={v.aria} style={{ left: L, width: W, ['--hl' as string]: c, ['--bw' as string]: bw + 'px' }}>
                    <span className="bar" aria-hidden="true" /><span className="vid">{v.label}</span>
                  </button>
                )
              }
              if (lane.type === 'thumb') {
                const narrow = W < 70
                return (
                  <button key={i} {...common} className={'clip' + (v.cur ? ' cur' : '') + (narrow ? ' narrow' : '') + cls} title={v.aria} style={{ left: L, width: W, ['--hl' as string]: c }}>
                    {narrow ? <span className="vid">{v.label}</span> : <>{v.thumb ? <Thumb t={v.thumb} /> : null}<span className="vid">{v.label}</span>{v.reverted && W > 150 ? <span className="ret">voltou</span> : null}</>}
                  </button>
                )
              }
              return (
                <button key={i} {...common} className={'clip' + (v.cur ? ' cur' : '') + cls} style={{ left: L, width: W, ['--hl' as string]: c }}>
                  <span className="vid">{v.label}</span>{W > 60 && v.clipText ? <span className="tt">{v.clipText}</span> : null}
                </button>
              )
            })}
            {spread(lane.markers, x).map(m => (
              <button key={m.changeId} className={'mk' + (hl && hl.type === lane.type && hl.ev === m.idx ? ' on' : '')} type="button"
                style={{ left: m.px, ['--c' as string]: c }} data-ev={lane.type + ':' + m.idx} aria-label={m.aria} aria-describedby="hv-tip"
                onMouseEnter={e => onMarker(m, lane.type, e.currentTarget)} onFocus={e => onMarker(m, lane.type, e.currentTarget)}
                onMouseLeave={() => onMarker(m, lane.type, null)} onBlur={() => onMarker(m, lane.type, null)}
                onClick={() => onMarkerClick(m)}>
                <span><HIcon name={lane.type} /></span>
              </button>
            ))}
          </div>
        )
      })}
      {fewAxis ? (
        <div className="lane-axis" aria-hidden="true">
          {fewAxis.map((m, i) => <span key={i} style={{ left: x(m.h) }}>{m.label}</span>)}
        </div>
      ) : null}
    </div>
  )
}

