/**
 * E5a Tarefa 19: o esqueleto de cada `<Suspense>` da página do canal (topo, as cinco células, os blocos), no tom de `--border-strong`.
 * Componentes de servidor sem prop de componente. Só reserva espaço: nenhum número, nenhum "0".
 */
import './canal-medidas.css'

export function EsqueletoDoTopo() {
  return <div className="pc-esq pc-esq-topo" data-esqueleto="topo" aria-hidden="true"><i /><i /></div>
}

export function EsqueletoDasCelulas() {
  return (
    <dl className="pc-cels pc-esq-cels" data-esqueleto="celulas" aria-label="Números do canal, carregando">
      {[0, 1, 2, 3, 4].map(k => <div key={k} className="pc-cel pc-esq"><dt><i /></dt><dd><i /></dd></div>)}
    </dl>
  )
}

export function EsqueletoDosBlocos() {
  return (
    <div className="pc-esq-blocos" data-esqueleto="blocos" role="status" aria-label="Carregando os blocos do canal">
      {[0, 1, 2, 3].map(k => <div key={k} className="pc-sec pc-esq"><i /><i /><i /></div>)}
    </div>
  )
}
