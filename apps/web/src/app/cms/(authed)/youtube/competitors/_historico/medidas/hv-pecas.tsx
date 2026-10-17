/**
 * E5a Tarefa 21a: peças pequenas que os blocos do Histórico dividem (cabeça com o ⓘ, "ainda não existe", "não medido" de bloco inteiro).
 * Componentes de servidor; o ⓘ é o `RiInfo` (cliente, só texto). Nenhum componente passa como prop. Fora da lista da seção 9 do plano
 * (desvio declarado): sem este arquivo cada bloco repetiria as mesmas três formas.
 */
import type { ReactNode } from 'react'
import { RiInfo } from '../../_canais/ri-info'
import { NaoMedido } from '../../_chrome/medidas/marcas'
import './historico-medidas.css'

export function CabecaDoBloco({ id, titulo, info, rotuloDoInfo, children }: { id: string; titulo: string; info: string[]; rotuloDoInfo: string; children?: ReactNode }) {
  return (
    <div className="hv-h">
      <h2 id={id}>{titulo}</h2>
      <RiInfo titulo={titulo} itens={info} rotuloBotao={rotuloDoInfo} />
      {children}
    </div>
  )
}

/** O bloco que ainda não tem como existir (a data vem do modelo). */
export function BlocoAindaNaoExiste({ titulo, linhas, quando }: { titulo: string; linhas: string[]; quando?: string | null }) {
  return (
    <section className="hv-vz" aria-label={`${titulo}: ainda não existe`} data-bloco-estado="ainda_nao_existe">
      <div className="hv-h"><h2>{titulo}</h2><span className="hv-ainda-tag">ainda não existe</span></div>
      {linhas.map((l, i) => <p key={i}>{l}</p>)}
      {quando ? <span className="q">{quando}</span> : null}
    </section>
  )
}

/** O bloco inteiro "não medido": a hachura de ponta a ponta e o motivo ao lado. */
export function BlocoNaoMedido({ id, titulo, curta, motivo, extra, info, rotuloDoInfo, children }: {
  id: string; titulo: string; curta: string; motivo: string; extra?: string | null; info: string[]; rotuloDoInfo: string; children?: ReactNode
}) {
  return (
    <section className="hv-card" aria-labelledby={id} data-bloco-estado="nao_medido">
      <CabecaDoBloco id={id} titulo={titulo} info={info} rotuloDoInfo={rotuloDoInfo} />
      <div className="hv-nmb2">
        <div className="faixa" role="img" aria-label={`não medido: ${motivo}`} />
        <div className="mot"><NaoMedido curta={curta} longa={motivo} /><span>{motivo}</span></div>
        {extra ? <p className="hv-mut">{extra}</p> : null}
      </div>
      {children}
    </section>
  )
}
