/** A5 · E5a, Tarefa 3: o quadrado de direção (▲ ＝ ▼) com o percentual e a palavra por extenso. Sem estado. */
import { direcaoExibida, type SimboloDeDirecao } from '@/lib/youtube/observatorio/medidas-telas/direcao-exibida'
import './medidas.css'

export const PALAVRA_DA_DIRECAO: Record<SimboloDeDirecao, string> = { sobe: 'subindo', estavel: 'estável', desce: 'descendo' }
const GLIFO: Record<SimboloDeDirecao, string> = { sobe: '▲', estavel: '＝', desce: '▼' }

export function Direcao({ variante, simbolo, pct, palavraVisivel = false }: {
  variante: 'cheio' | 'contorno'; simbolo: SimboloDeDirecao; pct: number; palavraVisivel?: boolean
}) {
  return (
    <span className={`obs-md-dir ${variante} ${simbolo}`}>
      <span className="obs-md-dir-q" aria-hidden="true">{GLIFO[simbolo]}</span>
      <b className="obs-md-dir-n">{direcaoExibida(pct / 100).texto}</b>
      <span className={palavraVisivel ? 'obs-md-dir-w' : 'obs-md-sr'}>{PALAVRA_DA_DIRECAO[simbolo]}</span>
    </span>
  )
}
