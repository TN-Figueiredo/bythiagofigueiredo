/**
 * E5a Tarefa 21a: os três cartões da reserva do Histórico (o estado `carregando` do mockup 13). Sem `server-only` e sem estado:
 * o `HistoricoScreen` (cliente) importa este arquivo e desenha o cabeçalho de verdade em cima. Só reserva espaço: nenhum número, nenhum "0".
 * A frase "Carregando o histórico do vídeo." aparece uma vez, no primeiro cartão.
 */
import './historico-medidas.css'

export const FRASE_CARREGANDO = 'Carregando o histórico do vídeo.'

export function Esqueleto() {
  return (
    <div className="hv-esq" data-esqueleto="historico" role="status" aria-live="polite" aria-busy="true">
      <div className="hv-esq-c"><p className="hv-fr hv-mut" id="hv-carregando">{FRASE_CARREGANDO}</p><i /><i /></div>
      <div className="hv-esq-c" aria-hidden="true"><i /><i className="g" /></div>
      <div className="hv-esq-c" aria-hidden="true"><i /><i className="g" /></div>
    </div>
  )
}
