/** A5 · E5a, Tarefa 5: a célula de Direção (tabela e cartão) e a linha de estado sob o nome do canal. Sem estado: tudo vem da linha. */
import type { CanaisRow } from './view-model'
import { Direcao, PALAVRA_DA_DIRECAO } from '../_chrome/medidas/direcao'
import { ReguaDirecao } from '../_chrome/medidas/regua-direcao'
import { EstadoDoCanal } from '../_chrome/medidas/estado-canal'
import { NaoCarregou, NaoMedido } from '../_chrome/medidas/marcas'

export function DirecaoCell({ r, cartao = false }: { r: CanaisRow; cartao?: boolean }) {
  const d = r.direcao
  if (d.tipo === 'nao_carregou') return <NaoCarregou />
  if (d.tipo === 'nao_medido' || d.tipo === 'canal_proprio') return <NaoMedido curta={d.curta} longa={d.longa} />
  const n = r.direcaoNumeros
  const exato = (d.ganhoRecente - d.ganhoAnterior) / d.ganhoAnterior
  return (
    <div className="obs-cn-dir" data-direcao={d.simbolo}>
      <Direcao variante="cheio" simbolo={d.simbolo} pct={d.pct} palavraVisivel={cartao} />
      <ReguaDirecao limite={50} pct={d.pct} foraDaEscala={d.foraDaEscala} exato={exato} />
      {n ? (
        <span className="obs-cn-dir-n num">
          <span aria-hidden="true">{n.recente} × {n.anterior}</span>
          <span className="obs-md-sr">{n.recente} views nos últimos 28 dias, contra {n.anterior} nos 28 anteriores ({PALAVRA_DA_DIRECAO[d.simbolo]})</span>
        </span>
      ) : null}
    </div>
  )
}

/** Sob o nome: a pastilha do estado (a pior), o apoio e, quando é o caso, o motivo da queda não medida. "Ativo" não tem pastilha. */
export function EstadoLinha({ r }: { r: CanaisRow }) {
  const e = r.estado
  const motivoQueda = e.quedaLinha ? <div className="obs-cn-est obs-md-apoio" data-queda-nao-medida="">{e.quedaLinha}</div> : null
  switch (e.pastilha) {
    case 'ativo':
      return <>{e.linha ? <div className="obs-cn-est obs-cn-ativo" data-estado="ativo">{e.linha}</div> : null}{motivoQueda}{e.extrasNaoLidos ? <ExtrasNaoLidos /> : null}</>
    case 'canal_proprio':
      return e.linha ? <div className="obs-cn-est obs-md-apoio" data-estado="canal_proprio">{e.linha}</div> : null
    case 'nao_carregou':
      return <div className="obs-cn-est" data-estado="nao_carregou"><NaoCarregou /></div>
    case 'nao_medido':
      return <div className="obs-cn-est" data-estado="nao_medido"><NaoMedido curta={e.linha ?? 'não medido'} longa={e.longa ?? ''} /></div>
    case 'pausado':
      return <div className="obs-cn-est" data-estado="pausado"><EstadoDoCanal estado="pausado" /></div>
    default:
      return (
        <div className="obs-cn-est" data-estado={e.pastilha}>
          <EstadoDoCanal estado={e.pastilha} dataOuDias={e.dataOuDias} tambemEmQueda={e.tambemEmQueda} apoio={e.apoio} />
          {motivoQueda}
          {e.extrasNaoLidos && e.pastilha !== 'fora_do_ar' ? <ExtrasNaoLidos /> : null}
        </div>
      )
  }
}

// TEXTO-A-REVISAR (Logan/Naksu): o plano diz "a linha diz não carregou" quando os campos do canal não foram lidos
function ExtrasNaoLidos() {
  return <div className="obs-cn-est obs-md-apoio" data-extras-nao-lidos="">Não carregou: se o canal saiu do YouTube.</div>
}
