'use client'
/**
 * Title / thumbnail / description lanes under the curve. Pixel mapping only: every text, hour and window comes from the
 * view model; lane-layout.ts decides which periods and markers share one target. Each lane is ONE Tab stop: the arrows,
 * Home and End walk its periods and changes in time order. A group opens its list with Enter, space or a click, never on focus.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from 'react'
import type { LaneType, LaneView, MarkerView } from './view-model'
import { fitCount, type LaneItem, type MarkGroup, type PeriodGroup } from './lane-layout'
import { HIcon, TYPE_COLOR, type HIconName } from './icons'
import { Thumb } from './thumb'

/** `label` set = every period of that thumbnail image (the image summary's row); `i` is then -1. */
export interface Hl { type: LaneType; i: number; ev: number | null; label?: string }
export interface Geom { w: number; H: number; x: (h: number) => number }
/** What the tooltip says about a group: its count, its span and how to open it. */
export interface GroupTip { type: LaneType; title: string; when: string; seq: string | null }

const STATUS_ICON = (s: string): HIconName | null =>
  ['neutro', 'ganhou', 'perdeu', 'inconclusivo', 'aguardando', 'sem-serie', 'sem-antes'].includes(s) ? (s as HIconName) : null

export function isHl(hl: Hl | null, lane: LaneView, i: number): boolean {
  if (!hl || hl.type !== lane.type) return false
  if (hl.label != null) return lane.type === 'thumb' && lane.versions[i]?.label === hl.label
  if (hl.i === i) return true
  return lane.type === 'thumb' && lane.versions[i]?.label === lane.versions[hl.i]?.label
}

