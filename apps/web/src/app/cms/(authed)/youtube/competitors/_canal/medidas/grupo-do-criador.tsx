'use client'
// Comentários em produção, T5: um vídeo no "O que o criador respondeu". Cliente só pelo botão "Ver as outras N deste vídeo". O cabeçalho (com o
// `Link` para o Histórico) vem pronto do servidor em `cabeca`: um `Link` nunca vira prop de componente cliente.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FioDeComentario } from '../../_chrome/comentarios/fio'
import type { CriadorDoFio, FioView } from '../../_chrome/comentarios/fio-model'
import { FRASES } from '../../_chrome/comentarios/frases'
import { VISIVEIS_POR_GRUPO } from './criador-lista-model'
import '../../_chrome/comentarios/fio.css'
import '../../_chrome/comentarios/comentarios.css'
import './canal-medidas.css'

export function GrupoDoCriador({ cabeca, fios, criador }: { cabeca: ReactNode; fios: FioView[]; criador: CriadorDoFio }) {
  const [todos, setTodos] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const foco = useRef<'primeiro-novo' | 'botao' | null>(null)
  const resto = fios.length - VISIVEIS_POR_GRUPO

  useEffect(() => {
    if (foco.current === 'primeiro-novo') document.getElementById(fios[VISIVEIS_POR_GRUPO]?.id ?? '')?.focus()
    else if (foco.current === 'botao') botao.current?.focus()
    foco.current = null
  }, [todos, fios])

  return (
    <li className="pc-grupo">
      {cabeca}
      <ol className="cf-lista">
        {fios.map((f, i) => <FioDeComentario key={f.id} v={f} criador={criador} densidade="lista" escondido={!todos && i >= VISIVEIS_POR_GRUPO} />)}
      </ol>
      {resto > 0 ? (
        <button ref={botao} type="button" className="cd-mais" aria-expanded={todos} onClick={() => { foco.current = todos ? 'botao' : 'primeiro-novo'; setTodos(t => !t) }}>
          {todos ? FRASES.recolher : `Ver as outras ${resto} deste vídeo`}
        </button>
      ) : null}
    </li>
  )
}
