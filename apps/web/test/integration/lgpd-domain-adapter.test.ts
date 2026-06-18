/**
 * DB-gated regression test for BythiagoLgpdDomainAdapter against the REAL
 * schema. collectUserData + phase1Cleanup queried three columns that do not
 * exist (`invitations.invited_by_user_id`, `contact_submissions.user_id`,
 * `password_reset_attempts.user_id`) — every LGPD Art.18 export threw, and
 * phase1Cleanup aborted on the contact_submissions pre-query. Both methods are
 * keyed by email for those tables. This test exercises the full method end to
 * end so the bug cannot silently return.
 *
 * The user is created via the GoTrue admin API (NOT insertAuthUser) so the
 * adapter's internal getUserById(userId) resolves the email — a hand-inserted
 * auth.users row fails GoTrue's loader ("Database error loading user").
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoGoTrue } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'
import { BythiagoLgpdDomainAdapter } from '../../src/lib/lgpd/domain-adapter'

// Needs GoTrue: createUser + the adapter's internal getUserById both hit the auth admin
// API. CI excludes gotrue, so this suite skips there and runs locally (full Supabase).
describe.skipIf(skipIfNoGoTrue())('LGPD domain adapter — real-schema regression', () => {
  let db: SupabaseClient
  let adapter: BythiagoLgpdDomainAdapter
  let siteId: string
  let userId: string
  let contactId: string
  const email = `lgpd-adp-${randomUUID().slice(0, 8)}@example.com`

  beforeAll(async () => {
    db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    adapter = new BythiagoLgpdDomainAdapter(db)
    siteId = (await seedSite(db)).siteId
    const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true })
    if (error) throw error
    userId = created.user!.id
    // contact_submissions is keyed by email (no user_id) — the previously-broken column.
    const { data: contact } = await db.from('contact_submissions').insert({
      site_id: siteId,
      name: 'Test Person',
      email,
      message: 'hello there',
      consent_processing: true,
      consent_processing_text_version: 'v1',
      ip: '203.0.113.10',
      user_agent: 'ua',
    }).select('id').single()
    contactId = contact!.id
  })

  afterAll(async () => {
    await db.from('contact_submissions').delete().eq('id', contactId)
    await db.auth.admin.deleteUser(userId)
  })

  it('collectUserData completes against the real schema and surfaces email-keyed rows', async () => {
    const bundle = await adapter.collectUserData(userId)
    // Previously threw on invitations/contact/password column mismatches.
    expect(Array.isArray(bundle.invitations_received)).toBe(true)
    expect(Array.isArray(bundle.password_reset_attempts)).toBe(true)
    const contacts = bundle.contact_submissions_sent as Array<Record<string, unknown>>
    expect(Array.isArray(contacts)).toBe(true)
    // the seeded contact_submission (keyed by email) is surfaced, with the
    // message redacted for 3rd-party PII.
    const mine = contacts.find((c) => c.email === email)
    expect(mine).toBeTruthy()
    expect(mine).toHaveProperty('message_redacted')
  })

  it('phase1Cleanup completes and anonymizes the email-keyed contact_submission', async () => {
    await adapter.phase1Cleanup(userId)
    // The phase1 RPC redacts the row in place (email → per-user [REDACTED]-…
    // address, name/message → [REDACTED], ip/user_agent → null). Assert on the
    // seeded row's id so we are robust to the exact redacted-email format.
    const { data: row } = await db
      .from('contact_submissions')
      .select('email, name, message, ip, user_agent')
      .eq('id', contactId)
      .single()
    expect(row).toBeTruthy()
    expect(row!.email).not.toBe(email)
    expect(String(row!.email)).toMatch(/^\[REDACTED\]/)
    expect(row!.name).toBe('[REDACTED]')
    expect(row!.ip).toBeNull()
    expect(row!.user_agent).toBeNull()
  })
})
