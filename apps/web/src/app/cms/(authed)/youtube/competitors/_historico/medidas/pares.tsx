/**
 * E5a Tarefa 21a: os pares de barras "os mesmos pontos, lado a lado" (1, 7 e 30 dias). A largura de cada barra é o espaço livre vezes a
 * fração que o modelo calculou (proporcional ao valor; o piso de 4 px só vale para valor acima de zero, em CSS). Componente de servidor.
 */
import type { ParDeBarras } from './idade-model'
import { abrev } from './formatos'
import './historico-medidas.css'

const LARGURA = (f: number): string => `calc((100% - 120px) * ${f.toFixed(4)})`

function Par({ p }: { p: ParDeBarras }) {
  const rot = <div className="hv-pl">{p.rotulo}</div>
  if (p.estado === 'ainda_nao_existe') {
    return (
      <li className="hv-par" aria-label={`${p.rotulo}: ainda não existe`} data-par={p.idade} data-estado="ainda_nao_existe">
        {rot}<div className="hv-pb"><div className="hv-bl"><span className="hv-ainda-tag">ainda não existe</span>{p.nota ? <span className="hv-bv m">{p.nota}</span> : null}</div></div>
      </li>
    )
  }
  if (p.estado === 'nao_medido') {
    return (
      <li className="hv-par" aria-label={`${p.rotulo}: não medido`} data-par={p.idade} data-estado="nao_medido">
        {rot}<div className="hv-pb"><div className="hv-bl"><span className="hv-nmb" role="img" aria-label="não medido" /></div>{p.nota ? <div className="hv-bv m">{p.nota}</div> : null}</div>
      </li>
    )
  }
  const v = p.video!
  const n = p.normal
  return (
    <li className="hv-par" aria-label={`${p.rotulo}: ${p.fala}`} data-par={p.idade} data-estado="ok">
      {rot}
      <div className="hv-pb">
        <div className="hv-bl">
          <span className="hv-sw-vid hv-g" aria-hidden="true" />
          {v.zero ? <><span className="hv-bar vz" /><span className="hv-bv">0, medido</span></> : <><span className="hv-bar" style={{ width: LARGURA(v.fracao) }} data-fracao={v.fracao.toFixed(4)} /><span className="hv-bv">{abrev(v.views)}</span></>}
        </div>
        {n === null ? null : n.tipo === 'fora' ? (
          <div className="hv-bl"><span className="hv-bv m">fora do normal do canal (ao vivo ou estreia)</span></div>
        ) : n.tipo === 'nao_medido' ? (
          <><div className="hv-bl"><span className="hv-nmb" style={{ maxWidth: 140 }} role="img" aria-label="não medido" /></div><div className="hv-bv m">{n.frase}</div></>
        ) : (
          <>
            <div className="hv-bl"><span className="hv-sw-nor hv-g" aria-hidden="true" /><span className="hv-bar n" style={{ width: LARGURA(n.fracao) }} data-fracao={n.fracao.toFixed(4)} /><span className="hv-bv">{abrev(n.views)}</span></div>
            <div className="hv-bv m">{n.frase}</div>
          </>
        )}
      </div>
      {p.razao ? <div className="hv-rz" data-razao>{p.razao.texto}</div> : null}
    </li>
  )
}

export function Pares({ pares }: { pares: ParDeBarras[] }) {
  return <ul className="hv-pares" aria-label="O vídeo contra o normal do canal, com 1, 7 e 30 dias">{pares.map((p) => <Par key={p.idade} p={p} />)}</ul>
}
