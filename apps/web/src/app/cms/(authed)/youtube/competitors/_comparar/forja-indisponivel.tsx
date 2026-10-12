'use client'
/**
 * O cartão "Leitura da forja" da comparação (spec 18.8): NA FASE A só o estado "ainda não disponível", com ou sem canal próprio no par. A
 * "leitura de comparação" é uma leitura nova da forja (L4) que não existe no produto: o cartão não tem etapas, leitura de exemplo nem ação.
 * O botão é apagado (spec 17.4): `aria-disabled="true"` (focável), contorno tracejado, texto `--muted`, sem mudança no hover, sem `onClick`; o
 * porquê é um parágrafo ligado por `aria-describedby`. Texto com canal próprio: o do mockup (comparar.js, `forjaCard`, ramo dono), que
 * confere com 17.4. O porquê é o mesmo com e sem canal próprio (D-B.1 itens 2 e 3 do design da 11c; sem segundo parágrafo). Ele não cita a coleta diária (a mesma tela diz que ela já roda) nem promete data. Nenhuma server action.
 */
import { useId } from 'react'
import type { ParView } from './par-model'

const AINDA_NAO_DA = 'Ainda não dá: a forja não sabe escrever uma leitura que compare dois canais.'
const FORJA = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4 15h11l3-5H7zM9 15v4M14 15v4M6 19h11" /></svg>

export function ForjaIndisponivel({ par }: { par: ParView }) {
  const titulo = useId(), porque = useId()
  const dono = par.a.own || par.b.own
  return (
    <section className="cp-fj off" role="region" aria-labelledby={titulo}>
      <h3><span id={titulo}>Leitura da forja</span><span className="cp-fj-off">{dono ? 'ainda não disponível para o seu canal' : 'ainda não disponível'}</span></h3>
      <p className="cp-fj-what">
        {dono
          ? 'A leitura desta comparação seria sobre os números dos dois canais lado a lado, com as mesmas cautelas das outras leituras: só diz o que está nos números, sem afirmar causa.'
          : `A forja leria os números públicos de ${par.a.name} e de ${par.b.name} e escreveria 3 ou 4 frases sobre o que os números mostram, sem afirmar causa.`}
      </p>
      <div className="cp-fj-ask">
        <button type="button" className="cp-fj-btn" aria-disabled="true" aria-describedby={porque}>{FORJA}Pedir leitura desta comparação à forja</button>
        <p id={porque}>{AINDA_NAO_DA}</p>
      </div>
    </section>
  )
}
