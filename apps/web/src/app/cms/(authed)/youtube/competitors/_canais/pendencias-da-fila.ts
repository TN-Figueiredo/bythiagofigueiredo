import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerCanaisRemovidos } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { lerPendencias, pendenciasParaTela, type LeituraPendencias, type NomesDaFila, type PendenciasDaTela } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'
import type { PermissoesDoSite } from '../_chrome/permissoes'

/** 42883 = função inexistente no Postgres; PGRST202 = o PostgREST não a achou. A migration da M3b a cria; em produção pode vir depois do código. */
const FUNCAO_AUSENTE = new Set(['42883', 'PGRST202'])

/**
 * Peça 7, parte de leitura. Depois da guarda de edição (`permissoesDoSite`), nunca antes: sem edição o cliente de serviço nem é criado.
 * Nunca devolve "zero" no lugar de uma falha: erro, lançamento, função ausente e forma inválida viram `nao_medido`.
 */
export async function lerPendenciasDaFila(siteId: string, perm: PermissoesDoSite, agora: Date, nomes?: NomesDaFila): Promise<PendenciasDaTela | null> {
  if (!perm.podeEditar) return null
  if (process.env.OBS_ARQUIVO !== 'on') return null
  try {
    const { data, error } = await getSupabaseServiceClient().rpc('obs_archive_owner_pending', { p_site: siteId })
    if (error) {
      Sentry.captureMessage('obs_archive_owner_pending: ' + error.code, FUNCAO_AUSENTE.has(error.code) ? 'warning' : 'error')
      return { estado: 'nao_medido' }
    }
    const leitura = lerPendencias(data)
    return pendenciasParaTela(leitura, { podeVerComandos: perm.canUnlock, agora, nomes: await comNomesDosRemovidos(siteId, leitura, nomes) })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'observatorio', step: 'peca7-pendencias' } })
    return { estado: 'nao_medido' }
  }
}

/**
 * O item `canal` da fila é, por definição, um canal que já saiu de `competitor_channels`: o mapa de canais vivos da página não o acha. O nome que sobrevive é o
 * `name_at_removal` da lista de removidos (uma leitura, só quando algum canal da fila não tem nome vivo). Falha da leitura = sem nome extra (a tela cai no código).
 * Vídeo removido: a linha do vídeo foi apagada pela decisão e nada guarda o título; o item mostra o canal dono (dívida declarada no ledger da M5).
 */
async function comNomesDosRemovidos(siteId: string, l: LeituraPendencias, nomes?: NomesDaFila): Promise<NomesDaFila | undefined> {
  if (!l.ok) return nomes
  const faltam = l.itens.some(i => i.kind === 'canal' && i.channelRef && !nomes?.canais?.has(i.channelRef))
  if (!faltam) return nomes
  const removidos = await lerCanaisRemovidos(getSupabaseServiceClient(), siteId)
  return removidos.ok ? { ...nomes, canais: new Map([...removidos.lista.flatMap(r => (r.nome ? [[r.channel_ref, r.nome] as const] : [])), ...(nomes?.canais ?? [])]) } : nomes
}
