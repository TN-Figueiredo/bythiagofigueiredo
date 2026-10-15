/**
 * Quem está na conta (plano E5b, Tarefa 8, commit 8a; emenda 2: D-N1). Puro: só tipos.
 * Uma regra só para a divisão por origem e para o total do período. Por vídeo, a partir do último dia do período em que ele tem
 * cobertura e referência medida:
 *   - nenhum dia: FORA da conta (saiu do YouTube, ficou privado, o diário parou);
 *   - último dia anterior a `ate - DIAS_SEM_LEITURA`: PARADO, exigido só até esse último dia (os dias seguintes contam só os outros);
 *   - senão: exigido no período inteiro.
 * Num período de 7 dias a regra dos 8 dias nunca dispara (o último dia medido já está dentro dele).
 */
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { DiaYt } from './tipos'

/** O mesmo número de `DIAS_DE_ATRASO_ANTIGO` (`coleta/diario-step.ts:30`, que não é exportado; um teste lê o arquivo e compara). */
export const DIAS_SEM_LEITURA = 8

export interface NaConta {
  /** por vídeo na conta, o último dia em que ele é exigido (`ate` ou o último dia medido do parado); vídeo fora não aparece */
  exigidoAte: ReadonlyMap<string, DiaYt>
  fora: readonly string[]
  parados: readonly string[]
  /** o menor "último dia medido" entre os parados; nulo sem parados */
  paradosDesde: DiaYt | null
}

export function quemEstaNaConta(p: { ytIds: readonly string[]; de: DiaYt; ate: DiaYt; ultimoMedido(ytId: string): DiaYt | null }): NaConta {
  const corte = addDays(p.ate, -DIAS_SEM_LEITURA)
  const exigidoAte = new Map<string, DiaYt>()
  const fora: string[] = []
  const parados: string[] = []
  let paradosDesde: DiaYt | null = null
  for (const id of new Set(p.ytIds)) {
    const ultimo = p.ultimoMedido(id)
    if (ultimo == null || ultimo < p.de) { fora.push(id); continue }
    if (ultimo < corte) {
      parados.push(id)
      exigidoAte.set(id, ultimo)
      if (paradosDesde == null || ultimo < paradosDesde) paradosDesde = ultimo
      continue
    }
    exigidoAte.set(id, p.ate)
  }
  return { exigidoAte, fora, parados, paradosDesde }
}
