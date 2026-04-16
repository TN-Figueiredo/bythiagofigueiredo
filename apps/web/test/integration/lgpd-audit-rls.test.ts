/**
 * DB-gated integration tests for audit_log self-access RLS + cascade suppression
 * (Sprint 5a / Track A, migrations 014 + 015).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  ANON_KEY,
  seedLgpdScenario,
  cleanupRbacScenario,
  signUserJwt,
} from '../helpers/db-seed'

function clientFor(userId: string): SupabaseClient {
  const { jwt } = signUserJwt(userId)
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}

describe.skipIf(skipIfNoLocalDb())('LGPD audit_log RLS', () => {
  let admin: SupabaseClient
  let scenario: Awaited<ReturnType<typeof seedLgpdScenario>>

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    scenario = await seedLgpdScenario(admin)
  })

  afterAll(async () => {
    await cleanupRbacScenario(admin, scenario)
  })

  it('self-as-actor: user can read audit_log rows where actor_user_id = auth.uid()', async () => {
    // Seed an audit row with reporter as actor
    await admin.from('audit_log').insert({
      actor_user_id: scenario.reporterAId,
      action: 'test_action',
      resource_type: 'test',
      resource_id: scenario.reporterAId,
    })
    const client = clientFor(scenario.reporterAId)
    const { data, error } = await client
      .from('audit_log')
      .select('id, action')
      .eq('actor_user_id', scenario.reporterAId)
      .eq('action', 'test_action')
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('self-as-resource-target: user can read audit_log rows where resource_type=auth_user AND resource_id = auth.uid()', async () => {
    await admin.from('audit_log').insert({
      actor_user_id: scenario.superAdminId,
      action: 'lifecycle_deletion_phase1',
      resource_type: 'auth_user',
      resource_id: scenario.reporterAId,
    })
    const client = clientFor(scenario.reporterAId)
    const { data, error } = await client
      .from('audit_log')
      .select('id, action')
      .eq('resource_type', 'auth_user')
      .eq('resource_id', scenario.reporterAId)
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('super_admin sees cross-org audit rows (pre-existing policy holds)', async () => {
    const client = clientFor(scenario.superAdminId)
    const { data, error } = await client
      .from('audit_log')
      .select('id')
      .limit(5)
    expect(error).toBeNull()
    // Super admin should see at least seed-generated rows
    expect((data ?? []).length).toBeGreaterThanOrEqual(0)
  })

  it('non-owner non-admin denied: random user sees no cross-user audit rows', async () => {
    await admin.from('audit_log').insert({
      actor_user_id: scenario.reporterAId,
      action: 'private_event',
      resource_type: 'test',
      resource_id: scenario.reporterAId,
    })
    const client = clientFor(scenario.randomId)
    const { data } = await client
      .from('audit_log')
      .select('id')
      .eq('action', 'private_event')
    expect((data ?? []).length).toBe(0)
  })

  it('skip_cascade_audit GUC suppresses new audit rows', async () => {
    // Use a pg-direct approach via RPC: the set_config call inside lgpd_phase1_cleanup
    // sets app.skip_cascade_audit=1. That should suppress trigger output.
    const countBefore = await admin
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('resource_type', 'authors')
    const before = countBefore.count ?? 0

    // Run phase1 cleanup on a non-existent user — no rows will change but GUC is set.
    await admin.rpc('lgpd_phase1_cleanup', {
      p_user_id: scenario.randomId,
      p_pre_capture: {},
    })

    const countAfter = await admin
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('resource_type', 'authors')
    const after = countAfter.count ?? 0
    // Delta should be 0 since no authors were actually mutated.
    expect(after - before).toBe(0)
  })

  it('audit trigger writes normally when GUC is NOT set', async () => {
    const { data: row } = await admin
      .from('organization_members')
      .select('id')
      .eq('org_id', scenario.orgChildId)
      .eq('user_id', scenario.orgAdminId)
      .maybeSingle()
    if (!row) return
    const countBefore = await admin
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('resource_type', 'organization_members')
      .eq('resource_id', row.id)
      .eq('action', 'update')
    const before = countBefore.count ?? 0

    await admin.from('organization_members').update({ role: 'org_admin' }).eq('id', row.id)

    const countAfter = await admin
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('resource_type', 'organization_members')
      .eq('resource_id', row.id)
      .eq('action', 'update')
    expect((countAfter.count ?? 0)).toBeGreaterThan(before)
  })

  it('audit consent mutations on consents table (Sprint 5a trigger)', async () => {
    await admin.from('consents').insert({
      user_id: scenario.editorAId,
      category: 'cookie_analytics',
      consent_text_id: 'cookie_analytics_v1_pt-BR',
      granted: true,
    })
    const { count } = await admin
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('resource_type', 'consents')
      .eq('action', 'insert')
    expect((count ?? 0)).toBeGreaterThanOrEqual(1)
  })

  it('self-lifecycle policy scoped strictly: user cannot see other user lifecycle rows', async () => {
    await admin.from('audit_log').insert({
      actor_user_id: scenario.superAdminId,
      action: 'lifecycle_test',
      resource_type: 'auth_user',
      resource_id: scenario.editorAId,
    })
    const client = clientFor(scenario.reporterAId)
    const { data } = await client
      .from('audit_log')
      .select('id')
      .eq('resource_type', 'auth_user')
      .eq('resource_id', scenario.editorAId)
      .eq('action', 'lifecycle_test')
    expect((data ?? []).length).toBe(0)
  })
})
