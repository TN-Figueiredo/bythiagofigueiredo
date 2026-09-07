// Isomórfico: lido por Server Components, por client components (C3) e pelos
// crons. MUST NOT importar nada de runtime — só `import type`. É o que permite
// que o card do CMS e o popup do OAuth compartilhem exatamente as mesmas
// frases sem arrastar `node:crypto` para o bundle do cliente.
import type { OauthErrorCode } from '@/lib/oauth/errors'

export type { OauthErrorCode }

/**
 * Verbo do call-to-action do alerta de token, fixado POR COMMIT.
 * C2: 'paste a new token' (a UI de OAuth só existe em C3).
 * C3: 'reconnect' — trocado no MESMO commit que troca a asserção de §6.
 * Único consumidor: `deliverTokenAlert` (src/lib/instagram/token.ts).
 */
export const RECONNECT_CTA = 'paste a new token'

export type TokenKind = 'transient' | 'expired' | 'revoked' | 'invalid'

export function kindFrom(row: { token_error?: string | null }): TokenKind {
  const reason = row.token_error
  if (reason == null) return 'transient'
  if (reason === 'expired') return 'expired'
  if (reason === 'deauthorized' || reason === 'data_deletion_requested') return 'revoked'
  return 'invalid'
}

// `satisfies` dá exaustividade em typecheck: um código novo em OauthErrorCode
// sem entrada aqui quebra o build, nunca vira `undefined` na janela do dono.
const OAUTH_ERROR_TEXT = {
  not_configured: "Instagram OAuth isn't configured yet — see the setup runbook",
  vault_unavailable: "Token storage isn't configured — see the Instagram setup runbook",
  account_not_found: 'This Instagram account no longer exists — reload the page',
  // Frase SECA. O call-site anexa ' (code N)' quando o corpo de erro plano da
  // Meta traz `code`; o `error_message` da Meta NUNCA chega ao popup (§3.1).
  exchange_failed: 'Instagram rejected the authorization',
  origin_not_allowed: "This domain isn't allowed for Instagram authorization",
  invalid_state:
    'Invalid or expired authorization (it expires after 30 minutes) — start again from the CMS',
  session_changed: 'Session changed during authorization — sign in and try again',
  permission_denied: 'Instagram did not grant the required permission',
  cancelled: 'Authorization cancelled',
  identity_invalid: 'Instagram returned an unexpected account identity',
  write_failed: "Couldn't save the connection — try again in a minute",
  cross_origin: 'This page must be opened from the CMS — go back and click Connect again',
  browser_changed:
    'Authorization finished in a different browser. Open the CMS in Safari or Chrome (not inside another app) and try again.',
} satisfies Record<OauthErrorCode, string>

export function oauthErrorText(code: OauthErrorCode): string {
  return OAUTH_ERROR_TEXT[code]
}

export function previewDisabledText(): string {
  return 'Instagram authorization is disabled on preview deployments — use production.'
}
