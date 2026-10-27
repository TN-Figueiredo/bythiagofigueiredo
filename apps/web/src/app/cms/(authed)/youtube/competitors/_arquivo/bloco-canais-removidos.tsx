import type { ReactElement } from 'react'
import type { BlocoCanaisRemovidos, LinhaCanalRemovido } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { Regua } from './regua'

const dmy = (ms: number): string => { const d = spDateOf(ms); return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` }

function Linha({ l }: { l: LinhaCanalRemovido }): ReactElement {
  const grav = l.gravidade === 'vermelho' ? ' vm' : l.gravidade === 'ambar' ? ' am' : l.gravidade === 'nao_medido' ? ' nm' : ''
  return (
    <li className={`arq-can${grav}${l.noTopo ? ' arq-contorno' : ''}`}>
      <div className="arq-cn" title={l.rotulo} aria-label={l.rotulo}>{l.rotulo}</div>
      <div>
        <p className="arq-fr">{l.frase}</p>
        {l.blob ? <p className="arq-fr arq-sec" data-forma={l.blob.forma}>{l.blob.frase}</p> : null}
      </div>
      <Regua etapas={l.regua} rotulo={`Etapas da limpeza de ${l.rotulo}`} />
    </li>
  )
}

/** O bloco "Canais removidos", só de leitura (M5): nenhum botão e nenhum comando (são da M9). */
export function BlocoCanaisRemovidosView({ bloco }: { bloco: BlocoCanaisRemovidos }): ReactElement {
  return (
    <section id="canais-removidos" className="arq-card arq-removidos" aria-label="Canais removidos" data-secao="canais-removidos">
      <header className="arq-card-h">
        <h3 className="arq-h3">Canais removidos</h3>
        <p className="arq-resumo">{bloco.resumo}</p>
      </header>
      {bloco.linhas.length > 0 ? <ul className="arq-rows">{bloco.linhas.map(l => <Linha key={l.channelRef} l={l} />)}</ul> : null}
      {bloco.jaLimpos.n > 0 ? (
        <details className="arq-ja">
          <summary>Já limpos ({bloco.jaLimpos.n})</summary>
          <p>{bloco.jaLimpos.n === 1 ? '1 canal removido já foi limpo' : `${bloco.jaLimpos.n} canais removidos já foram limpos`}{bloco.jaLimpos.ultimoEm !== null ? `; o último em ${dmy(bloco.jaLimpos.ultimoEm)}` : ''}.</p>
        </details>
      ) : null}
    </section>
  )
}

/** O bloco não pôde ser lido: a frase em hachura, nunca lista vazia. */
export function BlocoNaoLido(): ReactElement {
  return (
    <section id="canais-removidos" className="arq-card arq-removidos" aria-label="Canais removidos" data-secao="canais-removidos">
      <p className="arq-ausente nm" data-forma="hachura"><span className="arq-hach" aria-hidden="true" /><span>Não foi possível ler os canais removidos.</span></p>
    </section>
  )
}
