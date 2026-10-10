'use client'
/**
 * Filters of Mudanças (port of the mockup's .filters bar). The URL is the state: every control writes its parameter
 * with router.replace and the server rebuilds the view. Counts come from the view model. ?niche= is the chrome's.
 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MudancasView, Patch } from './view-model'
import { Ic } from './icons'
import { Popover } from '../_chrome/flut/flut'

export function useGo() {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams()
  return useCallback((patch: Patch) => {
    const q = new URLSearchParams(search?.toString() ?? '')
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === '') q.delete(k); else q.set(k, v) }
    const s = q.toString()
    router.replace(pathname + (s ? '?' + s : ''), { scroll: false })
  }, [router, pathname, search])
}

const WINS = [7, 30, 90] as const
const FMTS = [['all', 'Todos', 'Longos e Shorts'], ['long', 'Longos', undefined], ['short', 'Shorts', undefined]] as const
const TYPES = [['title', 'Título', 'title'], ['thumb', 'Thumbnail', 'image'], ['desc', 'Descrição', 'text']] as const
const LOCKED = 'Desligado enquanto a lista citada pela forja está aberta. Tire o filtro “Trocas citadas pela forja” para usar.'

export function Filters({ view }: { view: MudancasView }) {
  const go = useGo(), f = view.filters, c = view.controls
  const [q, setQ] = useState(f.q)
  const [more, setMore] = useState(false)
  const moreBtn = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { setQ(f.q) }, [f.q])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const onSearch = (v: string) => {
    setQ(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => go({ q: v.trim() || null }), 300)
  }
  return (
    <div className="filters" role="search" aria-label="Filtrar mudanças">
      <div className="field"><span className="lbl" id="mu-lWin">Troca feita nos últimos</span>
        <div className="seg" role="group" aria-labelledby="mu-lWin">
          {WINS.map(w => <button key={w} type="button" aria-pressed={f.win === w} disabled={c.windowLocked} title={c.windowLocked ? LOCKED : undefined}
            onClick={() => go({ win: w === 30 ? null : String(w) })}>{w} d</button>)}
        </div>
      </div>
      <div className="field"><span className="lbl" id="mu-lFmt">Formato</span>
        <div className="seg" role="group" aria-labelledby="mu-lFmt">
          {FMTS.map(([v, label, title]) => <button key={v} type="button" aria-pressed={f.fmt === v} disabled={c.windowLocked} title={c.windowLocked ? LOCKED : title}
            onClick={() => go({ fmt: v === 'all' ? null : v })}>{label}</button>)}
        </div>
      </div>
      <div className="field"><span className="lbl" id="mu-lType">Tipo</span>
        <div className="seg" role="group" aria-labelledby="mu-lType">
          <button type="button" aria-pressed={f.type === 'all'} onClick={() => go({ type: null })}>Todos <span className="c num">{c.typeCounts.all}</span></button>
          {TYPES.map(([v, label, icon]) => <button key={v} type="button" aria-pressed={f.type === v} onClick={() => go({ type: v })}><Ic name={icon} />{label} <span className="c num">{c.typeCounts[v]}</span></button>)}
        </div>
      </div>
      <div className="field"><label className="lbl" htmlFor="mu-fSort">Ordenar</label>
        <select className="sel" id="mu-fSort" value={f.sort} onChange={e => go({ sort: e.target.value === 'recent' ? null : e.target.value })}>
          <option value="recent">Mais recentes</option>
          <option value="gain">Maior efeito primeiro</option>
          <option value="loss">Menor efeito primeiro</option>
        </select>
      </div>
      <button ref={moreBtn} type="button" className={'more-btn' + (c.moreCount ? ' on' : '')} aria-haspopup="dialog" aria-expanded={more} aria-controls={more ? 'mu-more' : undefined}
        onClick={() => setMore(m => !m)}>{c.moreCount ? 'Mais filtros (' + c.moreCount + ')' : 'Mais filtros'}</button>
      <Popover open={more} anchor={() => moreBtn.current} onClose={() => setMore(false)} id="mu-more" className="mu-more-pop" role="dialog" label="Mais filtros" align="fim">
        <div className="field"><label className="lbl" htmlFor="mu-fChannel">Canal</label>
          <select className="sel" id="mu-fChannel" value={f.channel} onChange={e => go({ channel: e.target.value === 'all' ? null : e.target.value })}>
            <option value="all">Todos os canais</option>
            {c.channels.map(g => <optgroup key={g.label} label={g.label}>{g.options.map(o => <option key={o.id} value={o.id}>{o.name + ' (' + o.count + ')'}</option>)}</optgroup>)}
          </select>
        </div>
        <label className="check" title="Ganhou, perdeu, neutro ou inconclusivo; fora ficam as que aguardam 7 dias e as sem série">
          <input type="checkbox" checked={f.measured} onChange={e => go({ measured: e.target.checked ? '1' : null })} />Só com efeito medido</label>
        <label className="check"><input type="checkbox" checked={f.saved} onChange={e => go({ saved: e.target.checked ? '1' : null })} /><Ic name="bookmark" style={{ width: 13, height: 13 }} />Só o swipe file</label>
      </Popover>
      <div className="search">
        <Ic name="search" />
        <label className="sr" htmlFor="mu-fSearch">Buscar</label>
        <input id="mu-fSearch" type="search" placeholder="Buscar trocas" title="Busca em títulos antigos e novos, títulos de vídeo e nomes de canal" value={q} onChange={e => onSearch(e.target.value)} />
      </div>
      {c.chips.map(ch => (
        <span key={ch.key} className="fchip" data-chip={ch.key}><span>{ch.text}</span>
          <button type="button" aria-label={ch.label} onClick={() => go(ch.patch)}><Ic name="x" /></button></span>
      ))}
    </div>
  )
}
