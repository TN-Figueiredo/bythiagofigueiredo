import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

describe.skipIf(skipIfNoLocalDb())('organizations + sites schema', () => {
  const orgIds: string[] = []
  afterAll(async () => {
    if (orgIds.length) await admin.from('organizations').delete().in('id', orgIds)
  })

  it('insert minimal organization', async () => {
    const { data, error } = await admin.from('organizations')
      .insert({ name: 'Test Org', slug: `test-${Date.now()}` })
      .select().single()
    expect(error).toBeNull()
    expect(data?.parent_org_id).toBeNull()
    if (data?.id) orgIds.push(data.id)
  })

  it('organization with parent (child ring)', async () => {
    const { data: parent } = await admin.from('organizations')
      .insert({ name: 'Parent', slug: `parent-${Date.now()}` }).select('id').single()
    if (parent?.id) orgIds.push(parent.id)
    const { data: child, error } = await admin.from('organizations')
      .insert({ name: 'Child', slug: `child-${Date.now()}`, parent_org_id: parent!.id })
      .select().single()
    expect(error).toBeNull()
    expect(child?.parent_org_id).toBe(parent!.id)
    if (child?.id) orgIds.push(child.id)
  })

  it('organization_members enforces unique (org_id, user_id)', async () => {
    const { data: org } = await admin.from('organizations')
      .insert({ name: 'MemTest', slug: `mem-${Date.now()}` }).select('id').single()
    if (org?.id) orgIds.push(org.id)
    const uid = '00000000-0000-0000-0000-000000000001'
    await admin.from('organization_members').insert({ org_id: org!.id, user_id: uid, role: 'owner' })
    const dup = await admin.from('organization_members').insert({ org_id: org!.id, user_id: uid, role: 'editor' })
    expect(dup.error).not.toBeNull()
  })

  it('organization_members rejects invalid role', async () => {
    const { data: org } = await admin.from('organizations')
      .insert({ name: 'RoleTest', slug: `role-${Date.now()}` }).select('id').single()
    if (org?.id) orgIds.push(org.id)
    const { error } = await admin.from('organization_members').insert({
      org_id: org!.id,
      user_id: '00000000-0000-0000-0000-000000000001',
      role: 'bogus',
    })
    expect(error).not.toBeNull()
  })

  it('sites belong to an org', async () => {
    const { data: org } = await admin.from('organizations')
      .insert({ name: 'SiteOwner', slug: `site-owner-${Date.now()}` }).select('id').single()
    if (org?.id) orgIds.push(org.id)
    const { data: site, error } = await admin.from('sites').insert({
      org_id: org!.id,
      name: 'Test Site',
      slug: `site-${Date.now()}`,
      domains: ['test.example'],
      default_locale: 'pt-BR',
      supported_locales: ['pt-BR', 'en'],
    }).select().single()
    expect(error).toBeNull()
    expect(site?.org_id).toBe(org!.id)
    expect(site?.domains).toContain('test.example')
  })
})
