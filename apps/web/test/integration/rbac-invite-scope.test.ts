/**
 * DB-gated integration tests for accept_invitation_atomic(p_token_hash, p_user_id)
 * with role_scope branching (Sprint 4.75 Track A / Task A10).
 *
 * - role_scope='org'  inserts organization_members with role=org_admin and
 *   returns redirect_url=https://bythiagofigueiredo.com/cms/login.
 * - role_scope='site' inserts site_memberships and returns
 *   redirect_url=https://<site.primary_domain>/cms/login.
 * - Expired / revoked / unknown tokens raise P0002.
 * - Idempotent accept: re-invoking the same hash returns invitation_invalid
 *   (because accepted_at is non-null → filtered out).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  seedRbacScenario,
  cleanupRbacScenario,
  insertAuthUser,
  deleteAuthUser,
  type RbacScenario,
} from '../helpers/db-seed'

function hexToken(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex')
}

describe.skipIf(skipIfNoLocalDb())('RBAC v3 accept_invitation_atomic (two-param)', () => {
  let admin: SupabaseClient
  let s: RbacScenario

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    s = await seedRbacScenario(admin)
  })

  afterAll(async () => {
    await cleanupRbacScenario(admin, s)
  })

  async function createInvitation(overrides: {
    role_scope: 'org' | 'site'
    role: 'org_admin' | 'editor' | 'reporter'
    siteId?: string | null
    orgId: string
    expiresInMs?: number
  }): Promise<{ id: string; token: string }> {
    const token = hexToken()
    const expires_at = new Date(Date.now() + (overrides.expiresInMs ?? 24 * 60 * 60 * 1000)).toISOString()
    const { data, error } = await admin
      .from('invitations')
      .insert({
        email: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
        org_id: overrides.orgId,
        site_id: overrides.siteId ?? null,
        role: overrides.role,
        role_scope: overrides.role_scope,
        token,
        invited_by: s.orgAdminId,
        expires_at,
      })
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('createInvitation failed')
    return { id: data.id, token }
  }

  it('org invite creates organization_members row + returns master-ring redirect', async () => {
    const { token } = await createInvitation({
      role_scope: 'org',
      role: 'org_admin',
      orgId: s.orgChildId,
    })
    // Insert throwaway auth user via pg.Client (GoTrue excluded in CI).
    const newUserId = await insertAuthUser(`acceptor-org-${Date.now()}@test`)

    const { data, error } = await admin.rpc('accept_invitation_atomic', {
      p_token_hash: token,
      p_user_id: newUserId,
    })
    expect(error).toBeNull()
    expect(data).toBeTruthy()
    expect((data as { role_scope: string }).role_scope).toBe('org')
    expect((data as { redirect_url: string }).redirect_url).toContain('bythiagofigueiredo.com')

    const { data: om } = await admin
      .from('organization_members')
      .select('role')
      .eq('org_id', s.orgChildId)
      .eq('user_id', newUserId)
      .single()
    expect(om!.role).toBe('org_admin')

    await deleteAuthUser(newUserId)
  })

  it('site invite creates site_memberships row + returns site.primary_domain redirect', async () => {
    const { token } = await createInvitation({
      role_scope: 'site',
      role: 'editor',
      orgId: s.orgChildId,
      siteId: s.siteAId,
    })
    const newUserId = await insertAuthUser(`acceptor-site-${Date.now()}@test`)

    const { data, error } = await admin.rpc('accept_invitation_atomic', {
      p_token_hash: token,
      p_user_id: newUserId,
    })
    expect(error).toBeNull()
    expect((data as { role_scope: string }).role_scope).toBe('site')
    const redirect = (data as { redirect_url: string }).redirect_url
    const { data: site } = await admin.from('sites').select('primary_domain').eq('id', s.siteAId).single()
    expect(redirect).toContain(site!.primary_domain)
    expect(redirect).toMatch(/^https:\/\//)

    const { data: sm } = await admin
      .from('site_memberships')
      .select('role')
      .eq('site_id', s.siteAId)
      .eq('user_id', newUserId)
      .single()
    expect(sm!.role).toBe('editor')

    await deleteAuthUser(newUserId)
  })

  it('unknown token raises P0002 (invitation_invalid)', async () => {
    const fakeHash = hexToken()
    const { error } = await admin.rpc('accept_invitation_atomic', {
      p_token_hash: fakeHash,
      p_user_id: s.randomId,
    })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('P0002')
  })

  it('expired token raises P0002', async () => {
    const { token } = await createInvitation({
      role_scope: 'org',
      role: 'org_admin',
      orgId: s.orgChildId,
      expiresInMs: -60_000, // already expired 1min ago
    })
    const { error } = await admin.rpc('accept_invitation_atomic', {
      p_token_hash: token,
      p_user_id: s.randomId,
    })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('P0002')
  })

  it('already-accepted invitation cannot be re-accepted (P0002)', async () => {
    const { token } = await createInvitation({
      role_scope: 'site',
      role: 'reporter',
      orgId: s.orgChildId,
      siteId: s.siteAId,
    })
    const newUserId = await insertAuthUser(`acceptor-again-${Date.now()}@test`)

    const first = await admin.rpc('accept_invitation_atomic', {
      p_token_hash: token,
      p_user_id: newUserId,
    })
    expect(first.error).toBeNull()

    const second = await admin.rpc('accept_invitation_atomic', {
      p_token_hash: token,
      p_user_id: newUserId,
    })
    expect(second.error).not.toBeNull()
    expect(second.error!.code).toBe('P0002')

    await deleteAuthUser(newUserId)
  })

  it('invitations scope CHECK rejects org-scope with a non-null site_id', async () => {
    // The inv_scope_check constraint says role_scope='org' AND site_id IS NULL.
    const { error } = await admin.from('invitations').insert({
      email: `bad-scope-${Date.now()}@test`,
      org_id: s.orgChildId,
      site_id: s.siteAId, // illegal for org scope
      role: 'org_admin',
      role_scope: 'org',
      token: hexToken(),
      invited_by: s.orgAdminId,
    })
    expect(error).not.toBeNull()
    // 23514 = check_violation
    expect(error!.code).toBe('23514')
  })
})
