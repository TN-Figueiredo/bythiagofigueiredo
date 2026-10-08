// Helpers compartilhados pelos passos que falam com a Reporting API (1A jobs e 1C relatórios).
import { describeCronCause } from '@/lib/cron/failure-note'
import { REPORT_TYPES_ENABLED, ReportingHttpError } from '@/lib/youtube/reporting/types'

export const HABILITADOS: readonly string[] = REPORT_TYPES_ENABLED

export const statusHttp = (e: unknown): number | null => (e instanceof ReportingHttpError ? e.status : null)

/** Texto curto para `error`: status e reason, nunca o corpo. */
export function descreverErro(e: unknown): string {
  if (e instanceof ReportingHttpError) return `HTTP ${e.status}${e.reason ? ` ${e.reason}` : ''}`
  return describeCronCause(e)
}
