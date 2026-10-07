'use client'
/**
 * "Antes e depois de cada troca". Up to 6 changes: one chip per change (or group), as before. From 7 on (Fase 4 item 5):
 * one row per change in a list that filters by field and by situation; the count sentence lives in ONE node (a live region).
 */
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { BaSide, CompareView, ComparisonView, LaneType } from './view-model'
import type { Situation } from './many-versions'
import { HIcon, TYPE_COLOR, type HIconName } from './icons'
import { Thumb } from './thumb'
import { RichText } from '../_mudancas/rich'

const STATUS_ICON = (s: string): HIconName | null =>
  ['neutro', 'ganhou', 'perdeu', 'inconclusivo', 'aguardando', 'sem-serie', 'sem-antes'].includes(s) ? (s as HIconName) : null
const SIT_ICON: Record<Situation, HIconName> = { ganhou: 'ganhou', perdeu: 'perdeu', neutro: 'neutro', inconclusivo: 'inconclusivo', aguardando: 'aguardando', 'sem-base': 'sem-antes' }
const trocas = (n: number) => n + (n === 1 ? ' troca' : ' trocas')

export interface CompareFilter { field: LaneType | 'all'; situation: Situation | 'all' }
export const NO_FILTER: CompareFilter = { field: 'all', situation: 'all' }

function Side({ s }: { s: BaSide }) {
  const th = s.thumb ? <Thumb t={s.thumb} /> : null
  return (
    <div className={'side' + (s.title && th ? '' : ' solo')}>
      {th}
      {s.title ? <div><div className="lbl">{s.label}</div><div className="ttl">{s.title}</div></div> : <div className="lbl">{s.label}</div>}
    </div>
  )
}

function Detail({ p, onDescLink }: { p: ComparisonView; onDescLink: () => void }) {
  return (
    <>
      {p.ba ? (
        <div className={'ba' + (p.ba.length === 3 ? ' three' : '')}>
          {p.ba.map((s, i) => [i ? <span key={'a' + i} className="arr" aria-hidden="true">→</span> : null, <Side key={'s' + i} s={s} />])}
        </div>
      ) : null}
      {p.nobase ? <div className="nobase" data-nobase=""><strong>{p.nobase.strong}</strong>{p.nobase.text}</div> : null}
      {p.full ? <Full p={p} /> : null}
      {p.runLines.map((t, i) => <p key={i} className="seqline"><HIcon name="ab" /><span>{t}</span></p>)}
      {p.descLink ? <p className="src"><a className="inl" href="#hv-desc" onClick={e => { e.preventDefault(); onDescLink() }}>Ver comparação linha a linha</a></p> : null}
    </>
  )
}

