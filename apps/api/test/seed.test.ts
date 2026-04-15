import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from './helpers/db-skip'
import { PG_URL, SUPABASE_URL, SERVICE_KEY } from './helpers/local-supabase'

describe.skipIf(skipIfNoLocalDb())('seed dev.sql', () => {
  const db = new Client({ connectionString: PG_URL })
  beforeAll(async () => {
    await db.connect()
    const sql = readFileSync(resolve(__dirname, '../../../supabase/seeds/dev.sql'), 'utf8')
    await db.query(sql)
  })
  afterAll(async () => { await db.end() })

  it('seeds thiago super_admin user', async () => {
    const { rows } = await db.query(
      `select raw_app_meta_data->>'role' as role from auth.users where email='thiago@bythiagofigueiredo.com'`
    )
    expect(rows[0]?.role).toBe('super_admin')
  })

  it('seeds author linked to user', async () => {
    const { rows } = await db.query(`select slug from public.authors where slug='thiago'`)
    expect(rows).toHaveLength(1)
  })

  it('seeds 3 blog posts with at least one published', async () => {
    const { rows: posts } = await db.query(`select status from public.blog_posts`)
    expect(posts.length).toBeGreaterThanOrEqual(3)
    expect(posts.some(p => p.status === 'published')).toBe(true)
  })

  it('seeds pt-BR + en translations for at least one post', async () => {
    const { rows } = await db.query(`
      select post_id, count(*)::int as n
      from public.blog_translations group by post_id having count(*) >= 2
    `)
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })
})

describe.skipIf(skipIfNoLocalDb())('seed: master ring + bythiagofigueiredo site', () => {
  // Re-apply the seed so assertions don't depend on earlier tests that truncate
  // blog_posts / campaigns (e.g. blog.test.ts, campaigns.test.ts).
  const db = new Client({ connectionString: PG_URL })
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)
  beforeAll(async () => {
    await db.connect()
    const sql = readFileSync(resolve(__dirname, '../../../supabase/seeds/dev.sql'), 'utf8')
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
    const { data: org } = await admin.from('organizations').select('id').eq('slug', 'figueiredo-tech').maybeSingle()
    const { data: site } = await admin.from('sites').select('id').eq('org_id', org!.id).eq('slug', 'bythiagofigueiredo').maybeSingle()
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
