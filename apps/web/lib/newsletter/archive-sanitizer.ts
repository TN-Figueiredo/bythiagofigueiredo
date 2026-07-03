import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitization policy for newsletter edition HTML rendered on the public
 * archive page (`/newsletter/archive/[id]`). The content comes from our own
 * editor, but it round-trips through the DB — treat it as untrusted.
 *
 * Default DOMPurify profile: strips script/style/iframe/object, on* handlers
 * and javascript: URIs; keeps regular formatting/table markup that the email
 * editor produces. Extracted from the page so the policy is unit-testable
 * (server-only code — tests must run under @vitest-environment node).
 */
export function sanitizeArchiveHtml(html: string): string {
  return DOMPurify.sanitize(html)
}
