'use client'
// Aviso do topo do painel de escolha (M7b T11): `err` (vermelho) para recusa; `inc` (âmbar) só para o estado incerto/sem conexão.
import type { ReactElement, Ref } from 'react'
import { Ic, type NomeIcone } from './icones-painel'

export interface AvisoPainelProps {
  tom: 'err' | 'inc'
  icone: NomeIcone
  titulo: string
  detalhe: string
  avisoRef?: Ref<HTMLDivElement>
}

export function AvisoPainel({ tom, icone, titulo, detalhe, avisoRef }: AvisoPainelProps): ReactElement {
  return (
    <div ref={avisoRef} className={`pe-aviso${tom === 'inc' ? ' inc' : ''}`} role="alert" tabIndex={-1} data-aviso>
      <Ic n={icone} />
      <div><b>{titulo}</b><span>{detalhe}</span></div>
    </div>
  )
}
