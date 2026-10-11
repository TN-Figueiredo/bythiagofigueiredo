'use client'
/**
 * A linha de controles da aba Vídeos (spec 5.5, rótulos exatos): Formato, Ordenar, busca e Vista. Só desenha: quem muda o estado,
 * escreve a URL e anuncia é a tela (`onFmt`, `onSort`, `onQ`, `onClearQ`, `onVer`). Borda da busca e do seletor em --dim; contorno
 * do segmento ativo em --muted (os tokens de linha não passam de 3:1).
 */
import type { RefObject } from 'react'
import type { CanalFmt, CanalSort } from '@/lib/youtube/observatorio/links'
import { Icon } from '../_chrome/icons'
import { OutIcon } from '../_outliers/outlier-card'
import type { ListaView } from './lista'
import type { CanalState } from './params'

export const FMT_NOME: Record<CanalFmt, string> = { todos: 'Todos', longos: 'Longos', shorts: 'Shorts', fixados: 'Fixados' }
/** Como o status chama cada ordenação (o mesmo nome do cabeçalho da coluna na Lista). */
export const SORT_NOME: Record<CanalSort, string> = { recentes: 'Publicado', vistos: 'Views', multiplo: 'Múltiplo', vpd: 'Views/dia' }
const SORT_OPCOES: Array<[CanalSort, string]> = [['recentes', 'Mais recentes'], ['vistos', 'Mais vistos'], ['multiplo', 'Maior múltiplo'], ['vpd', 'Mais views por dia']]
const FMTS: CanalFmt[] = ['todos', 'longos', 'shorts', 'fixados']

export function Controles({ state, counts, barRef, inputRef, onFmt, onSort, onQ, onClearQ, onVer }: {
  state: CanalState; counts: ListaView['counts']
  barRef: RefObject<HTMLDivElement | null>; inputRef: RefObject<HTMLInputElement | null>
  onFmt: (f: CanalFmt) => void; onSort: (s: CanalSort) => void; onQ: (q: string) => void; onClearQ: () => void; onVer: (v: CanalState['ver']) => void
}) {
  return (
    <div className="cv-ctl" ref={barRef}>
      <div className="cv-fscroll">
        <div className="cv-seg" role="group" aria-label="Formato">
          {FMTS.map(k => (
            <button key={k} type="button" aria-pressed={state.fmt === k} aria-label={`${FMT_NOME[k]}, ${counts[k]}`} onClick={() => onFmt(k)}>
              {FMT_NOME[k]} <span className="n" aria-hidden="true">{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>
      <span className="cv-sel">
        <label className="obs-ch-sr" htmlFor="cv-sort">Ordenar</label>
        <select id="cv-sort" value={state.sort} onChange={e => onSort(e.target.value as CanalSort)}>
          {SORT_OPCOES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        {Icon.chev()}
      </span>
      <div className="cv-search" role="search">
        <svg className="i" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
        <label className="obs-ch-sr" htmlFor="cv-q">Buscar por título</label>
        <input id="cv-q" ref={inputRef} type="search" placeholder="Buscar por título" autoComplete="off" spellCheck={false} value={state.q}
          onChange={e => onQ(e.target.value)} onKeyDown={e => { if (e.key === 'Escape' && state.q) { e.preventDefault(); onClearQ() } }} />
        {state.q ? (
          <button type="button" className="clr" aria-label="Limpar busca" onClick={onClearQ}>
            <svg className="i" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        ) : null}
      </div>
      <span className="cv-gap" />
      <div className="cv-seg" role="group" aria-label="Vista">
        <button type="button" aria-pressed={state.ver === 'capas'} onClick={() => onVer('capas')}><OutIcon name="grid" className="i" />Capas</button>
        <button type="button" aria-pressed={state.ver === 'lista'} onClick={() => onVer('lista')}><OutIcon name="list" className="i" />Lista</button>
      </div>
    </div>
  )
}
