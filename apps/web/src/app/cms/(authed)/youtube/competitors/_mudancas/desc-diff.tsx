'use client'
/**
 * Description "comparação linha a linha" (port of descHTML): chip "+N −M linhas", a 3-line peek and the full
 * comparison behind "Ver comparação"; UTM-only changes are noise, hidden behind "Mostrar ruído (UTM)".
 */
import { useId, useState } from 'react'
import type { DescView } from './view-model'

const CLS: Record<string, string> = { ctx: 'ctx', add: 'a', rem: 'r', utm: 'nz' }
const GLYPH: Record<string, string> = { ctx: ' ', add: '+', rem: '−', utm: '~' }
const SR: Record<string, string> = { ctx: '', add: 'Linha nova: ', rem: 'Linha removida: ', utm: 'Só UTM mudou: ' }

export function DescDiff({ d }: { d: DescView }) {
  const [open, setOpen] = useState(d.open)
  const [noise, setNoise] = useState(false)
  const id = useId()
  if (d.noText != null) {
    return <div className="hatch"><span><b>{d.label}</b>{d.noText}</span></div>
  }
  return (
    <>
      <div className="d-sum">
        <span className="chip"><span className="add num">+{d.add}</span> <span className="rem num">−{d.rem}</span> linhas</span>
        {d.noiseHidden ? <span className="noise">{d.noiseHidden === 1 ? '1 troca de UTM oculta' : d.noiseHidden + ' trocas de UTM ocultas'}</span> : null}
        <button className="linkbtn" type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>{open ? 'Esconder comparação' : 'Ver comparação'}</button>
      </div>
      <ul className="d-peek" hidden={open}>
        {d.peek.map((l, i) => (
          <li key={i} className={l.op === 'add' ? 'a' : 'r'}>
            <span className="g" aria-hidden="true">{l.op === 'add' ? '+' : '−'}</span>
            <span className="sr">{l.op === 'add' ? 'Linha nova: ' : 'Linha removida: '}</span>
            <span className="t">{l.text}</span>
          </li>
        ))}
        {d.peekMore ? <li className="more">{d.peekMore}</li> : null}
      </ul>
      <div className={'d-diff' + (noise ? ' show-noise' : '')} id={id} hidden={!open} data-desc-diff="">
        {d.lines.map((l, i) => (
          <div key={i} className={'ln ' + (CLS[l.op] ?? 'ctx')}>
            <span className="g" aria-hidden="true">{GLYPH[l.op] ?? ' '}</span>
            <span><span className="sr">{SR[l.op] ?? ''}</span>{l.text}</span>
          </div>
        ))}
        <div className="bar">
          {d.noiseHidden ? <label><input type="checkbox" checked={noise} onChange={e => setNoise(e.target.checked)} />Mostrar ruído (UTM)</label> : <span />}
          <span>Texto inteiro arquivado nas duas versões</span>
        </div>
      </div>
    </>
  )
}
