'use client'
/**
 * O ⓘ do bloco "Estourou e parou" (G-4 do Gio): um `<details>` que também fecha com Esc. Módulo `'use client'` à parte porque o bloco é
 * de servidor; o conteúdo é estático e não importa nada do motor.
 */
import { useRef } from 'react'
import { NOME_DA_LEITURA, pct, REGRAS_DA_LEITURA } from '../_chrome/medidas/estourou-model'

const R = REGRAS_DA_LEITURA

/** O ⓘ: um `<details>` (sem JavaScript), com o método. Texto do NOTAS 14, linha "ⓘ (corpo)". */
export function EstourouInfo() {
  const ref = useRef<HTMLDetailsElement>(null)
  const base = `Base: só vídeos com ${R.minDias} dias ou mais e com a medida dos 30 primeiros dias. O normal do canal é a mediana dos vídeos longos (Shorts à parte) que têm essa medida; o canal precisa de ${R.minVideos} deles.`
  return (
    <details
      className="lm-info"
      ref={ref}
      onKeyDown={e => {
        // G-4: Esc fecha o painel e devolve o foco ao botão do ⓘ
        if (e.key === 'Escape' && ref.current?.open) {
          e.stopPropagation()
          ref.current.open = false
          ref.current.querySelector('summary')?.focus()
        }
      }}
    >
      <summary aria-label={`Como a leitura ${NOME_DA_LEITURA} é calculada`}>
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="8" cy="8" r="6.5" /><path d="M8 7.2v4M8 4.8v.1" /></svg>
      </summary>
      <div className="lm-info-c">
        <h3>Como a leitura é calculada</h3>
        <p>Cálculo do Observatório sobre dados públicos do YouTube. É um indício, não uma medição.</p>
        <ul>
          <li>{base}</li>
          <li><b>Muitas views cedo:</b> as views dos 30 primeiros dias são {R.outlierMin}× o normal do canal ou mais.</li>
          <li><b>Quase nada depois:</b> a parte das views que veio depois do dia 30 é no máximo metade do normal do canal, e o vídeo ganhou no máximo {pct(R.stillMax)} das views dos 30 primeiros dias nos últimos {R.stillDias} dias. As duas precisam bater juntas.</li>
          <li><b>Pouca reação:</b> (curtidas + comentários) ÷ views aos 30 dias é no máximo metade do normal do canal. Sem curtidas e sem comentários visíveis, a leitura não é dada.</li>
          <li>Igual ao limite bate. Se só 2 dos 3 sinais batem, não é o caso. Ao vivo e estreia ficam de fora.</li>
          <li>Os limites são nossos, valem para este canal e são só um ponto de partida: vamos conferi-los contra vídeos reais.</li>
        </ul>
      </div>
    </details>
  )
}
