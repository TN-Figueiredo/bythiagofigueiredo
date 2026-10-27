import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerPendencias, pendenciasParaTela, type PendenciasDaTela } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'
import type { PermissoesDoSite } from '../_chrome/permissoes'

/** 42883 = função inexistente no Postgres; PGRST202 = o PostgREST não a achou. A migration da M3b a cria; em produção pode vir depois do código. */
const FUNCAO_AUSENTE = new Set(['42883', 'PGRST202'])

/**
 * Peça 7, parte de leitura. Depois da guarda de edição (`permissoesDoSite`), nunca antes: sem edição o cliente de serviço nem é criado.
 * Nunca devolve "zero" no lugar de uma falha: erro, lançamento, função ausente e forma inválida viram `nao_medido`.
 */
export async function lerPendenciasDaFila(siteId: string, perm: PermissoesDoSite, agora: Date): Promise<PendenciasDaTela | null> {
  if (!perm.podeEditar) return null
  if (process.env.OBS_ARQUIVO !== 'on') return null
  try {
    const { data, error } = await getSupabaseServiceClient().rpc('obs_archive_owner_pending', { p_site: siteId })
    if (error) {
      Sentry.captureMessage('obs_archive_owner_pending: ' + error.code, FUNCAO_AUSENTE.has(error.code) ? 'warning' : 'error')
      return { estado: 'nao_medido' }
    }
    return pendenciasParaTela(lerPendencias(data), { podeVerComandos: perm.canUnlock, agora })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'observatorio', step: 'peca7-pendencias' } })
    return { estado: 'nao_medido' }
  }
}
