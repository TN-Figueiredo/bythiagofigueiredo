/**
 * Redação de segredos para telemetria (spec §4, commit A2).
 *
 * Módulo-folha: NENHUM import e NENHUM acesso a `process.env`. Quem conhece os
 * segredos estáticos (`INSTAGRAM_APP_SECRET`, `META_APP_SECRET`,
 * `SOCIAL_MASTER_KEY`) os registra por `registerSecretLiteral` — isso acontece
 * em `sentry.server.config.ts` / `sentry.edge.config.ts`, no commit C2.
 *
 * MUST: a redação de query é dirigida por NOME DE PARÂMETRO, não pela forma do
 * valor. O token longo da Meta viaja em query string (`api-client.ts:56,76,83`)
 * e sobe ao Sentry pelo breadcrumb undici (`data.url`) e, com
 * `beforeSendTransaction` (C2), pelo `description`/`data` de um span
 * `http.client`. O prefixo `IG…` é apenas a SEGUNDA rede.
 */

const REDACTED = '[REDACTED]'

/** `?access_token=…`, `&code=…`, e a forma nua ancorada em início/espaço. */
const QUERY_PARAM_RE =
  /(^|[?&\s])((?:access_token|client_secret|code|signed_request|state|rebind)=)[^&\s]+/gi

/** `"access_token":"…"`, `client_secret: …`, `signed_request = …`. */
const ASSIGNMENT_RE =
  /("?(?:access_token|client_secret|signed_request)"?\s*[:=]\s*"?)([^"'&\s,}]+)/gi

/** 2ª rede: token com o prefixo `IG` fora de query string. */
const IG_TOKEN_RE = /\bIG[A-Za-z0-9_-]{16,}/g

const seenLiterals = new Set<string>()
const literalPatterns: RegExp[] = []

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Registra um segredo estático. No-op abaixo de 16 caracteres (evita transformar
 * uma palavra comum em padrão global), escapa metacaracteres e deduplica.
 * O literal só é usado em `String.prototype.replace` — nunca é logado nem comparado.
 */
export function registerSecretLiteral(value?: string): void {
  if (!value || value.length < 16) return
  if (seenLiterals.has(value)) return
  seenLiterals.add(value)
  literalPatterns.push(new RegExp(escapeRegExp(value), 'g'))
}

/** Redige segredos conhecidos de uma string arbitrária. Nunca lança. */
export function redactSecrets(input: string): string {
  let out = input
    .replace(QUERY_PARAM_RE, `$1$2${REDACTED}`)
    .replace(ASSIGNMENT_RE, `$1${REDACTED}`)
    .replace(IG_TOKEN_RE, REDACTED)
  for (const pattern of literalPatterns) {
    pattern.lastIndex = 0
    out = out.replace(pattern, REDACTED)
  }
  return out
}
