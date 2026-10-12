/**
 * O cartão "Leitura da forja" no estado "ainda não disponível para o seu canal" (spec 17.4; mockup M/video-proprio.js): a forja só recebe dados
 * públicos de concorrente, então o pedido de leitura de um vídeo do seu canal ainda não existe. Sem etapas e sem estado; o botão fica apagado
 * (`aria-disabled`, não `disabled`: o foco não some e o leitor de tela lê o porquê) e não faz nada. Componente de servidor: só texto.
 */
import type { ForjaIndisponivelView } from './video-blocos-model'

export function ForjaIndisponivelVideo({ view }: { view: ForjaIndisponivelView }) {
  return (
    <section className="vb-forja" aria-labelledby="vb-forja-h">
      <h3 id="vb-forja-h">{view.titulo}<span className="vb-forja-off">{view.estado}</span></h3>
      <p className="vb-forja-what">{view.oQue}</p>
      <button type="button" className="vb-forja-btn" aria-disabled="true" aria-describedby="vb-forja-pq">{view.botao}</button>
      <p id="vb-forja-pq" className="vb-forja-pq">{view.porque}</p>
    </section>
  )
}
