import type { ReactElement } from 'react'
import type { BlocoCanaisRemovidos } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { LinhaCanalRemovido } from './linha-canal-removido'
import type { RespostaApagar } from './actions-canal'

const dmy = (ms: number): string => { const d = spDateOf(ms); return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` }

/** O bloco "Canais removidos". Os botões vêm do modelo (`acao`): sem a flag ou sem ser admin, só leitura. `onApagar` é a action, por prop. */
export function BlocoCanaisRemovidosView({ bloco, onApagar }: { bloco: BlocoCanaisRemovidos; onApagar?: (channelRef: string, digitado: string) => Promise<RespostaApagar> }): ReactElement {
  return (
    <section id="canais-removidos" className="arq-card arq-removidos" aria-label="Canais removidos" data-secao="canais-removidos">
      <header className="arq-card-h">
        <h3 className="arq-h3">Canais removidos</h3>
        <p className="arq-resumo">{bloco.resumo}</p>
      </header>
      {bloco.linhas.length > 0 ? <ul className="arq-rows">{bloco.linhas.map(l => <LinhaCanalRemovido key={l.channelRef} l={l} onApagar={onApagar} />)}</ul> : null}
      {bloco.jaLimpos.n > 0 ? (
        <details className="arq-ja">
          <summary>Já limpos ({bloco.jaLimpos.n})</summary>
          <p>{bloco.jaLimpos.n === 1 ? '1 canal removido já foi limpo' : `${bloco.jaLimpos.n} canais removidos já foram limpos`}{bloco.jaLimpos.ultimoEm !== null ? `; o último em ${dmy(bloco.jaLimpos.ultimoEm)}` : ''}.</p>
          {bloco.jaLimpos.viaE10 > 0 ? <p className="arq-sec">{bloco.jaLimpos.viaE10 === 1 ? '1 desses canais tinha exportação feita à mão; ela continua' : `${bloco.jaLimpos.viaE10} desses canais tinham exportação feita à mão; ela continua`} no Mac e no NAS: apague-a.</p> : null}
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
