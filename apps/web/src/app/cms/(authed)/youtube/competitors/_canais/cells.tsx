'use client'
/**
 * Cells shared by the table and the cards (port of canais.html cells/chCell/syncCell/growthCell/strip/thumb).
 * They only lay out what the view model computed.
 */
import { useId, type ReactNode } from 'react'
import type { CadenceCell, CanaisRow, GrowthCell, OutCell, SwapCell, SyncCell, Thumb, VpdCell } from './view-model'
import { NicheSelect } from './niche-editor'
import type { Niche } from '@/lib/youtube/observatorio/types'

const P: Record<string, ReactNode> = {
  wait: <path d="M4 1.5h8M4 14.5h8M5 1.5c0 3 6 3.5 6 6.5s-6 3.5-6 6.5M11 1.5c0 3-6 3.5-6 6.5s6 3.5 6 6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
  up: <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  down: <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  eq: <path d="M3 6h10M3 10h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  q: <><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.3v.1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  warn: <><path d="M8 2 1.5 13.5h13z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8 6.5v3.2M8 11.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
  clock: <><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 4.5V8l2.3 1.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  pause: <path d="M5.5 3.5v9M10.5 3.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  spin: <path d="M8 2a6 6 0 1 1-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  ok: <><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5.3 8.2 7.2 10l3.5-3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>,
  nodata: <><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M4 12 12 4" stroke="currentColor" strokeWidth="1.5" /></>,
  plus: <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" />,
  search: <><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10.5 10.5 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" /></>,
  close: <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" />,
  trash: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  dots: <><circle cx="3" cy="8" r="1.4" fill="currentColor" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /><circle cx="13" cy="8" r="1.4" fill="currentColor" /></>,
}
export type IconName = keyof typeof P
export function Ic({ n, spin }: { n: IconName; spin?: boolean }) {
  return <svg className={'ico' + (spin ? ' spin' : '')} viewBox="0 0 16 16" aria-hidden="true" focusable="false">{P[n]}</svg>
}

/** "?" help with a tooltip (canais.html .tip); aria-describedby points at the tooltip. */
export function Tip({ label, children, left }: { label: string; children: ReactNode; left?: boolean }) {
  const id = useId()
  return (
    <span className={'tip' + (left ? ' left' : '')} tabIndex={0} role="button" aria-label={label} aria-describedby={id}>
      <span className="tt" role="tooltip" id={id}>{children}</span>
    </span>
  )
}

export function ThumbView({ t, lg }: { t: Thumb | null; lg?: boolean }) {
  if (!t) return null
  if (!t.src) return <span className={'thumb ph' + (lg ? ' lg' : '')} aria-hidden="true" data-thumb-missing="">{t.text}</span>
  return (
    <span className={'thumb img' + (lg ? ' lg' : '')} aria-hidden="true" data-thumb="">
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed 16:9 thumb, already sized by YouTube */}
      <img src={t.src} alt="" loading="lazy" decoding="async" />
    </span>
  )
}

/** 13-week strip: long bars and Short bars per week (geometry only; the counts come from the engine). */
export function Strip({ cell }: { cell: CadenceCell }) {
  const W = 130, H = 30
  if (cell.kind === 'na') return (
    <svg width={W} height={H} aria-hidden="true">{Array.from({ length: 13 }, (_, i) => <rect key={i} x={i * 10 + 3} y={H - 2} width={3} height={2} fill="var(--strip-empty)" />)}</svg>
  )
  return (
    <svg width={W} height={H} role="img" aria-label={cell.label}>
      {cell.weeks.map((w, i) => {
        const x = i * 10
        if (!w.long && !w.short) return <rect key={i} x={x + 3} y={H - 2} width={3} height={2} fill="var(--strip-empty)" />
        const hl = Math.min(w.long, 5) * 5.2, hs = Math.min(w.short, 6) * 2.2
        return (
          <g key={i}>
            {w.long ? <rect x={x} y={H - hl} width={5} height={hl} rx={1} fill="var(--strip-long)" /> : null}
            {w.short ? <rect x={x + 6} y={H - hs} width={3} height={hs} rx={1} fill="var(--strip-short)" opacity={0.6} /> : null}
          </g>
        )
      })}
    </svg>
  )
}

export function CadenceView({ c }: { c: CadenceCell }) {
  if (c.kind === 'na') return <div className="cad"><Strip cell={c} /><span className="na" style={{ maxWidth: 150 }} title={c.title}>{c.text}</span></div>
  return (
    <div className="cad">
      <Strip cell={c} />
      <div className="v">
        <span className="num big" data-k="pw">{c.pw}</span> <span className="u">{c.unit}</span>
        {c.paused ? <span className="paused"><Ic n="pause" /><span>{c.paused}</span></span> : c.sub ? <small>{c.sub}</small> : null}
      </div>
    </div>
  )
}

export function VpdView({ c }: { c: VpdCell }) {
  if (c.kind === 'na') return <span className="na r" title={c.title}>{c.text}</span>
  return (
    <>
      <span className="big num" data-k="vpd">{c.big}</span>
      <span className="cap" style={{ whiteSpace: 'normal' }}>
        {c.abs ? <><span className="num">{c.abs}</span>/dia, </> : null}
        <span className={c.weak ? 'weak' : ''}>n{' '}={' '}<span data-k="n">{c.n}</span>{c.weak ? ', base fraca' : ''}</span>
        {c.tail}
      </span>
    </>
  )
}

