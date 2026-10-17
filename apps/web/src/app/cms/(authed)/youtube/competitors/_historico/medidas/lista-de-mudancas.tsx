/**
 * E5a Tarefa 21a: "Mudanças deste vídeo". Cada mudança tem o seu ícone (losango = título, triângulo = miniatura, círculo = outras), o número, a
 * janela real ("entre 06:00 e 12:00") e, quando há subida, a marca "fora dos 14 dias antes" só nos itens de fora. Nenhuma frase diz "depois da
 * troca" nem afirma causa. Mudanças não lidas são "não carregou", nunca "nenhuma mudança". Componente de servidor.
 */
import { NaoCarregou } from '../../_chrome/medidas/marcas'
import type { ListaDeMudancas } from './mudancas-model'
import './historico-medidas.css'

const FORMA = { titulo: 't', miniatura: 'm', outras: 'o' } as const

export function ListaDeMudancasHistorico({ lista }: { lista: ListaDeMudancas | null }) {
  if (lista === null) {
    return (
      <section className="hv-card" aria-labelledby="hMud" data-mudancas="nao_carregou">
        <div className="hv-h"><h2 id="hMud">Mudanças deste vídeo</h2></div>
        <NaoCarregou medida="Mudanças deste vídeo" />
      </section>
    )
  }
  return (
    <section className="hv-card" aria-labelledby="hMud" data-mudancas={lista.itens.length === 0 ? 'vazia' : 'lista'}>
      <div className="hv-h"><h2 id="hMud">{lista.titulo}</h2></div>
      {lista.fraseDeDentro ? <p className="hv-fr" data-frase-de-dentro>{lista.fraseDeDentro}</p> : null}
      {lista.vazia ? <p className="hv-fr hv-mut">{lista.vazia}</p> : (
        <ol className={'hv-muda' + (lista.emColunas ? ' cols' : '')}>
          {lista.itens.map((i) => (
            <li key={i.n} data-mudanca={i.n}>
              <span className={`hv-mi ${FORMA[i.tipo]}`} aria-hidden="true">{i.n}</span>
              <div>
                <b>{i.rotulo}</b>{' '}<span className="hv-mq">{i.quando}</span>
                {i.marcaFora ? <span className="dentro">fora dos 14 dias antes</span> : null}
                {i.deParaTexto || i.notaDoDia ? <div className="hv-mq" data-detalhe>{[i.deParaTexto, i.notaDoDia].filter(Boolean).join(' ')}</div> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
