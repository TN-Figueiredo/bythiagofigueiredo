/**
 * A barra do % assistido do vídeo (A4) com a marca do "normal do canal". Sem 'use client': serve ao servidor (`SecAssistido`, sem cartões de período)
 * e ao cliente (`AssistidoPeriodos`, onde a marca segue o período escolhido). Só apresentação: recebe o modelo pronto.
 * `normal` = a marca a desenhar (`undefined` = a do próprio bloco, que é o normal do canal da A4; `null` = nenhuma).
 */
import { marcaDaBarra, type BlocoAssistido } from './video-blocos-model'

export function BarraAssistido({ a, normal }: { a: BlocoAssistido; normal?: number | null }) {
  if (a.estado === 'nao-medido' || a.barraPct == null) return null
  const pouco = a.estado === 'pouco'
  // abaixo de 10 views não se compara: sem marca, qualquer que seja o período
  const marca = pouco ? null : normal === undefined ? (a.marcaPct != null && a.rotuloAncora != null && a.normalTexto != null ? { marcaPct: a.marcaPct, rotuloAncora: a.rotuloAncora, normalTexto: a.normalTexto } : null) : marcaDaBarra(normal)
  return (
    <>
      <div className={'vb-as-barra' + (pouco ? ' pouco' : '')} role="img" aria-label={a.alt}>
        <i style={{ width: `${a.barraPct}%` }} />
        {marca ? <s style={{ left: `${marca.marcaPct}%` }} /> : null}
      </div>
      {a.marcas ? <div className="vb-as-tk" aria-hidden="true"><span>{a.marcas[0]}</span><span>{a.marcas[1]}</span><span>{a.marcas[2]}</span></div> : null}
      {marca ? (
        <div className="vb-as-med" aria-hidden="true">
          <span className={'vb-as-med-' + marca.rotuloAncora} style={marca.rotuloAncora === 'meio' ? { left: `${marca.marcaPct}%` } : undefined}>normal do canal: {marca.normalTexto}</span>
        </div>
      ) : null}
    </>
  )
}
