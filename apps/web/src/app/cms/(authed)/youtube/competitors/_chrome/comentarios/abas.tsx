'use client'
// A5 · E5a · Tarefa C2: as três abas (1, 7 e 30 dias). A segunda linha de cada aba diz o estado. Recebe os três painéis como `children`
// (nenhum componente passa como prop). Setas, Início e Fim; o painel é uma região `aria-live="polite"`.
import { Children, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { AbaView } from './model'
import './comentarios.css'

/** `cima`: um nó por aba (a frase-resumo da idade), desenhado ANTES da lista de abas enquanto aquela aba está aberta. */
export function Abas({ abas, abertaInicial, cima, children }: { abas: AbaView[]; abertaInicial: number; cima?: ReactNode[]; children: ReactNode }) {
  const base = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const paineis = Children.toArray(children)
  const inicial = Math.max(0, abas.findIndex(a => a.marco === abertaInicial))
  const [ativa, setAtiva] = useState(inicial)
  const botoes = useRef<Array<HTMLButtonElement | null>>([])
  const ir = (i: number) => {
    const n = (i + abas.length) % abas.length
    setAtiva(n)
    botoes.current[n]?.focus()
  }
  const tecla = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); ir(i + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1) }
    else if (e.key === 'Home') { e.preventDefault(); ir(0) }
    else if (e.key === 'End') { e.preventDefault(); ir(abas.length - 1) }
  }
  return (
    <div className="cd-abas">
      {cima?.map((n, i) => (n ? <div key={i} hidden={i !== ativa}>{n}</div> : null))}
      <div role="tablist" aria-label="Idade do vídeo" className="cd-tablist">
        {abas.map((a, i) => (
          <button
            key={a.marco} ref={el => { botoes.current[i] = el }} type="button" role="tab" id={`${base}-t${a.marco}`}
            aria-selected={i === ativa} aria-controls={`${base}-p${a.marco}`} tabIndex={i === ativa ? 0 : -1}
            className={`cd-aba cd-tom-${a.tom}`} onClick={() => setAtiva(i)} onKeyDown={e => tecla(e, i)}
          >
            <span className="cd-aba-r">{a.rotulo}</span>
            <span className="cd-aba-e">{a.estado}</span>
          </button>
        ))}
      </div>
      <div aria-live="polite" className="cd-paineis">
        {abas.map((a, i) => (
          <div key={a.marco} role="tabpanel" id={`${base}-p${a.marco}`} aria-labelledby={`${base}-t${a.marco}`} hidden={i !== ativa} className="cd-painel">
            {paineis[i]}
          </div>
        ))}
      </div>
    </div>
  )
}
