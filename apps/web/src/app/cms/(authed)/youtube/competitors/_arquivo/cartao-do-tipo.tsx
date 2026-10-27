import type { ReactElement } from 'react'
import type { CartaoDoTipo, LinhaDoMes } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { FRASE_FORA_DE_ORDEM, ancoraDoMes } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { FormaIcone, FraseComForma, Regua } from './regua'

/** Uma linha de mês. `contorno`: só a que precisa do dono (`sobeAoTopo`), a primeira do tipo. `acoes`: o encaixe da M6, que a M5 nunca preenche. */
export function LinhaDeMes({ linha, teste = false }: { linha: LinhaDoMes; teste?: boolean }): ReactElement {
  const grav = linha.gravidade === 'vermelho' ? ' vm' : linha.gravidade === 'ambar' ? ' am' : linha.gravidade === 'nao_medido' ? ' nm' : ''
  const foraDeOrdem = linha.secundaria?.includes(FRASE_FORA_DE_ORDEM) === true
  return (
    <li id={teste ? undefined : ancoraDoMes(linha.chave)} className={`arq-mes${linha.sobeAoTopo ? ' arq-contorno' : ''}${grav}${teste ? ' teste' : ''}`} data-mes={linha.chave}>
      <div className="arq-mn">{linha.mesNome}{teste ? <span className="arq-marca">teste</span> : null}</div>
      <div className="arq-fr">
        {linha.frase}
        {linha.info ? <details className="arq-info"><summary aria-label="Por que se espera"><span aria-hidden="true">ⓘ</span></summary><span className="arq-info-t">{linha.info}</span></details> : null}
        {linha.secundaria ? (
          foraDeOrdem
            ? <span className="arq-sec"><FraseComForma forma="triangulo">{linha.secundaria}</FraseComForma></span>
            : <span className="arq-sec">{linha.secundaria}</span>
        ) : null}
      </div>
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
      {cartao.linhas.length > 0 ? <p className="arq-sub">O caminho de cada mês · do mais antigo ao corrente</p> : null}
      <ul className="arq-rows">{cartao.linhas.map(l => <LinhaDeMes key={l.chave} linha={l} />)}</ul>
      {cartao.anosNoArquivo.length > 0 ? (
        <div className="arq-anos">
          {cartao.anosNoArquivo.map(a => <AnoNoArquivo key={a.ano} a={a} />)}
        </div>
      ) : null}
    </section>
  )
}

const dmy = (ms: number): string => { const d = spDateOf(ms); return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` }

/** Os meses que já saíram do banco, num `<details>` por ano (Logan A2 / Naksu N1). Fechado quando todos estão conferidos; aberto quando algum não está. */
function AnoNoArquivo({ a }: { a: CartaoDoTipo['anosNoArquivo'][number] }): ReactElement {
  const sem = a.semConferencia ?? (a.todosConferidos ? 0 : 1)
  const quantos = a.meses === 1 ? '1 mês no arquivo' : `${a.meses} meses no arquivo`
  const resto = sem === 0 ? (a.meses === 1 ? 'conferido' : 'todos conferidos') : `${sem} sem conferência`
  return (
    <details className="arq-ja arq-ano" open={sem > 0} data-forma="arquivo">
      <summary><FormaIcone forma="arquivo" /> {a.ano}: {quantos}, {resto}</summary>
      {a.itens && a.itens.length > 0 ? (
        <ul className="arq-ano-ls">{a.itens.map(m => <li key={m.mesNome}>{m.mesNome} · {m.verificadoEm != null ? `verificado em ${dmy(m.verificadoEm)}` : 'sem verificação'}</li>)}</ul>
      ) : null}
    </details>
  )
}
