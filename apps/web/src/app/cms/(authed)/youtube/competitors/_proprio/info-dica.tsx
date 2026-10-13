'use client'
/**
 * O ⓘ de uma seção da tela do vídeo: um botão de 44 px no toque e a dica na camada única (`Popover`, #flut). Recebe só texto
 * (título e parágrafos já escritos pelo modelo): nada de dado privado cru atravessa para o cliente além do que a tela já mostra.
 */
import { useId, useRef, useState } from 'react'
import { Popover } from '../_chrome/flut/flut'
import { Icon } from '../_chrome/icons'

export function InfoDica({ titulo, paragrafos, rotulo }: { titulo: string; paragrafos: readonly string[]; rotulo?: string }) {
  const [aberto, setAberto] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const base = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const id = 'vbi' + base
  return (
    <>
      <button ref={btn} type="button" className="ibtn vb-info" aria-expanded={aberto} aria-controls={id} aria-label={rotulo ?? titulo} onClick={() => setAberto(o => !o)}>
        {Icon.info()}
      </button>
      <Popover open={aberto} anchor={() => btn.current} onClose={() => setAberto(false)} id={id} role="dialog" labelledBy={id + 't'} className="canal-tip" pref="baixo" align="inicio" maxW={380}>
        <h3 id={id + 't'}>{titulo}</h3>
        {paragrafos.map((p, i) => <p key={i} className="vb-info-p">{p}</p>)}
      </Popover>
    </>
  )
}
