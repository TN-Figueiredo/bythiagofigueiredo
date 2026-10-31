import 'server-only'
import { pendenciasDoBloco, type PendenciasDoBloco } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { pendenciasDoDono } from './leituras'

/** M9b T7: o que falta a cada canal removido (item `canal:` das pendências do dono). Nunca lança; qualquer falha = `{ ok: false }` (a linha diz "não medido"). Usa a leitura única (`leituras.ts`). */
export async function lerPendenciasDosCanais(siteId: string): Promise<PendenciasDoBloco> {
  const r = await pendenciasDoDono(siteId)
  return r.erro ? { ok: false } : pendenciasDoBloco(r.leitura)
}
