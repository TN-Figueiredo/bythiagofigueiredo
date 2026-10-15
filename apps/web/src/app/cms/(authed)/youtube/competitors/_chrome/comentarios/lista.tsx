'use client'
// A5 · E5a · Tarefa C2: o painel de uma idade com lista: frase, barra, legenda, fileira, movimento e os cartões (cinco por vez).
import { useEffect, useRef, useState } from 'react'
import { Cartao } from './cartao'
import { Fileira } from './fileira'
import { FRASES } from './frases'
import type { ListaView } from './model'
import './comentarios.css'

const POR_VEZ = 5

export function ListaDoPainel({ v, hrefFilaSaiu }: { v: ListaView; hrefFilaSaiu?: string }) {
  const [todos, setTodos] = useState(false)
  const [saidas, setSaidas] = useState(false)
  const ol = useRef<HTMLOListElement>(null)
  const foco = useRef<string | null>(null)
  const resto = v.cartoes.length - POR_VEZ

  useEffect(() => {
    const el = ol.current
    if (!el) return
    const abre = (e: Event) => { foco.current = (e as CustomEvent<string>).detail; setTodos(true) }
    el.addEventListener('cd-revelar', abre)
    return () => el.removeEventListener('cd-revelar', abre)
  }, [])
  useEffect(() => {
    if (todos && foco.current) { document.getElementById(foco.current)?.focus(); foco.current = null }
  }, [todos])

  const alternar = () => {
    if (!todos) foco.current = v.cartoes[POR_VEZ]?.id ?? null
    setTodos(t => !t)
  }
  return (
    <div className="cd-lista-painel">
      <p className="cd-frase">{v.frase}</p>
      <p className="cd-barra" aria-label={v.barra.texto}>
        <span className="cd-barra-t">{v.barra.texto}</span>
        <span className="cd-barra-f" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.round((v.barra.n / Math.max(1, v.barra.de)) * 100))}%` }} /></span>
      </p>
      <ul className="cd-legenda">
        {v.legenda.map(l => (
          <li key={l.chave} className={`cd-leg cd-g-${l.chave}${l.zero ? ' zero' : ''}`}>
            <span className="cd-leg-p" aria-hidden="true" /><span className="cd-leg-r">{l.rotulo}</span> <span>{l.texto}</span>
          </li>
        ))}
      </ul>
      {v.inscritosOcultos ? <p className="cd-nota"><span className="obs-ch-nm cd-selo">{v.inscritosOcultos}</span></p> : null}
      <Fileira casas={v.casas} />
      <p className="cd-movimento">
        {v.movimento.texto}{v.movimento.saidas ? <> · {v.movimento.saidas}</> : null}
      </p>
      {v.movimento.sairam > 0 ? (
        <>
          <button type="button" className="cd-link" aria-expanded={saidas} onClick={() => setSaidas(s => !s)}>{FRASES.verOsQueSairam(v.movimento.sairam)}</button>
          {saidas ? <ol className="cd-cartoes cd-cartoes-saidos">{v.saidos.map(c => <Cartao key={c.id} v={c} hrefFilaSaiu={hrefFilaSaiu} />)}</ol> : null}
        </>
      ) : null}
      <ol ref={ol} data-cd-lista="" className="cd-cartoes">
        {v.cartoes.map((c, i) => <Cartao key={c.id} v={c} escondido={!todos && i >= POR_VEZ} hrefFilaSaiu={hrefFilaSaiu} />)}
      </ol>
      {resto > 0 ? (
        <button type="button" className="cd-mais" aria-expanded={todos} onClick={alternar}>
          {todos ? FRASES.mostrarSoOsPrimeiros(POR_VEZ) : FRASES.mostrarOutros(resto)}
        </button>
      ) : null}
    </div>
  )
}
