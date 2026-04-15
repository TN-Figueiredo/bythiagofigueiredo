import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, ANON_KEY, SERVICE_KEY, PG_URL, adminJwt } from '../helpers/local-supabase'
import { ensureSharedSites, SHARED_SITE_A_ID as SITE_A, SHARED_SITE_B_ID as SITE_B } from '../helpers/ring-fixtures'

async function insertOne<T extends { id: string }>(
  query: PromiseLike<{ data: T | null; error: unknown }>,
  label: string
): Promise<T> {
  const { data, error } = await query
  if (error || !data) throw error ?? new Error(`${label}: insert returned no row`)
  return data
}

describe.skipIf(skipIfNoLocalDb())('RLS: blog_posts + blog_translations + authors', () => {
  const service = createClient(SUPABASE_URL, SERVICE_KEY)
  const anon = createClient(SUPABASE_URL, ANON_KEY)
  const admin = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${adminJwt()}` } },
  })

  let authorId: string
  let publishedId: string
  let draftId: string
  let postSiteAId: string
  let postSiteBId: string
  let trNullId: string
  let trSiteAId: string
  let trSiteBId: string

  beforeAll(async () => {
    await service.from('blog_translations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await service.from('blog_posts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await service.from('authors').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Ensure SITE_A and SITE_B exist to satisfy blog_posts.site_id FK.
    await ensureSharedSites(service)

    // Test-unique slug to reduce races with seed.test.ts, which concurrently
    // re-applies supabase/seeds/dev.sql (inserting a 'thiago' author).
    const uniqueSlug = `rls-author-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    authorId = (await insertOne(
      service.from('authors').insert({ name: 'RLS Author', slug: uniqueSlug }).select('id').single(),
      'author'
    )).id

    publishedId = (await insertOne(
      service.from('blog_posts').insert({
        author_id: authorId, status: 'published', published_at: new Date().toISOString(),
      }).select('id').single(),
      'pub'
    )).id

    draftId = (await insertOne(
      service.from('blog_posts').insert({
        author_id: authorId, status: 'draft',
      }).select('id').single(),
      'draft'
    )).id

    postSiteAId = (await insertOne(
      service.from('blog_posts').insert({
        author_id: authorId, status: 'published', published_at: new Date().toISOString(), site_id: SITE_A,
      }).select('id').single(),
      'pA'
    )).id

    postSiteBId = (await insertOne(
      service.from('blog_posts').insert({
        author_id: authorId, status: 'published', published_at: new Date().toISOString(), site_id: SITE_B,
      }).select('id').single(),
      'pB'
    )).id

    trNullId = (await insertOne(
      service.from('blog_translations').insert({
        post_id: publishedId, locale: 'en', title: 'null-site', slug: 'null-site', content_md: 'x',
      }).select('id').single(),
      'tN'
    )).id

    trSiteAId = (await insertOne(
      service.from('blog_translations').insert({
        post_id: postSiteAId, locale: 'en', title: 'site-a', slug: 'site-a', content_md: 'x',
      }).select('id').single(),
      'tA'
    )).id

    trSiteBId = (await insertOne(
      service.from('blog_translations').insert({
        post_id: postSiteBId, locale: 'en', title: 'site-b', slug: 'site-b', content_md: 'x',
      }).select('id').single(),
      'tB'
    )).id
  })

  it('anon sees only published posts', async () => {
    const { data, error } = await anon.from('blog_posts').select('id,status')
    expect(error).toBeNull()
    const ids = (data ?? []).map(r => r.id)
    expect(ids).toContain(publishedId)
    expect(ids).not.toContain(draftId)
  })

  it('anon cannot insert blog_posts', async () => {
    const { error } = await anon.from('blog_posts').insert({ author_id: authorId, status: 'draft' })
    expect(error).not.toBeNull()
  })

  it('super_admin sees all posts', async () => {
    const { data, error } = await admin.from('blog_posts').select('id')
    expect(error).toBeNull()
    const ids = (data ?? []).map(r => r.id)
    expect(ids).toContain(publishedId)
    expect(ids).toContain(draftId)
  })

  it('super_admin can insert/update/delete', async () => {
    const ins = await insertOne(
      admin.from('blog_posts').insert({ author_id: authorId, status: 'draft' }).select('id').single(),
      'admin-insert'
    )
    const { error: ue } = await admin.from('blog_posts')
      .update({ status: 'archived' }).eq('id', ins.id)
    expect(ue).toBeNull()
    const { error: de } = await admin.from('blog_posts').delete().eq('id', ins.id)
    expect(de).toBeNull()
  })

  it('anon can read authors', async () => {
    const { data, error } = await anon.from('authors').select('id')
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('anon cannot insert authors', async () => {
    const { error } = await anon.from('authors').insert({ name: 'x', slug: 'x' })
    expect(error).not.toBeNull()
  })

  // Site-scoping tests go through direct pg (not PostgREST) so we own the
  // connection and can scope `app.site_id` with SET LOCAL inside a transaction.
  // Going through PostgREST would be flaky because its pooled backend
  // connections retain GUCs between requests.
  describe('site_id scoping (app.site_id GUC)', () => {
    let pg: Client

    beforeAll(async () => {
      pg = new Client({ connectionString: PG_URL })
      await pg.connect()
    })

    afterAll(async () => {
      await pg.end()
    })

    async function asAnonWithSite(siteId: string): Promise<{ postIds: string[]; trIds: string[] }> {
      await pg.query('begin')
      try {
        await pg.query('set local role anon')
        await pg.query(`select set_config('app.site_id', $1, true)`, [siteId])
        const posts = await pg.query<{ id: string }>('select id from public.blog_posts')
        const trs = await pg.query<{ id: string }>('select id from public.blog_translations')
        return { postIds: posts.rows.map(r => r.id), trIds: trs.rows.map(r => r.id) }
      } finally {
        await pg.query('rollback')
      }
    }

    async function asAnonNoSite(): Promise<{ postIds: string[]; trIds: string[] }> {
      await pg.query('begin')
      try {
        await pg.query('set local role anon')
        // intentionally no set_config — exercises current_setting(..., true) returning null
        const posts = await pg.query<{ id: string }>('select id from public.blog_posts')
        const trs = await pg.query<{ id: string }>('select id from public.blog_translations')
        return { postIds: posts.rows.map(r => r.id), trIds: trs.rows.map(r => r.id) }
      } finally {
        await pg.query('rollback')
      }
    }

    it('anon with GUC never set (missing_ok path) sees null + both site posts', async () => {
      const { postIds } = await asAnonNoSite()
      expect(postIds).toContain(publishedId)
      expect(postIds).toContain(postSiteAId)
      expect(postIds).toContain(postSiteBId)
      expect(postIds).not.toContain(draftId)
    })

    it('anon with empty app.site_id sees null-site AND site-scoped posts (backward compat)', async () => {
      await pg.query('begin')
      try {
        await pg.query('set local role anon')
        await pg.query(`select set_config('app.site_id', '', true)`)
        const posts = await pg.query<{ id: string }>('select id from public.blog_posts')
        const ids = posts.rows.map(r => r.id)
        expect(ids).toContain(publishedId)
        expect(ids).toContain(postSiteAId)
        expect(ids).toContain(postSiteBId)
        expect(ids).not.toContain(draftId)
      } finally {
        await pg.query('rollback')
      }
    })

    it('anon with app.site_id = siteA sees null-site + siteA, not siteB', async () => {
      const { postIds } = await asAnonWithSite(SITE_A)
      expect(postIds).toContain(publishedId)
      expect(postIds).toContain(postSiteAId)
      expect(postIds).not.toContain(postSiteBId)
      expect(postIds).not.toContain(draftId)
    })

    it('anon with app.site_id = siteA sees translations only for visible posts', async () => {
      const { trIds } = await asAnonWithSite(SITE_A)
      expect(trIds).toContain(trNullId)
      expect(trIds).toContain(trSiteAId)
      expect(trIds).not.toContain(trSiteBId)
    })

    it('anon with app.site_id = siteB sees null-site + siteB, not siteA', async () => {
      const { postIds } = await asAnonWithSite(SITE_B)
      expect(postIds).toContain(publishedId)
      expect(postIds).toContain(postSiteBId)
      expect(postIds).not.toContain(postSiteAId)
      expect(postIds).not.toContain(draftId)
    })

    it('staff sees every site regardless of app.site_id (is_staff OR bypasses site filter)', async () => {
      const { data, error } = await admin.from('blog_posts').select('id')
      expect(error).toBeNull()
      const ids = (data ?? []).map(r => r.id)
      expect(ids).toContain(publishedId)
      expect(ids).toContain(postSiteAId)
      expect(ids).toContain(postSiteBId)
      expect(ids).toContain(draftId)
    })
  })
})

describe.skipIf(skipIfNoLocalDb())('blog_posts site_id FK', () => {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  it('rejects blog_posts with non-existent site_id', async () => {
    const { data: a } = await admin.from('authors')
      .insert({ name: 'T', slug: `t-${Date.now()}` }).select('id').single()
    const { error } = await admin.from('blog_posts').insert({
      author_id: a!.id,
      status: 'draft',
      site_id: '99999999-9999-9999-9999-999999999999',
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/foreign key|violates/i)
  })

  // NOT NULL enforcement deferred to a later migration after seed backfills.
})
