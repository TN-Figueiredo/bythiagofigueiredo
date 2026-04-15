/**
 * Accept only URLs that are either same-origin relative paths (starting with
 * `/`) or absolute `http(s):` URLs. Rejects `javascript:`, `data:`,
 * `vbscript:`, and anything else.
 *
 * Empty/undefined input returns true (callers that require presence should
 * check separately — this is about safety, not presence).
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  if (url == null) return true
  const trimmed = url.trim()
  if (trimmed === '') return true
  // Relative/root-relative path.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true
  // Absolute URL — parse and allowlist the scheme.
  try {
    const u = new URL(trimmed)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
