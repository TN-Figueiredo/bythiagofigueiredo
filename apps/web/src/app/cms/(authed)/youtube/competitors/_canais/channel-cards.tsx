'use client'
/** Cards view of Canais (port of canais.html card()). */
import type { CanaisRow, CanaisView } from './view-model'
import { CadenceView, ChCell, DirecaoValor, GrowthView, OutView, SwapView, SyncView, VpdView } from './cells'
import { fraseDoCartao, motivoTexto } from './posicao-model'
import { CompararLink, type RowHandlers } from './channel-table'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
const JANELA = MEASURE_RULES.direction.windowDays

/** A frase do canal próprio no cartão: a posição na ordenação atual, ou o motivo de não ter. Concorrente não tem a frase. */
function Voce({ r, view }: { r: CanaisRow; view: CanaisView }) {
  if (!r.own) return null
  const frase = r.pos ? fraseDoCartao(r.pos, view.conjunto) : r.semMedida ? motivoTexto(r.semMedida, r.semMedidaTexto ?? undefined) : null // sem posição e sem motivo seria erro do modelo (testado): nada a dizer
  return frase ? <p className="voce">{frase}</p> : null
}

function Card({ r, h, view }: { r: CanaisRow; h: RowHandlers; view: CanaisView }) {
  const c = r.cells, todos = view.fmt === 'todos'
  return (
    <article role="listitem" className={'card ' + (r.own ? 'you' : '')} data-id={r.id} tabIndex={r.own ? -1 : undefined} ref={r.own ? el => h.reg(r.id, el) : undefined}>
      {r.numero ? <span className="cp num" data-testid="canais-p">{r.numero.pos}º{r.numero.empate ? ' · empate' : ''}</span>
        : <span className="cp num" data-testid="canais-p" aria-label="sem posição"><span className="sr">sem posição</span></span>}
      <ChCell r={r} ctx="card" onOpen={() => h.open(r.id)} onNiche={n => h.niche(r, n, 'card')} />
      <Voce r={r} view={view} />
      <div className="kv"><div><div className="l">Direção, views {JANELA} dias × {JANELA} anteriores</div><div className="obs-cn-dirv"><DirecaoValor r={r} cartao /></div></div></div>
      <div><CadenceView c={c.cadence} c2={todos ? c.cadence2 : undefined} dica={r.dicas.cadence} dica2={r.dicas.cadence2} /></div>
      <div className="kv">
        <div><div className="l">Views/dia, {view.scale === 'per-mil' ? 'por mil inscritos' : 'mediana'}</div><VpdView c={c.vpd} c2={todos ? c.vpd2 : undefined} visible dica={r.dicas.vpd} dica2={r.dicas.vpd2} /></div>
        <div><div className="l">Crescimento, 30{' '}d</div><div className="grow"><GrowthView c={c.growth} dica={r.dicas.growth} /></div></div>
      </div>
      <div><div className="l" style={{ marginBottom: 4 }}>Outliers, até 90{' '}d</div><OutView c={c.out} c2={todos ? c.out2 : undefined} upnextHref={h.upnextHref} visible dica={r.dicas.out} dica2={r.dicas.out2} /></div>
      <div className="kv">
        <div><div className="l">Trocas de título e thumbnail, 30{' '}d</div><SwapView c={c.swap} dica={r.dicas.swap} /></div>
        <div className="sync"><SyncView dica={r.dicas.sync} c={c.sync} local={h.local(r.id) ?? (h.roundRunning && c.sync.queued ? 'queued' : undefined)} onRetry={() => h.retry(r.id)} onRemove={() => h.remove(r.id, null)} somenteLeitura={h.somenteLeitura} /></div>
      </div>
      {r.comparar ? <div className="cmp-card"><CompararLink r={r} texto="Comparar com o meu canal" /></div> : null}
      {r.own ? null : <div><button type="button" className="btn small" data-menu={r.id} aria-haspopup="menu" aria-expanded={h.menuFor === r.id} disabled={h.somenteLeitura} onClick={() => h.menu(r.id)}>Mais ações</button></div>}
    </article>
  )
}

export function ChannelCards({ view, ranked, unranked, semMedidaN, buscando, h, empty, busy }: { view: CanaisView; ranked: CanaisRow[]; unranked: CanaisRow[]; /** O número do divisor "sem medida": o da lista inteira, não o da página. */ semMedidaN: number; buscando: boolean; h: RowHandlers; empty: React.ReactNode; busy?: boolean }) {
  const semConcorrente = buscando ? ranked.length + unranked.length === 0 : !ranked.some(r => !r.own) && !unranked.some(r => !r.own)
  return (
    <div className="cards" role="list" aria-label="Canais acompanhados" aria-busy={busy || undefined}>
      {ranked.map(r => <Card key={r.id} r={r} h={h} view={view} />)}
      {view.list.divisor && unranked.length
        ? <div className="cardsep" role="listitem" data-divisor=""><strong>{view.list.divisor.titulo.replace(/\(\d+\)$/, `(${semMedidaN})`)}</strong> <small>{view.list.divisor.nota}</small></div> : null}
      {unranked.map(r => <Card key={r.id} r={r} h={h} view={view} />)}
      {semConcorrente ? <div className="cardsep" role="listitem">{empty}</div> : null}
    </div>
  )
}
