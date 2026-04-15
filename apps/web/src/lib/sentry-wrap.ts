// Sprint 4 Epic 9 T71 — tiny helper that forwards unexpected server-action
// errors to Sentry with standardized tags. No-op when Sentry isn't initialized
// (dev/test or missing DSN), so tests don't need env vars and happy paths
// aren't polluted with mock-setup noise.
//
// Intentional non-goals:
//   * Does NOT swallow the error — callers keep full control of flow (redirect,
//     return result object, rethrow, etc).
//   * Does NOT capture validation / rate-limit / expected domain errors.
//     Wire it only into `catch` blocks for thrown / unexpected failures.

import * as Sentry from '@sentry/nextjs'

export interface ServerActionErrorContext {
  /** Short identifier of the action — becomes the `action` tag in Sentry. */
  action: string
  /** Optional site scoping so multi-ring filtering works. */
  site_id?: string
  /** Any extra primitive/string context — passed through as tags. */
  [key: string]: unknown
}

/**
 * Capture an error from a server action. Safe to call when Sentry hasn't been
 * initialized (e.g., DSN missing in dev/test) — it becomes a no-op.
 *
 * @example
 *   try {
 *     await supabase.rpc('accept_invitation_atomic', { p_token: token })
 *   } catch (err) {
 *     captureServerActionError(err, { action: 'accept_invitation', site_id })
 *     redirect(`/signup/invite/${token}?error=rpc_failed`)
 *   }
 */
export function captureServerActionError(
  err: unknown,
  ctx: ServerActionErrorContext,
): void {
  try {
    // `Sentry.getClient()` returns undefined until `Sentry.init()` runs. That
    // is our only-init-when-DSN-set signal — no manual flag needed.
    const client = Sentry.getClient?.()
    if (!client) return

    const tags: Record<string, string> = {}
    for (const [k, v] of Object.entries(ctx)) {
      if (v === undefined || v === null) continue
      // Sentry tags must be primitive. Stringify non-strings defensively but
      // drop large values to avoid runaway payloads.
      const str = typeof v === 'string' ? v : String(v)
      if (str.length <= 200) tags[k] = str
    }

    Sentry.captureException(err, { tags })
  } catch {
    // Never let Sentry instrumentation break the caller.
  }
}
