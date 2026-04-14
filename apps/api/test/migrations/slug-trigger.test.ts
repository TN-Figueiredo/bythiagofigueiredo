import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'

const DB_URL = 'postgres://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('trigger validate_translation_slug_unique_per_site', () => {
  const db = new Client({ connectionString: DB_URL })
  beforeAll(async () => { await db.connect() })
  afterAll(async () => { await db.end() })

  it('blocks duplicate (site, locale, slug)', async () => {
    await db.query(`insert into public.authors(name,slug) values('T','tslug') on conflict do nothing`)
    const { rows: [a] } = await db.query(`select id from public.authors where slug='tslug'`)
    const site = '11111111-1111-1111-1111-111111111111'
    const { rows: [p1] } = await db.query(
      `insert into public.blog_posts(author_id, site_id) values ($1,$2) returning id`, [a.id, site]
    )
    const { rows: [p2] } = await db.query(
      `insert into public.blog_posts(author_id, site_id) values ($1,$2) returning id`, [a.id, site]
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
    const { rows: [a] } = await db.query(`select id from public.authors where slug='tslug'`)
    const site = '22222222-2222-2222-2222-222222222222'
    const { rows: [p] } = await db.query(
      `insert into public.blog_posts(author_id, site_id) values ($1,$2) returning id`, [a.id, site]
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
