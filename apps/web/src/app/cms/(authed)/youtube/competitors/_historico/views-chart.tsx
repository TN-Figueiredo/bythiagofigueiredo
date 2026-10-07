'use client'
/**
 * "Views por dia e cada troca": the step curve, the expected curve dashed in --muted, the lanes, the change lines and
 * the tooltip (port of renderChart/renderLanes/legend). Pixel mapping only; the numbers and texts come from the view model.
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ChartView, ComparisonView, LaneType, LaneView, LanesAxisView, LegendItem, MarkerView, RangeView } from './view-model'
import { RichText } from '../_mudancas/rich'
import type { RangeId } from './many-versions'
import { Lanes, type Geom, type GroupTip, type Hl } from './lanes'
import { layoutLane, MINPX, MINPX_COARSE } from './lane-layout'
import { HIcon, TYPE_COLOR } from './icons'
import { Thumb } from './thumb'

const PADL = 92, PADR = 14, HH = 200, TOP = 22, BOT = 26, PH = HH - TOP - BOT
const yPx = (f: number) => TOP + PH - f * PH

export function geomOf(w: number, chart: ChartView): Geom {
  const pw = w - PADL - PADR, H = chart.H, f = chart.fromH
  // with a period filter the axis starts at fromH: what is older is pinned to the left edge, never drawn outside
  if (chart.B0 == null) return { w, H, x: h => PADL + ((Math.max(f, h) - f) / Math.max(1e-9, H - f)) * pw }
  const B0 = chart.B0, preW = Math.min(120, pw * 0.14)
  return { w, H, x: h => (h <= B0 ? PADL + (h / B0) * preW : PADL + preW + ((h - B0) / (H - B0)) * (pw - preW)) }
}

/** Linear geometry of the lanes when there is no chart (R117): from the first stored version to the last check. */
export function geomOfAxis(w: number, a: LanesAxisView): Geom {
  const pw = w - PADL - PADR, span = Math.max(1e-9, a.toH - a.fromH)
  return { w, H: a.toH, x: h => PADL + Math.min(1, Math.max(0, (h - a.fromH) / span)) * pw }
}
/** Which tick labels fit: the first and the last always; a middle one when it is at least `gap` px from its shown neighbours. */
export function shownTicks(px: number[], gap = 64): boolean[] {
  const n = px.length, show = px.map((_, i) => i === 0 || i === n - 1)
  let last = px[0] ?? 0
  for (let i = 1; i < n - 1; i++) if (px[i]! - last >= gap && px[n - 1]! - px[i]! >= gap) { show[i] = true; last = px[i]! }
  return show
}

interface TipState { m: MarkerView | null; g: GroupTip | null; type: LaneType; px: number; laneTop: number }
const coarse = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer:coarse),(max-width:900px)').matches

