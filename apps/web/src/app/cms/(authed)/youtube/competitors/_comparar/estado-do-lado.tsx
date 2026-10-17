'use client'
/** A5 E5a T7: a linha de estado do canal (M8) sob o nome no cartão do lado. Lado que não carregou: só a pastilha "não carregou". */
import { EstadoDoCanal } from '../_chrome/medidas/estado-canal'
import { NaoCarregou, NaoMedido } from '../_chrome/medidas/marcas'
import type { LadoMedidas } from './medidas-do-lado'

export function EstadoDoLado({ lado }: { lado: LadoMedidas }) {
  const e = lado.estado
  if (lado.naoCarregou) return <div className="cp-est" data-estado="nao_carregou"><NaoCarregou /></div>
  const queda = e.quedaLinha ? <div className="cp-est-q obs-md-apoio" data-queda-nao-medida="">{e.quedaLinha}</div> : null
  switch (e.pastilha) {
    case 'ativo': return e.linha || queda ? <div className="cp-est" data-estado="ativo">{e.linha ? <span className="obs-md-apoio">{e.linha}</span> : null}{queda}</div> : null
    case 'canal_proprio': return e.linha ? <div className="cp-est" data-estado="canal_proprio"><span className="obs-md-apoio">{e.linha}</span></div> : null
    case 'nao_carregou': return <div className="cp-est" data-estado="nao_carregou"><NaoCarregou /></div>
    case 'nao_medido': return <div className="cp-est" data-estado="nao_medido"><NaoMedido curta={e.linha ?? 'não medido'} longa={e.longa ?? ''} /></div>
    default:
      return (
        <div className="cp-est" data-estado={e.pastilha}>
          <EstadoDoCanal estado={e.pastilha} dataOuDias={e.dataOuDias} tambemEmQueda={e.tambemEmQueda} apoio={e.apoio} />
          {queda}
        </div>
      )
  }
}
