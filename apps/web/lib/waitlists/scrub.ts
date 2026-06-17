const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const IP_RE = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g
// Matches full IPv6 addresses, compressed forms (::), and IPv4-mapped IPv6 (::ffff:…).
// Runs BEFORE IPv4 so ::ffff:1.2.3.4 is collapsed to a single [ip] token.
const IPV6_RE = /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{0,4}\b|::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:/g
/** Redact emails, IPv6, and IPv4 addresses from a free-text string before logging/Sentry. */
export function redactMessage(s: string): string {
  // ORDER MATTERS: IPV6_RE must run before IP_RE so an IPv4-mapped IPv6 literal
  // (::ffff:1.2.3.4) collapses to a single [ip] token. Do not reorder.
  return (s ?? '').replace(IPV6_RE, '[ip]').replace(EMAIL_RE, '[email]').replace(IP_RE, '[ip]')
}

/**
 * Strip the direct-PII keys (`email`/`ip`/`user_agent`) from a context object before it
 * is attached to a log line or Sentry breadcrumb (Task 0b). Returns a shallow copy with
 * those keys removed so the caller can spread non-PII context without leaking the rest.
 */
export function scrub<T extends Record<string, unknown>>(ctx: T): Omit<T, 'email' | 'ip' | 'user_agent'> {
  const { email: _email, ip: _ip, user_agent: _ua, ...rest } = ctx
  void _email
  void _ip
  void _ua
  return rest
}
