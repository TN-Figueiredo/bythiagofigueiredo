import { TokenRevokedError } from '@/lib/social/token-refresh'

/**
 * A "nota" que fica escrita em `cron_health.last_error` / `cron_runs.error` quando um cron
 * do YouTube/social fica vermelho: UMA linha legível — qual canal e o que falhou — sem token,
 * sem segredo e sem o texto cru do Postgres ou do corpo de resposta do Google (o detalhe
 * completo vai ao Sentry, por quem chama).
 */

/** Causa em uma linha, derivada do TIPO/forma do erro, nunca copiando a mensagem. */
export function describeCronCause(err: unknown): string {
  if (err instanceof TokenRevokedError) return 'token revoked by Google — the channel must be reconnected'
  const message = err instanceof Error ? err.message : String(err)

  // ensureFreshToken: "Could not read/count the youtube connection ..." = leitura no banco.
  if (/^Could not (read|count) the \w+ connections?/.test(message)) return 'database error reading the connection'
  if (/connection disappeared/i.test(message)) return 'connection disappeared during a concurrent refresh'
  const refresh = message.match(/token refresh failed(?: for \w+)? \((\d{3})\)/i)
  if (refresh) return `Google token refresh failed (HTTP ${refresh[1]})`
  if (/timeout|timed out|aborted/i.test(message) && !/statement timeout/i.test(message)) return 'request timed out'
  if (/statement timeout|relation |postgres|pgrst|violates|duplicate key/i.test(message)) return 'database error'
  return `unexpected error (${err instanceof Error ? err.name : 'unknown'})`
}

/** Causa para uma resposta HTTP não-ok da API do YouTube/Analytics. */
export function describeHttpCause(status: number): string {
  if (status >= 500) return `YouTube API ${status} (server error on Google's side)`
  if (status === 401) return 'YouTube API 401 — token rejected, the channel may need reconnecting'
  if (status === 403) return 'YouTube API 403 — permission denied or quota exceeded'
  if (status === 429) return 'YouTube API 429 — rate limited'
  return `YouTube API HTTP ${status}`
}

/** `Nome do canal (UC…): causa` — a unidade de nota de todos os crons. */
export function channelNote(label: string, cause: string): string {
  return `${label}: ${cause}`
}
