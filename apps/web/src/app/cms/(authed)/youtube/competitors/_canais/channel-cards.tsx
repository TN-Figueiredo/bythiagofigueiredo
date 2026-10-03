'use client'
/** Cards view of Canais (port of canais.html card()). */
import type { CanaisGroup, CanaisRow, CanaisView } from './view-model'
import { CadenceView, ChCell, GrowthView, OutView, SwapView, SyncView, VpdView } from './cells'
import { GroupMeta, OwnGroupParts, type RowHandlers } from './channel-table'

function Card({ r, h, view }: { r: CanaisRow; h: RowHandlers; view: CanaisView }) {
  const c = r.cells
  return (
    <article className={'card ' + (r.own ? 'you' : '')} data-id={r.id}>
      <ChCell r={r} ctx="card" onOpen={() => h.open(r.id)} onNiche={n => h.niche(r, n, 'card')} />
      <div><CadenceView c={c.cadence} /></div>
      <div className="kv">
        <div><div className="l">Views/dia, {view.scale === 'per-mil' ? 'por mil inscritos' : 'mediana'}</div><VpdView c={c.vpd} /></div>
        <div><div className="l">Crescimento, 30{' '}d</div><div className="grow"><GrowthView c={c.growth} /></div></div>
      </div>
      <div><div className="l" style={{ marginBottom: 4 }}>Outliers, até 90{' '}d</div><OutView c={c.out} upnextHref={h.upnextHref} /></div>
      <div className="kv">
        <div><div className="l">Trocas, 30{' '}d</div><SwapView c={c.swap} /></div>
        <div className="sync"><SyncView c={c.sync} local={h.local(r.id) ?? (h.roundRunning && c.sync.queued ? 'queued' : undefined)} onRetry={() => h.retry(r.id)} onRemove={() => h.remove(r.id, null)} /></div>
      </div>
      {r.own ? null : <div><button type="button" className="btn small" data-menu={r.id} aria-haspopup="menu" aria-expanded={h.menuFor === r.id} onClick={e => h.menu(r.id, e.currentTarget)}>Mais ações</button></div>}
    </article>
  )
}

export function ChannelCards({ view, own, groups, h, empty }: { view: CanaisView; own: CanaisView['own']; groups: CanaisGroup[]; h: RowHandlers; empty: React.ReactNode }) {
  return (
    <div className="cards">
      {own.group ? <div className="cardsep" data-own-group=""><strong>{own.group.label}</strong> <span className="gin" style={{ position: 'static', padding: '0 0 0 4px' }}><OwnGroupParts parts={own.group.parts} /></span></div> : null}
      {own.rows.map(r => <Card key={r.id} r={r} h={h} view={view} />)}
      {groups.map(g => [
        <div key={'s-' + g.key} className="cardsep"><strong>{g.label}</strong> {g.count} <span className="gin" style={{ position: 'static', padding: '0 0 0 8px' }}><GroupMeta g={g} /></span></div>,
        ...g.rows.map(r => <Card key={r.id} r={r} h={h} view={view} />),
      ])}
      {groups.length ? null : <div className="cardsep">{empty}</div>}
    </div>
  )
}
