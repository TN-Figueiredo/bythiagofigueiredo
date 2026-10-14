/** A5 · E5a, Tarefa 3: a régua de direção. `role="img"` com o texto por extenso; fora da escala o texto diz o valor verdadeiro. */
import { posicaoNaRegua, direcaoExibida } from '@/lib/youtube/observatorio/medidas-telas/direcao-exibida'
import './medidas.css'

export function ReguaDirecao({ limite, pct, foraDaEscala, exato }: { limite: 50 | 60; pct: number; foraDaEscala: 'acima' | 'abaixo' | null; exato?: number }) {
  const { texto, simbolo } = direcaoExibida(pct / 100)
  const fracao = posicaoNaRegua(pct, limite, exato).fracao
  const faixa = (v: number) => posicaoNaRegua(v, limite).fracao * 100
  const zero = 50
  const fim = fracao * 100
  const esq = Math.min(zero, fim), larg = Math.max(2.5, Math.abs(fim - zero))
  const palavra = limite === 50 ? 'Régua de menos 50% a mais 50%' : 'Régua de menos 60% a mais 60%'
  const aria = `${palavra}: ${texto.replace('−', 'menos ')}${foraDaEscala ? ', passa do limite da régua' : ''}`
  return (
    <span className={`obs-md-rg ${simbolo}`} role="img" aria-label={aria}>
      <i className="obs-md-rg-b" aria-hidden="true" style={{ left: `${faixa(-10)}%`, width: `${faixa(10) - faixa(-10)}%` }} />
      <i className="obs-md-rg-0" aria-hidden="true" />
      <i className="obs-md-rg-v" aria-hidden="true" style={{ left: `${esq}%`, width: `${larg}%` }} />
      {foraDaEscala ? <i className={`obs-md-rg-clip ${foraDaEscala}`} aria-hidden="true" /> : null}
    </span>
  )
}
