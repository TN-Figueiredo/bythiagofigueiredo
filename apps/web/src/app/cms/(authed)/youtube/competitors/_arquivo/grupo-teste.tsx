import type { ReactElement } from 'react'
import type { ModeloPagina } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { LinhaDeMes } from './cartao-do-tipo'

/** O grupo "Dado de teste", só de quem administra (D-M5-6): uma faixa e a marca "teste" em cada linha; sem botão. */
export function GrupoTeste({ teste }: { teste: NonNullable<ModeloPagina['teste']> }): ReactElement {
  return (
    <section className="arq-card arq-teste" aria-label="Dado de teste" data-secao="dado-de-teste">
      <p className="arq-teste-h">{teste.faixa}. Isto é um mês fictício, para ensaiar a saída de um mês; não é dado do seu canal.</p>
      {teste.linhas.length > 0 ? <ul className="arq-rows">{teste.linhas.map(l => <LinhaDeMes key={l.chave} linha={l} teste />)}</ul> : null}
    </section>
  )
}
