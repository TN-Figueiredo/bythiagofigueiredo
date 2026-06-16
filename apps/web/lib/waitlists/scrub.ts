const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const IP_RE = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g
/** Redact emails and IPv4 addresses from a free-text string before logging/Sentry. */
export function redactMessage(s: string): string {
  return (s ?? '').replace(EMAIL_RE, '[email]').replace(IP_RE, '[ip]')
}
