/**
 * Dense lanes (Fase 4 item 4): which periods and markers of a lane become one target because they would not fit side by
 * side. Pixel mapping only: no text is invented here, the names are joined from the texts of the view model.
 * Two rules: (1) no period is drawn wider than its real duration; (2) no marker leaves the instant of its change.
 */
import type { LaneView, MarkerView, VersionView } from './view-model'

/** Minimum width of a target: 32 px with a fine pointer, 44 px with a coarse pointer or a narrow screen. */
export const MINPX = 32, MINPX_COARSE = 44

/** `small` = narrower than the minimum target: drawn at its real width, the click area grows by a pseudo-element. */
export interface PeriodItem { kind: 'clip'; small: boolean; i: number; v: VersionView; left: number; width: number; x: number }
export interface PeriodGroup {
  kind: 'pgroup'; key: string; left: number; width: number; x: number
  members: Array<{ i: number; v: VersionView; left: number; width: number }>
  /** "4 períodos" · its accessible name · the first start and the last end · "B → A → C → A" */
  unit: string; name: string; from: string; to: string; seq: string
  /** What fits inside the group: the letters in order (thumbnail only) and the count. */
  letters: string; count: string
}
export interface MarkItem { kind: 'mk'; m: MarkerView; px: number; x: number }
export interface MarkGroup {
  kind: 'mgroup'; key: string; left: number; width: number; x: number
  members: Array<{ m: MarkerView; px: number }>
  n: number; name: string; from: string; to: string
  /** No room for "N trocas" next to a neighbouring counter: "N tr.". */
  abbr: boolean
}
export type LaneItem = PeriodItem | PeriodGroup | MarkItem | MarkGroup

/** The letters of a group that fit in `px`: all of them, or the first ones and how many are left out. */
export function fitLetters(labels: readonly string[], px: number): string {
  const max = Math.floor((px - 6) / 6.4), all = labels.join(' ')
  if (all.length <= max) return all
  for (let k = labels.length - 1; k >= 2; k--) { const t = labels.slice(0, k).join(' ') + ' +' + (labels.length - k); if (t.length <= max) return t }
  return ''
}
/** The count that fits: the whole text, only the number, or nothing (the accessible name always has the whole text). */
export function fitCount(full: string, short: string, px: number): string {
  return full.length * 5.7 + 8 <= px ? full : short.length * 6.2 + 6 <= px ? short : ''
}

export function layoutLane(lane: LaneView, x: (h: number) => number, minpx: number): LaneItem[] {
  const out: Array<LaneItem & { o: number }> = []
  const its = lane.versions.map((v, i) => ({ v, i })).filter(q => q.v.inRange).map(q => { const L = x(q.v.fromH), R = x(q.v.toH); return { ...q, L, R, W: R - L } })
  for (let a = 0; a < its.length; a++) {
    const it = its[a]!
    if (it.W >= minpx) { out.push({ kind: 'clip', small: false, i: it.i, v: it.v, left: it.L + 1, width: Math.max(8, it.W - 2), x: it.L, o: 1 }); continue }
    let b = a
    while (b + 1 < its.length && its[b + 1]!.W < minpx) b++
    if (b === a) { out.push({ kind: 'clip', small: true, i: it.i, v: it.v, left: it.L + 0.5, width: Math.max(3, it.W - 1), x: it.L, o: 1 }); continue }
    const grp = its.slice(a, b + 1), L0 = grp[0]!.L, ext = grp[grp.length - 1]!.R - L0, labels = grp.map(g => g.v.label)
    const unit = grp.length + ' ' + lane.unit[1], from = grp[0]!.v.edge.from, to = grp[grp.length - 1]!.v.edge.to
    out.push({
      kind: 'pgroup', key: lane.type + ':p' + grp[0]!.i, left: L0, width: ext, x: L0, o: 1,
      members: grp.map(g => ({ i: g.i, v: g.v, left: g.L - L0, width: Math.max(3, g.W) })),
      unit, from, to, seq: labels.join(' → '),
      name: unit + (lane.type === 'thumb' ? ' de thumbnail' : '') + ', de ' + from + ' até ' + to + ': ' + labels.join(', '),
      letters: lane.type === 'thumb' ? fitLetters(labels, ext) : '', count: fitCount(unit, String(grp.length), ext),
    })
    a = b
  }
  // markers: the ones closer than minpx become one counter; then counters that would sit on top of each other are joined
  const ms = lane.markers.filter(m => m.inRange).map(m => ({ m, px: x(m.h) })).sort((p, q) => p.px - q.px)
  const cl: Array<Array<{ m: MarkerView; px: number }>> = []
  for (const m of ms) { const k = cl[cl.length - 1]; if (k && m.px - k[k.length - 1]!.px < minpx) k.push(m); else cl.push([m]) }
  const cx = (k: Array<{ px: number }>) => (k[0]!.px + k[k.length - 1]!.px) / 2
  for (let i = 0; i < cl.length - 1; i++) {
    if (cl[i]!.length > 1 && cl[i + 1]!.length > 1 && cx(cl[i + 1]!) - cx(cl[i]!) < 60) { cl[i] = cl[i]!.concat(cl[i + 1]!); cl.splice(i + 1, 1); i-- }
  }
  cl.forEach((k, ci) => {
    if (k.length === 1) { out.push({ kind: 'mk', m: k[0]!.m, px: k[0]!.px, x: k[0]!.px, o: 0 }); return }
    const L0 = k[0]!.px, n = k.length, from = k[0]!.m.edge.from, to = k[n - 1]!.m.edge.to
    const room = Math.min(1e9, ...[cl[ci - 1], cl[ci + 1]].filter((q): q is Array<{ m: MarkerView; px: number }> => !!q && q.length > 1).map(q => Math.abs(cx(q) - cx(k))))
    out.push({ kind: 'mgroup', key: lane.type + ':m' + k[0]!.m.idx, left: L0, width: k[n - 1]!.px - L0, x: L0, o: 0, members: k, n, from, to,
      name: n + ' trocas de ' + lane.changeWord + ' entre ' + from + ' e ' + to, abbr: room < 96 })
  })
  // time order; on a tie the change comes before the period it creates
  return out.sort((p, q) => (Math.abs(p.x - q.x) < 1 ? p.o - q.o : p.x - q.x))
}
