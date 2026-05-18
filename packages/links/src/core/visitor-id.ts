import { createHash } from 'crypto'

/**
 * Compute an anonymous, daily-rotating visitor ID.
 * Formula: sha256(ip + "|" + userAgent + "|" + YYYY-MM-DD)
 *
 * Same visitor on the same day always produces the same ID.
 * Different days produce different IDs (privacy: no long-term tracking).
 */
export function computeVisitorId(ip: string, userAgent: string): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD in UTC
  const input = `${ip}|${userAgent}|${dateStr}`
  return createHash('sha256').update(input).digest('hex')
}
