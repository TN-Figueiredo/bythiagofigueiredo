/**
 * DB-gated integration tests for `public.confirm_newsletter_subscription(text)`.
 *
 * Run with:
 *   npm run db:start && HAS_LOCAL_DB=1 npm run test:web
 *
 * CI runs without HAS_LOCAL_DB, so `describe.skipIf(skipIfNoLocalDb())` keeps
 * the suite green.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  seedSite,
  seedPendingNewsletterSub,
  sha256Hex,
} from '../helpers/db-seed'

describe.skipIf(skipIfNoLocalDb())('RPC confirm_newsletter_subscription', () => {
  let db: SupabaseClient
  const siteIdsToCleanup: string[] = []
  const orgIdsToCleanup: string[] = []

  beforeAll(() => {
    db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  })

  afterAll(async () => {
    if (siteIdsToCleanup.length) {
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

  it('happy path: pending → confirmed, clears token + expires, sets confirmed_at', async () => {
    const siteId = await freshSite()
    const rawToken = 'raw-token-happy-' + Date.now()
    const { subId, tokenHash } = await seedPendingNewsletterSub(
      db,
      siteId,
      `happy-${Date.now()}@example.test`,
      rawToken,
    )

    const { data, error } = await db.rpc('confirm_newsletter_subscription', {
      p_token_hash: tokenHash,
    })
    expect(error).toBeNull()
    expect(data).toMatchObject({ ok: true, site_id: siteId })
    // First-time confirm shouldn't carry `already: true`.
    expect((data as { already?: boolean }).already).not.toBe(true)

    const { data: row } = await db
      .from('newsletter_subscriptions')
      .select('status, confirmed_at, confirmation_token_hash, confirmation_expires_at')
      .eq('id', subId)
      .single()
    expect(row?.status).toBe('confirmed')
    expect(row?.confirmed_at).not.toBeNull()
    expect(row?.confirmation_token_hash).toBeNull()
    expect(row?.confirmation_expires_at).toBeNull()
  })

  it('already-confirmed: second call returns { ok:true, already:true } with no side effect', async () => {
    const siteId = await freshSite()
    const rawToken = 'raw-token-already-' + Date.now()
    const email = `already-${Date.now()}@example.test`
    const { subId, tokenHash } = await seedPendingNewsletterSub(db, siteId, email, rawToken)

    // First call flips to confirmed + clears the hash — so the 2nd call by-hash
    // will no longer find the row. To exercise the "already confirmed" branch
    // we must NOT let the first call clear the hash. Simulate by directly
    // flipping status and keeping the hash.
    await db
      .from('newsletter_subscriptions')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', subId)

    const before = await db
      .from('newsletter_subscriptions')
      .select('confirmed_at')
      .eq('id', subId)
      .single()

    const { data, error } = await db.rpc('confirm_newsletter_subscription', {
      p_token_hash: tokenHash,
    })
    expect(error).toBeNull()
    expect(data).toMatchObject({ ok: true, already: true, site_id: siteId })

    const after = await db
      .from('newsletter_subscriptions')
      .select('confirmed_at, status')
      .eq('id', subId)
      .single()
    expect(after.data?.status).toBe('confirmed')
    // confirmed_at must NOT have been bumped.
    expect(after.data?.confirmed_at).toBe(before.data?.confirmed_at)
  })

  it('expired token: returns { ok:false, error:"expired" } and leaves row untouched', async () => {
    const siteId = await freshSite()
    const rawToken = 'raw-token-expired-' + Date.now()
    const { subId, tokenHash } = await seedPendingNewsletterSub(
      db,
      siteId,
      `expired-${Date.now()}@example.test`,
      rawToken,
      { expiresInMinutes: -1 }, // already expired
    )

    const { data, error } = await db.rpc('confirm_newsletter_subscription', {
      p_token_hash: tokenHash,
    })
    expect(error).toBeNull()
    expect(data).toEqual({ ok: false, error: 'expired' })

    const { data: row } = await db
      .from('newsletter_subscriptions')
      .select('status, confirmed_at')
      .eq('id', subId)
      .single()
    expect(row?.status).toBe('pending_confirmation')
    expect(row?.confirmed_at).toBeNull()
  })

  it('wrong hash: returns { ok:false, error:"not_found" }', async () => {
    const bogusHash = sha256Hex('nonexistent-token-' + Date.now())
    const { data, error } = await db.rpc('confirm_newsletter_subscription', {
      p_token_hash: bogusHash,
    })
    expect(error).toBeNull()
    expect(data).toEqual({ ok: false, error: 'not_found' })
  })
})
