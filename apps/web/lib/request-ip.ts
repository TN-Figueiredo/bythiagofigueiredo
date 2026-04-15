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
// Very loose IPv6 sanity: hex digits and colons, at least one colon, length ≤ 45.
const IPV6_CHARS = /^[0-9a-fA-F:]+$/

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

  if (ip.includes(':') && IPV6_CHARS.test(ip)) {
    return true
  }

  return false
}
