// Helpers compartilhados pelos passos que falam com a Reporting API (1A jobs e 1C relatórios).
import { describeCronCause } from '@/lib/cron/failure-note'
import { NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import { REPORT_TYPES_ENABLED, ReportingHttpError } from '@/lib/youtube/reporting/types'
import { registrarTentativa } from './attempts'
import type { StepCtx, Tentativa } from './types'

export const HABILITADOS: readonly string[] = REPORT_TYPES_ENABLED

export const statusHttp = (e: unknown): number | null => (e instanceof ReportingHttpError ? e.status : null)

/** Texto curto para `error`: status e reason, nunca o corpo. */
export function descreverErro(e: unknown): string {
  if (e instanceof ReportingHttpError) return `HTTP ${e.status}${e.reason ? ` ${e.reason}` : ''}`
  return describeCronCause(e)
}

/**
 * Simplificação de L1a (sem `collection_status`): token revogado ou conexão ausente só pula o canal,
 * com tentativa `sem_conexao`, sem aviso e sem falha crítica. Devolve true quando tratou o erro;
 * false para qualquer outro erro (quem chama decide, normalmente falha crítica).
 */
export async function registrarSemConexao(
  ctx: Pick<StepCtx, 'supabase' | 'falhas' | 'tentativas'>,
  base: Omit<Tentativa, 'outcome' | 'http_status' | 'error'>,
  e: unknown,
): Promise<boolean> {
  if (!(e instanceof TokenRevokedError || e instanceof NoActiveConnectionError)) return false
  await registrarTentativa(ctx, { ...base, outcome: 'sem_conexao' })
  return true
}