export function Lanes({ lanes, layouts, geom, stale, fewAxis, fromH, hl, onHl, onMarker, onMarkerClick, onClip, onGroupTip }: {
  lanes: LaneView[]; layouts: LaneItem[][]; geom: Geom
  stale: { fromH: number; title: string } | null
  fewAxis: Array<{ h: number; label: string }> | null
  /** Start of the shown period (hours since publication): a window that ended before it is not drawn. */
  fromH: number
  hl: Hl | null
  onHl: (h: Hl | null) => void
  onMarker: (m: MarkerView, type: LaneType, el: HTMLElement | null) => void
  onMarkerClick: (m: MarkerView) => void
  onClip: (type: LaneType, i: number) => void
  onGroupTip: (g: GroupTip | null, el: HTMLElement | null) => void
}) {
  const { x, H } = geom
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<string | null>(null)
  /** The item of each lane that holds the Tab stop (index in the lane's time order). */
  const [rove, setRove] = useState<Record<string, number>>({})
  // a new layout (width, period filter) has other groups: nothing stays open
  useEffect(() => { setOpen(null) }, [layouts])
  // Esc closes the open list from anywhere and gives the focus back to its counter; a click outside closes it
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const w = root.current?.querySelector<HTMLElement>('.gwrap.open')
      const had = !!w && w.contains(document.activeElement)
      setOpen(null)
      if (had) w!.querySelector<HTMLElement>('.gbtn')?.focus()
    }
    const down = (e: MouseEvent) => { if (!(e.target as HTMLElement | null)?.closest?.('.gwrap')) setOpen(null) }
    document.addEventListener('keydown', key); document.addEventListener('mousedown', down)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', down) }
  }, [open])

  const onKeys = (e: RKeyboardEvent<HTMLDivElement>, type: LaneType) => {
    const t = e.target as HTMLElement
    // inside an open list the vertical arrows walk its rows
    const row = t.closest<HTMLElement>('.gpop button')
    if (row && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const rows = [...row.closest('.gpop')!.querySelectorAll<HTMLElement>('button')], k = rows.indexOf(row)
      e.preventDefault(); rows[Math.max(0, Math.min(rows.length - 1, k + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus()
      return
    }
    const it = t.closest<HTMLElement>('.ln-i')
    if (!it) return
    const all = [...e.currentTarget.querySelectorAll<HTMLElement>('.ln-i')], k = all.indexOf(it)
    const n = e.key === 'ArrowRight' ? Math.min(all.length - 1, k + 1) : e.key === 'ArrowLeft' ? Math.max(0, k - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -1
    if (n < 0) return
    e.preventDefault(); setOpen(null); setRove(r => ({ ...r, [type]: n })); all[n]?.focus()
  }

  return (
    <div className="lanes" ref={root}>
      {lanes.map((lane, li) => {
        const c = TYPE_COLOR[lane.type], items = layouts[li] ?? []
        const stop = Math.min(rove[lane.type] ?? 0, Math.max(0, items.length - 1))
        const hlLabel = hl && hl.type === lane.type && hl.label != null ? hl.label : null
        return (
          <div key={lane.type} className={'lane' + (lane.type === 'thumb' ? ' thumbs' : '') + (lane.runs.length ? ' has-run' : '') + (items.some(i => i.kind === 'mgroup') ? ' has-grp' : '')}
            data-lane={lane.type} role="group" aria-label={lane.aria} onKeyDown={e => onKeys(e, lane.type)}>
            <div className="lane-l"><i style={{ background: c }} aria-hidden="true" />{lane.label}</div>
            {lane.pre ? (
              <div className="pre" title={lane.pre.title} style={{ left: x(lane.pre.fromH), width: Math.max(0, x(lane.pre.toH) - x(lane.pre.fromH) - 2) }}>
                <span>{lane.pre.text}</span>
              </div>
            ) : null}
            {stale ? <div className="stale" title={stale.title} style={{ left: x(stale.fromH), width: Math.max(0, x(H) - x(stale.fromH)) }} /> : null}
            {lane.versions.map((v, i) => v.inRange && v.win && v.win[1] > fromH ? (
              <div key={'w' + i} className="win" title="janela entre duas sincronizações"
                style={{ left: x(v.win[0]), width: Math.max(2, x(v.win[1]) - x(v.win[0])), ['--c' as string]: c, ['--wa' as string]: lane.type === 'desc' ? 'var(--t-desc-a)' : 'var(--t-title-a)' }} />
            ) : null)}
            {items.map((it, k) => {
              const tab = k === stop ? 0 : -1
              if (it.kind === 'clip') {
                const v = it.v, i = it.i, W = it.width
                const common = {
                  type: 'button' as const, tabIndex: tab, 'data-k': lane.type + ':' + i, 'aria-label': v.name, title: v.aria,
                  onMouseEnter: () => onHl({ type: lane.type, i, ev: null }), onFocus: () => onHl({ type: lane.type, i, ev: null }),
                  onMouseLeave: () => onHl(null), onBlur: () => onHl(null), onClick: () => onClip(lane.type, i),
                }
                const cls = 'ln-i' + (v.cur ? ' cur' : '') + (isHl(hl, lane, i) ? ' is-hl' : '')
                if (it.small) return <button key={'p' + i} {...common} className={'clip sm ' + cls} style={{ left: it.left, width: W }}>{W >= 14 ? <span className="vid">{v.label}</span> : null}</button>
                if (lane.type === 'thumb') {
                  const narrow = W < 70
                  return (
                    <button key={'p' + i} {...common} className={'clip ' + cls + (narrow ? ' narrow' : '')} style={{ left: it.left, width: W }}>
                      {narrow ? <span className="vid">{v.label}</span> : <>{v.thumb ? <Thumb t={v.thumb} w={64} h={36} alt="" /> : null}<span className="vid">{v.label}</span>{v.reverted && W > 150 ? <span className="ret">voltou</span> : null}</>}
                    </button>
                  )
                }
                return (
                  <button key={'p' + i} {...common} className={'clip ' + cls} style={{ left: it.left, width: W }}>
                    <span className="vid">{v.label}</span>{W > 60 && v.clipText ? <span className="tt">{v.clipText}</span> : null}
                  </button>
                )
              }
              if (it.kind === 'mk') {
                const m = it.m
                return (
                  <button key={m.changeId} className={'mk ln-i' + (hl && hl.type === lane.type && hl.ev === m.idx ? ' on' : '')} type="button" tabIndex={tab}
                    style={{ left: it.px, ['--c' as string]: c }} data-ev={lane.type + ':' + m.idx} aria-label={m.aria} aria-describedby="hv-tip"
                    onMouseEnter={e => onMarker(m, lane.type, e.currentTarget)} onFocus={e => onMarker(m, lane.type, e.currentTarget)}
                    onMouseLeave={() => onMarker(m, lane.type, null)} onBlur={() => onMarker(m, lane.type, null)}
                    onClick={() => onMarkerClick(m)}>
                    <span><HIcon name={lane.type} /></span>
                  </button>
                )
              }
              const isOpen = open === it.key, id = 'hv-gp-' + it.key.replace(':', '-')
              const tip: GroupTip = it.kind === 'pgroup'
                ? { type: lane.type, title: it.unit + (lane.type === 'thumb' ? ' de thumbnail' : ''), when: 'de ' + it.from + ' até ' + it.to, seq: it.seq }
                : { type: lane.type, title: it.n + ' trocas de ' + lane.changeWord, when: 'entre ' + it.from + ' e ' + it.to, seq: null }
              const btn = {
                type: 'button' as const, tabIndex: tab, 'aria-expanded': isOpen, 'aria-controls': id, 'aria-label': it.name, 'data-group': it.key,
                onClick: () => { onGroupTip(null, null); setOpen(isOpen ? null : it.key) },
                onMouseEnter: (e: { currentTarget: HTMLElement }) => { if (!isOpen) onGroupTip(tip, e.currentTarget) }, onMouseLeave: () => onGroupTip(null, null),
                onFocus: (e: { currentTarget: HTMLElement }) => { if (!isOpen) onGroupTip(tip, e.currentTarget) }, onBlur: () => onGroupTip(null, null),
              }
              const wrapBlur = (e: { currentTarget: HTMLElement; relatedTarget: EventTarget | null }) => { if (isOpen && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(null) }
              if (it.kind === 'pgroup') {
                const on = it.members.filter(m => isHl(hl, lane, m.i)).length
                return (
                  <div key={it.key} className={'gwrap pg' + (isOpen ? ' open' : '')} style={{ left: it.left, width: it.width }} onBlur={wrapBlur}>
                    <button {...btn} className={'cgrp gbtn ln-i' + (on ? ' is-hl' : '')}>
                      {it.members.map(m => <span key={m.i} className={'sl' + (isHl(hl, lane, m.i) ? ' is-hl' : '')} data-sl={lane.type + ':' + m.i} style={{ left: m.left, width: m.width }} />)}
                      {it.letters ? <span className="gl" aria-hidden="true">{it.letters}</span> : null}
                      <span className="gn" aria-hidden="true">{hlLabel && on ? fitCount(on + ' de ' + it.members.length + ': ' + hlLabel, on + '/' + it.members.length, it.width) : it.count}</span>
                    </button>
                    <GroupPop id={id} open={isOpen} below={false} title={tip.title + ' neste trecho'}>
                      {it.members.map(m => (
                        <li key={m.i}><button type="button" data-go={lane.type + ':' + m.i} onClick={() => { setOpen(null); onClip(lane.type, m.i) }}>
                          <span className="gk">{m.v.label}</span><span className="g1">{cap(m.v.span)}</span>
                          <span className="g2">no ar por {m.v.dur}{lane.type === 'title' && m.v.clipText ? ' · ' + m.v.clipText : ''}</span>
                        </button></li>
                      ))}
                    </GroupPop>
                  </div>
                )
              }
              return <MarkerGroup key={it.key} it={it} id={id} lane={lane} color={c} isOpen={isOpen} btn={btn} wrapBlur={wrapBlur} tipTitle={tip.title}
                onPick={m => { setOpen(null); onMarkerClick(m) }} />
            })}
            {lane.runs.length ? (
              <div className="runrow">
                {lane.runs.map((r, i) => {
                  const a = x(r.fromH), w = Math.max(8, x(r.toH) - a), full = 'trocas em sequência: ' + r.rest
                  return (
                    <div key={i} className={'runb' + (r.open ? ' open' : '') + (r.cutLeft ? ' cutl' : '')} role="img" aria-label={r.aria} style={{ left: a, width: w, ['--c' as string]: c }}>
                      {w >= full.length * 5.9 + 18 ? <span className="rl" aria-hidden="true"><b>trocas em sequência</b>: {r.rest}</span>
                        : w >= r.short.length * 5.9 + 18 ? <span className="rl" aria-hidden="true">{r.short}</span> : null}
                    </div>
                  )
                })}
              </div>
            ) : null}
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

const cap = (t: string) => (t ? t[0]!.toUpperCase() + t.slice(1) : '')

function MarkerGroup({ it, id, lane, color, isOpen, btn, wrapBlur, tipTitle, onPick }: {
  it: MarkGroup; id: string; lane: LaneView; color: string; isOpen: boolean
  btn: Record<string, unknown>; wrapBlur: (e: { currentTarget: HTMLElement; relatedTarget: EventTarget | null }) => void
  tipTitle: string; onPick: (m: MarkerView) => void
}) {
  return (
    <div className={'gwrap mg' + (isOpen ? ' open' : '')} style={{ left: it.left, width: it.width, ['--c' as string]: color }} onBlur={wrapBlur}>
      <span className="mspan" style={{ left: 0, width: it.width }} />
      {it.members.map(m => <span key={m.m.changeId} className="mtick" style={{ left: m.px - it.left }} />)}
      <button {...btn} className="mkg gbtn ln-i" data-pairs={it.members.map(m => m.m.changeId).join(' ')}>
        <span><HIcon name={lane.type} />{it.abbr ? <>{it.n} <abbr title="trocas">tr.</abbr></> : it.n + ' trocas'}</span>
      </button>
      <GroupPop id={id} open={isOpen} below title={tipTitle + ' neste trecho'}>
        {it.members.map(m => {
          const ic = STATUS_ICON(m.m.list.status)
          return (
            <li key={m.m.changeId}><button type="button" data-pair={m.m.changeId} onClick={() => onPick(m.m)}>
              <span className="gk">{ic ? <HIcon name={ic} /> : null}</span><span className="g1">{m.m.list.label}</span><span className="g2">{m.m.list.line}</span>
            </button></li>
          )
        })}
      </GroupPop>
    </div>
  )
}

/** The list of a group: always in the DOM (aria-controls), hidden until opened; kept inside the timeline's box. */
function GroupPop({ id, open, below, title, children }: { id: string; open: boolean; below: boolean; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [left, setLeft] = useState(0)
  useLayoutEffect(() => {
    const pop = ref.current, wrap = pop?.closest('.tl-wrap')
    if (!open || !pop || !wrap) { setLeft(0); return }
    const pr = pop.getBoundingClientRect(), tr = wrap.getBoundingClientRect()
    // `natural` = where the list sits with left: 0; pull it back inside the right edge, then never past the left one
    const natural = pr.left - left, over = natural + pr.width - (tr.right - 4)
    let dx = over > 0 ? -over : 0
    const under = tr.left + 4 - (natural + dx)
    if (under > 0) dx += under
    setLeft(dx)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="gpop" id={id} ref={ref} hidden={!open} style={{ left, top: below ? 26 : undefined }}>
      <h4>{title}</h4>
      <ul>{children}</ul>
    </div>
  )
}
