import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { getSupabaseServiceClient } from '@/lib/supabase/service'
import { pendenciasDoBloco, type PendenciasDoBloco } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { lerPendencias } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

/** M9b T7: o que falta a cada canal removido (item `canal:` das pendências do dono). Nunca lança; qualquer falha = `{ ok: false }` (a linha diz "não medido"). */
export async function lerPendenciasDosCanais(sb: ReturnType<typeof getSupabaseServiceClient>, siteId: string): Promise<PendenciasDoBloco> {
  try {
    const { data, error } = await sb.rpc('obs_archive_owner_pending', { p_site: siteId })
    if (error) { Sentry.captureMessage('obs_archive_owner_pending (bloco de canais): ' + error.code, 'error'); return { ok: false } }
    return pendenciasDoBloco(lerPendencias(data))
  } catch (e) {
    Sentry.captureException(e)
    return { ok: false }
  }
}
