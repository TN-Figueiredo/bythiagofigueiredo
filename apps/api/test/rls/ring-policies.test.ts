import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY } from '../helpers/local-supabase'
import { makeOrg, makeSite } from '../helpers/ring-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const anon = createClient(SUPABASE_URL, ANON_KEY)

describe.skipIf(skipIfNoLocalDb())('ring tables RLS', () => {
  const orgIds: string[] = []
  const siteIds: string[] = []
  afterAll(async () => {
    if (siteIds.length) await admin.from('sites').delete().in('id', siteIds)
    if (orgIds.length) await admin.from('organizations').delete().in('id', orgIds)
  })

  it('anon can read organizations (public)', async () => {
    await makeOrg(admin, orgIds, { slug: `anon-read-${Date.now()}` })
    const { data, error } = await anon.from('organizations').select('id,name')
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('anon cannot write to organizations', async () => {
    const { error } = await anon.from('organizations').insert({
      name: 'hack', slug: `hack-${Date.now()}`,
    })
    expect(error).not.toBeNull()
  })

  it('anon can read sites (needed for hostname resolution)', async () => {
    const orgId = await makeOrg(admin, orgIds)
    await makeSite(admin, siteIds, orgId, { domains: ['public.example'] })
    const { data, error } = await anon.from('sites').select('id,domains')
    expect(error).toBeNull()
    expect((data ?? []).some((s) => (s.domains as string[]).includes('public.example'))).toBe(true)
  })

  it('anon cannot read organization_members (PII)', async () => {
    const { data } = await anon.from('organization_members').select('id')
    expect((data ?? []).length).toBe(0)
  })

  it('service role bypasses all policies', async () => {
    const { data, error } = await admin.from('organization_members').select('id')
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})
