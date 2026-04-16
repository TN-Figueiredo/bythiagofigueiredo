/**
 * DB-gated integration tests for the audit_log trigger (Sprint 4.75 / Task A10).
 *
 * Each mutation (INSERT/UPDATE/DELETE) on organization_members,
 * site_memberships, and invitations writes a row to public.audit_log. The
 * audit_log itself has RLS: only super_admin and org_admin for the row's
 * org_id may read.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  ANON_KEY,
  SERVICE_KEY,
  seedRbacScenario,
  cleanupRbacScenario,
  signUserJwt,
  type RbacScenario,
} from '../helpers/db-seed'

function clientFor(userId: string): SupabaseClient {
  const { jwt } = signUserJwt(userId)
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}

function randomToken(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex')
}

describe.skipIf(skipIfNoLocalDb())('RBAC v3 audit_log', () => {
  let admin: SupabaseClient
  let s: RbacScenario

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    s = await seedRbacScenario(admin)
  })

  afterAll(async () => {
    await cleanupRbacScenario(admin, s)
  })

  it('INSERT on organization_members writes audit row', async () => {
    const { count: before } = await admin
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('resource_type', 'organization_members')
      .eq('action', 'insert')

    // Seed already inserted 2 org_members rows (super_admin + org_admin).
    // New ad-hoc insert would require creating a new auth user + master ring
    // slot, which violates the single-master index. Verify instead that the
    // seed-time inserts are already audited.
    expect(before ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('UPDATE on organization_members writes audit row', async () => {
    // Update the child org's row: toggle role back to itself (no-op column) to
    // fire the trigger (UPDATE always fires regardless of OLD vs NEW).
    const { data: row } = await admin
      .from('organization_members')
      .select('id')
      .eq('org_id', s.orgChildId)
      .eq('user_id', s.orgAdminId)
      .single()
    await admin.from('organization_members').update({ role: 'org_admin' }).eq('id', row!.id)
    const { count } = await admin
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('resource_type', 'organization_members')
      .eq('action', 'update')
      .eq('resource_id', row!.id)
    expect((count ?? 0)).toBeGreaterThanOrEqual(1)
  })

  it('DELETE on site_memberships writes audit row', async () => {
    // Delete reporter-A's siteA membership and verify audit row appears.
    const { data: sm } = await admin
      .from('site_memberships')
      .select('id')
      .eq('site_id', s.siteAId)
      .eq('user_id', s.reporterAId)
      .single()
    await admin.from('site_memberships').delete().eq('id', sm!.id)
    const { count } = await admin
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('resource_type', 'site_memberships')
      .eq('action', 'delete')
      .eq('resource_id', sm!.id)
    expect((count ?? 0)).toBeGreaterThanOrEqual(1)

    // Re-seed so later tests in afterAll cleanup don't explode.
    await admin.from('site_memberships').insert({
      site_id: s.siteAId,
      user_id: s.reporterAId,
      role: 'reporter',
    })
  })

  it('invitations INSERT/UPDATE/DELETE all write audit rows', async () => {
    const tokenA = randomToken()
    const { data: inv, error: insErr } = await admin
      .from('invitations')
      .insert({
        email: `audit-inv-${Date.now()}@test`,
        org_id: s.orgChildId,
        role: 'org_admin',
        role_scope: 'org',
        token: tokenA,
        invited_by: s.orgAdminId,
      })
      .select('id')
      .single()
    expect(insErr).toBeNull()

    await admin.from('invitations').update({ resend_count: 1 }).eq('id', inv!.id)
    await admin.from('invitations').delete().eq('id', inv!.id)

    const { data: actions } = await admin
      .from('audit_log')
      .select('action')
      .eq('resource_type', 'invitations')
      .eq('resource_id', inv!.id)
    const kinds = new Set((actions ?? []).map((a) => a.action))
    expect(kinds.has('insert')).toBe(true)
    expect(kinds.has('update')).toBe(true)
    expect(kinds.has('delete')).toBe(true)
  })

  it('audit_log RLS: random user sees zero rows', async () => {
    const c = clientFor(s.randomId)
    const { data, error } = await c.from('audit_log').select('id').limit(5)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('audit_log RLS: org_admin (child) sees rows tagged with orgChildId', async () => {
    const c = clientFor(s.orgAdminId)
    const { data, error } = await c
      .from('audit_log')
      .select('org_id')
      .eq('org_id', s.orgChildId)
      .limit(50)
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('audit_log RLS: super_admin sees cross-org rows', async () => {
    const c = clientFor(s.superAdminId)
    const { data, error } = await c
      .from('audit_log')
      .select('org_id')
      .in('org_id', [s.orgMasterId, s.orgChildId])
      .limit(50)
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })
})