export function Timeline({ chart, axis, lanes, legend, pair, hl, onHl, onSelectPair, onGoVersion, range, onRange, groupLegend }: {
  chart: ChartView | null; axis?: LanesAxisView | null; lanes: LaneView[]; legend: LegendItem[]; pair: ComparisonView | null
  hl: Hl | null; onHl: (h: Hl | null) => void
  onSelectPair: (k: string) => void; onGoVersion: (type: LaneType, i: number) => void
  /** Period filter (null = not offered) and what a choice does; the legend text of a group of close items. */
  range?: RangeView | null; onRange?: (id: RangeId) => void; groupLegend?: string
}) {
  const wrap = useRef<HTMLDivElement>(null), tipRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(1100)
  const [tip, setTip] = useState<TipState | null>(null)
  const [tipTop, setTipTop] = useState(0)
  const [minpx, setMinpx] = useState(MINPX)
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => { const cw = Math.round(el.clientWidth); if (cw > 0) setW(cw); setMinpx(coarse() ? MINPX_COARSE : MINPX) }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    if (tip && tipRef.current) setTipTop(tip.laneTop - tipRef.current.offsetHeight - 8)
  }, [tip])
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setTip(null); onHl(null) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onHl])
  const geom = useMemo(() => (chart ? geomOf(w, chart) : geomOfAxis(w, axis ?? { fromH: 0, toH: 1, ticks: [] })), [w, chart, axis])
  const ticks = !chart && axis ? axis.ticks.map(t => ({ ...t, px: geom.x(t.h) })) : []
  const tickShown = shownTicks(ticks.map(t => t.px))
  const { x } = geom
  const hlVer = hl ? lanes.find(l => l.type === hl.type)?.versions[hl.i] ?? null : null
  const fromH = chart?.fromH ?? 0
  const layouts = useMemo(() => lanes.map(l => layoutLane(l, geom.x, minpx)), [lanes, geom, minpx])
  const anyGroup = layouts.some(l => l.some(i => i.kind === 'pgroup' || i.kind === 'mgroup'))
  const fullLegend = anyGroup && groupLegend ? [...legend, { kind: 'grp' as const, text: groupLegend }] : legend

  const onMarker = (m: MarkerView, type: LaneType, el: HTMLElement | null) => {
    if (!el) { setTip(null); onHl(null); return }
    onHl({ type, i: m.idx, ev: m.idx })
    const wr = wrap.current?.getBoundingClientRect(), r = el.getBoundingClientRect()
    setTip({ m, g: null, type, px: wr ? r.left - wr.left + r.width / 2 : x(m.h), laneTop: wr ? r.top - wr.top : 0 })
  }
  // the hint of a group: not interactive, opens upwards (over the chart), closes with Esc from anywhere
  const onGroupTip = (g: GroupTip | null, el: HTMLElement | null) => {
    if (!g || !el) { setTip(null); return }
    const wr = wrap.current?.getBoundingClientRect(), r = el.getBoundingClientRect()
    setTip({ m: null, g, type: g.type, px: wr ? r.left - wr.left + r.width / 2 : 0, laneTop: wr ? r.top - wr.top : 0 })
  }
  const tw = Math.min(310, w - 8)
  const tipLeft = tip ? Math.max(0, Math.min(tip.px - tw / 2, w - tw)) : 0
  const events = lanes.flatMap(l => l.markers.filter(m => m.inRange).map(m => ({ type: l.type, m })))

  return (
    <section className="card timeline" aria-labelledby="hv-tlh">
      <div className="sec-h">
        <h3 id="hv-tlh">{chart ? 'Views por dia e cada troca' : 'Trocas de título, thumbnail e descrição'}</h3>
        {range ? (
          <div className="rng-ctl" role="group" aria-labelledby="hv-rngl">
            <span className="rng-l" id="hv-rngl">Período</span>
            <div className="seg">
              {range.options.map(o => <button key={o.id} type="button" aria-pressed={o.id === range.value} aria-label={o.aria} data-range={o.id} onClick={() => onRange?.(o.id)}>{o.label}</button>)}
            </div>
          </div>
        ) : null}
        <span className="src">{chart ? <>{chart.src.bold ? <b>{chart.src.bold}</b> : null}{chart.src.text}</> : 'o eixo vai da primeira versão guardada à última vez em que o vídeo foi conferido'}</span>
      </div>
      <div className="tl-wrap" ref={wrap}>
        {chart ? (chart.few && chart.empty ? (
          <div className="empty-chart" data-empty-chart="">
            <div>
              <strong>{chart.empty.title}</strong>{chart.empty.text}
              {chart.empty.last ? <><br />Último valor: <span className="mono">{chart.empty.last.views}</span> views, em {chart.empty.last.at}.</> : null}
              {chart.empty.tail}
              {chart.empty.link ? <><br /><a className="inl" href={chart.empty.link.href}>{chart.empty.link.text}</a></> : null}
            </div>
          </div>
        ) : (
          <ChartSvg chart={chart} geom={geom} pair={pair} hlRange={hlVer ? [hlVer.fromH, hlVer.toH] : null} />
        )) : null}
        <Lanes lanes={lanes} layouts={layouts} geom={geom} stale={chart?.stale ?? null} fewAxis={chart?.fewAxis ?? null} fromH={fromH} hl={hl} onHl={onHl}
          onMarker={onMarker} onMarkerClick={m => { setTip(null); if (m.pairK) onSelectPair(m.pairK) }} onClip={onGoVersion} onGroupTip={onGroupTip} />
        {!chart && ticks.length ? (
          <div className="lane-axis fx-axis" aria-hidden="true">
            {ticks.map((t, i) => <i key={'m' + i} style={{ left: t.px }} />)}
            {ticks.map((t, i) => (tickShown[i] ? <span key={'l' + i} style={{ left: t.px }}>{t.label}</span> : null))}
          </div>
        ) : null}
        <div className="vlines" aria-hidden="true" style={!chart ? { bottom: 24 } : chart.few ? undefined : { top: 22 }}>
          {events.map(({ type, m }) => {
            const on = hl && hl.type === type && hl.ev === m.idx ? ' on' : ''
            return m.win && m.win[0] >= fromH
              ? <div key={m.changeId} className={'vband' + on} style={{ left: x(m.win[0]), width: Math.max(2, x(m.win[1]) - x(m.win[0])), ['--c' as string]: TYPE_COLOR[type], ['--wa' as string]: type === 'desc' ? 'var(--t-desc-a)' : 'var(--t-title-a)' }} />
              : <div key={m.changeId} className={'vline' + on} style={{ left: x(m.h), ['--c' as string]: TYPE_COLOR[type] }} />
          })}
        </div>
        <div className={'tip' + (tip ? ' show' : '')} id="hv-tip" role="tooltip" ref={tipRef}
          style={{ left: tipLeft, top: tipTop, ['--c' as string]: tip ? TYPE_COLOR[tip.type] : undefined }}>
          {tip?.m ? <TipBody m={tip.m} /> : null}
          {tip?.g ? <><h4>{tip.g.title}</h4><div className="when">{tip.g.when}</div>{tip.g.seq ? <div className="seq">{tip.g.seq}</div> : null}<p className="hint">Enter, espaço ou clique abre a lista.</p></> : null}
        </div>
      </div>
      {/* what the period filter left inside, right under the lanes: changing it never pushes the chart */}
      {range ? <p className="rng-txt" id="hv-rngtxt" role="status"><RichText r={range.text} /></p> : null}
      <div className="legend" data-legend="">
        {fullLegend.map((l, i) => <LegendEntry key={i} l={l} />)}
      </div>
      {chart?.table ? (
        <details className="data">
          <summary>Ver os registros diários em tabela</summary>
          <div className="tw">
            <table className="mono">
              <caption className="sr">Views em cada registro diário</caption>
              <thead><tr><th scope="col">registro</th><th scope="col">views acumuladas</th><th scope="col">views/dia desde o anterior</th><th scope="col">esperado (n)</th></tr></thead>
              <tbody>{chart.table.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  )
}

function LegendEntry({ l }: { l: LegendItem }): ReactNode {
  if (l.kind === 'text') return <span>{l.text}</span>
  if (l.kind === 'run') return <span data-legend-kind="run"><i className="sw swrun" aria-hidden="true" />{l.text}</span>
  if (l.kind === 'grp') return <span data-legend-kind="grp"><span className="sw swgrp" aria-hidden="true">N trocas</span>{l.text}</span>
  if (l.kind === 'thumb') return <span style={{ color: 'var(--t-thumb)' }}><HIcon name="thumb" size={13} /><span style={{ color: 'var(--muted)' }}>{l.text}</span></span>
  const cls = l.kind === 'curve' ? 'sw' : l.kind === 'dash' ? 'sw dash' : l.kind === 'shade' ? 'sw shade' : l.kind === 'hatch' ? 'sw hatch' : 'sw swwin'
  return <span data-legend-kind={l.kind}><i className={cls} aria-hidden="true" />{l.text}</span>
}

function TipBody({ m }: { m: MarkerView }) {
  const b = m.tip.body
  return (
    <>
      <h4>{m.tip.title}</h4>
      <div className="when">{m.tip.when}</div>
      {b.kind === 'title' ? <><div className="bef">{b.before}</div><div className="aft">{b.after}</div></> : null}
      {b.kind === 'thumb' ? <><div className="thpair"><Thumb t={b.before} w={140} h={79} /><span aria-hidden="true">→</span><Thumb t={b.after} w={140} h={79} /></div>{b.revert ? <div className="aft" style={{ color: 'var(--t-thumb)' }}>{b.revert}</div> : null}</> : null}
      {b.kind === 'desc' ? <><div className="aft">{b.text}</div>{b.sub ? <div className="src" style={{ marginTop: 4 }}>{b.sub}</div> : null}</> : null}
    </>
  )
}

function ChartSvg({ chart, geom, pair, hlRange }: { chart: ChartView; geom: Geom; pair: ComparisonView | null; hlRange: [number, number] | null }) {
  const { w, x, H } = geom
  const B = chart.bins
  const parts: ReactNode[] = []
  chart.yTicks.forEach((t, i) => parts.push(
    <g key={'y' + i}><line x1={PADL} x2={w - PADR} y1={yPx(t.y)} y2={yPx(t.y)} stroke="var(--grid)" /><text x={PADL - 10} y={yPx(t.y) + 4} textAnchor="end">{t.label}</text></g>,
  ))
  parts.push(<text key="unit" x={PADL} y={TOP - 10}>views/dia</text>)
  if (chart.pre) {
    const xb = x(chart.pre.toH)
    parts.push(<rect key="pre" x={x(0)} y={TOP} width={Math.max(0, xb - x(0))} height={PH} fill="var(--well)" />)
    if (chart.B0 != null) {
      parts.push(<line key="preline" x1={xb} x2={xb} y1={TOP} y2={TOP + PH} stroke="var(--border-strong)" strokeDasharray="2 3" />)
      chart.pre.lines.forEach((ln, i) => parts.push(<text key={'pn' + i} className="note" x={x(0) + 6} y={TOP + 18 + i * 16}>{ln}</text>))
    } else parts.push(<text key="pn" className="note" x={x(0) + 8} y={TOP + 18}>{chart.pre.lines[0]}</text>)
  }
  if (hlRange) parts.push(<rect key="hl" data-hlrect="" x={x(Math.max(0, hlRange[0]))} y={TOP} width={Math.max(0, x(hlRange[1]) - x(Math.max(0, hlRange[0])))} height={PH} fill="var(--text)" opacity={0.07} />)
  if (pair?.windows) {
    const [b0, b1] = pair.windows.before, [a0, a1] = pair.windows.after
    parts.push(<rect key="wb" x={x(b0)} y={TOP} width={Math.max(0, x(b1) - x(b0))} height={PH} fill="var(--text)" opacity={0.05} />)
    parts.push(<rect key="wa" x={x(a0)} y={TOP} width={Math.max(0, x(a1) - x(a0))} height={PH} fill="var(--text)" opacity={0.05} />)
  }
  if (B.length) {
    let area = 'M' + x(B[0]!.a) + ',' + yPx(0)
    let line = ''
    B.forEach((b, i) => { area += ' L' + x(b.a) + ',' + yPx(b.y) + ' L' + x(b.b) + ',' + yPx(b.y); line += (i ? 'L' : 'M') + x(b.a) + ',' + yPx(b.y) + ' L' + x(b.b) + ',' + yPx(b.y) + ' ' })
    area += ' L' + x(B[B.length - 1]!.b) + ',' + yPx(0) + 'Z'
    parts.push(<path key="area" d={area} fill="var(--curve-fill)" />)
    if (chart.expectedSteps.length) {
      let e = ''
      chart.expectedSteps.forEach(p => { e += (p.joined ? 'L' : 'M') + x(p.a) + ',' + yPx(p.y) + ' L' + x(p.b) + ',' + yPx(p.y) + ' ' })
      parts.push(<path key="exp" data-expected="" d={e} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 4" />)
    }
    parts.push(<path key="curve" data-curve="" d={line} fill="none" stroke="var(--curve)" strokeWidth={2} strokeLinejoin="round" />)
    if (chart.hatch) {
      const hx0 = x(chart.hatch.fromH)
      parts.push(<rect key="hatch" x={hx0} y={TOP} width={Math.max(3, x(H) - hx0)} height={PH} fill="url(#hv-hatch)" />)
      if (chart.hatch.note) parts.push(<text key="hn" className="note" x={hx0 - 6} y={TOP + 18} textAnchor="end">{chart.hatch.note}</text>)
    }
    const per = (w - PADL - PADR) / (Math.max(1e-9, H - chart.fromH) / 24)
    if (per >= 56) {
      let last: { r: number; y: number } | null = null
      B.forEach((b, i) => {
        const cx = (x(b.a) + x(b.b)) / 2, wt = b.label.length * 6.7, yy = Math.max(TOP + 10, yPx(b.labelY) - 7)
        if (last && cx - wt / 2 < last.r + 6 && Math.abs(yy - last.y) < 14) return
        last = { r: cx + wt / 2, y: yy }
        parts.push(<text key={'vl' + i} className="vl" x={cx} y={yy} textAnchor="middle">{b.label}</text>)
      })
    }
    if (chart.firstNote) {
      const fx = x(chart.firstNote.toH)
      parts.push(<line key="fn" x1={x(0)} x2={fx} y1={TOP + PH - 1} y2={TOP + PH - 1} stroke="var(--muted)" strokeWidth={2} />)
      parts.push(<text key="fnt" className="note" x={x(0) + 4} y={TOP + PH - 8}>{chart.firstNote.text}</text>)
    }
  }
  const tk: Array<{ h: number; label: string }> = []
  chart.xTicks.forEach((t, i) => {
    if (tk.length && x(t.h) - x(tk[tk.length - 1]!.h) < 56) { if (i === chart.xTicks.length - 1) tk[tk.length - 1] = t; return }
    tk.push(t)
  })
  tk.forEach((t, i) => parts.push(
    <g key={'x' + i}><line x1={x(t.h)} x2={x(t.h)} y1={TOP + PH} y2={TOP + PH + 5} stroke="var(--border-strong)" />
      <text x={x(t.h)} y={HH - 6} textAnchor={i === 0 ? 'start' : i === tk.length - 1 ? 'end' : 'middle'}>{t.label}</text></g>,
  ))
  return (
    <svg className="hv-chart" role="img" aria-label={chart.aria} viewBox={'0 0 ' + w + ' ' + HH} height={HH}>
      <defs><pattern id="hv-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="6" fill="var(--border-strong)" /></pattern></defs>
      {parts}
    </svg>
  )
}
