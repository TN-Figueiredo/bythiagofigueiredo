import type { OauthErrorCode } from './errors'

/**
 * The HTML a popup renders when an OAuth flow finishes.
 *
 * Extracted in commit B from `api/social/oauth/[provider]/callback/route.ts:48-74`,
 * which hard-coded status 200, had no CSP nonce, no back link and auto-closed
 * even with no opener (leaving the user on a blank page with no way back).
 */

/** Only two shapes may ride along in the postMessage payload. */
export type OauthResultExtra = { status: 'handle_mismatch' } | { code: OauthErrorCode }

export interface IOauthResultHtmlOptions {
  /** `'social-oauth-result'` or `'instagram-oauth-result'`. */
  messageType: string
  provider: string
  success: boolean
  /** Always a human sentence — never a machine string (spec §2). */
  error?: string
  extra?: OauthResultExtra
  /** Site-relative path; must be in the allow-list below. */
  backHref: string
  targetOrigin: string
  /** `(await headers()).get('x-nonce')` — `src/middleware.ts:169`. */
  nonce: string
  /** Defaults to 200. Transport failures pass 400/401/403/404/503. */
  status?: number
  headers?: { 'Cache-Control'?: string; 'Referrer-Policy'?: string }
}

/**
 * Allow-list of back destinations AND their labels. A value outside it throws:
 * the guard is written as an allow-list and has to behave like one.
 */
const BACK_HREF_LABELS: Record<string, string> = {
  '/cms/settings/instagram': 'Back to Instagram settings',
  '/cms/social/accounts': 'Back to social accounts',
  '/cms/login?next=/cms/settings/instagram': 'Sign in and try again',
}

/**
 * Runtime mirror of `OauthErrorCode`. Typed as `Record<OauthErrorCode, true>`
 * so TypeScript rejects both a missing key and an unknown one — the union in
 * `errors.ts` and this object cannot drift.
 */
const OAUTH_ERROR_CODE_SET: Record<OauthErrorCode, true> = {
  not_configured: true,
  vault_unavailable: true,
  account_not_found: true,
  exchange_failed: true,
  origin_not_allowed: true,
  invalid_state: true,
  session_changed: true,
  permission_denied: true,
  cancelled: true,
  identity_invalid: true,
  write_failed: true,
  cross_origin: true,
  browser_changed: true,
}

/** Note: does NOT escape `'` — every attribute below uses double quotes. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function assertRelativeHref(href: string): void {
  // `/\evil.com` starts with `/` and not with `//`, and every modern browser
  // normalises `\` to `/` while parsing — it must be refused explicitly.
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/\\')) {
    throw new Error(`oauthResultHtml: backHref must be a site-relative path (got ${href})`)
  }
}

function assertExtra(extra: OauthResultExtra | undefined): void {
  if (extra === undefined) return
  const keys = Object.keys(extra)
  if (keys.length !== 1) {
    throw new Error(`oauthResultHtml: extra must carry exactly one key (got ${keys.join(',')})`)
  }
  const [key] = keys
  if (key === 'status') {
    const value = (extra as { status: string }).status
    if (value !== 'handle_mismatch') {
      throw new Error(`oauthResultHtml: unknown extra.status (${value})`)
    }
    return
  }
  if (key === 'code') {
    const value = (extra as { code: string }).code
    if (!Object.prototype.hasOwnProperty.call(OAUTH_ERROR_CODE_SET, value)) {
      throw new Error(`oauthResultHtml: unknown extra.code (${value})`)
    }
    return
  }
  throw new Error(`oauthResultHtml: unknown extra key (${String(key)})`)
}

export function oauthResultHtml(opts: IOauthResultHtmlOptions): Response {
  const {
    messageType,
    provider,
    success,
    error,
    extra,
    backHref,
    targetOrigin,
    nonce,
    status = 200,
    headers,
  } = opts

  assertRelativeHref(backHref)
  const backLabel = BACK_HREF_LABELS[backHref]
  if (backLabel === undefined) {
    throw new Error(`oauthResultHtml: backHref is not allow-listed (${backHref})`)
  }
  assertExtra(extra)

  // `extra` is spread at the TOP LEVEL of the message on purpose — a consumer
  // reads `event.data.code` / `event.data.status` directly, never nested.
  const payload = JSON.stringify({
    type: messageType,
    success,
    provider,
    ...(error !== undefined ? { error } : {}),
    ...extra,
  })
  // Escape `</` so nothing in the payload can close the script element.
  const safePayload = payload.replace(/<\//g, '<\\/')
  const safeTargetOrigin = JSON.stringify(targetOrigin).replace(/<\//g, '<\\/')
  const safeError = escapeHtml(error ?? 'unknown')

  const html = `<!DOCTYPE html>
<html><head><title>OAuth Complete</title></head>
<body>
<p>${success ? 'Connected! This window will close.' : `Error: ${safeError}`}</p>
<p><a href="${escapeHtml(backHref)}">${escapeHtml(backLabel)}</a></p>
<script nonce="${escapeHtml(nonce)}">
  try { window.opener.postMessage(${safePayload}, ${safeTargetOrigin}) } catch {}
  if (window.opener != null) setTimeout(() => window.close(), 1500)
</script>
</body></html>`

  const responseHeaders = new Headers({ 'Content-Type': 'text/html; charset=utf-8' })
  const cacheControl = headers?.['Cache-Control']
  if (cacheControl !== undefined) responseHeaders.set('Cache-Control', cacheControl)
  const referrerPolicy = headers?.['Referrer-Policy']
  if (referrerPolicy !== undefined) responseHeaders.set('Referrer-Policy', referrerPolicy)

  return new Response(html, { status, headers: responseHeaders })
}
