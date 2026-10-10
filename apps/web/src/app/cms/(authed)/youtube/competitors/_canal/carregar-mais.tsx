'use client'
/**
 * O bloco "Carregar mais" (spec 5.6): barra de progresso, "Mostrando 120 de 202 vídeos", a frase do que vem e o botão, o único
 * preenchido da tela, com 44 px. Só botão: nada carrega ao rolar. Depois do clique quem chama move o foco e anuncia.
 */
import type { ListaView } from './lista'

export function CarregarMais({ mais, onMais }: { mais: NonNullable<ListaView['mais']>; onMais: () => void }) {
  const pct = mais.total ? Math.round((mais.mostrando / mais.total) * 100) : 0
  return (
    <>
      {mais.soAntigos ? <p className="cv-soantigos">{mais.soAntigos}</p> : null}
      <div className="cv-more" role="group" aria-label="Carregar mais vídeos">
        <div className="cv-more-bar" role="progressbar" aria-label="Vídeos na tela" aria-valuemin={0} aria-valuemax={mais.total} aria-valuenow={mais.mostrando}><i style={{ width: pct + '%' }} /></div>
        <p className="cv-more-t"><b>Mostrando {mais.mostrando} de {mais.total} vídeos</b></p>
        <p className="cv-more-s">{mais.frase}</p>
        <button type="button" className="obs-ch-btn pri" onClick={onMais}>{mais.botao}</button>
      </div>
    </>
  )
}