export function OutView({ c, upnextHref }: { c: OutCell; upnextHref: string }) {
  if (c.kind === 'na') return (
    <span className="na">
      {c.text}{c.weak ? <> <span className="weak">{c.weak}</span></> : null}
      {c.upnext ? <> <a className="btn small link" href={upnextHref}>{c.upnext}</a></> : null}
    </span>
  )
  return (
    <div className="out" title={c.title}>
      <ThumbView t={c.thumb} />
      <div>
        <div className="t" title={c.videoTitle}>{c.videoTitle}</div>
        <div className="cap"><b className={`mult num ${c.tier}`} data-k="best">{c.mult}</b> vs {c.vs}, n{' '}={' '}<span data-k="bestN">{c.n}</span></div>
        <div className="cap">publicado <span title={c.publishedTitle}>{c.published}</span>, <span data-k="outs">{c.count}</span></div>
      </div>
    </div>
  )
}

export function SwapView({ c }: { c: SwapCell }) {
  if (c.kind === 'na') return <span className="na">{c.text}</span>
  return <div className="swap"><div className="k num" data-k="sw">{c.n}</div><div className="last">{c.lastTitle ? <span title={c.lastTitle}>{c.last}</span> : c.last}</div></div>
}

export function GrowthView({ c }: { c: GrowthCell }) {
  if (c.kind === 'na') return <span className="na r" title={c.title}>{c.text}</span>
  if (c.kind === 'flat') return <><span className="big num flat">{c.big}</span><span className="cap capr" style={{ whiteSpace: 'normal', maxWidth: 135 }}><span data-k="growth">{c.cap}</span></span></>
  return (
    <>
      <span className={`big num ${c.up ? 'up' : 'down'}`} title={c.title}><Ic n={c.up ? 'up' : 'down'} /> {c.big}</span>
      <span className="cap num capr" data-k="growth" style={{ whiteSpace: 'normal', maxWidth: 118 }}>{c.cap}</span>
    </>
  )
}

export type LocalSync = 'now' | 'just' | 'queued' | undefined
export function SyncView({ c, local, onRetry, onRemove }: { c: SyncCell; local: LocalSync; onRetry: () => void; onRemove: () => void }) {
  const cov = c.cov ? <div className="cov" title={c.covTitle ?? undefined}>{c.cov}</div> : null
  if (local === 'now') return <><div className="st" style={{ color: 'var(--info)' }}><Ic n="spin" spin />Sincronizando agora</div>{cov}</>
  if (local === 'queued' && c.queued) return <><div className="st" style={{ color: 'var(--muted)' }}><Ic n="clock" />{c.queued.label}</div>{c.queued.cov ? <div className="cov" title={c.queued.covTitle ?? undefined}>{c.queued.cov}</div> : null}</>
  if (local === 'just') return <><div className="st"><Ic n="ok" /><span style={{ color: 'var(--success)' }}>Sincronizado agora</span></div>{cov}</>
  if (c.state === 'ok') return <><div className="st"><span className="dot" style={{ background: 'var(--success)' }} /><span title={c.labelTitle ?? undefined}>{c.label}</span></div>{cov}</>
  if (c.state === 'atrasado') return (
    <>
      <div className="st" style={{ color: 'var(--warning-text)' }}><Ic n="clock" /><span title={c.labelTitle ?? undefined}>{c.label}</span></div>
      {c.msg ? <div className="msg late">{c.msg}</div> : null}
      {c.canRetry ? <div className="act"><button type="button" className="btn small" onClick={onRetry}>Tentar de novo</button></div> : null}
    </>
  )
  if (c.state === 'erro') return (
    <>
      <div className="st" style={{ color: 'var(--danger-text)' }}><Ic n="warn" /><span>{c.label}</span></div>
      {c.msg ? <div className="msg">{c.msg}</div> : null}
      {c.canRemove ? <div className="act"><button type="button" className="btn small" onClick={onRemove}>Remover canal…</button></div> : null}
    </>
  )
  return (
    <>
      <div className="st" style={{ color: 'var(--info)' }}><Ic n="spin" spin />{c.label}</div>
      {c.progress ? (
        <div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={c.progress.total} aria-valuenow={c.progress.done} aria-label="Busca de vídeos">
          <i style={{ width: `${c.progress.total ? (c.progress.done / c.progress.total) * 100 : 0}%` }} />
        </div>
      ) : null}
      {cov}
    </>
  )
}

/** Channel cell: avatar, name button (opens the drawer), niche select or "seu canal", subscribers with the rounding tip. */
export function ChCell({ r, ctx, onOpen, onNiche }: { r: CanaisRow; ctx: string; onOpen: () => void; onNiche: (n: Niche) => void }) {
  return (
    <div className="ch">
      <div className="av" style={{ background: r.color }} aria-hidden="true">{r.ini}</div>
      <div style={{ minWidth: 0 }}>
        <button type="button" className="nmbtn" data-open={r.id} aria-label={`Abrir detalhes de ${r.name}`} onClick={onOpen}>{r.name}</button>
        <div className="sub">
          {r.own ? <span className="youtag">seu canal</span> : <NicheSelect id={r.id} name={r.name} niche={r.niche} ctx={ctx} onChange={onNiche} />}
          <span className="num">{r.subs}</span>
          <Tip label="Sobre o número de inscritos">{r.subsTip}</Tip>
        </div>
      </div>
    </div>
  )
}
