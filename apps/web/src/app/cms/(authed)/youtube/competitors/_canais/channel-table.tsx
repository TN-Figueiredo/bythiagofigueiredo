'use client'
/** Table view of Canais (port of canais.html thead + renderBody rows and group rows). */
import { useEffect, useRef, useState } from 'react'
import type { Niche } from '@/lib/youtube/observatorio/types'
import type { CanaisRow, CanaisSort, CanaisView } from './view-model'
import { temPosicao } from './posicao-model'
import { CadenceView, ChCell, GrowthView, OutView, SwapView, SyncView, Tip, VpdView, type LocalSync } from './cells'

export interface RowHandlers {
  open: (id: string) => void; niche: (r: CanaisRow, n: Niche, ctx: string) => void; menu: (id: string) => void
  retry: (id: string) => void; remove: (id: string, from: HTMLElement | null) => void
  local: (id: string) => LocalSync; roundRunning: boolean; upnextHref: string; menuFor: string | null; selected: string | null
  /** Rola até a linha (ou o cartão) do canal e põe o foco nela; com a busca escondendo a linha, limpa a busca antes. */
  irAte: (id: string) => void
  /** Guarda o elemento da linha do canal próprio (achado por ref, nunca por id global); null ao desmontar. */
  reg: (id: string, el: HTMLElement | null) => void
}

/** `fm`: a coluna depende do formato (em "Todos" tem duas medidas e o rótulo sobe para o cabeçalho). */
const COLS: Array<{ k: CanaisSort; label: string; unit: string | null; r?: boolean; hide?: boolean; minW?: number; fm?: boolean }> = [
  { k: 'active', label: 'Ritmo', fm: true, unit: 'uploads por semana, 13 sem' },
  { k: 'vpd', label: 'Views/dia', fm: true, unit: null, r: true, minW: 118 },
  { k: 'outliers', label: 'Outliers', fm: true, unit: '2× ou mais, até 90 dias' },
  { k: 'swaps', label: 'Trocas', unit: '30 d, por evento, longos e Shorts' },
  { k: 'growth', label: 'Crescimento', unit: 'inscritos, 30 d', r: true, hide: true },
]

/** A posição: "13º" (com "(empate)" só para o leitor de tela); sem posição, "sem posição" só para o leitor e, numa ordenação que tem posição, um traço. */
function PosCell({ r, ordenacaoComPosicao }: { r: CanaisRow; ordenacaoComPosicao: boolean }) {
  if (r.pos) return <td className="p num">{r.pos.pos}º{r.pos.empate ? <span className="sr"> (empate)</span> : null}</td>
  return <td className="p num"><span className="sr">sem posição</span>{ordenacaoComPosicao ? <span aria-hidden="true">–</span> : null}</td>
}

function Row({ r, h, todos, ordenacaoComPosicao }: { r: CanaisRow; h: RowHandlers; todos: boolean; ordenacaoComPosicao: boolean }) {
  const c = r.cells
  return (
    <tr className={`row obs-cn-row ${r.own ? 'you' : ''} ${h.selected === r.id ? 'sel' : ''}`} data-id={r.id}
      tabIndex={r.own ? -1 : undefined} ref={r.own ? el => h.reg(r.id, el) : undefined}
      onClick={e => { if (!(e.target as HTMLElement).closest('select,button,a,.tip')) h.open(r.id) }}>
      <PosCell r={r} ordenacaoComPosicao={ordenacaoComPosicao} />
      <td><ChCell r={r} ctx="row" onOpen={() => h.open(r.id)} onNiche={n => h.niche(r, n, 'row')} /></td>
      <td><CadenceView c={c.cadence} c2={todos ? c.cadence2 : undefined} /></td>
      <td className={todos ? 'r dois' : 'r'}><VpdView c={c.vpd} c2={todos ? c.vpd2 : undefined} /></td>
      <td className={todos ? 'dois' : undefined}><OutView c={c.out} c2={todos ? c.out2 : undefined} upnextHref={h.upnextHref} /></td>
      <td><SwapView c={c.swap} /></td>
      <td className="r grow c-hide"><GrowthView c={c.growth} /></td>
      <td className="sync c-hide"><SyncView c={c.sync} local={h.local(r.id) ?? (h.roundRunning && c.sync.queued ? 'queued' : undefined)} onRetry={() => h.retry(r.id)} onRemove={() => h.remove(r.id, null)} /></td>
      <td>{r.own ? null : (
        <button type="button" className="more" aria-label={`Mais ações para ${r.name}`} aria-haspopup="menu" aria-expanded={h.menuFor === r.id} data-menu={r.id}
          onClick={e => { e.stopPropagation(); h.menu(r.id) }}>
          <svg className="ico" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
        </button>
      )}</td>
    </tr>
  )
}

