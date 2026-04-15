/**
 * Extracts the best-guess client IP from request headers.
 *
 * Fallback order:
 *   1. `x-forwarded-for` (first entry before comma, trimmed)
 *   2. `x-real-ip`
 *   3. `cf-connecting-ip`
 *   4. `null`
 *
 * Always returns a trimmed non-empty string or null — never empty string.
 */
export function getClientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = headers.get('x-real-ip')?.trim()
  if (real) return real
  const cf = headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  return null
}

// Loose IPv4 dotted-quad matcher (1–3 digit octets — DB is authoritative).
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
// Tighter IPv6 sanity: hex groups separated by single colons, with at most one
// `::` elision. Still not a full RFC-5952 validator — the DB (inet) remains
// authoritative — but rejects obvious garbage like `2001:db8:::1`.
const IPV6_HEXGROUP = '[0-9a-fA-F]{1,4}'
const IPV6_CHARS_ONLY = /^[0-9a-fA-F:]+$/
const IPV6_TRIPLE_COLON = /:::/
// Full form: 8 groups separated by 7 colons.
const IPV6_FULL = new RegExp(`^(?:${IPV6_HEXGROUP}:){7}${IPV6_HEXGROUP}$`)
// Elided form: one `::` replacing 1+ groups. Allow 0-7 groups on each side
// (`::` alone and `::1` and `fe80::` and `2001:db8::1` all valid).
const IPV6_ELIDED = new RegExp(
  `^(?:${IPV6_HEXGROUP}(?::${IPV6_HEXGROUP}){0,6})?::(?:${IPV6_HEXGROUP}(?::${IPV6_HEXGROUP}){0,6})?$`,
)

/**
 * Loose sanity check to avoid PG 22P02 errors on inet insert.
 * Not a real validator — the DB is. Just rejects obviously non-IP strings
 * (empty, tags, random text, too-long, too-many-octets).
 */
export function isValidInet(ip: string | null): ip is string {
  if (ip === null) return false
  if (typeof ip !== 'string') return false
  if (ip.length === 0 || ip.length > 45) return false

  if (IPV4.test(ip)) {
    const parts = ip.split('.').map((p) => Number(p))
    return parts.every((n) => n >= 0 && n <= 255)
  }

  if (ip.includes(':') && IPV6_CHARS_ONLY.test(ip) && !IPV6_TRIPLE_COLON.test(ip)) {
    if (IPV6_FULL.test(ip) || IPV6_ELIDED.test(ip)) return true
  }

  return false
}
