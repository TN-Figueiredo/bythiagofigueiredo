/** A5 · E5a, lote rápido: a dica do VALOR da Direção da linha, com os dois totais de views que o percentual compara (texto do Logan, escolhido pela Hanna). */
import type { CanaisRow } from './view-model'
import { Tip } from './cells'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { direcaoExibida } from '@/lib/youtube/observatorio/medidas-telas/direcao-exibida'
const JANELA = MEASURE_RULES.direction.windowDays

export function DirecaoDica({ r }: { r: CanaisRow }) {
  const d = r.direcao, n = r.direcaoNumeros
  if (d.tipo !== 'medido' || !n) return null
  const pct = Math.abs(direcaoExibida(d.pct / 100).pct)
  const fecho = d.simbolo === 'sobe' ? `Subiu ${pct}%.` : d.simbolo === 'desce' ? `Caiu ${pct}%.` : 'Quase igual.'
  return <Tip label="Como o percentual desta linha foi calculado">Views dos últimos {JANELA} dias: {n.recente}. Dos {JANELA} anteriores: {n.anterior}. {fecho}</Tip>
}
