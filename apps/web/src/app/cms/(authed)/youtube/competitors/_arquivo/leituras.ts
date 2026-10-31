import 'server-only'
import { cache } from 'react'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerCanaisRemovidos } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { lerPendencias, type LeituraPendencias } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

/**
 * M9b conserto 1 (item 8): UMA leitura por requisição e por site, dividida entre o chrome (a marca), a página do Arquivo (o bloco) e a peça 7 (a fila).
 * React `cache()` guarda pela identidade do argumento: `siteId` é string, então duas chamadas com o mesmo site dividem a mesma promessa.
 * Nenhuma das duas lança. As ações do servidor (`apagarDoArquivoAction`) NÃO usam estas: lêem de novo, porque decidem sobre o que o banco diz agora.
 */
export const listaDosRemovidos = cache((siteId: string) => lerCanaisRemovidos(getSupabaseServiceClient(), siteId))

/** 42883 = função inexistente no Postgres; PGRST202 = o PostgREST não a achou. A migration da M3b a cria; em produção pode vir depois do código. */
const FUNCAO_AUSENTE = new Set(['42883', 'PGRST202'])

/** `ok: false` = a leitura falhou (erro, lançamento, função ausente ou forma inválida): quem usa mostra "não medido", nunca "nada pendente". */
export type PendenciasLidas = { erro: true } | { erro: false; leitura: LeituraPendencias }

export const pendenciasDoDono = cache(async (siteId: string): Promise<PendenciasLidas> => {
  try {
    const { data, error } = await getSupabaseServiceClient().rpc('obs_archive_owner_pending', { p_site: siteId })
    if (error) {
      Sentry.captureMessage('obs_archive_owner_pending: ' + error.code, FUNCAO_AUSENTE.has(error.code) ? 'warning' : 'error')
      return { erro: true }
    }
    return { erro: false, leitura: lerPendencias(data) }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'observatorio', step: 'peca7-pendencias' } })
    return { erro: true }
  }
})
