'use client'
// "Sai / Entra" dentro do painel de escolha (M7b T11): sem diálogo; mostra o que sai do YouTube e o que entra.
import type { ReactElement } from 'react'
import type { LadoSaiEntra } from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import { Ic } from './icones-painel'
import { MiniaturaPainel } from './opcao-versao'

function Lado({ lado, rotulo, classe }: { lado: LadoSaiEntra; rotulo: string; classe: 'out' | 'in' }): ReactElement {
  return (
    <div className={`pe-lado ${classe}`}>
      {lado.tipo === 'versao' ? <MiniaturaPainel src={lado.miniatura} /> : null}
      <span className="tx">
        <span className="k">{rotulo}</span>
        <span className="t">{lado.tipo === 'versao' ? (lado.titulo ?? '') : lado.texto}</span>
      </span>
    </div>
  )
}

export function SaiEntra({ sai, entra, linhaNeutra }: { sai: LadoSaiEntra; entra: LadoSaiEntra; linhaNeutra: string | null }): ReactElement {
  return (
    <div className="pe-troca" role="group" aria-label="O que muda no YouTube" data-sai-entra>
      <div className="pe-par">
        <Lado lado={sai} rotulo="Sai" classe="out" />
        <span className="pe-seta"><Ic n="arrow" /></span>
        <Lado lado={entra} rotulo="Entra" classe="in" />
      </div>
      {linhaNeutra ? <div className="pe-linha"><Ic n="info" /><span>{linhaNeutra}</span></div> : null}
    </div>
  )
}
