// Sprint 4 H1 — Sentry PII scrubber.
//
// LGPD + defensive hygiene: even though we've set `sendDefaultPii: false`,
// free-form error messages and breadcrumbs regularly contain email addresses
// (Supabase RPC errors, user-facing validation strings, template rendering
// failures, etc). Run every outgoing event through an email redactor before
// it leaves the SDK.
//
// Extracted from the `sentry.*.config.ts` trio so it can be unit-tested
// without wiring the full Sentry SDK into a mock.

export const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g

/** Replace any email-shaped substring with the literal '<email>'. */
export function scrubEmail(value: string): string {
  return value.replace(EMAIL_RE, '<email>')
}

// Minimal subset of the Sentry Event shape we care about. Typing it locally
// avoids pinning this helper to `@sentry/types` at test time.
interface ScrubbableEvent {
  message?: string
  exception?: {
    values?: Array<{ value?: string }>
  }
  breadcrumbs?: Array<{ message?: string }>
}

/**
 * Mutates an event in-place, replacing email-like substrings in message,
 * exception values, and breadcrumb messages. Returns the same object so it
 * can be used directly as a `beforeSend` / `beforeBreadcrumb` return value.
 */
export function scrubEventPii<T extends ScrubbableEvent>(event: T): T {
  if (event.message) event.message = scrubEmail(event.message)
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubEmail(ex.value)
    }
  }
  if (event.breadcrumbs) {
    for (const b of event.breadcrumbs) {
      if (b.message) b.message = scrubEmail(b.message)
    }
  }
  return event
}
