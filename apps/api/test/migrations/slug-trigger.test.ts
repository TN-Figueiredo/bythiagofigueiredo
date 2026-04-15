import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { PG_URL } from '../helpers/local-supabase'

// Per-run unique fixtures so we don't collide with other DB-gated tests
// (blog.test.ts wipes authors in beforeAll, etc.). fileParallelism is already
// off under HAS_LOCAL_DB, but uniqueness keeps this robust even if a run is
// re-ordered or re-run against a dirty DB.
const AUTHOR_SLUG = `slug-trigger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const SITE_A = randomUUID()
const SITE_B = randomUUID()

describe.skipIf(skipIfNoLocalDb())('trigger validate_translation_slug_unique_per_site', () => {
  const db = new Client({ connectionString: PG_URL })
  let authorId: string

  beforeAll(async () => {
    await db.connect()
    const { rows: [a] } = await db.query(
      `insert into public.authors(name, slug) values('T', $1) returning id`,
      [AUTHOR_SLUG]
    )
    authorId = a.id
    // Create an org + two sites with the SITE_A/SITE_B UUIDs to satisfy blog_posts.site_id FK.
    const slugSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const { rows: [org] } = await db.query(
      `insert into public.organizations(name, slug) values($1, $2) returning id`,
      [`Slug Trigger Org ${slugSuffix}`, `slug-trigger-org-${slugSuffix}`]
    )
    await db.query(
      `insert into public.sites(id, org_id, name, slug, domains, default_locale, supported_locales)
       values ($1,$2,'SA',$3,'{}','pt-BR','{pt-BR}'),
              ($4,$2,'SB',$5,'{}','pt-BR','{pt-BR}')`,
      [SITE_A, org.id, `sa-${slugSuffix}`, SITE_B, `sb-${slugSuffix}`]
    )
  })

  afterAll(async () => {
    // Clean up in FK-safe order: translations -> posts -> author -> sites -> org.
    await db.query(
      `delete from public.blog_translations
         where post_id in (select id from public.blog_posts where author_id = $1)`,
      [authorId]
    )
    await db.query(`delete from public.blog_posts where author_id = $1`, [authorId])
    await db.query(`delete from public.authors where id = $1`, [authorId])
    await db.query(`delete from public.sites where id in ($1,$2)`, [SITE_A, SITE_B])
    await db.end()
  })

  it('blocks duplicate (site, locale, slug)', async () => {
    const { rows: [p1] } = await db.query(
      `insert into public.blog_posts(author_id, site_id) values ($1,$2) returning id`, [authorId, SITE_A]
    )
    const { rows: [p2] } = await db.query(
      `insert into public.blog_posts(author_id, site_id) values ($1,$2) returning id`, [authorId, SITE_A]
    )
    await db.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_md)
       values ($1,'pt-BR','t1','dup','c')`, [p1.id]
    )
    await expect(db.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_md)
       values ($1,'pt-BR','t2','dup','c')`, [p2.id]
    )).rejects.toThrow(/slug/i)
  })

  it('allows same slug across different locales', async () => {
    const { rows: [p] } = await db.query(
      `insert into public.blog_posts(author_id, site_id) values ($1,$2) returning id`, [authorId, SITE_B]
    )
    await db.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_md)
       values ($1,'pt-BR','x','same','c')`, [p.id]
    )
    await db.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_md)
       values ($1,'en','x','same','c')`, [p.id]
    )
  })
})
