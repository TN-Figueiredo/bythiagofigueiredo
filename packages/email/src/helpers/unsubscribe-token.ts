import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Ensure an unsubscribe token exists for (siteId, email) and return an
 * unsubscribe URL containing the RAW token. The token is hashed before being
 * stored — plaintext tokens never hit the database.
 *
 * If a token already exists for this (siteId, email) pair we keep the stored
 * hash (we can't recover the original raw token) and issue a fresh raw token
 * for the URL — the DB continues to recognise only the original token.
 * This is acceptable because ensureUnsubscribeToken is idempotent at the row
 * level and the URL issued here is the one sent in the email immediately.
 */
export async function ensureUnsubscribeToken(
  supabase: SupabaseClient,
  siteId: string,
  email: string,
  baseUrl: string,
): Promise<string> {
  const rawToken = generateToken()
  const tokenHash = hashToken(rawToken)
  const cleanBase = baseUrl.replace(/\/$/, '')

  const { data } = await supabase
    .from('unsubscribe_tokens')
    .upsert(
      { token_hash: tokenHash, site_id: siteId, email },
      { onConflict: 'site_id,email', ignoreDuplicates: true },
    )
    .select('token_hash')
    .single()

  if (data?.token_hash === tokenHash) {
    // Row inserted — raw token corresponds to stored hash.
    return `${cleanBase}/unsubscribe/${rawToken}`
  }

  // Conflict — existing row already has a (different) hash we can't invert.
  // Return a URL built from the just-generated raw token; the DB still holds
  // the old hash, so we overwrite it to keep the newly-emitted URL valid.
  const { data: existing } = await supabase
    .from('unsubscribe_tokens')
    .select('site_id, email')
    .eq('site_id', siteId)
    .eq('email', email)
    .single()

  if (!existing) throw new Error('unsubscribe_token_lookup_failed')

  await supabase
    .from('unsubscribe_tokens')
    .update({ token_hash: tokenHash, used_at: null })
    .eq('site_id', siteId)
    .eq('email', email)

  return `${cleanBase}/unsubscribe/${rawToken}`
}
