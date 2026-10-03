'use client'
/** "Antes e depois de cada troca": one chip per change (or group), the before/after sides and the effect (port of renderCompare). */
import type { BaSide, ComparisonView } from './view-model'
import { HIcon, type HIconName } from './icons'
import { Thumb } from './thumb'

const STATUS_ICON = (s: string): HIconName | null =>
  ['neutro', 'ganhou', 'perdeu', 'inconclusivo', 'aguardando', 'sem-serie', 'sem-antes'].includes(s) ? (s as HIconName) : null

function Side({ s }: { s: BaSide }) {
  const th = s.thumb ? <Thumb t={s.thumb} /> : null
  return (
    <div className={'side' + (s.title && th ? '' : ' solo')}>
      {th}
      {s.title ? <div><div className="lbl">{s.label}</div><div className="ttl">{s.title}</div></div> : <div className="lbl">{s.label}</div>}
    </div>
  )
}

export function Compare({ comparisons, selected, empty, onSelect, onDescLink }: {
  comparisons: ComparisonView[]; selected: string | null; empty: string | null
  onSelect: (k: string) => void; onDescLink: () => void
}) {
  const head = (
    <div className="sec-h">
      <h3 id="hv-cmph">Antes e depois de cada troca</h3>
      <span className="src">média de views/dia, 7 dias depois contra até 7 dias antes, ajustada pela idade</span>
    </div>
  )
  if (!comparisons.length) {
    return (
      <section className="card compare" id="hv-compare" aria-labelledby="hv-cmph">
        {head}
        <div className="nobase" style={{ marginTop: 12 }}><strong>Nada para comparar: nenhuma troca registrada.</strong>{empty}</div>
      </section>
    )
  }
  const p = comparisons.find(c => c.changeId === selected) ?? comparisons[0]!
  return (
    <section className="card compare" id="hv-compare" aria-labelledby="hv-cmph">
      {head}
      <div className="pairs" role="group" aria-label="Escolher troca">
        {comparisons.map(q => {
          const ic = STATUS_ICON(q.effect.status)
          return (
            <button key={q.changeId} className="pair" type="button" aria-pressed={q.changeId === p.changeId} data-k={q.changeId} onClick={() => onSelect(q.changeId)}>
              {ic ? <HIcon name={ic} /> : null}{q.chip}
            </button>
          )
        })}
      </div>
      {p.ba ? (
        <div className="ba" style={p.ba.length === 3 ? { gridTemplateColumns: 'minmax(0,1fr) 28px minmax(0,1fr) 28px minmax(0,1fr)' } : undefined}>
          {p.ba.map((s, i) => [i ? <span key={'a' + i} className="arr" aria-hidden="true">→</span> : null, <Side key={'s' + i} s={s} />])}
        </div>
      ) : null}
      {p.nobase ? <div className="nobase" data-nobase=""><strong>{p.nobase.strong}</strong>{p.nobase.text}</div> : null}
      {p.full ? <Full p={p} /> : null}
      {p.descLink ? <p className="src"><a className="inl" href="#hv-desc" onClick={e => { e.preventDefault(); onDescLink() }}>Ver comparação linha a linha</a></p> : null}
    </section>
  )
}

function Full({ p }: { p: ComparisonView }) {
  const f = p.full!, s = f.scale, ic = STATUS_ICON(p.effect.status)
  return (
    <div className="cmp">
      <div>
        <p className="what"><b>{f.what}</b>{f.whatWhen}</p>
        <div className="big"><span className="n">{p.before}</span><span className="arr" aria-hidden="true">→</span><span className="n">{p.after}</span><span className="u">média de views/dia</span></div>
        <div className="src" style={{ marginTop: 6 }}>{f.days}</div>
        <div className="vd" data-verdict={p.effect.status}>{ic ? <HIcon name={ic} /> : null}{f.pill}</div>
      </div>
      <div>
        <p className="verdict"><strong>{f.verdictStrong}</strong>{f.verdictText}</p>
        <div className="scale" role="img" aria-label={s.aria}>
          <div className="axis" />
          {s.iqr ? <div className="iqr" style={{ left: s.iqr.left + '%', width: s.iqr.width + '%' }} /> : null}
          {s.med != null ? <div className="med" style={{ left: s.med + '%' }} /> : null}
          <div className="obs" style={{ left: s.obs + '%' }} />
          {s.baseLabel ? <span className="lb" style={{ left: 0, top: -2 }}>{s.baseLabel}</span> : null}
          <span className="lb" style={{ left: s.obsLabelLeft + '%', top: 42, transform: 'translateX(-50%)', color: 'var(--text)' }}>{s.obsLabel}</span>
          <span className="lb lbr" style={{ right: 0, top: -2 }}>{s.rangeLabel}</span>
          <span className="zero" style={{ left: s.zero + '%' }} aria-hidden="true" />
        </div>
        <div className="src">{f.src}</div>
        {f.second ? <p className="verdict"><strong>{f.second.strong}</strong>{f.second.text}</p> : null}
        {f.caveats.length ? <ul className="caveats">{f.caveats.map((c, i) => <li key={i}><HIcon name="warn" /><span>{c}</span></li>)}</ul> : null}
      </div>
    </div>
  )
}
