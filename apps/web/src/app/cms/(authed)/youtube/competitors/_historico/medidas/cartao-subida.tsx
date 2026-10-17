/**
 * E5a Tarefa 21a: o cartão da subida (M5). Cinco formas: subiu (faixa verde com forma e palavra), sem subida ("＝"), não medido com a barra
 * de dias ("são N. Faltam M: fecha em dd/mm"), inconclusivo (contagem por semana: caixa neutra, nunca a hachura rosa) e não carregou.
 * Nenhuma frase afirma causa; a lista das mudanças dos 14 dias antes leva a nota fixa de coincidência. Componente de servidor.
 */
import { NaoCarregou, NaoMedido } from '../../_chrome/medidas/marcas'
import type { CartaoDaSubida } from './subida-model'
import './historico-medidas.css'

export function CartaoSubida({ cartao }: { cartao: CartaoDaSubida }) {
  switch (cartao.tipo) {
    case 'nao_carregou':
      return <section className="hv-card" aria-label="Subida" data-subida="nao_carregou"><NaoCarregou medida="Subida" /><p className="hv-fr hv-mut">{cartao.frase}</p></section>
    case 'inconclusivo':
      return (
        <section className="hv-incl hv-card" aria-label="Subida" data-subida="inconclusivo">
          <span className="hv-neu">{cartao.titulo}</span>
          <p className="hv-fr">{cartao.texto}</p>
          <p className="hv-mut">{cartao.info}</p>
        </section>
      )
    case 'sem_subida':
      return <section className="hv-card" aria-label="Subida" data-subida="sem_subida"><h2 className="hv-fr"><b>{cartao.titulo}</b></h2><p className="hv-fr">{cartao.texto}</p></section>
    case 'subiu':
      return (
        <section className="hv-sub" aria-label="Subida" data-subida="subiu">
          <p className="hv-fr"><b className="hv-up">{cartao.fraseTopo}</b></p>
          <p className="hv-lista" data-lista-dos-antes={cartao.listaCarregou ? 'lida' : 'nao_lida'}>{cartao.lista}</p>
          <p className="hv-nota">{cartao.nota}</p>
        </section>
      )
    case 'nao_medido': {
      const pc = Math.max(2, Math.min(100, (100 * cartao.feitos) / cartao.total))
      return (
        <section className="hv-card" aria-label="Subida" data-subida="nao_medido" data-motivo={cartao.motivo}>
          <div className="hv-nmb2">
            <div className="mot"><NaoMedido curta={cartao.curto} longa={cartao.texto} /><b>{cartao.titulo}</b></div>
            {cartao.motivo === 'faltam_dias' ? (
              <div className="hv-pg" role="img" aria-label={`Dias de leitura: ${cartao.feitos} de ${cartao.total}`}><span className="hv-pg-f" style={{ width: `${pc}%` }} /><span className="hv-pg-r" /></div>
            ) : null}
            <p className="hv-fr">{cartao.texto}.</p>
          </div>
        </section>
      )
    }
  }
}
