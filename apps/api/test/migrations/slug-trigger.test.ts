import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { PG_URL, SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'
import {
  ensureSharedSites,
  SHARED_SITE_A_ID as SITE_A,
  SHARED_SITE_B_ID as SITE_B,
} from '../helpers/ring-fixtures'

// Per-run unique author slug to avoid collisions with blog.test.ts, which wipes
// authors in beforeAll. fileParallelism is off under HAS_LOCAL_DB, but uniqueness
// keeps this robust against dirty DBs.
const AUTHOR_SLUG = `slug-trigger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describe.skipIf(skipIfNoLocalDb())('trigger validate_translation_slug_unique_per_site', () => {
  const db = new Client({ connectionString: PG_URL })
  let authorId: string

  beforeAll(async () => {
    await db.connect()
    // Use the shared fixture to guarantee SITE_A/SITE_B exist without clobbering
    // another suite's org_id (they all upsert to the same SHARED_RING_ORG_ID).
    await ensureSharedSites(createClient(SUPABASE_URL, SERVICE_KEY))
    const { rows: [a] } = await db.query(
      `insert into public.authors(name, slug) values('T', $1) returning id`,
      [AUTHOR_SLUG]
    )
    authorId = a.id
  })

  afterAll(async () => {
    // Clean up only this suite's rows; the shared org+sites persist by design.
    await db.query(
      `delete from public.blog_translations
         where post_id in (select id from public.blog_posts where author_id = $1)`,
      [authorId]
    )
    await db.query(`delete from public.blog_posts where author_id = $1`, [authorId])
    await db.query(`delete from public.authors where id = $1`, [authorId])
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
