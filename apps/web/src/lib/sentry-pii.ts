// Sprint 4 H1 — Sentry PII scrubber (expanded Sprint 5a ops audit).
//
// LGPD + defensive hygiene: even though we've set `sendDefaultPii: false`,
// free-form error messages, breadcrumbs, and serialized request bodies
// regularly contain PII (Supabase RPC errors, user-facing validation
// strings, template rendering failures, fetch-breadcrumb bodies, etc).
// Run every outgoing event and breadcrumb through the scrubber before it
// leaves the SDK.
//
// Coverage (Sprint 5a expansion):
//   - Email addresses -> <email>
//   - Brazilian-shaped phone numbers -> [REDACTED_PHONE]
//   - CPF (Brazilian taxpayer id) -> [REDACTED_CPF]
//
// Scrubbed surfaces:
//   - event.message
//   - event.exception.values[].value
//   - event.breadcrumbs[].message
//   - event.breadcrumbs[].data (string values only — fetch request/response
//     payloads, fetch URLs, console args are typically here)
//   - event.request.headers (string values only)
//   - event.request.data (string payloads)
//
// Extracted from the `sentry.*.config.ts` trio so it can be unit-tested
// without wiring the full Sentry SDK into a mock.

export const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g
// Mirrors the regex in apps/web/src/lib/lgpd/redact-third-party-pii.ts so
// both scrubbers stay in lock-step if one is tightened.
export const PHONE_RE = /\+?\d{2,3}[- ]?\(?\d{2,3}\)?[- ]?\d{4,5}[- ]?\d{4}/g
// Matches Brazilian CPF in either punctuated (123.456.789-00) or raw
// (12345678900) form. We don't bother with mod-11 validation: the goal is
// redaction, false positives are acceptable.
export const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g

/** Replace email-shaped substrings with '<email>'. */
export function scrubEmail(value: string): string {
  return value.replace(EMAIL_RE, '<email>')
}

/** Run all PII regexes over a string, in redaction order that avoids collisions. */
export function scrubPiiString(value: string): string {
  // CPF first (tighter pattern) so phone RE doesn't eat the digits.
  return value
    .replace(CPF_RE, '[REDACTED_CPF]')
    .replace(PHONE_RE, '[REDACTED_PHONE]')
    .replace(EMAIL_RE, '<email>')
}

// Minimal subset of the Sentry Event shape we care about. Typing it locally
// avoids pinning this helper to `@sentry/types` at test time.
interface ScrubbableBreadcrumb {
  message?: string
  data?: Record<string, unknown>
}
interface ScrubbableRequest {
  headers?: Record<string, unknown>
  data?: unknown
}
interface ScrubbableEvent {
  message?: string
  exception?: {
    values?: Array<{ value?: string }>
  }
  breadcrumbs?: Array<ScrubbableBreadcrumb>
  request?: ScrubbableRequest
}

function scrubRecordStrings(obj: Record<string, unknown> | undefined): void {
  if (!obj) return
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (typeof v === 'string') {
      obj[k] = scrubPiiString(v)
    }
  }
}

/**
 * Mutates an event in-place, replacing PII substrings in message,
 * exception values, breadcrumb messages + data, and the attached request
 * headers + data. Returns the same object so it can be used directly as a
 * `beforeSend` return value.
 */
export function scrubEventPii<T extends ScrubbableEvent>(event: T): T {
  if (event.message) event.message = scrubPiiString(event.message)
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubPiiString(ex.value)
    }
  }
  if (event.breadcrumbs) {
    for (const b of event.breadcrumbs) {
      if (b.message) b.message = scrubPiiString(b.message)
      scrubRecordStrings(b.data)
    }
  }
  if (event.request) {
    scrubRecordStrings(event.request.headers)
    if (typeof event.request.data === 'string') {
      event.request.data = scrubPiiString(event.request.data)
    }
  }
  return event
}

/**
 * `beforeBreadcrumb` shape — Sentry passes a single breadcrumb at a time.
 * Scrubs the breadcrumb's message + data.string values.
 */
export function scrubBreadcrumbPii<T extends ScrubbableBreadcrumb>(
  breadcrumb: T,
): T {
  if (breadcrumb.message) breadcrumb.message = scrubPiiString(breadcrumb.message)
  scrubRecordStrings(breadcrumb.data)
  return breadcrumb
}
