'use client'
import { useId, useRef, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import type { LinhaCanalRemovido } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { FormaIcone, Regua } from './regua'
import { PainelComandos } from './painel-comandos'
import { DialogoApagar } from './apagar-do-arquivo'
import type { RespostaApagar } from './actions-canal'

/** `router.refresh()` quando há roteador montado; fora dele (teste, Storybook) não faz nada em vez de lançar. */
function useAtualizar(): () => void {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const router = useRouter()
    return () => router.refresh()
  } catch {
    return () => undefined
  }
}

/** Uma linha do bloco "Canais removidos". O botão e o painel dependem só do que o modelo devolveu (`acao`, `comandos`, `dialogo`). */
export function LinhaCanalRemovido({ l, onApagar }: { l: LinhaCanalRemovido; onApagar?: (channelRef: string, digitado: string) => Promise<RespostaApagar> }): ReactElement {
  const uid = useId()
  const atualizar = useAtualizar()
  const [painel, setPainel] = useState(false)
  const [dialogo, setDialogo] = useState(false)
  const [status, setStatus] = useState('')
  const gatilho = useRef<HTMLButtonElement>(null)
  const titulo = useRef<HTMLDivElement>(null)
  const grav = l.gravidade === 'vermelho' ? ' vm' : l.gravidade === 'ambar' ? ' am' : l.gravidade === 'nao_medido' ? ' nm' : ''
  const painelId = `${uid}-cmd`
  const apagar = l.acao === 'apagar' && l.dialogo !== null && onApagar !== undefined
  return (
    <li className={`arq-can${grav}${l.noTopo ? ' arq-contorno' : ''}`}>
      <div className="arq-cn" title={l.rotulo} ref={titulo} tabIndex={-1}>{l.rotulo}</div>
      <div>
        <p className="arq-fr">{l.frase}</p>
        {l.blob ? <p className="arq-fr arq-sec" data-forma={l.blob.forma}>{l.blob.frase}</p> : null}
        {l.nota ? <p className="arq-fr arq-sec" data-forma={l.nota.forma}><FormaIcone forma={l.nota.forma} /><span>{l.nota.frase}</span></p> : null}
        <p className="arq-st" role="status" aria-live="polite">{status}</p>
      </div>
      <Regua etapas={l.regua} rotulo={`Etapas da limpeza de ${l.rotulo}`} />
      {l.acao === 'comandos' && l.comandos ? (
        <div className="arq-ac"><button type="button" className="btn small" aria-expanded={painel} aria-controls={painelId} onClick={() => setPainel(a => !a)}>Ver os comandos</button></div>
      ) : null}
      {apagar ? <div className="arq-ac"><button type="button" ref={gatilho} className="btn small danger" onClick={() => setDialogo(true)}>Apagar do arquivo</button></div> : null}
      {l.acao === 'comandos' && l.comandos && painel ? <PainelComandos id={painelId} titulo={l.comandos.titulo} linha={l.comandos.linha} /> : null}
      {apagar && dialogo ? (
        <DialogoApagar d={l.dialogo!}
          onConfirmar={digitado => onApagar!(l.channelRef, digitado)}
          onFechar={r => {
            setDialogo(false)
            if (r) {
              setStatus(r.status === 'ja_pedido' ? 'Este canal já estava com a limpeza pedida; a linha foi atualizada.' : `Limpeza pedida para ${l.rotulo}.`)
              atualizar()
              setTimeout(() => titulo.current?.focus(), 0)
            } else setTimeout(() => gatilho.current?.focus(), 0)
          }} />
      ) : null}
    </li>
  )
}
