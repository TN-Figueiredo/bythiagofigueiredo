import { lerResultadoV2 } from './ab-types'

export const ROTULO_V2_NO_COWORK = 'encerrado pela regra nova; desfecho no Cowork'
export const ROTULO_V2_PENDENTE = 'encerrado pela regra nova; desfecho pendente'
export const ROTULO_V2_ILEGIVEL = 'encerrado pela regra nova; desfecho ilegível'

/** Rótulo da lista do concluído por regra v2 (S8-F4 T11c). Outro motivo: null. Sem desfecho gravado é "pendente", nunca "sem vencedor". */
export function rotuloDeConcluido(completedReason: string | null, resultMetadata: unknown): string | null {
  if (completedReason !== 'regra_v2') return null
  const lido = lerResultadoV2(resultMetadata)
  if (lido.estado === 'ilegivel') return ROTULO_V2_ILEGIVEL
  if (lido.estado === 'ok' && lido.v2.desfecho) return ROTULO_V2_NO_COWORK
  return ROTULO_V2_PENDENTE
}
