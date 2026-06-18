import crypto, { createHmac } from 'node:crypto'
import { getServerEnv } from '../../src/lib/env'

// Deterministic, namespaced rights token for waitlist DSAR (access + erasure).
// Mirrors the newsletter unsubscribe-token pattern but with a DISTINCT key
// namespace ('waitlist-dsar:') so a waitlist link can never resolve a newsletter
// token (or vice-versa) even for the same (site, email). Server-side secret only.
function getWaitlistDsarKey(): Buffer {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET ?? process.env.CRON_SECRET ?? getServerEnv().CRON_SECRET
  return crypto.createHash('sha256').update(`waitlist-dsar:${secret}`).digest()
}

/**
 * Deterministic over (site, lowercased email): re-requesting the link yields the
 * SAME token (idempotent upsert, no row churn). Returns the raw token (emailed to
 * the data subject) and its sha256 hash (the only thing stored in the DB).
 */
export function generateWaitlistDsarToken(siteId: string, email: string): { raw: string; hash: string } {
  const raw = createHmac('sha256', getWaitlistDsarKey()).update(`${siteId}:${email.toLowerCase()}`).digest('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

/** Hash a raw token for DB lookup (never store/log the raw token). */
export function hashWaitlistDsarToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}
