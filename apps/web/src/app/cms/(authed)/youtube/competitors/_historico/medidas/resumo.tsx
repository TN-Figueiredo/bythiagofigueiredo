/** E5a Tarefa 21a: o cartão do resumo do vídeo (a frase e a faixa de números). A frase e os números saem da mesma função (`resumoDoVideo`). Componente de servidor. */
import { FaixaDeNumerosHistorico } from './faixa-de-numeros'
import type { Resumo } from './resumo-model'
import './historico-medidas.css'

export function ResumoDoVideo({ resumo }: { resumo: Resumo }) {
  return (
    <section className="hv-card" aria-label="Resumo do vídeo" data-resumo={resumo.variante}>
      <div className="hv-h"><h2 className="sr">Resumo</h2></div>
      <p className="hv-fr">{resumo.frase}</p>
      <FaixaDeNumerosHistorico faixa={resumo.faixa} />
    </section>
  )
}
