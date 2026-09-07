/**
 * Canonical machine codes for every OAuth failure the user can be shown.
 *
 * TYPE-ONLY MODULE ON PURPOSE — no function, no const, no runtime import.
 * `src/lib/instagram/status-text.ts` (C2) re-exports this union and declares
 * `oauthErrorText(code) satisfies Record<OauthErrorCode, string>`; keeping this
 * file free of runtime code is what lets `status-text.ts` stay isomorphic and
 * be imported from a `'use client'` component.
 *
 * The user-facing sentence for each code lives in `oauthErrorText` (C2) — the
 * canonical map is spec §3.1.
 */
export type OauthErrorCode =
  | 'not_configured'
  | 'vault_unavailable'
  | 'account_not_found'
  | 'exchange_failed'
  | 'origin_not_allowed'
  | 'invalid_state'
  | 'session_changed'
  | 'permission_denied'
  | 'cancelled'
  | 'identity_invalid'
  | 'write_failed'
  | 'cross_origin'
  | 'browser_changed'
