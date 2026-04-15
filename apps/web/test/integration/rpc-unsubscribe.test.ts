/**
 * DB-gated integration tests for `public.unsubscribe_via_token(text)`.
 *
 * Run with `HAS_LOCAL_DB=1 npm run test:web` after `npm run db:start`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  seedSite,
  seedUnsubscribeToken,
  sha256Hex,
} from '../helpers/db-seed'

describe.skipIf(skipIfNoLocalDb())('RPC unsubscribe_via_token', () => {
  let db: SupabaseClient
  const siteIdsToCleanup: string[] = []
  const orgIdsToCleanup: string[] = []

  beforeAll(() => {
    db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  })

  afterAll(async () => {
    if (siteIdsToCleanup.length) {
      await db.from('unsubscribe_tokens').delete().in('site_id', siteIdsToCleanup)
      await db.from('newsletter_subscriptions').delete().in('site_id', siteIdsToCleanup)
      await db.from('sites').delete().in('id', siteIdsToCleanup)
    }
    if (orgIdsToCleanup.length) {
      await db.from('organizations').delete().in('id', orgIdsToCleanup)
    }
  })

  async function freshSite(): Promise<string> {
    const { siteId, orgId } = await seedSite(db)
    siteIdsToCleanup.push(siteId)
    orgIdsToCleanup.push(orgId)
    return siteId
  }

  it('happy path: confirmed sub → unsubscribed, token used_at set', async () => {
    const siteId = await freshSite()
    const email = `unsub-${Date.now()}@example.test`
    const rawToken = 'raw-unsub-token-' + Date.now()
    const { tokenHash, subId } = await seedUnsubscribeToken(db, siteId, email, rawToken, {
      seedConfirmedSub: true,
    })

    const { data, error } = await db.rpc('unsubscribe_via_token', {
      p_token_hash: tokenHash,
    })
    expect(error).toBeNull()
    // Epic 10 T73: RPC return omits `email` (row is anonymized); only ok/site_id/sub_id remain.
    expect(data).toMatchObject({ ok: true, site_id: siteId, sub_id: subId })
    expect((data as { already?: boolean }).already).not.toBe(true)

    const { data: sub } = await db
      .from('newsletter_subscriptions')
      .select('status, unsubscribed_at, email, ip, user_agent, locale')
      .eq('id', subId!)
      .single()
    expect(sub?.status).toBe('unsubscribed')
    expect(sub?.unsubscribed_at).not.toBeNull()
    // Anonymization: email → sha256 hex, PII fields → NULL.
    expect(sub?.email).toMatch(/^[a-f0-9]{64}$/)
    expect(sub?.ip).toBeNull()
    expect(sub?.user_agent).toBeNull()
    expect(sub?.locale).toBeNull()

    const { data: tok } = await db
      .from('unsubscribe_tokens')
      .select('used_at')
      .eq('token_hash', tokenHash)
      .single()
    expect(tok?.used_at).not.toBeNull()
  })

  it('already-used token: returns { ok:true, already:true } no-op', async () => {
    const siteId = await freshSite()
    const email = `already-unsub-${Date.now()}@example.test`
    const rawToken = 'raw-already-unsub-' + Date.now()
    const { tokenHash } = await seedUnsubscribeToken(db, siteId, email, rawToken, {
      seedConfirmedSub: true,
    })

    // First call actually performs the unsub.
    const first = await db.rpc('unsubscribe_via_token', { p_token_hash: tokenHash })
    expect(first.error).toBeNull()

    // Second call should report already-used. Post-T73 the RPC no longer returns
    // `email` in the already-branch (row has been anonymized).
    const { data, error } = await db.rpc('unsubscribe_via_token', { p_token_hash: tokenHash })
    expect(error).toBeNull()
    expect(data).toMatchObject({ ok: true, already: true, site_id: siteId })
    void email
  })

  it('wrong hash: returns { ok:false, error:"not_found" }', async () => {
    const bogus = sha256Hex('never-issued-' + Date.now())
    const { data, error } = await db.rpc('unsubscribe_via_token', { p_token_hash: bogus })
    expect(error).toBeNull()
    expect(data).toEqual({ ok: false, error: 'not_found' })
  })
})
