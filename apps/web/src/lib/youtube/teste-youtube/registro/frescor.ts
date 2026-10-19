import { periodoMin, RODADA } from '@/lib/youtube/watch/rodada'
import { DISPAROS_DE_ATRASO, MARGEM_FRESCOR_MS, PERIODO_DISPARO_MS } from './constantes'

const MIN_MS = 60_000

/**
 * Soma nominal do frescor (§6.2 item 4): o intervalo entre rodadas de um alvo de 4 por dia, o sorteio das duas pontas
 * (+- `sorteioMin` cada), um disparo da coleta, um do registrador e `DISPAROS_DE_ATRASO` disparos de atraso tolerado. 8 h 00.
 */
export function somaFrescorNominalMs(): number {
  return periodoMin(4) * MIN_MS + 2 * RODADA.sorteioMin * MIN_MS + PERIODO_DISPARO_MS + PERIODO_DISPARO_MS + DISPAROS_DE_ATRASO * PERIODO_DISPARO_MS
}

/** Passado deste tempo sem rodada nova, o alvo ativo ganha uma avaliação `sem_rodada_nova`. 8 h 40. */
export const FRESCOR_MAX_MS: number = somaFrescorNominalMs() + MARGEM_FRESCOR_MS
