'use client'
/** Cards view of Canais (port of canais.html card()). */
import type { CanaisRow, CanaisView } from './view-model'
import { CadenceView, ChCell, GrowthView, OutView, SwapView, SyncView, VpdView } from './cells'
import { fraseDoCartao, motivoTexto, temPosicao } from './posicao-model'
import { CompararLink, type RowHandlers } from './channel-table'

/** A frase do canal próprio no cartão: a posição na ordenação atual, ou o motivo de não ter. Concorrente não tem a frase. */
function Voce({ r, view }: { r: CanaisRow; view: CanaisView }) {
  if (!r.own) return null
  const frase = r.pos ? fraseDoCartao(r.pos, view.conjunto) : r.semMedida ? motivoTexto(r.semMedida) : null // sem posição e sem motivo seria erro do modelo (testado): nada a dizer
  return frase ? <p className="voce">{frase}</p> : null
}

function Card({ r, h, view }: { r: CanaisRow; h: RowHandlers; view: CanaisView }) {
  const c = r.cells, todos = view.fmt === 'todos'
  return (
    <article className={'card ' + (r.own ? 'you' : '')} data-id={r.id} tabIndex={r.own ? -1 : undefined} ref={r.own ? el => h.reg(r.id, el) : undefined}>
      {r.pos ? <span className="cp num">{r.pos.pos}º{r.pos.empate ? <span className="sr"> (empate)</span> : null}</span>
        : <span className="cp num">{temPosicao(view.sort) ? <span aria-hidden="true">–</span> : null}<span className="sr">sem posição</span></span>}
      <ChCell r={r} ctx="card" onOpen={() => h.open(r.id)} onNiche={n => h.niche(r, n, 'card')} />
      <Voce r={r} view={view} />
      <div><CadenceView c={c.cadence} c2={todos ? c.cadence2 : undefined} /></div>
      <div className="kv">
        <div><div className="l">Views/dia, {view.scale === 'per-mil' ? 'por mil inscritos' : 'mediana'}</div><VpdView c={c.vpd} c2={todos ? c.vpd2 : undefined} visible /></div>
        <div><div className="l">Crescimento, 30{' '}d</div><div className="grow"><GrowthView c={c.growth} /></div></div>
      </div>
      <div><div className="l" style={{ marginBottom: 4 }}>Outliers, até 90{' '}d</div><OutView c={c.out} c2={todos ? c.out2 : undefined} upnextHref={h.upnextHref} visible /></div>
      <div className="kv">
        <div><div className="l">Trocas, 30{' '}d</div><SwapView c={c.swap} /></div>
        <div className="sync"><SyncView c={c.sync} local={h.local(r.id) ?? (h.roundRunning && c.sync.queued ? 'queued' : undefined)} onRetry={() => h.retry(r.id)} onRemove={() => h.remove(r.id, null)} /></div>
      </div>
      {r.comparar ? <div className="cmp-card"><CompararLink r={r} texto="Comparar com o meu canal" /></div> : null}
      {r.own ? null : <div><button type="button" className="btn small" data-menu={r.id} aria-haspopup="menu" aria-expanded={h.menuFor === r.id} onClick={() => h.menu(r.id)}>Mais ações</button></div>}
    </article>
  )
}

export function ChannelCards({ view, ranked, unranked, buscando, h, empty, busy }: { view: CanaisView; ranked: CanaisRow[]; unranked: CanaisRow[]; buscando: boolean; h: RowHandlers; empty: React.ReactNode; busy?: boolean }) {
  const semConcorrente = buscando ? ranked.length + unranked.length === 0 : !ranked.some(r => !r.own) && !unranked.some(r => !r.own)
  return (
    <div className="cards" aria-busy={busy || undefined}>
      {ranked.map(r => <Card key={r.id} r={r} h={h} view={view} />)}
      {view.list.divisor && unranked.length
        ? <div className="cardsep" data-divisor=""><strong>{view.list.divisor.titulo.replace(/\(\d+\)$/, `(${unranked.length})`)}</strong> <small>{view.list.divisor.nota}</small></div> : null}
      {unranked.map(r => <Card key={r.id} r={r} h={h} view={view} />)}
      {semConcorrente ? <div className="cardsep">{empty}</div> : null}
    </div>
  )
}