export function ChannelTable({ view, ranked, unranked, h, onSort, empty, busy, busySort }: {
  view: CanaisView; ranked: CanaisRow[]; unranked: CanaisRow[]; h: RowHandlers; onSort: (k: CanaisSort) => void
  /** A frase de vazio; aparece sob as linhas quando não sobra nenhum concorrente (filtro, busca ou nicho sem canais). */
  empty: React.ReactNode
  /** A navigation that changes these numbers or their order is in flight: the rows are the previous ones. */
  busy?: boolean
  /** The column whose header was clicked and whose order has not arrived yet. */
  busySort?: CanaisSort
}) {
  // canais.html #scrollHint: says the table scrolls sideways only when it really overflows (drawer open, narrow screen)
  const box = useRef<HTMLDivElement>(null)
  const todos = view.fmt === 'todos'
  const ordenacaoComPosicao = temPosicao(view.sort)
  const semConcorrente = !ranked.some(r => !r.own) && !unranked.some(r => !r.own)
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
  }, [ranked, unranked])
  return (
    <>
    {overflow ? <p className="cap" data-scroll-hint="" style={{ whiteSpace: 'normal', margin: '0 0 6px' }}>Role a tabela para o lado para ver todas as colunas.</p> : null}
    <div className="tablebox" ref={box} aria-busy={busy || undefined}>
      <table aria-label="Canais acompanhados" className={todos ? 'todos' : undefined}>
        <thead><tr>
          <th scope="col" className="p"><span className="sr">Posição</span></th>
          <th scope="col" className="sortable" data-k="subs" aria-sort={view.sort === 'subs' ? (view.dir === 'desc' ? 'descending' : 'ascending') : undefined}>
            <button type="button" aria-busy={busySort === 'subs' || undefined} title="Ordenar por inscritos" onClick={() => onSort('subs')}>Canal <span className="arrow" aria-hidden="true">{view.sort === 'subs' ? (view.dir === 'desc' ? '▼' : '▲') : ''}</span></button>
            <span className="unit">nicho e inscritos</span>
          </th>
          {COLS.map(col => {
            const on = view.sort === col.k
            return (
              <th key={col.k} scope="col" className={`sortable${col.r ? ' r' : ''}${col.hide ? ' c-hide' : ''}`} data-k={col.k}
                aria-sort={on ? (view.dir === 'desc' ? 'descending' : 'ascending') : undefined} style={col.minW ? { minWidth: col.minW } : undefined}>
                <button type="button" aria-busy={busySort === col.k || undefined} onClick={() => onSort(col.k)}>{col.label} <span className="arrow" aria-hidden="true">{on ? (view.dir === 'desc' ? '▼' : '▲') : ''}</span></button>
                <span className="unit">{col.unit ?? view.vpdUnit}</span>
                {todos && col.fm && view.fmtCab ? <span className="unit cab-fmt" data-cab-fmt="">{view.fmtCab.dois}{on ? <>. <strong>{view.fmtCab.ordenado}</strong></> : null}</span> : null}
              </th>
            )
          })}
          <th scope="col" className="c-hide">Sincronização <Tip label="Sobre a cobertura" left>{view.syncTip}</Tip><span className="unit">e vídeos acompanhados</span></th>
          <th scope="col"><span className="sr">Ações</span></th>
        </tr></thead>
        <tbody>
          {ranked.map(r => <Row key={r.id} r={r} h={h} todos={todos} ordenacaoComPosicao={ordenacaoComPosicao} />)}
          {view.list.divisor && unranked.length ? (
            <tr className="group" data-divisor=""><th scope="rowgroup" colSpan={9}><span className="gin"><strong>{view.list.divisor.titulo.replace(/\(\d+\)$/, `(${unranked.length})`)}</strong><small>{view.list.divisor.nota}</small></span></th></tr>
          ) : null}
          {unranked.map(r => <Row key={r.id} r={r} h={h} todos={todos} ordenacaoComPosicao={ordenacaoComPosicao} />)}
          {semConcorrente ? <tr><td colSpan={9} style={{ padding: '28px 14px', color: 'var(--muted)' }}>{empty}</td></tr> : null}
        </tbody>
      </table>
    </div>
    </>
  )
}
