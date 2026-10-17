/**
 * E5a Tarefa 21a: "Mudanças deste vídeo". Cada mudança tem o seu ícone (losango = título, triângulo = miniatura, círculo = outras), o número, a
 * janela real ("entre 06:00 e 12:00") e, quando há subida, a marca "fora dos 14 dias antes" só nos itens de fora. Nenhuma frase diz "depois da
 * troca" nem afirma causa. Mudanças não lidas são "não carregou", nunca "nenhuma mudança". Componente de servidor.
 */
import { PastilhaAusencia } from '../../_chrome/ausencia/pastilhas'
import { RiInfo } from '../../_canais/ri-info'
import type { ListaDeMudancas } from './mudancas-model'
import './historico-medidas.css'

const FORMA = { titulo: 'hv-mi-t', miniatura: 'hv-mi-m', outras: 'hv-mi-o' } as const

export function ListaDeMudancasHistorico({ lista }: { lista: ListaDeMudancas | null }) {
  if (lista === null) {
    return (
      <section className="hv-card" aria-labelledby="hMud" data-mudancas="nao_carregou">
        <div className="hv-h"><h2 id="hMud">Mudanças deste vídeo</h2></div>
        <PastilhaAusencia estado="falhou" motivo="Mudanças deste vídeo" />
      </section>
    )
  }
  return (
    <section className="hv-card" aria-labelledby="hMud" data-mudancas={lista.itens.length === 0 ? 'vazia' : 'lista'}>
      <div className="hv-h">
        <h2 id="hMud">{lista.titulo}</h2>
        <RiInfo
          titulo={lista.titulo}
          itens={['Cada mudança traz o tipo e a janela em que a contagem a viu. A leitura das views do dia fecha às 12:00: mudança feita depois disso só aparece nas views do dia seguinte.']}
          rotuloBotao="Como ler as mudanças deste vídeo"
        />
      </div>
      {lista.resumo ? <p className="hv-fr" data-resumo-mudancas><b>{lista.resumo.negrito}</b>{lista.resumo.resto}</p> : null}
      {lista.fraseDeDentro ? <p className="hv-fr" data-frase-de-dentro>{lista.fraseDeDentro}</p> : null}
      {lista.vazia ? <p className="hv-fr hv-mut">{lista.vazia}</p> : (
        <ol className={'hv-muda' + (lista.emColunas ? ' cols' : '')}>
          {lista.itens.map((i) => (
            <li key={i.n} data-mudanca={i.n}>
              <span className={`hv-mi ${FORMA[i.tipo]}`} aria-hidden="true">{i.n}</span>
              <div>
                <b>{i.rotulo}</b>{' · '}<span className="hv-mq">{i.quando}</span>
                {i.depoisDaLeitura ? <span className="hv-mq"> · depois da leitura do dia</span> : null}
                {i.marcaFora ? <span className="dentro">fora dos 14 dias antes</span> : null}
                {i.deParaTexto ? <div className="hv-mq" data-detalhe>{i.deParaTexto}</div> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
