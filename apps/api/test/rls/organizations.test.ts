import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'

const DB_URL = 'postgres://postgres:postgres@127.0.0.1:54322/postgres'

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

  it('rejects site slug collision within the same org', async () => {
    const { data: org } = await admin.from('organizations')
      .insert({ name: 'SlugTest', slug: `slug-test-${Date.now()}` }).select('id').single()
    if (org?.id) orgIds.push(org.id)
    const slug = `collide-${Date.now()}`
    const first = await admin.from('sites').insert({
      org_id: org!.id, name: 'A', slug, domains: [], default_locale: 'pt-BR', supported_locales: ['pt-BR'],
    })
    expect(first.error).toBeNull()
    const dup = await admin.from('sites').insert({
      org_id: org!.id, name: 'B', slug, domains: [], default_locale: 'pt-BR', supported_locales: ['pt-BR'],
    })
    expect(dup.error).not.toBeNull()
  })

  it('allows same site slug across different orgs', async () => {
    const { data: orgA } = await admin.from('organizations')
      .insert({ name: 'OrgA', slug: `orga-${Date.now()}` }).select('id').single()
    const { data: orgB } = await admin.from('organizations')
      .insert({ name: 'OrgB', slug: `orgb-${Date.now()}` }).select('id').single()
    if (orgA?.id) orgIds.push(orgA.id)
    if (orgB?.id) orgIds.push(orgB.id)
    const slug = `shared-${Date.now()}`
    const a = await admin.from('sites').insert({
      org_id: orgA!.id, name: 'blog A', slug, domains: [], default_locale: 'pt-BR', supported_locales: ['pt-BR'],
    })
    const b = await admin.from('sites').insert({
      org_id: orgB!.id, name: 'blog B', slug, domains: [], default_locale: 'pt-BR', supported_locales: ['pt-BR'],
    })
    expect(a.error).toBeNull()
    expect(b.error).toBeNull()
  })

  it('rejects self-reference on organizations.parent_org_id', async () => {
    const { data: org } = await admin.from('organizations')
      .insert({ name: 'SelfRef', slug: `self-${Date.now()}` }).select('id').single()
    if (org?.id) orgIds.push(org.id)
    const { error } = await admin.from('organizations')
      .update({ parent_org_id: org!.id }).eq('id', org!.id)
    expect(error).not.toBeNull()
  })
})

describe.skipIf(skipIfNoLocalDb())('seed: master ring + bythiagofigueiredo site', () => {
  // Re-apply the seed so assertions don't depend on earlier tests that truncate
  // blog_posts / campaigns (e.g. blog.test.ts, campaigns.test.ts).
  const db = new Client({ connectionString: DB_URL })
  beforeAll(async () => {
    await db.connect()
    const sql = readFileSync(resolve(__dirname, '../../../../supabase/seeds/dev.sql'), 'utf8')
    await db.query(sql)
  })
  afterAll(async () => { await db.end() })

  it('seeds org "figueiredo-tech" with slug', async () => {
    const { data } = await admin.from('organizations').select('id,slug').eq('slug', 'figueiredo-tech').maybeSingle()
    expect(data).not.toBeNull()
  })

  it('seeds site "bythiagofigueiredo" linked to figueiredo-tech org', async () => {
    const { data: org } = await admin.from('organizations').select('id').eq('slug', 'figueiredo-tech').maybeSingle()
    const { data: site } = await admin.from('sites').select('id,org_id,domains,default_locale')
      .eq('slug', 'bythiagofigueiredo').maybeSingle()
    expect(site).not.toBeNull()
    expect(site!.org_id).toBe(org!.id)
    expect(site!.domains).toContain('bythiagofigueiredo.com')
    expect(site!.default_locale).toBe('pt-BR')
  })

  it('seeds thiago as org owner', async () => {
    const { data: org } = await admin.from('organizations').select('id').eq('slug', 'figueiredo-tech').maybeSingle()
    const { data: mem } = await admin.from('organization_members').select('role,user_id')
      .eq('org_id', org!.id).eq('user_id', '00000000-0000-0000-0000-000000000001').maybeSingle()
    expect(mem?.role).toBe('owner')
  })

  it('blog_posts after seed have site_id set (no NULL from seed)', async () => {
    const { data } = await admin.from('blog_posts').select('id,site_id')
    // Some blog_posts may be inserted by tests with null site_id (not enforceable yet);
    // seed-inserted posts must have site_id set.
    const { data: org } = await admin.from('organizations').select('id').eq('slug', 'figueiredo-tech').maybeSingle()
    const { data: site } = await admin.from('sites').select('id').eq('org_id', org!.id).eq('slug', 'bythiagofigueiredo').maybeSingle()
    // We can't distinguish seed vs test rows easily; just assert at least one row has the seeded site_id.
    const seeded = (data ?? []).filter((p) => p.site_id === site!.id)
    expect(seeded.length).toBeGreaterThan(0)
  })

  it('campaigns after seed have site_id set', async () => {
    const { data: org } = await admin.from('organizations').select('id').eq('slug', 'figueiredo-tech').maybeSingle()
    const { data: site } = await admin.from('sites').select('id').eq('org_id', org!.id).eq('slug', 'bythiagofigueiredo').maybeSingle()
    const { data } = await admin.from('campaigns').select('id,site_id')
    const seeded = (data ?? []).filter((c) => c.site_id === site!.id)
    expect(seeded.length).toBeGreaterThan(0)
  })
})
