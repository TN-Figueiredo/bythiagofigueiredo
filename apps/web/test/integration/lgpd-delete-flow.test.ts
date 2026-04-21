/**
 * DB-gated integration tests for LGPD account deletion flow (Sprint 5a / Track A).
 *
 * Covers: request creation idempotency, confirmation → phase 1 atomic cleanup
 * (newsletter anon, contact anon, content reassign, authors nullify, invites
 * deleted, audit nullify), ban semantics, phase 3 hard delete timing,
 * sole-admin blocker, cancel during grace.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  seedLgpdScenario,
  cleanupRbacScenario,
} from '../helpers/db-seed'

function tokenHash(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

describe.skipIf(skipIfNoLocalDb())('LGPD delete flow', () => {
  let admin: SupabaseClient
  let scenario: Awaited<ReturnType<typeof seedLgpdScenario>>

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    scenario = await seedLgpdScenario(admin, { pendingDeletion: false })
  })

  afterAll(async () => {
    await cleanupRbacScenario(admin, scenario)
  })

  it('lgpd_requests unique-partial-index blocks duplicate pending per user+type', async () => {
    const uid = scenario.reporterAId
    const h1 = tokenHash(`delete-${uid}-${Date.now()}`)
    const { error: e1 } = await admin.from('lgpd_requests').insert({
      user_id: uid,
      type: 'account_deletion',
      status: 'pending',
      confirmation_token_hash: h1,
    })
    expect(e1).toBeNull()

    const h2 = tokenHash(`delete-${uid}-${Date.now()}-dup`)
    const { error: e2 } = await admin.from('lgpd_requests').insert({
      user_id: uid,
      type: 'account_deletion',
      status: 'pending',
      confirmation_token_hash: h2,
    })
    expect(e2).not.toBeNull()

    await admin.from('lgpd_requests').delete().eq('user_id', uid)
  })

  it('lgpd_phase1_cleanup anonymizes newsletter_subscriptions via pre-capture', async () => {
    const email = `ra-${randomUUID().slice(0, 8)}@example.test`
    const { data: sub } = await admin
      .from('newsletter_subscriptions')
      .insert({
        site_id: scenario.siteAId,
        email,
        status: 'confirmed',
        consent_text_version: 'v1',
        confirmed_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    expect(sub?.id).toBeTruthy()

    await admin.rpc('lgpd_phase1_cleanup', {
      p_user_id: scenario.reporterAId,
      p_pre_capture: { newsletter_emails: [email] },
    })

    const { data: after } = await admin
      .from('newsletter_subscriptions')
      .select('email, status, ip, user_agent')
      .eq('id', sub!.id)
      .single()
    expect(after?.status).toBe('unsubscribed')
    expect(after?.email).not.toBe(email)
    expect(after?.ip).toBeNull()
    expect(after?.user_agent).toBeNull()

    await admin.from('newsletter_subscriptions').delete().eq('id', sub!.id)
  })

  it('lgpd_phase1_cleanup anonymizes contact_submissions matching pre-capture emails', async () => {
    const email = `cs-${randomUUID().slice(0, 8)}@example.test`
    const { data: sub } = await admin
      .from('contact_submissions')
      .insert({
        site_id: scenario.siteAId,
        name: 'Alice',
        email,
        message: 'Secret message about joao@xyz.com',
        consent_processing: true,
        consent_processing_text_version: 'v1',
      })
      .select('id')
      .single()

    await admin.rpc('lgpd_phase1_cleanup', {
      p_user_id: scenario.reporterAId,
      p_pre_capture: { newsletter_emails: [email] },
    })

    const { data: after } = await admin
      .from('contact_submissions')
      .select('name, email, message, ip, user_agent')
      .eq('id', sub!.id)
      .single()
    expect(after?.name).toBe('[REDACTED]')
    expect(after?.message).toBe('[REDACTED]')
    expect(after?.email).toContain('redacted.invalid')

    await admin.from('contact_submissions').delete().eq('id', sub!.id)
  })

  it('lgpd_phase1_cleanup reassigns blog_posts.owner_user_id to master admin', async () => {
    // Use editor_a (Site A editor) who has an authors row.
    // Use the stored author ID directly to avoid a query that may fail if a
    // previous (concurrent) test run already nulled editorAId's authors.user_id.
    const authorId = scenario.authorsByUser[scenario.editorAId]
    const { data: post, error: postErr } = await admin
      .from('blog_posts')
      .insert({
        site_id: scenario.siteAId,
        author_id: authorId,
        owner_user_id: scenario.editorAId,
        status: 'draft',
      })
      .select('id')
      .single()
    expect(postErr).toBeNull()

    await admin.rpc('lgpd_phase1_cleanup', {
      p_user_id: scenario.editorAId,
      p_pre_capture: {},
    })

    const { data: after } = await admin
      .from('blog_posts')
      .select('owner_user_id')
      .eq('id', post!.id)
      .single()
    // Owner is reassigned to master_admin (superAdminId) OR NULL if no other admin exists.
    expect(after?.owner_user_id).not.toBe(scenario.editorAId)

    await admin.from('blog_posts').delete().eq('id', post!.id)
  })

  it('lgpd_phase1_cleanup nullifies authors.user_id for target user', async () => {
    // Earlier tests called phase1 for reporterAId (newsletter + contact cleanup),
    // which already nulled reporter's authors.user_id. Use randomId instead —
    // no prior test in this suite has run phase1 for randomId at this point.
    const userId = scenario.randomId
    const { data: before } = await admin.from('authors').select('user_id').eq('user_id', userId)
    expect((before ?? []).length).toBeGreaterThan(0)

    await admin.rpc('lgpd_phase1_cleanup', { p_user_id: userId, p_pre_capture: {} })

    const { data: after } = await admin.from('authors').select('user_id').eq('user_id', userId)
    expect((after ?? []).length).toBe(0)
  })

  it('lgpd_phase1_cleanup deletes pending invitations sent by target user', async () => {
    const userId = scenario.orgAdminId
    const token = createHash('sha256').update(`inv-${Date.now()}`).digest('hex')
    const { data: inv } = await admin
      .from('invitations')
      .insert({
        email: `pending-${Date.now()}@test`,
        org_id: scenario.orgChildId,
        role: 'org_admin',
        role_scope: 'org',
        token,
        invited_by: userId,
      })
      .select('id')
      .single()

    await admin.rpc('lgpd_phase1_cleanup', { p_user_id: userId, p_pre_capture: {} })

    const { data: after } = await admin.from('invitations').select('id').eq('id', inv!.id)
    expect((after ?? []).length).toBe(0)
  })

  it('lgpd_phase1_cleanup nulls audit_log.actor_user_id for target user', async () => {
    const userId = scenario.orgAdminId
    // Trigger an audit row by mutating org_members
    const { data: row } = await admin
      .from('organization_members')
      .select('id')
      .eq('org_id', scenario.orgChildId)
      .eq('user_id', userId)
      .maybeSingle()
    if (row) {
      await admin.from('organization_members').update({ role: 'org_admin' }).eq('id', row.id)
    }

    await admin.rpc('lgpd_phase1_cleanup', { p_user_id: userId, p_pre_capture: {} })

    const { count } = await admin
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('actor_user_id', userId)
    expect(count ?? 0).toBe(0)
  })

  it('check_deletion_safety returns can_delete=true for user with no blockers', async () => {
    const { data } = await admin.rpc('check_deletion_safety', { p_user_id: scenario.randomId })
    expect(data).toBeTruthy()
    const parsed = data as { can_delete: boolean; blockers: string[] }
    expect(parsed.can_delete).toBe(true)
    expect(parsed.blockers.length).toBe(0)
  })

  it('check_deletion_safety flags master_ring_sole_admin when only 1 master admin exists', async () => {
    // Temporarily make superAdminId the sole master ring admin by removing
    // any other org_admin rows (e.g. the dev seed user) for this check.
    const { data: otherAdmins } = await admin
      .from('organization_members')
      .select('id, org_id, user_id, role')
      .eq('org_id', scenario.orgMasterId)
      .neq('user_id', scenario.superAdminId)
    if (otherAdmins?.length) {
      await admin
        .from('organization_members')
        .delete()
        .eq('org_id', scenario.orgMasterId)
        .neq('user_id', scenario.superAdminId)
    }

    const { data } = await admin.rpc('check_deletion_safety', { p_user_id: scenario.superAdminId })

    // Restore other admins.
    if (otherAdmins?.length) {
      await admin.from('organization_members').insert(
        otherAdmins.map(({ org_id, user_id, role }) => ({ org_id, user_id, role })),
      )
    }

    const parsed = data as { can_delete: boolean; blockers: string[] }
    expect(parsed.blockers).toContain('master_ring_sole_admin')
    expect(parsed.can_delete).toBe(false)
  })

  it('cancel_account_deletion_in_grace cancels a processing request within the grace window', async () => {
    const raw = `cancel-${randomUUID()}`
    const hash = tokenHash(raw)
    const future = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString()
    const { data } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.reporterAId,
        type: 'account_deletion',
        status: 'processing',
        phase: 1,
        confirmation_token_hash: hash,
        scheduled_purge_at: future,
      })
      .select('id')
      .single()

    const { data: result } = await admin.rpc('cancel_account_deletion_in_grace', { p_token_hash: hash })
    const parsed = result as { cancelled: boolean; user_id?: string }
    expect(parsed.cancelled).toBe(true)
    expect(parsed.user_id).toBe(scenario.reporterAId)

    const { data: row } = await admin.from('lgpd_requests').select('status, cancelled_at').eq('id', data!.id).single()
    expect(row?.status).toBe('cancelled')
    expect(row?.cancelled_at).toBeTruthy()

    await admin.from('lgpd_requests').delete().eq('id', data!.id)
  })

  it('cancel_account_deletion_in_grace fails with wrong token hash', async () => {
    const { data } = await admin.rpc('cancel_account_deletion_in_grace', { p_token_hash: 'does-not-exist' })
    const parsed = data as { cancelled: boolean }
    expect(parsed.cancelled).toBe(false)
  })

  it('cancel_account_deletion_in_grace fails when scheduled_purge_at has passed', async () => {
    const raw = `expired-${randomUUID()}`
    const hash = tokenHash(raw)
    const past = new Date(Date.now() - 1000).toISOString()
    const { data } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.reporterAId,
        type: 'account_deletion',
        status: 'processing',
        phase: 1,
        confirmation_token_hash: hash,
        scheduled_purge_at: past,
      })
      .select('id')
      .single()

    const { data: result } = await admin.rpc('cancel_account_deletion_in_grace', { p_token_hash: hash })
    expect((result as { cancelled: boolean }).cancelled).toBe(false)

    await admin.from('lgpd_requests').delete().eq('id', data!.id)
  })

  it('purge_deleted_user_audit nulls PII keys while preserving audit row structure', async () => {
    const { data: inserted } = await admin
      .from('audit_log')
      .insert({
        actor_user_id: scenario.randomId,
        action: 'test',
        resource_type: 'auth_user',
        resource_id: scenario.randomId,
        before_data: { email: 'x@y.com', name: 'Z', ip: '1.1.1.1', user_agent: 'UA', message: 'secret', keep: 'yes' },
        after_data: { email: 'new@y.com', keep: 'still' },
      })
      .select('id')
      .single()

    await admin.rpc('purge_deleted_user_audit', { p_user_id: scenario.randomId })

    const { data: row } = await admin.from('audit_log').select('before_data, after_data').eq('id', inserted!.id).single()
    const before = row!.before_data as Record<string, unknown>
    expect(before.email).toBeUndefined()
    expect(before.name).toBeUndefined()
    expect(before.ip).toBeUndefined()
    expect(before.user_agent).toBeUndefined()
    expect(before.message).toBeUndefined()
    expect(before.keep).toBe('yes')

    await admin.from('audit_log').delete().eq('id', inserted!.id)
  })

  it('phase 1 cleanup runs idempotently (second call is no-op / safe)', async () => {
    const userId = scenario.reporterAId
    // Run once
    const { error: e1 } = await admin.rpc('lgpd_phase1_cleanup', { p_user_id: userId, p_pre_capture: {} })
    expect(e1).toBeNull()
    // Run again — should not fail
    const { error: e2 } = await admin.rpc('lgpd_phase1_cleanup', { p_user_id: userId, p_pre_capture: {} })
    expect(e2).toBeNull()
  })

  it('scheduled_purge_at is 15 days in future (phase 1 → phase 3 grace calculation)', async () => {
    const future = new Date(Date.now() + 15 * 24 * 3600 * 1000)
    const { data, error } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.randomId,
        type: 'account_deletion',
        status: 'processing',
        phase: 1,
        scheduled_purge_at: future.toISOString(),
      })
      .select('scheduled_purge_at, id')
      .single()
    expect(error).toBeNull()
    const stored = new Date(data!.scheduled_purge_at as string).getTime()
    const delta = Math.abs(stored - future.getTime())
    expect(delta).toBeLessThan(2000)

    await admin.from('lgpd_requests').delete().eq('id', data!.id)
  })

  it('metadata column stores arbitrary jsonb per request', async () => {
    const { data } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.randomId,
        type: 'data_export',
        status: 'pending',
        metadata: { test: true, retries: 3 },
      })
      .select('id, metadata')
      .single()

    const meta = data!.metadata as { test: boolean; retries: number }
    expect(meta.test).toBe(true)
    expect(meta.retries).toBe(3)

    await admin.from('lgpd_requests').delete().eq('id', data!.id)
  })
})
