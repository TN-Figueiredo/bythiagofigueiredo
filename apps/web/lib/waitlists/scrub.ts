import { scrubPiiString } from '../../src/lib/sentry-pii'

/**
 * Redact PII from a free-text string before it is logged or attached to Sentry.
 * Delegates to the canonical project scrubber (`scrubPiiString`, also wired as the
 * Sentry `beforeSend`) so this never drifts from it and inherits its full coverage —
 * email, IPv4/IPv6, plus Brazilian CPF and phone (WL-CQ-1).
 */
export function redactMessage(s: string): string {
  return scrubPiiString(s ?? '')
}

/**
 * Strip the direct-PII keys (`email`/`ip`/`user_agent`) from a context object before it
 * is attached to a log line or Sentry breadcrumb (Task 0b). Returns a shallow copy with
 * those keys removed so the caller can spread non-PII context without leaking the rest.
 */
export function scrub<T extends Record<string, unknown>>(ctx: T): Omit<T, 'email' | 'ip' | 'user_agent'> {
  // Rest-spread excludes the three PII keys; the destructured bindings are intentionally unused.
  const { email: _email, ip: _ip, user_agent: _ua, ...rest } = ctx
  return rest
}
