import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'
import { makeOrg, makeSite, makeMembership } from '../helpers/ring-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const SEED_USER = '00000000-0000-0000-0000-000000000001'

describe.skipIf(skipIfNoLocalDb())('ring RLS helpers', () => {
  const orgIds: string[] = []
  const siteIds: string[] = []
  afterAll(async () => {
    if (siteIds.length) await admin.from('sites').delete().in('id', siteIds)
    if (orgIds.length) await admin.from('organizations').delete().in('id', orgIds)
  })

  it('org_role returns membership role for matching user', async () => {
    const orgId = await makeOrg(admin, orgIds)
    await makeMembership(admin, orgId, SEED_USER, 'editor')
    const { data, error } = await admin.rpc('org_role_for_user', {
      p_org_id: orgId, p_user_id: SEED_USER,
    })
    expect(error).toBeNull()
    expect(data).toBe('editor')
  })

  it('org_role returns null for non-member', async () => {
    const orgId = await makeOrg(admin, orgIds)
    const { data, error } = await admin.rpc('org_role_for_user', {
      p_org_id: orgId, p_user_id: SEED_USER,
    })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('can_admin_site: member of site org → true', async () => {
    const orgId = await makeOrg(admin, orgIds)
    const siteId = await makeSite(admin, siteIds, orgId)
    await makeMembership(admin, orgId, SEED_USER, 'admin')
    const { data } = await admin.rpc('can_admin_site_for_user', {
      p_site_id: siteId, p_user_id: SEED_USER,
    })
    expect(data).toBe(true)
  })

  it('can_admin_site: non-member → false', async () => {
    const orgId = await makeOrg(admin, orgIds)
    const siteId = await makeSite(admin, siteIds, orgId)
    const { data } = await admin.rpc('can_admin_site_for_user', {
      p_site_id: siteId, p_user_id: SEED_USER,
    })
    expect(data).toBe(false)
  })

  it('can_admin_site: member of parent ring → true (cascade up)', async () => {
    const masterOrgId = await makeOrg(admin, orgIds)
    const childOrgId = await makeOrg(admin, orgIds, { parentOrgId: masterOrgId })
    const childSiteId = await makeSite(admin, siteIds, childOrgId)
    await makeMembership(admin, masterOrgId, SEED_USER, 'owner')
    const { data } = await admin.rpc('can_admin_site_for_user', {
      p_site_id: childSiteId, p_user_id: SEED_USER,
    })
    expect(data).toBe(true)
  })

  it('can_admin_site: author role → false (not staff)', async () => {
    const orgId = await makeOrg(admin, orgIds)
    const siteId = await makeSite(admin, siteIds, orgId)
    await makeMembership(admin, orgId, SEED_USER, 'author')
    const { data } = await admin.rpc('can_admin_site_for_user', {
      p_site_id: siteId, p_user_id: SEED_USER,
    })
    expect(data).toBe(false)
  })
})

describe.skipIf(skipIfNoLocalDb())('is_org_staff', () => {
  const orgIds: string[] = []
  afterAll(async () => {
    if (orgIds.length) await admin.from('organizations').delete().in('id', orgIds)
  })

  // Note: is_org_staff uses auth.uid() internally — we test the contract
  // transitively through can_admin_site_for_user in this suite. But we add
  // a signature/plumbing test here to detect if the function is dropped.
  it('is_org_staff RPC exists and returns non-staff for service role context', async () => {
    const orgId = await makeOrg(admin, orgIds)
    const { data, error } = await admin.rpc('is_org_staff', { p_org_id: orgId })
    expect(error).toBeNull()
    // Service role context → auth.uid() returns null → no membership row.
    // is_org_staff wraps the result in coalesce(..., false) so it always
    // returns a concrete boolean.
    expect(data).toBe(false)
  })
})
