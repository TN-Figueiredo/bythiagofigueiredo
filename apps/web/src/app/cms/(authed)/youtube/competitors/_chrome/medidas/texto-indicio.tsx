/**
 * A5 · E5a, Tarefa 10a: o texto obrigatório de M10, no corpo, inteiro e frase por frase (mockup 14, decisão 7). Sem número e sem interpolação:
 * as frases são as de `TEXTO_M10`. A forma de cada linha diz o tipo da afirmação (dado, hipótese, o que ninguém de fora vê).
 */
import './medidas.css'
import { TEXTO_M10 } from '@/lib/youtube/observatorio/medidas-telas/texto-m10'

const SVG = { viewBox: '0 0 22 22', className: 'si', 'aria-hidden': true } as const

export function TextoIndicio() {
  return (
    <div className="lm-txt" role="note" aria-label={TEXTO_M10.titulo}>
      <p className="lm-txt-t">{TEXTO_M10.titulo}</p>
      <ul>
        <li>
          <svg {...SVG}><circle cx="11" cy="11" r="7.5" fill="currentColor" stroke="none" /></svg>
          <span className="k">O que vimos</span>
          <p className="f">{TEXTO_M10.oQueVimos}</p>
        </li>
        <li>
          <svg {...SVG}><circle cx="11" cy="11" r="8" strokeDasharray="3 3" /><path d="M8.6 8.8a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2.8-1.2 1.6M11 15.3v.1" /></svg>
          <span className="k">Hipótese nossa</span>
          <p className="f">{TEXTO_M10.hipoteseNossa}</p>
        </li>
        <li>
          <svg {...SVG}><circle cx="11" cy="11" r="8" /><path d="M5.6 16.4 16.4 5.6" /></svg>
          <span className="k">O que ninguém de fora vê</span>
          <p className="f">{TEXTO_M10.oQueNinguemDeForaVe}</p>
        </li>
      </ul>
    </div>
  )
}
