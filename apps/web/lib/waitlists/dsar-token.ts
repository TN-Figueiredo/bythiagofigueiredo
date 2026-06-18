import crypto, { createHmac } from 'node:crypto'
import { getServerEnv } from '../../src/lib/env'

// Shared token-shape bounds — used by every consumer (rights/dsar routes + manage page +
// erase action) so a change can't silently desync the length guards.
export const WAITLIST_DSAR_TOKEN_MIN_LEN = 16
export const WAITLIST_DSAR_TOKEN_MAX_LEN = 256
// Access/erasure links expire — a leaked link is bounded; a fresh /rights request re-arms it.
export const WAITLIST_DSAR_TOKEN_TTL_DAYS = 7

/** True when a raw token is shape-valid (length bounds only — not authenticity). */
export function isWaitlistDsarTokenShape(token: string | null | undefined): token is string {
  return Boolean(token) && token!.length >= WAITLIST_DSAR_TOKEN_MIN_LEN && token!.length <= WAITLIST_DSAR_TOKEN_MAX_LEN
}

/**
 * True when a token row is still usable: not burned (used_at null) AND issued within the TTL.
 * Centralizes the freshness/replay guard shared by the dsar route and the manage page.
 */
export function isWaitlistDsarTokenFresh(row: { created_at: string; used_at: string | null }): boolean {
  if (row.used_at) return false
  const ageMs = Date.now() - new Date(row.created_at).getTime()
  return Number.isFinite(ageMs) && ageMs <= WAITLIST_DSAR_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
}

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
