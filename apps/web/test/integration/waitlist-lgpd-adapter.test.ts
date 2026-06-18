/**
 * DB-gated integration test for the BythiagoLgpdDomainAdapter waitlist wiring
 * (Task 11). Two guarantees:
 *
 *   1. collectUserData(userId) surfaces the user's waitlist memberships under a
 *      `waitlists` key with a NARROWED projection that EXCLUDES network PII
 *      (ip/user_agent) — parity with the newsletter_sends projection.
 *   2. phase1Cleanup(userId) anonymizes the user's waitlist_signups rows (sets
 *      anonymized_at and replaces email with its sha256 hash) by passing the
 *      auth-derived email array as p_pre_capture.waitlist_emails.
 *
 * The adapter derives the email INTERNALLY via getUserById(userId), so the test
 * seeds a real auth user (insertAuthUser) and keys the signup off that email.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoGoTrue } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'
import { BythiagoLgpdDomainAdapter } from '../../src/lib/lgpd/domain-adapter'

// Needs GoTrue: createUser + the adapter's internal getUserById both hit the auth admin
// API. CI excludes gotrue, so this suite skips there and runs locally (full Supabase).
describe.skipIf(skipIfNoGoTrue())('LGPD domain adapter — waitlist wiring (Task 11)', () => {
  let db: SupabaseClient
  let adapter: BythiagoLgpdDomainAdapter
  let siteId: string
  let waitlistId: string
  let userId: string
  const email = `wl-lgpd-${randomUUID().slice(0, 8)}@example.com`

  beforeAll(async () => {
    db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    adapter = new BythiagoLgpdDomainAdapter(db)
    const seeded = await seedSite(db)
    siteId = seeded.siteId
    // GoTrue admin createUser (not insertAuthUser) so the adapter's internal
    // getUserById(userId) resolves the email — a hand-inserted row fails GoTrue.
    const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true })
    if (error) throw error
    userId = created.user!.id
    const { data: wl } = await db
      .from('waitlists')
      .insert({ site_id: siteId, slug: `lgpd-${randomUUID().slice(0, 6)}`, name: 'LGPD', status: 'open' })
      .select('id')
      .single()
    waitlistId = wl!.id
    await db.from('waitlist_signups').insert({
      waitlist_id: waitlistId,
      site_id: siteId,
      email,
      consent_launch_notification: true,
      consent_text_version: 'v1',
      status: 'pending',
      source_surface: 'landing',
      ip: '203.0.113.42',
      user_agent: 'test-agent/1.0',
    })
  })

  afterAll(async () => {
    await db.from('waitlists').delete().eq('id', waitlistId)
    await db.auth.admin.deleteUser(userId)
  })

  it('collectUserData includes a waitlists section WITHOUT network PII', async () => {
    const bundle = await adapter.collectUserData(userId)
    const waitlists = bundle.waitlists as Array<Record<string, unknown>>
    expect(Array.isArray(waitlists)).toBe(true)
    const row = waitlists.find((r) => r.email === email)
    expect(row).toBeTruthy()
    // narrowed projection present
    expect(row).toHaveProperty('consent_launch_notification', true)
    expect(row).toHaveProperty('consent_text_version', 'v1')
    expect(row).toHaveProperty('status', 'pending')
    expect(row).toHaveProperty('source_surface', 'landing')
    expect(row).toHaveProperty('created_at')
    // network PII MUST be excluded (parity with newsletter_sends)
    expect(row).not.toHaveProperty('ip')
    expect(row).not.toHaveProperty('user_agent')
  })

  it('phase1Cleanup anonymizes the user waitlist_signups rows', async () => {
    await adapter.phase1Cleanup(userId)
    const { data: row } = await db
      .from('waitlist_signups')
      .select('email, ip, user_agent, anonymized_at')
      .eq('waitlist_id', waitlistId)
      .not('anonymized_at', 'is', null)
      .single()
    expect(row).toBeTruthy()
    expect(row!.anonymized_at).toBeTruthy()
    expect(row!.ip).toBeNull()
    expect(row!.user_agent).toBeNull()
    expect(row!.email).toMatch(/^[a-f0-9]{64}$/)
  })
})
