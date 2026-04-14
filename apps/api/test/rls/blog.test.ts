import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import jwt from 'jsonwebtoken'
import { skipIfNoLocalDb, getLocalJwtSecret } from '../helpers/db-skip'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const SITE_A = '11111111-1111-1111-1111-111111111111'
const SITE_B = '22222222-2222-2222-2222-222222222222'

function adminJwt(): string {
  return jwt.sign(
    {
      role: 'authenticated',
      sub: '00000000-0000-0000-0000-000000000001',
      app_metadata: { role: 'super_admin' },
    },
    getLocalJwtSecret(),
    { expiresIn: '1h' }
  )
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

    // Test-unique slug to reduce races with seed.test.ts, which concurrently
    // re-applies supabase/seeds/dev.sql (inserting a 'thiago' author).
    const uniqueSlug = `rls-author-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const { data: a, error: aErr } = await service.from('authors')
      .insert({ name: 'RLS Author', slug: uniqueSlug }).select('id').single()
    if (aErr || !a) throw aErr ?? new Error('author insert returned no row')
    authorId = a.id

    const { data: pub } = await service.from('blog_posts').insert({
      author_id: authorId, status: 'published', published_at: new Date().toISOString(),
    }).select('id').single()
    publishedId = pub!.id

    const { data: draft } = await service.from('blog_posts').insert({
      author_id: authorId, status: 'draft',
    }).select('id').single()
    draftId = draft!.id

    const { data: pA } = await service.from('blog_posts').insert({
      author_id: authorId, status: 'published', published_at: new Date().toISOString(), site_id: SITE_A,
    }).select('id').single()
    postSiteAId = pA!.id

    const { data: pB } = await service.from('blog_posts').insert({
      author_id: authorId, status: 'published', published_at: new Date().toISOString(), site_id: SITE_B,
    }).select('id').single()
    postSiteBId = pB!.id

    const { data: tN } = await service.from('blog_translations').insert({
      post_id: publishedId, locale: 'en', title: 'null-site', slug: 'null-site', content_md: 'x',
    }).select('id').single()
    trNullId = tN!.id

    const { data: tA } = await service.from('blog_translations').insert({
      post_id: postSiteAId, locale: 'en', title: 'site-a', slug: 'site-a', content_md: 'x',
    }).select('id').single()
    trSiteAId = tA!.id

    const { data: tB } = await service.from('blog_translations').insert({
      post_id: postSiteBId, locale: 'en', title: 'site-b', slug: 'site-b', content_md: 'x',
    }).select('id').single()
    trSiteBId = tB!.id
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
    const { data: ins, error: ie } = await admin.from('blog_posts')
      .insert({ author_id: authorId, status: 'draft' }).select('id').single()
    expect(ie).toBeNull()
    const { error: ue } = await admin.from('blog_posts')
      .update({ status: 'archived' }).eq('id', ins!.id)
    expect(ue).toBeNull()
    const { error: de } = await admin.from('blog_posts').delete().eq('id', ins!.id)
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
      pg = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' })
      await pg.connect()
    })

    afterAll(async () => {
      await pg.end()
    })

    async function asAnonWithSite(siteId: string | null): Promise<{ postIds: string[]; trIds: string[] }> {
      await pg.query('begin')
      try {
        await pg.query('set local role anon')
        if (siteId === null) {
          await pg.query(`select set_config('app.site_id', '', true)`)
        } else {
          await pg.query(`select set_config('app.site_id', $1, true)`, [siteId])
        }
        const posts = await pg.query<{ id: string }>('select id from public.blog_posts')
        const trs = await pg.query<{ id: string }>('select id from public.blog_translations')
        return { postIds: posts.rows.map(r => r.id), trIds: trs.rows.map(r => r.id) }
      } finally {
        await pg.query('rollback')
      }
    }

    it('anon with GUC never set (missing_ok path) sees null + both site posts', async () => {
      const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' })
      await client.connect()
      try {
        await client.query('begin')
        await client.query(`set local role anon`)
        // intentionally no set_config — exercises current_setting(..., true) returning null
        const { rows } = await client.query<{ id: string; site_id: string | null }>(
          `select id, site_id from public.blog_posts where status='published'`
        )
        const ids = rows.map(r => r.id)
        expect(ids).toContain(publishedId)
        expect(ids).toContain(postSiteAId)
        expect(ids).toContain(postSiteBId)
        expect(ids).not.toContain(draftId)
        await client.query('rollback')
      } finally { await client.end() }
    })

    it('anon without app.site_id sees null-site AND site-scoped posts (backward compat)', async () => {
      const { postIds } = await asAnonWithSite(null)
      expect(postIds).toContain(publishedId)
      expect(postIds).toContain(postSiteAId)
      expect(postIds).toContain(postSiteBId)
      expect(postIds).not.toContain(draftId)
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
  })
})
