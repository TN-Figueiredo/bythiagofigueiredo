'use client'
/**
 * One group of the result (a phase in PHASES order, or "Todos os outliers" / above-below 2× in the flat modes),
 * as a grid of cards of equal height per row ([data-outlier-row]) or as the list table.
 */
import type { OutlierGroupView } from './view-model'
import { ChannelName, OutlierCard, OutIcon, MultBlock, Ruler, Actions, StageChip, Thumb } from './outlier-card'
import { CelulaIdade, Selo } from './idade-ui'

const isPhase = (k: string) => k !== 'flat' && k !== 'above' && k !== 'below'

export function PhaseGroup({ g, view, shorts, ordem = null }: { g: OutlierGroupView; view: 'grid' | 'list'; shorts: boolean; ordem?: 7 | 30 | null }) {
  const hid = 'obs-out-gh-' + g.id
  return (
    <section className={'obs-out-group obs-out-g-' + g.tone} aria-labelledby={hid} data-group={g.id}>
      <div className="obs-out-ghead">
        <h2 id={hid}>{isPhase(g.id) ? <OutIcon name={g.id} /> : null}{g.label}</h2>
        {g.count != null ? <span className="obs-out-gn obs-out-mono" data-count={'g-' + g.id}>{g.count}</span> : null}
        {g.onlyWeakText ? <span className="obs-out-gn" data-count={'g-' + g.id} data-n="0">{g.onlyWeakText}</span> : null}
        {g.countText ? <span className="obs-out-gn">{g.countText}</span> : null}
        {g.why ? <p>{g.why}</p> : null}
      </div>
      {view === 'grid'
        ? <div className={'obs-out-grid' + (shorts ? ' obs-out-shorts' : '')} data-outlier-row="" data-obs-row="outliers">{g.cards.map(c => <OutlierCard key={c.id} c={c} shorts={shorts} />)}</div>
        : <ListTable g={g} ordem={ordem} />}
      {g.pageNote ? <p className="obs-out-pagenote">{g.pageNote}</p> : null}
    </section>
  )
}

function ListTable({ g, ordem }: { g: OutlierGroupView; ordem: 7 | 30 | null }) {
  // as duas colunas de idade existem quando quem montou trouxe os dados (E5a T8); sem eles a tabela é a de antes
  const idade = g.cards.some(c => c.idade)
  const cab = (n: 7 | 30) => (
    <th scope="col" className={'obs-out-idc' + (ordem === n ? ' obs-out-on' : '')} aria-sort={ordem === n ? 'descending' : undefined}>
      Views aos {n} dias{n === 7 ? <span className="obs-out-novo">novo</span> : null}{ordem === n ? <span aria-hidden="true"> ▼</span> : null}
    </th>
  )
  return (
    <div className="obs-out-tablewrap">
      <table className="obs-out-list">
        <caption className="obs-out-sr">{g.label}</caption>
        <colgroup><col /><col className="obs-out-c-views" /><col className="obs-out-c-mult" /><col className="obs-out-c-vpd" />{idade ? <><col className="obs-out-c-i7" /><col className="obs-out-c-i30" /></> : null}<col className="obs-out-c-age" /><col className="obs-out-c-acts" /></colgroup>
        <thead><tr>
          <th scope="col">Vídeo</th><th scope="col" className="obs-out-wide">Views</th><th scope="col">Multiplicador ajustado pela idade</th>
          <th scope="col">Views/dia</th>{idade ? <>{cab(7)}{cab(30)}</> : null}<th scope="col" className="obs-out-wide">Idade</th><th scope="col"><span className="obs-out-sr">Ações</span></th>
        </tr></thead>
        <tbody>{g.cards.map(c => (
          <tr key={c.id} data-id={c.id} data-phase={c.phase.id} data-weak={String(c.weak)}>
            <td className="obs-out-v"><div className="obs-out-vcell"><Thumb c={c} /><div className="obs-out-t1">
              <h3 className="obs-out-ttl" title={c.title}>{c.title}</h3>
              <div className="obs-out-who"><ChannelName c={c} title={c.channel} />
                {c.niche ? <span className={'obs-out-niche obs-out-niche-' + c.niche}>{c.nicheLabel}</span> : null}
                {c.showPhase ? <StageChip c={c} /> : null}
                {c.reuse ? <span className="obs-out-stagechip obs-out-old">assunto de {c.reuse.month}: ainda relevante?</span> : null}
                {c.idade?.aoVivo ? <><Selo /><span className="obs-out-nao-conta">não conta no normal do canal</span></> : null}
                {c.idade?.saiu ? <span className="obs-out-saiu">saiu do YouTube</span> : null}
                <span className="obs-out-narrow">{c.age}</span>
              </div></div></div></td>
            <td className="obs-out-mono obs-out-nw obs-out-wide">{c.views}</td>
            <td><MultBlock c={c} compact /><Ruler c={c} /></td>
            <td data-l="Views por dia"><span className="obs-out-mono">{c.vpdShort}</span>{c.vpdShortNote ? <><br /><span className="obs-out-vnote">{c.vpdShortNote}</span></> : null}</td>
            {c.idade ? <><td data-l="Views aos 7 dias" className={ordem === 7 ? 'obs-out-on' : undefined}><CelulaIdade c={c.idade.c7} idade={7} /></td><td data-l="Views aos 30 dias" className={ordem === 30 ? 'obs-out-on' : undefined}><CelulaIdade c={c.idade.c30} idade={30} /></td></> : null}
            <td className="obs-out-wide"><span title={c.ageTitle}>{c.ageShort}</span></td>
            <td><Actions c={c} /></td>
          </tr>))}</tbody>
      </table>
    </div>
  )
}
