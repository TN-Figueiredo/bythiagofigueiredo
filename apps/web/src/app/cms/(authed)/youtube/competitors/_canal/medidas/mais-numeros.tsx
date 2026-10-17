/**
 * E5a Tarefa 15: o bloco recolhido "Mais números do canal": os quatro números que saíram do cabeçalho, com o valor e o motivo que o modelo de
 * hoje já devolve. Sem estado (um `<details>`). Cada um traz a base escrita.
 */
import type { NumeroDeMais } from './cabecalho-model'
import './canal-medidas.css'

export function MaisNumeros({ numeros }: { numeros: NumeroDeMais[] }) {
  return (
    <details className="pc-mais" data-mais-numeros="">
      <summary>Mais números do canal<span className="mut"> ({numeros.length})</span></summary>
      <dl className="pc-cels pc-cels2" aria-label="Os quatro números que saíram da faixa">
        {numeros.map(n => (
          <div key={n.chave} className="pc-cel" data-celula={n.chave}>
            <dt>{n.rotulo}</dt>
            <dd className="v">
              {n.valor !== null
                ? <><b className="num">{n.valor}</b>{n.n ? <small className="num"> {n.n}</small> : null}</>
                : <span className="obs-ch-nm">não medido</span>}
            </dd>
            <dd className="b">{n.valor !== null ? n.base : (n.motivo ?? n.base)}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
