'use client'
/**
 * "Leitura rápida" (spec 18.3): o que a tabela diz, sem ler a tabela. Calculada dos mesmos números, sem IA (o texto vem do modelo do par).
 * "É maior", nunca "ganha". Lista vazia: o bloco não existe. O símbolo (▲ ＝ e a pastilha de hachura) é decoração; a frase já diz tudo.
 */
import { useId, type CSSProperties } from 'react'
import { corVar } from './lados'
import type { CorLado, ParView } from './par-model'

export function LeituraRapida({ itens, cores }: { itens: ParView['leitura']; cores: [CorLado, CorLado] }) {
  const titulo = useId()
  if (!itens.length) return null
  return (
    <div className="cp-lr" role="group" aria-labelledby={titulo}>
      <h3 id={titulo}>Leitura rápida</h3>
      <ul>
        {itens.map((i, k) => (
          <li key={k}>
            {i.simbolo === 'maior' && i.lado != null ? <span className="lr-s" style={{ '--c': corVar(cores[i.lado]) } as CSSProperties} aria-hidden="true">▲</span>
              : i.simbolo === 'igual' ? <span className="lr-s eq" aria-hidden="true">＝</span>
              : <span className="lr-s nmk" aria-hidden="true"><i className="obs-ch-nm" /></span>}
            <span className="lr-t">{i.texto}</span>
          </li>
        ))}
      </ul>
      <p className="lr-n">Calculada dos mesmos números da tabela, sem IA.</p>
    </div>
  )
}