export function Compare({ comparisons, compare, selected, empty, onSelect, onDescLink, filter = NO_FILTER, onFilter, onWholeVideo }: {
  comparisons: ComparisonView[]; compare: CompareView; selected: string | null; empty: string | null
  onSelect: (k: string) => void; onDescLink: () => void
  /** List mode: the two filters (state lives in the screen: a marker of a filtered-out change clears them). */
  filter?: CompareFilter; onFilter?: (f: CompareFilter) => void
  /** List mode with a period that holds no change: back to the whole video. */
  onWholeVideo?: () => void
}) {
  const list = useRef<HTMLUListElement>(null)
  const all = comparisons.filter(c => c.inRange)
  const match = (c: ComparisonView, f: CompareFilter) => (f.field === 'all' || c.field === f.field) && (f.situation === 'all' || c.situation === f.situation)
  const vis = compare.mode === 'list' ? all.filter(c => match(c, filter)) : all
  const p = vis.find(c => c.changeId === selected) ?? vis.find(c => ['neutro', 'ganhou', 'perdeu'].includes(c.effect.status)) ?? vis[0] ?? null
  // the selected row stays in view inside the list (the list scrolls, never the page)
  useEffect(() => {
    const l = list.current, s = l?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!l || !s) return
    const d = s.getBoundingClientRect().top - l.getBoundingClientRect().top
    if (d < 0 || d > l.clientHeight - s.offsetHeight) l.scrollTop += d - Math.min(60, l.clientHeight / 3)
  }, [p?.changeId])
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
  if (compare.mode === 'pairs') {
    return (
      <section className="card compare" id="hv-compare" aria-labelledby="hv-cmph">
        {head}
        {!p ? <div className="nobase" style={{ marginTop: 12 }}><strong>Nenhuma troca neste período.</strong></div> : (
          <>
            <div className="pairs" role="group" aria-label="Escolher troca">
              {all.map(q => {
                const ic = STATUS_ICON(q.effect.status)
                return (
                  <button key={q.changeId} className="pair" type="button" aria-pressed={q.changeId === p.changeId} data-k={q.changeId} onClick={() => onSelect(q.changeId)}>
                    {ic ? <HIcon name={ic} /> : null}{q.chip}
                  </button>
                )
              })}
            </div>
            <Detail p={p} onDescLink={onDescLink} />
          </>
        )}
      </section>
    )
  }
  const count = (f: CompareFilter) => all.filter(c => match(c, f)).length
  const set = (f: CompareFilter) => onFilter?.(f)
  const sits = compare.situations.filter(s => s.id !== 'sem-base' || all.some(c => c.situation === 'sem-base'))
  const fName = filter.field === 'all' ? '' : ' de ' + (compare.fields.find(f => f.id === filter.field)?.name ?? '')
  const sName = filter.situation === 'all' ? '' : ' na situação “' + (compare.situations.find(s => s.id === filter.situation)?.label ?? '') + '”'
  let status: string
  if (!vis.length) {
    const others: string[] = []
    const nF = all.filter(c => c.field === filter.field).length, nS = all.filter(c => c.situation === filter.situation).length
    if (filter.field !== 'all' && filter.situation !== 'all') { if (nF) others.push(trocas(nF) + fName + ' em outras situações'); if (nS) others.push(trocas(nS) + sName + ' em outros campos') }
    status = (all.length ? 'Nenhuma troca' + fName + sName + compare.scope + '.' : 'Nenhuma troca neste período.') + (others.length ? ' Há ' + others.join(' e ') + '.' : '')
  } else {
    status = 'Mostrando ' + vis.length + ' de ' + trocas(all.length) + compare.scope + (compare.scope ? ' (' + compare.total + ' no vídeo inteiro)' : '') + '. Selecionada: ' + (p?.label ?? '') + '.'
  }
  const onKeys = (e: KeyboardEvent<HTMLUListElement>) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-k]')
    if (!li) return
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('li[data-k]')], k = items.indexOf(li), last = items.length - 1
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(li.dataset.k!); return }
    const n = e.key === 'ArrowDown' ? Math.min(last, k + 1) : e.key === 'ArrowUp' ? Math.max(0, k - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last
      : e.key === 'PageDown' ? Math.min(last, k + 5) : e.key === 'PageUp' ? Math.max(0, k - 5) : -1
    if (n < 0) return
    e.preventDefault(); items.forEach(x => { x.tabIndex = -1 }); items[n]!.tabIndex = 0; items[n]!.focus()
  }
  return (
    <section className="card compare" id="hv-compare" aria-labelledby="hv-cmph" data-mode="list">
      {head}
      {compare.sum ? <p className="cmp-sum"><RichText r={compare.sum} /></p> : null}
      <div className="flt">
        <div className="flt-g" role="group" aria-labelledby="hv-fl1">
          <span className="flt-l" id="hv-fl1">Campo</span>
          <div className="seg">
            <FilterBtn group="field" id="all" label="Todos" n={count({ ...filter, field: 'all' })} on={filter.field === 'all'} onClick={() => set({ ...filter, field: 'all' })} />
            {compare.fields.map(f => <FilterBtn key={f.id} group="field" id={f.id} label={f.label} n={count({ ...filter, field: f.id })} on={filter.field === f.id} onClick={() => set({ ...filter, field: f.id })}
              icon={<i style={{ width: 7, height: 7, borderRadius: 2, background: TYPE_COLOR[f.id] }} aria-hidden="true" />} />)}
          </div>
        </div>
        <div className="flt-g" role="group" aria-labelledby="hv-fl2">
          <span className="flt-l" id="hv-fl2">Situação</span>
          <div className="seg">
            <FilterBtn group="situation" id="all" label="Todas" n={count({ ...filter, situation: 'all' })} on={filter.situation === 'all'} onClick={() => set({ ...filter, situation: 'all' })} />
            {sits.map(s => <FilterBtn key={s.id} group="situation" id={s.id} label={s.label} n={count({ ...filter, situation: s.id })} on={filter.situation === s.id} onClick={() => set({ ...filter, situation: s.id })}
              icon={<HIcon name={SIT_ICON[s.id]} />} />)}
          </div>
        </div>
      </div>
      {/* the same node on every change of filter or selection: a live region announces only what changed */}
      <p className="cmp-count" id="hv-cmpcount" role="status">{status}</p>
      {vis.length ? <p className="cmp-count" id="hv-cmphint">A lista rola; as setas andam e Enter escolhe.</p> : null}
      <div className="cmpx">
        {!vis.length || !p ? (
          <div className="nobase cmp-empty" id="hv-cmpempty">
            <strong>{status}</strong>
            <button className="btn" type="button" id="hv-fltclear" onClick={() => (all.length ? set(NO_FILTER) : onWholeVideo?.())}>{all.length ? 'Limpar filtros' : 'Mostrar o vídeo inteiro'}</button>
          </div>
        ) : (
          <>
            <ul className="clist" id="hv-clist" role="listbox" aria-label="Trocas, da mais recente para a mais antiga" aria-describedby="hv-cmphint" ref={list} onKeyDown={onKeys}>
              {vis.map(q => {
                const on = q.changeId === p.changeId, ic = STATUS_ICON(q.effect.status)
                return (
                  <li key={q.changeId} role="option" aria-selected={on} tabIndex={on ? 0 : -1} data-k={q.changeId} data-st={q.effect.status} onClick={() => onSelect(q.changeId)}>
                    {ic ? <HIcon name={ic} /> : <span aria-hidden="true" />}
                    <span className="l1">{q.label}<span className="sr">, </span></span><span className="dt">{q.when}<span className="sr">, </span></span><span className="l2">{q.statusLine}</span>
                  </li>
                )
              })}
            </ul>
            <div className="cdet" id="hv-cdet" role="region" aria-label="Troca selecionada"><Detail p={p} onDescLink={onDescLink} /></div>
          </>
        )}
      </div>
    </section>
  )
}

function FilterBtn({ group, id, label, n, on, onClick, icon }: { group: string; id: string; label: string; n: number; on: boolean; onClick: () => void; icon?: ReactNode }) {
  return (
    <button type="button" data-flt={group} data-v={id} aria-pressed={on} onClick={onClick}>
      {icon}{label}<span className="c" aria-hidden="true">{n}</span><span className="sr">, {trocas(n)}</span>
    </button>
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
