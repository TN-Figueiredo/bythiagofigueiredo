'use client'
/**
 * O ⓘ compartilhado do YouTube (Observatório e A/B Lab): um botão de 44 px no toque e a dica na camada única (`Popover`, #flut). Recebe só texto
 * (título e parágrafos já escritos pelo modelo): nada de dado privado cru atravessa para o cliente além do que a tela já mostra.
 */
import { useId, useRef, useState } from 'react'
import { Popover } from '../competitors/_chrome/flut/flut'
import { Icon } from '../competitors/_chrome/icons'
import '../competitors/_chrome/tokens-obs.css'
import '../competitors/_chrome/camadas.css'
import '../competitors/_chrome/flut/flut.css'
import './info-dica.css'

export function InfoDica({ titulo, paragrafos, rotulo, className }: { titulo: string; paragrafos: readonly string[]; rotulo?: string; className?: string }) {
  const [aberto, setAberto] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const base = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const id = 'vbi' + base
  return (
    <>
      <button ref={btn} type="button" className={`ibtn dica-i${className ? ` ${className}` : ''}`} aria-expanded={aberto} aria-controls={id} aria-label={rotulo ?? titulo} onClick={() => setAberto(o => !o)}>
        {Icon.info()}
      </button>
      <Popover open={aberto} anchor={() => btn.current} onClose={() => setAberto(false)} id={id} role="dialog" labelledBy={id + 't'} className="canal-tip" pref="baixo" align="inicio" maxW={380}>
        <h3 id={id + 't'}>{titulo}</h3>
        {paragrafos.map((p, i) => <p key={i} className="dica-p">{p}</p>)}
      </Popover>
    </>
  )
}
