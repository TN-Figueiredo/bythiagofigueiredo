import type { ReactElement } from 'react'
import type { CartaoDoTipo, LinhaDoMes } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { FRASE_FORA_DE_ORDEM } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { FormaIcone, FraseComForma, Regua } from './regua'

/** Uma linha de mês. `contorno`: só a que precisa do dono (`sobeAoTopo`), a primeira do tipo. `acoes`: o encaixe da M6, que a M5 nunca preenche. */
export function LinhaDeMes({ linha, teste = false }: { linha: LinhaDoMes; teste?: boolean }): ReactElement {
  const grav = linha.gravidade === 'vermelho' ? ' vm' : linha.gravidade === 'ambar' ? ' am' : linha.gravidade === 'nao_medido' ? ' nm' : ''
  const foraDeOrdem = linha.secundaria?.includes(FRASE_FORA_DE_ORDEM) === true
  return (
    <li className={`arq-mes${linha.sobeAoTopo ? ' arq-contorno' : ''}${grav}${teste ? ' teste' : ''}`} data-mes={linha.chave}>
      <div className="arq-mn">{linha.mesNome}{teste ? <span className="arq-marca">teste</span> : null}</div>
      <p className="arq-fr">
        {linha.frase}
        {linha.secundaria ? (
          foraDeOrdem
            ? <span className="arq-sec"><FraseComForma forma="triangulo">{linha.secundaria}</FraseComForma></span>
            : <span className="arq-sec">{linha.secundaria}</span>
        ) : null}
      </p>
      <Regua etapas={linha.regua} rotulo={`Etapas de ${linha.mesNome}`} />
      {linha.acoes ? <div className="arq-ac">{linha.acoes}</div> : null}
    </li>
  )
}

export function CartaoDoTipoView({ cartao }: { cartao: CartaoDoTipo }): ReactElement {
  return (
    <section className="arq-card" role="region" aria-label={cartao.titulo} data-secao={`tipo-${cartao.tipo}`}>
      <header className="arq-card-h">
        <div className="arq-card-top"><h3 className="arq-h3">{cartao.titulo}</h3>{cartao.acoes ? <div className="arq-ac">{cartao.acoes}</div> : null}</div>
        <p className="arq-resumo">{cartao.resumo}</p>
      </header>
      <ul className="arq-rows">{cartao.linhas.map(l => <LinhaDeMes key={l.chave} linha={l} />)}</ul>
      {cartao.anosNoArquivo.length > 0 ? (
        <div className="arq-anos">
          {cartao.anosNoArquivo.map(a => (
            <p key={a.ano} className="arq-ano" data-forma="arquivo"><FormaIcone forma="arquivo" /> {a.ano}: {a.meses} {a.meses === 1 ? 'mês no arquivo' : 'meses no arquivo'}, {a.todosConferidos ? (a.meses === 1 ? 'conferido' : 'todos conferidos') : 'nem todos conferidos'}</p>
          ))}
        </div>
      ) : null}
    </section>
  )
}
