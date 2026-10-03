'use client'
/** Table view of Canais (port of canais.html thead + renderBody rows and group rows). */
import { useEffect, useRef, useState } from 'react'
import type { CanaisGroup, CanaisRow, CanaisSort, CanaisView, OwnGroupPart } from './view-model'
import type { Niche } from '@/lib/youtube/observatorio/types'
import { CadenceView, ChCell, GrowthView, Ic, OutView, SwapView, SyncView, Tip, VpdView, type LocalSync } from './cells'

export interface RowHandlers {
  open: (id: string) => void; niche: (r: CanaisRow, n: Niche, ctx: string) => void; menu: (id: string, btn: HTMLButtonElement) => void
  retry: (id: string) => void; remove: (id: string, from: HTMLElement | null) => void
  local: (id: string) => LocalSync; roundRunning: boolean; upnextHref: string; menuFor: string | null; selected: string | null
}

const COLS: Array<{ k: CanaisSort; label: string; unit: string | null; r?: boolean; hide?: boolean; minW?: number }> = [
  { k: 'active', label: 'Ritmo', unit: 'uploads por semana, 13 sem' },
  { k: 'vpd', label: 'Views/dia', unit: null, r: true, minW: 118 },
  { k: 'outliers', label: 'Outliers', unit: '2× ou mais, até 90 dias' },
  { k: 'swaps', label: 'Trocas', unit: '30 d, por evento, longos e Shorts' },
  { k: 'growth', label: 'Crescimento', unit: 'inscritos, 30 d', r: true, hide: true },
]

export function GroupMeta({ g }: { g: CanaisGroup }) {
  const look = { erro: ['var(--danger-text)', 'warn'], atrasado: ['var(--warning-text)', 'clock'], backfill: ['var(--info)', 'spin'], parado: ['var(--warning-text)', 'pause'] } as const
  return <>{g.flags.map(f => <span key={f.kind} className="flag" style={{ color: look[f.kind][0] }}><Ic n={look[f.kind][1]} />{f.text}</span>)}</>
}
/** The pieces of the "Seus canais" line (canais.html ownParts): one <span> each; the texts come from the view model. */
export function OwnGroupParts({ parts }: { parts: OwnGroupPart[] }) {
  return <>{parts.map((p, i) => (
    <span key={i}>
      {p.warn ? <span className="flag" style={{ color: 'var(--warning-text)' }}><Ic n="warn" />{p.text}</span>
        : p.num != null ? <><span className="num">{p.num}</span> {p.text}</> : p.text}
    </span>
  ))}</>
}
export const groupColor = (k: CanaisGroup['key']) => (k === 'ia' ? 'var(--ai)' : k === 'viagem' ? 'var(--travel)' : 'var(--muted)')

function Row({ r, h }: { r: CanaisRow; h: RowHandlers }) {
  const c = r.cells
  return (
    <tr className={`row obs-cn-row ${r.own ? 'you' : ''} ${h.selected === r.id ? 'sel' : ''}`} data-id={r.id}
      onClick={e => { if (!(e.target as HTMLElement).closest('select,button,a,.tip')) h.open(r.id) }}>
      <td><ChCell r={r} ctx="row" onOpen={() => h.open(r.id)} onNiche={n => h.niche(r, n, 'row')} /></td>
      <td><CadenceView c={c.cadence} /></td>
      <td className="r"><VpdView c={c.vpd} /></td>
      <td><OutView c={c.out} upnextHref={h.upnextHref} /></td>
      <td><SwapView c={c.swap} /></td>
      <td className="r grow c-hide"><GrowthView c={c.growth} /></td>
      <td className="sync c-hide"><SyncView c={c.sync} local={h.local(r.id) ?? (h.roundRunning && c.sync.queued ? 'queued' : undefined)} onRetry={() => h.retry(r.id)} onRemove={() => h.remove(r.id, null)} /></td>
      <td>{r.own ? null : (
        <button type="button" className="more" aria-label={`Mais ações para ${r.name}`} aria-haspopup="menu" aria-expanded={h.menuFor === r.id} data-menu={r.id}
          onClick={e => { e.stopPropagation(); h.menu(r.id, e.currentTarget) }}>
          <svg className="ico" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
        </button>
      )}</td>
    </tr>
  )
}

export function ChannelTable({ view, own, groups, h, onSort, empty }: {
  view: CanaisView; own: CanaisView['own']; groups: CanaisGroup[]; h: RowHandlers; onSort: (k: CanaisSort) => void; empty: React.ReactNode
}) {
  // canais.html #scrollHint: says the table scrolls sideways only when it really overflows (drawer open, narrow screen)
  const box = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const on = () => setOverflow(el.scrollWidth > el.clientWidth + 2)
    on()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(on)
    ro?.observe(el)
    window.addEventListener('resize', on)
    return () => { ro?.disconnect(); window.removeEventListener('resize', on) }
  }, [groups, own.rows])
  return (
    <>
    {overflow ? <p className="cap" data-scroll-hint="" style={{ whiteSpace: 'normal', margin: '0 0 6px' }}>Role a tabela para o lado para ver todas as colunas.</p> : null}
    <div className="tablebox" ref={box}>
      <table aria-label="Canais acompanhados">
        <thead><tr>
          <th scope="col">Canal<span className="unit">nicho e inscritos</span></th>
          {COLS.map(col => {
            const on = view.sort === col.k
            return (
              <th key={col.k} scope="col" className={`sortable${col.r ? ' r' : ''}${col.hide ? ' c-hide' : ''}`} data-k={col.k}
                aria-sort={on ? (view.dir === 'desc' ? 'descending' : 'ascending') : undefined} style={col.minW ? { minWidth: col.minW } : undefined}>
                <button type="button" onClick={() => onSort(col.k)}>{col.label} <span className="arrow" aria-hidden="true">{on ? (view.dir === 'desc' ? '▼' : '▲') : ''}</span></button>
                <span className="unit">{col.unit ?? view.vpdUnit}</span>
              </th>
            )
          })}
          <th scope="col" className="c-hide">Sincronização <Tip label="Sobre a cobertura" left>{view.syncTip}</Tip><span className="unit">e vídeos acompanhados</span></th>
          <th scope="col"><span className="sr">Ações</span></th>
        </tr></thead>
        <tbody>
          {own.group ? <tr className="group" data-own-group=""><td colSpan={8}><span className="gin"><strong>{own.group.label}</strong><OwnGroupParts parts={own.group.parts} /></span></td></tr> : null}
          {own.rows.map(r => <Row key={r.id} r={r} h={h} />)}
          {groups.map(g => [
            <tr key={'g-' + g.key} className="group"><td colSpan={8}><span className="gin"><span className="dot" style={{ background: groupColor(g.key) }} /><strong>{g.label}</strong><span>{g.count}</span><GroupMeta g={g} /></span></td></tr>,
            ...g.rows.map(r => <Row key={r.id} r={r} h={h} />),
          ])}
          {groups.length ? null : <tr><td colSpan={8} style={{ padding: '28px 14px', color: 'var(--muted)' }}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
    </>
  )
}
