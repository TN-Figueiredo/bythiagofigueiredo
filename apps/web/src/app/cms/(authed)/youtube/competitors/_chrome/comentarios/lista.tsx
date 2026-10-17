'use client'
// A5 · E5a · Tarefa C2 (refeita em "comentários em produção", T4): o painel de uma idade com lista: legenda, zeros, os fios (cinco por vez),
// o movimento no rodapé e os que saíram dos 12. A frase-resumo e a barra ficam antes das abas (`ResumoDaLista`).
import { useEffect, useRef, useState } from 'react'
import { Cartao } from './cartao'
import type { CriadorDoFio } from './fio-model'
import { FRASES } from './frases'
import type { ListaEnxuta } from './enxuto'
import './comentarios.css'

const POR_VEZ = 5

export function ListaDoPainel({ v, criador, hrefFilaSaiu }: { v: ListaEnxuta; criador: CriadorDoFio; hrefFilaSaiu?: string }) {
  const [todos, setTodos] = useState(false)
  const [saidas, setSaidas] = useState(false)
  const foco = useRef<string | null>(null)
  const resto = v.cartoes.length - POR_VEZ

  useEffect(() => {
    if (todos && foco.current) { document.getElementById(foco.current)?.focus(); foco.current = null }
  }, [todos])

  const alternar = () => {
    if (!todos) foco.current = v.cartoes[POR_VEZ]?.id ?? null
    setTodos(t => !t)
  }
  return (
    <div className="cd-lista-painel">
      {v.legenda.length > 0 ? (
        <ul className="cd-legenda">
          {v.legenda.map(l => (
            <li key={l.chave} className={`cd-leg cd-g-${l.chave}`}>
              <span className="cd-leg-p" aria-hidden="true" /><span>{l.texto}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {v.zeros ? <p className="cd-zeros">{v.zeros}</p> : null}
      {v.inscritosOcultos ? <p className="cd-nota"><span className="obs-ch-nm cd-selo">{v.inscritosOcultos}</span></p> : null}
      <ol className="cf-lista">
        {v.cartoes.map((c, i) => <Cartao key={c.id} v={c} criador={criador} escondido={!todos && i >= POR_VEZ} hrefFilaSaiu={hrefFilaSaiu} />)}
      </ol>
      {resto > 0 ? (
        <button type="button" className="cd-mais" aria-expanded={todos} onClick={alternar}>
          {todos ? FRASES.mostrarSoOsPrimeiros : FRASES.mostrarOutros(resto)}
        </button>
      ) : null}
      <p className="cd-movimento">
        {v.movimento.texto}{v.movimento.saidas ? <> · {v.movimento.saidas}</> : null}
      </p>
      {v.movimento.sairam > 0 ? (
        <>
          <button type="button" className="cd-link" aria-expanded={saidas} onClick={() => setSaidas(s => !s)}>{FRASES.verOsQueSairam(v.movimento.sairam)}</button>
          {saidas ? <ol className="cf-lista cd-cartoes-saidos">{v.saidos.map(c => <Cartao key={c.id} v={c} criador={criador} hrefFilaSaiu={hrefFilaSaiu} />)}</ol> : null}
        </>
      ) : null}
    </div>
  )
}
